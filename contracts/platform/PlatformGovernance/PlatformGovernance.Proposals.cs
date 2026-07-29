using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;
using Neo.SmartContract.Framework.Native;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class PlatformGovernanceContract
    {
        public static BigInteger CreateProposal(
            string appId,
            UInt160 creator,
            string proposalType,
            string title,
            string description,
            ByteString actionData,
            BigInteger durationSeconds)
        {
            RequireGovernanceLane(appId);
            ValidateAddress(creator);
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "creator witness required");
            ExecutionEngine.Assert(proposalType != null && proposalType.Length > 0 && proposalType.Length <= 40,
                "invalid proposal type");
            ValidateText(title, description);
            ExecutionEngine.Assert(actionData != null && actionData.Length <= MAX_ACTION_BYTES, "invalid action data");
            ExecutionEngine.Assert(durationSeconds >= MinimumDurationOf(appId) && durationSeconds <= MaximumDurationOf(appId),
                "invalid proposal duration");

            AcquireTenantLock(appId);
            BigInteger proposalId = ReadInteger(AppKey(appId, PREFIX_PROPOSAL_COUNT)) + 1;
            ExecutionEngine.Assert(proposalId <= MAX_PROPOSALS, "proposal limit reached");
            Storage.Put(Storage.CurrentContext, AppKey(appId, PREFIX_PROPOSAL_COUNT), proposalId);
            object[] proposal = new object[]
            {
                proposalId, creator, proposalType, title, description, actionData,
                Runtime.Time, Runtime.Time + durationSeconds * 1_000, BigInteger.Zero,
                BigInteger.Zero, 1
            };
            Storage.Put(Storage.CurrentContext, ProposalKey(appId, proposalId), StdLib.Serialize(proposal));
            ReleaseTenantLock(appId);
            OnProposalCreated(appId, proposalId, creator, (BigInteger)proposal[7]);
            return proposalId;
        }

        public static void Vote(string appId, UInt160 voter, BigInteger proposalId, bool support, BigInteger amount)
        {
            RequireGovernanceLane(appId);
            ValidateAddress(voter);
            ExecutionEngine.Assert(Runtime.CheckWitness(voter), "voter witness required");
            ExecutionEngine.Assert(amount > 0, "invalid vote amount");
            object[] proposal = ReadProposal(appId, proposalId);
            ExecutionEngine.Assert((BigInteger)proposal[10] == 1, "proposal not active");
            ExecutionEngine.Assert(Runtime.Time < (BigInteger)proposal[7], "voting period ended");
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, VoteKey(appId, proposalId, voter)) == null,
                "voter already voted");
            ExecutionEngine.Assert(ReadCredit(appId, voter) >= amount, "insufficient funded credit");

            AcquireTenantLock(appId);
            ConsumeCredit(appId, voter, amount);
            AdjustVoteLiability(appId, amount);
            if (support) proposal[8] = (BigInteger)proposal[8] + amount;
            else proposal[9] = (BigInteger)proposal[9] + amount;
            Storage.Put(Storage.CurrentContext, ProposalKey(appId, proposalId), StdLib.Serialize(proposal));
            Storage.Put(Storage.CurrentContext, VoteKey(appId, proposalId, voter),
                StdLib.Serialize(new object[] { amount, support }));
            ReleaseTenantLock(appId);
            OnVoteCast(appId, proposalId, voter, support, amount);
        }

        public static BigInteger FinalizeProposal(string appId, BigInteger proposalId)
        {
            RequireRegistered(appId);
            object[] proposal = ReadProposal(appId, proposalId);
            ExecutionEngine.Assert((BigInteger)proposal[10] == 1, "proposal already finalized");
            ExecutionEngine.Assert(Runtime.Time >= (BigInteger)proposal[7], "voting period active");
            BigInteger yes = (BigInteger)proposal[8];
            BigInteger no = (BigInteger)proposal[9];
            BigInteger total = yes + no;
            BigInteger status = total >= QuorumOf(appId) && yes * 10_000 >= total * ThresholdBpsOf(appId) ? 2 : 3;
            AcquireTenantLock(appId);
            proposal[10] = status;
            Storage.Put(Storage.CurrentContext, ProposalKey(appId, proposalId), StdLib.Serialize(proposal));
            ReleaseTenantLock(appId);
            OnProposalFinalized(appId, proposalId, status);
            return status;
        }

        public static void ExecuteProposal(string appId, BigInteger proposalId)
        {
            RequireRegistered(appId);
            RequireAppAdminOrPlatformAdmin(appId, Admin());
            object[] proposal = ReadProposal(appId, proposalId);
            ExecutionEngine.Assert((BigInteger)proposal[10] == 2, "proposal not passed");
            proposal[10] = 5;
            Storage.Put(Storage.CurrentContext, ProposalKey(appId, proposalId), StdLib.Serialize(proposal));
            OnProposalExecuted(appId, proposalId, Runtime.CallingScriptHash);
        }

        public static void RevokeProposal(string appId, UInt160 revoker, BigInteger proposalId)
        {
            RequireRegistered(appId);
            ValidateAddress(revoker);
            ExecutionEngine.Assert(Runtime.CheckWitness(revoker), "revoker witness required");
            object[] proposal = ReadProposal(appId, proposalId);
            ExecutionEngine.Assert((BigInteger)proposal[10] == 1, "proposal already finalized");
            UInt160 creator = (UInt160)proposal[1];
            ExecutionEngine.Assert(revoker == creator || revoker == TenantAdminOf(appId) || revoker == Admin(),
                "revoker not authorized");
            proposal[10] = 4;
            Storage.Put(Storage.CurrentContext, ProposalKey(appId, proposalId), StdLib.Serialize(proposal));
            OnProposalRevoked(appId, proposalId, revoker);
        }
    }
}
