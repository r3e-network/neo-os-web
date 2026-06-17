using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppQuadraticFunding
    {
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

            // Audit fix C-2: prohibit project owner and round creator from contributing.
            // Self-contribution allowed the project owner to inflate TotalContributed (which
            // is paid back via ClaimProject) and round creators to launder funds back to
            // themselves through the matching pool.
            ExecutionEngine.Assert(contributor != project.Owner, "owner cannot contribute");
            ExecutionEngine.Assert(contributor != round.Creator, "round creator cannot contribute");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(contributor), "unauthorized");

            ConsumeDirectAssetCredit(round.Asset, contributor, amount);

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

        /// <summary>
        /// Reclaim a contribution from a finalized round whose project owner never
        /// called ClaimProject. Without this path an inactive project owner locks
        /// every contributor's funds (and the matched amount) forever. After the
        /// CLAIM_GRACE window past round.EndTime, each contributor can recover their
        /// own contribution. Witness-gated (or routed via the trusted gateway).
        ///
        /// CEI: the per-contributor ledger is zeroed and project.TotalContributed is
        /// decremented BEFORE the asset transfer. Setting these to zero also keeps
        /// the invariant that total paid out per project never exceeds the project's
        /// original TotalContributed + MatchedAmount: once a contribution is
        /// reclaimed it can no longer be paid out by ClaimProject (which reads the
        /// reduced project.TotalContributed), and reclaim itself is barred once the
        /// project is Claimed.
        /// </summary>
        public static void ReclaimContribution(UInt160 contributor, BigInteger roundId, BigInteger projectId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(contributor);

            RoundData round = GetRound(roundId);
            RequireRoundExists(round);
            ExecutionEngine.Assert(round.Finalized, "round not finalized");
            ExecutionEngine.Assert(!round.Cancelled, "round cancelled");
            ExecutionEngine.Assert(Runtime.Time >= round.EndTime + CLAIM_GRACE, "grace period not elapsed");

            ProjectData project = GetProject(projectId);
            RequireProjectExists(project);
            ExecutionEngine.Assert(project.RoundId == roundId, "project mismatch");
            ExecutionEngine.Assert(!project.Claimed, "already claimed");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(contributor), "unauthorized");

            BigInteger amount = GetContributionInternal(contributor, roundId, projectId);
            ExecutionEngine.Assert(amount > 0, "nothing to reclaim");

            // CEI: zero the contributor's ledger entry and decrement the project total
            // before moving any funds.
            StoreContribution(contributor, roundId, projectId, 0);
            project.TotalContributed -= amount;
            StoreProject(projectId, project);

            bool transferred = IsNeo(round.Asset)
                ? NEO.Transfer(Runtime.ExecutingScriptHash, contributor, amount)
                : GAS.Transfer(Runtime.ExecutingScriptHash, contributor, amount);
            ExecutionEngine.Assert(transferred, "transfer failed");

            OnContributionReclaimed(roundId, projectId, contributor, amount);
        }

        /// <summary>
        /// Sweep the matched amount of a finalized project whose owner never claimed
        /// it. Mirrors ReclaimContribution for the matching side: after CLAIM_GRACE,
        /// the round creator recovers a project's MatchedAmount that would otherwise
        /// be stranded. Does NOT touch round.MatchingWithdrawn / MatchingAllocated —
        /// the matched amount was already counted against the pool at finalization,
        /// so it is paid out directly from the contract's asset balance.
        ///
        /// CEI: project.MatchedAmount is zeroed and project.MatchClaimed is set BEFORE
        /// the transfer. MatchClaimed (not Claimed) is used so sweeping the match does
        /// NOT block contributors from still reclaiming their own contributions via
        /// ReclaimContribution. ClaimProject (which pays both pools) reads the current
        /// MatchedAmount (now 0) so it cannot re-pay the swept match, and a second
        /// ReclaimUnclaimedMatch is blocked by MatchClaimed; the invariant total-out
        /// &lt;= TotalContributed + MatchedAmount holds because each pool drains once.
        /// </summary>
        public static void ReclaimUnclaimedMatch(UInt160 creator, BigInteger projectId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(creator);

            ProjectData project = GetProject(projectId);
            RequireProjectExists(project);
            ExecutionEngine.Assert(!project.Claimed, "already claimed");
            ExecutionEngine.Assert(!project.MatchClaimed, "match already claimed");

            RoundData round = GetRound(project.RoundId);
            RequireRoundExists(round);
            ExecutionEngine.Assert(round.Creator == creator, "not creator");
            ExecutionEngine.Assert(round.Finalized, "round not finalized");
            ExecutionEngine.Assert(!round.Cancelled, "round cancelled");
            ExecutionEngine.Assert(Runtime.Time >= round.EndTime + CLAIM_GRACE, "grace period not elapsed");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            BigInteger matched = project.MatchedAmount;
            ExecutionEngine.Assert(matched > 0, "no unclaimed match");

            // CEI: zero the matched amount and mark only the MATCH as claimed (not the
            // whole project) so contributors can still reclaim their contributions.
            project.MatchedAmount = 0;
            project.MatchClaimed = true;
            StoreProject(projectId, project);

            bool transferred = IsNeo(round.Asset)
                ? NEO.Transfer(Runtime.ExecutingScriptHash, creator, matched)
                : GAS.Transfer(Runtime.ExecutingScriptHash, creator, matched);
            ExecutionEngine.Assert(transferred, "transfer failed");

            OnMatchingWithdrawn(project.RoundId, creator, matched);
        }

        #endregion
    }
}
