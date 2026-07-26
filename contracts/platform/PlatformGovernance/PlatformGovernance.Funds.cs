using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class PlatformGovernanceContract
    {
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == NEO.Hash, "only NEO accepted");
            ValidateAddress(from);
            ExecutionEngine.Assert(amount > 0, "invalid amount");
            string appId = MiniAppCreditLedger.RequireVoteAppId(data);
            RequireRegistered(appId);
            MiniAppCreditLedger.Credit(
                (ByteString)CreditKey(appId, from),
                (ByteString)AppKey(appId, PREFIX_TENANT_LIABILITY),
                (ByteString)PREFIX_NEO_CREDIT_LIABILITY,
                amount);
            OnNeoCredited(appId, from, amount);
        }

        public static BigInteger WithdrawCredit(string appId, UInt160 payer, BigInteger amount)
        {
            RequireRegistered(appId);
            ValidateAddress(payer);
            ExecutionEngine.Assert(Runtime.CheckWitness(payer), "payer witness required");
            ExecutionEngine.Assert(amount > 0 && ReadCredit(appId, payer) >= amount, "insufficient credit");
            AcquireAccountLock(appId, payer);
            ConsumeCredit(appId, payer, amount);
            TransferNeo(payer, amount);
            ReleaseAccountLock(appId, payer);
            OnCreditWithdrawn(appId, payer, amount);
            return amount;
        }

        public static BigInteger WithdrawVote(string appId, UInt160 voter, BigInteger proposalId)
        {
            RequireRegistered(appId);
            ValidateAddress(voter);
            ExecutionEngine.Assert(Runtime.CheckWitness(voter), "voter witness required");
            object[] proposal = ReadProposal(appId, proposalId);
            ExecutionEngine.Assert((BigInteger)proposal[10] != 1, "proposal still active");
            object[] vote = ReadVote(appId, proposalId, voter);
            BigInteger amount = (BigInteger)vote[0];
            AcquireAccountLock(appId, voter);
            Storage.Delete(Storage.CurrentContext, VoteKey(appId, proposalId, voter));
            AdjustVoteLiability(appId, -amount);
            TransferNeo(voter, amount);
            ReleaseAccountLock(appId, voter);
            OnVoteWithdrawn(appId, proposalId, voter, amount);
            return amount;
        }
    }
}
