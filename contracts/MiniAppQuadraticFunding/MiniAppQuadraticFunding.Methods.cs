using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppQuadraticFunding
    {
        #region Round Methods

        public static BigInteger CreateRound(
            UInt160 creator,
            UInt160 asset,
            BigInteger matchingPool,
            BigInteger startTime,
            BigInteger endTime,
            string title,
            string description)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(creator);
            ValidateAsset(asset);
            ValidateTextLimits(title, description);

            ExecutionEngine.Assert(matchingPool > 0, "invalid matching pool");
            ExecutionEngine.Assert(startTime < endTime, "invalid time range");
            ExecutionEngine.Assert(endTime > Runtime.Time, "end time in past");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            if (IsNeo(asset))
            {
                ExecutionEngine.Assert(matchingPool >= MIN_NEO, "min 1 NEO");
            }
            else
            {
                ExecutionEngine.Assert(matchingPool >= MIN_GAS, "min 0.1 GAS");
            }

            ConsumeDirectAssetCredit(asset, creator, matchingPool);

            BigInteger roundId = TotalRounds() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND_ID, roundId);

            // Audit fix NEW-H-8: record the creator's initial matching deposit in
            // the per-funder ledger so CancelRound can refund proportionally.
            Put(BuildMatchingFunderKey(roundId, creator), matchingPool);

            RoundData round = new RoundData
            {
                Creator = creator,
                Asset = asset,
                MatchingPool = matchingPool,
                MatchingAllocated = 0,
                MatchingWithdrawn = 0,
                StartTime = startTime,
                EndTime = endTime,
                CreatedTime = Runtime.Time,
                TotalContributed = 0,
                ProjectCount = 0,
                Finalized = false,
                Cancelled = false,
                Title = title,
                Description = description
            };

            StoreRound(roundId, round);
            AddCreatorRound(creator, roundId);

            OnRoundCreated(roundId, creator, asset, matchingPool);
            return roundId;
        }

        public static void AddMatchingPool(UInt160 contributor, BigInteger roundId, BigInteger amount)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(contributor);
            ExecutionEngine.Assert(amount > 0, "invalid amount");

            RoundData round = GetRound(roundId);
            RequireRoundExists(round);
            ExecutionEngine.Assert(!round.Cancelled, "round cancelled");
            ExecutionEngine.Assert(!round.Finalized, "round finalized");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(contributor), "unauthorized");

            // Audit fix NEW-H-8: track per-funder matching contributions so
            // CancelRound can refund pro-rata instead of paying the entire pool
            // back to the round creator. Without this ledger the creator could
            // pocket matching contributions made by third-party sponsors.
            ConsumeDirectAssetCredit(round.Asset, contributor, amount);

            ByteString funderKey = BuildMatchingFunderKey(roundId, contributor);
            BigInteger existing = GetBigInteger(funderKey);
            Put(funderKey, existing + amount);

            round.MatchingPool += amount;
            StoreRound(roundId, round);

            OnMatchingPoolAdded(roundId, contributor, amount, round.MatchingPool);
        }

        /// <summary>
        /// Refund a single matching-pool funder after a round has been cancelled
        /// (audit fix NEW-H-8). The original CreateRound funder is refunded via
        /// CancelRound; this method handles any additional sponsors who topped up
        /// via AddMatchingPool. Anyone can call it on behalf of an actual funder
        /// once the round is cancelled — it just routes the refund to the
        /// recorded funder address, gas-paid by the caller.
        /// </summary>
        public static void RefundMatchingPoolContribution(UInt160 funder, BigInteger roundId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(funder);

            RoundData round = GetRound(roundId);
            RequireRoundExists(round);
            ExecutionEngine.Assert(round.Cancelled, "round not cancelled");

            ByteString funderKey = BuildMatchingFunderKey(roundId, funder);
            BigInteger owed = GetBigInteger(funderKey);
            ExecutionEngine.Assert(owed > 0, "no matching contribution to refund");
            Delete(funderKey);

            bool transferred = IsNeo(round.Asset)
                ? NEO.Transfer(Runtime.ExecutingScriptHash, funder, owed)
                : GAS.Transfer(Runtime.ExecutingScriptHash, funder, owed);
            ExecutionEngine.Assert(transferred, "refund transfer failed");

            OnMatchingWithdrawn(roundId, funder, owed);
        }

        public static void CancelRound(UInt160 creator, BigInteger roundId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(creator);
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "unauthorized");

            RoundData round = GetRound(roundId);
            RequireRoundExists(round);
            ExecutionEngine.Assert(round.Creator == creator, "not creator");
            ExecutionEngine.Assert(!round.Finalized, "round finalized");
            ExecutionEngine.Assert(!round.Cancelled, "round cancelled");
            ExecutionEngine.Assert(round.TotalContributed == 0, "contributions already made");
            ExecutionEngine.Assert(Runtime.Time < round.StartTime, "round already started");

            // Audit fix NEW-H-8: refund ONLY the creator's recorded matching
            // contribution, not the whole pool. Third-party matching sponsors
            // claim their share separately via RefundMatchingPoolContribution.
            ByteString creatorKey = BuildMatchingFunderKey(roundId, creator);
            BigInteger creatorContribution = GetBigInteger(creatorKey);
            if (creatorContribution > 0) Delete(creatorKey);

            round.Cancelled = true;
            round.MatchingWithdrawn = creatorContribution;
            StoreRound(roundId, round);

            if (creatorContribution > 0)
            {
                bool transferred = IsNeo(round.Asset)
                    ? NEO.Transfer(Runtime.ExecutingScriptHash, creator, creatorContribution)
                    : GAS.Transfer(Runtime.ExecutingScriptHash, creator, creatorContribution);
                ExecutionEngine.Assert(transferred, "transfer failed");
            }

            OnRoundCancelled(roundId, creator);
        }

        public static void FinalizeRound(UInt160 operatorAddress, BigInteger roundId, BigInteger[] projectIds, BigInteger[] matchedAmounts)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(operatorAddress);

            RoundData round = GetRound(roundId);
            RequireRoundExists(round);
            ExecutionEngine.Assert(!round.Cancelled, "round cancelled");
            ExecutionEngine.Assert(!round.Finalized, "round finalized");
            ExecutionEngine.Assert(Runtime.Time >= round.EndTime, "round still active");

            // Audit fix C-2: the round creator can also register their own project and
            // self-contribute, so they MUST NOT be allowed to choose match amounts.
            // Finalization is restricted to platform admin (or the trusted gateway, which
            // forwards from an attested match-computation service). round.Creator is no
            // longer an authorized caller here.
            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            bool authorized = fromGateway || Runtime.CheckWitness(Admin());
            ExecutionEngine.Assert(authorized, "unauthorized");

            ExecutionEngine.Assert(projectIds != null && matchedAmounts != null, "invalid arrays");
            ExecutionEngine.Assert(projectIds.Length == matchedAmounts.Length, "array length mismatch");
            ExecutionEngine.Assert(projectIds.Length > 0, "no projects");

            BigInteger totalMatched = 0;
            for (int i = 0; i < projectIds.Length; i++)
            {
                BigInteger projectId = projectIds[i];
                BigInteger amount = matchedAmounts[i];
                ExecutionEngine.Assert(amount >= 0, "invalid match amount");
                // Reject duplicate projectIds: a repeat re-adds to totalMatched while only the
                // last MatchedAmount write sticks, inflating MatchingAllocated and stranding
                // the difference from ClaimUnusedMatching.
                for (int j = 0; j < i; j++)
                    ExecutionEngine.Assert(projectIds[j] != projectId, "duplicate project");

                ProjectData project = GetProject(projectId);
                RequireProjectExists(project);
                ExecutionEngine.Assert(project.RoundId == roundId, "project mismatch");

                project.MatchedAmount = amount;
                StoreProject(projectId, project);

                totalMatched += amount;
            }

            ExecutionEngine.Assert(totalMatched <= round.MatchingPool, "match exceeds pool");

            round.MatchingAllocated = totalMatched;
            round.Finalized = true;
            StoreRound(roundId, round);

            OnRoundFinalized(roundId, totalMatched);
        }

        public static void ClaimUnusedMatching(UInt160 creator, BigInteger roundId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(creator);
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "unauthorized");

            RoundData round = GetRound(roundId);
            RequireRoundExists(round);
            ExecutionEngine.Assert(round.Creator == creator, "not creator");
            ExecutionEngine.Assert(round.Finalized, "round not finalized");
            ExecutionEngine.Assert(!round.Cancelled, "round cancelled");

            BigInteger unused = round.MatchingPool - round.MatchingAllocated - round.MatchingWithdrawn;
            ExecutionEngine.Assert(unused > 0, "no unused matching");

            round.MatchingWithdrawn += unused;
            StoreRound(roundId, round);

            bool transferred = IsNeo(round.Asset)
                ? NEO.Transfer(Runtime.ExecutingScriptHash, creator, unused)
                : GAS.Transfer(Runtime.ExecutingScriptHash, creator, unused);
            ExecutionEngine.Assert(transferred, "transfer failed");

            OnMatchingWithdrawn(roundId, creator, unused);
        }

        #endregion

    }
}
