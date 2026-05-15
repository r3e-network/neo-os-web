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

        #endregion
    }
}
