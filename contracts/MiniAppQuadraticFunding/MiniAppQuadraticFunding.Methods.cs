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

            bool transferred = IsNeo(asset)
                ? NEO.Transfer(creator, Runtime.ExecutingScriptHash, matchingPool)
                : GAS.Transfer(creator, Runtime.ExecutingScriptHash, matchingPool);
            ExecutionEngine.Assert(transferred, "transfer failed");

            BigInteger roundId = TotalRounds() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND_ID, roundId);

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

            bool transferred = IsNeo(round.Asset)
                ? NEO.Transfer(contributor, Runtime.ExecutingScriptHash, amount)
                : GAS.Transfer(contributor, Runtime.ExecutingScriptHash, amount);
            ExecutionEngine.Assert(transferred, "transfer failed");

            round.MatchingPool += amount;
            StoreRound(roundId, round);

            OnMatchingPoolAdded(roundId, contributor, amount, round.MatchingPool);
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

            round.Cancelled = true;
            round.MatchingWithdrawn = round.MatchingPool;
            StoreRound(roundId, round);

            if (round.MatchingPool > 0)
            {
                bool transferred = IsNeo(round.Asset)
                    ? NEO.Transfer(Runtime.ExecutingScriptHash, creator, round.MatchingPool)
                    : GAS.Transfer(Runtime.ExecutingScriptHash, creator, round.MatchingPool);
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

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            bool authorized = fromGateway || Runtime.CheckWitness(round.Creator) || Runtime.CheckWitness(Admin());
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

        #region Project Methods

        public static BigInteger RegisterProject(
            UInt160 owner,
            BigInteger roundId,
            string name,
            string description,
            string link)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(owner);
            ValidateProjectText(name, description, link);

            ExecutionEngine.Assert(name != null && name.Length > 0, "name required");

            RoundData round = GetRound(roundId);
            RequireRoundExists(round);
            ExecutionEngine.Assert(!round.Cancelled, "round cancelled");
            ExecutionEngine.Assert(!round.Finalized, "round finalized");
            ExecutionEngine.Assert(Runtime.Time <= round.EndTime, "round ended");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            BigInteger projectId = TotalProjects() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_PROJECT_ID, projectId);

            ProjectData project = new ProjectData
            {
                Owner = owner,
                RoundId = roundId,
                Name = name,
                Description = description,
                Link = link,
                CreatedTime = Runtime.Time,
                TotalContributed = 0,
                ContributorCount = 0,
                MatchedAmount = 0,
                Active = true,
                Claimed = false
            };

            StoreProject(projectId, project);
            AddRoundProject(roundId, projectId);
            AddOwnerProject(owner, projectId);

            round.ProjectCount += 1;
            StoreRound(roundId, round);

            OnProjectRegistered(projectId, roundId, owner, name);
            return projectId;
        }

        public static void UpdateProject(
            UInt160 owner,
            BigInteger projectId,
            string name,
            string description,
            string link,
            bool active)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(owner);
            ValidateProjectText(name, description, link);

            ProjectData project = GetProject(projectId);
            RequireProjectExists(project);
            ExecutionEngine.Assert(project.Owner == owner, "not owner");

            RoundData round = GetRound(project.RoundId);
            RequireRoundExists(round);
            ExecutionEngine.Assert(!round.Cancelled, "round cancelled");
            ExecutionEngine.Assert(!round.Finalized, "round finalized");

            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "unauthorized");

            if (name != null && name.Length > 0) project.Name = name;
            if (description != null) project.Description = description;
            if (link != null) project.Link = link;
            project.Active = active;

            StoreProject(projectId, project);
            OnProjectUpdated(projectId);
        }

        public static void Contribute(
            UInt160 contributor,
            BigInteger roundId,
            BigInteger projectId,
            BigInteger amount,
            string memo)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(contributor);
            ValidateMemo(memo);
            ExecutionEngine.Assert(amount > 0, "invalid amount");

            RoundData round = GetRound(roundId);
            RequireRoundExists(round);
            ExecutionEngine.Assert(!round.Cancelled, "round cancelled");
            ExecutionEngine.Assert(!round.Finalized, "round finalized");
            ExecutionEngine.Assert(Runtime.Time >= round.StartTime, "round not started");
            ExecutionEngine.Assert(Runtime.Time <= round.EndTime, "round ended");

            ProjectData project = GetProject(projectId);
            RequireProjectExists(project);
            ExecutionEngine.Assert(project.RoundId == roundId, "project mismatch");
            ExecutionEngine.Assert(project.Active, "project inactive");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(contributor), "unauthorized");

            bool transferred = IsNeo(round.Asset)
                ? NEO.Transfer(contributor, Runtime.ExecutingScriptHash, amount)
                : GAS.Transfer(contributor, Runtime.ExecutingScriptHash, amount);
            ExecutionEngine.Assert(transferred, "transfer failed");

            BigInteger current = GetContributionInternal(contributor, roundId, projectId);
            if (current == 0)
            {
                project.ContributorCount += 1;
            }

            BigInteger newAmount = current + amount;
            StoreContribution(contributor, roundId, projectId, newAmount);

            project.TotalContributed += amount;
            StoreProject(projectId, project);

            round.TotalContributed += amount;
            StoreRound(roundId, round);

            OnContributionMade(roundId, projectId, contributor, amount, memo);
        }

        public static void ClaimProject(UInt160 owner, BigInteger projectId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(owner);
            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "unauthorized");

            ProjectData project = GetProject(projectId);
            RequireProjectExists(project);
            ExecutionEngine.Assert(project.Owner == owner, "not owner");
            ExecutionEngine.Assert(!project.Claimed, "already claimed");

            RoundData round = GetRound(project.RoundId);
            RequireRoundExists(round);
            ExecutionEngine.Assert(round.Finalized, "round not finalized");
            ExecutionEngine.Assert(!round.Cancelled, "round cancelled");

            BigInteger amount = project.TotalContributed + project.MatchedAmount;
            ExecutionEngine.Assert(amount > 0, "nothing to claim");

            project.Claimed = true;
            StoreProject(projectId, project);

            bool transferred = IsNeo(round.Asset)
                ? NEO.Transfer(Runtime.ExecutingScriptHash, owner, amount)
                : GAS.Transfer(Runtime.ExecutingScriptHash, owner, amount);
            ExecutionEngine.Assert(transferred, "transfer failed");

            OnProjectClaimed(projectId, owner, amount);
        }

        #endregion
    }
}
