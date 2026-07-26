using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class PlatformGovernanceContract
    {
        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != UInt160.Zero && Runtime.CheckWitness(admin), "unauthorized");
        }

        private static void ValidateAddress(UInt160 address) =>
            ExecutionEngine.Assert(address != null && address.IsValid && address != UInt160.Zero, "invalid address");

        private static void ValidateAppId(string appId) =>
            ExecutionEngine.Assert(appId != null && appId.Length > 0 && appId.Length <= 64, "invalid appId");

        private static void ActivateLocalApp(string appId, UInt160 appAdmin)
        {
            ValidateAppId(appId);
            ValidateAddress(appAdmin);
            ExecutionEngine.Assert(!IsTenantRegistered(appId), "app already registered");
            Storage.Put(Storage.CurrentContext, AppKey(appId, PREFIX_TENANT_ADMIN), appAdmin);
            OnAppActivated(appId, appAdmin);
        }

        private static void ApplyDescriptorMap(string appId, Map<string, object> descriptor)
        {
            if (descriptor == null) return;
            string[] keys = descriptor.Keys;
            for (int i = 0; i < keys.Length; i++) ApplyDescriptor(appId, keys[i], descriptor[keys[i]]);
        }

        private static void ApplyDescriptor(string appId, string key, object value)
        {
            BigInteger parsed = ReadInteger(value);
            if (key == "governance:minDurationSeconds")
            {
                ExecutionEngine.Assert(parsed >= 0 && parsed <= MAX_DURATION_SECONDS, "minimum duration out of range");
                ExecutionEngine.Assert(parsed <= MaximumDurationOf(appId), "minimum duration exceeds maximum");
                Storage.Put(Storage.CurrentContext, AppKey(appId, PREFIX_MIN_DURATION), parsed);
                return;
            }
            if (key == "governance:maxDurationSeconds")
            {
                ExecutionEngine.Assert(parsed > 0 && parsed <= MAX_DURATION_SECONDS, "maximum duration out of range");
                ExecutionEngine.Assert(parsed >= MinimumDurationOf(appId), "maximum duration below minimum");
                Storage.Put(Storage.CurrentContext, AppKey(appId, PREFIX_MAX_DURATION), parsed);
                return;
            }
            if (key == "governance:quorum")
            {
                ExecutionEngine.Assert(parsed > 0, "quorum out of range");
                Storage.Put(Storage.CurrentContext, AppKey(appId, PREFIX_QUORUM), parsed);
                return;
            }
            if (key == "governance:thresholdBps")
            {
                ExecutionEngine.Assert(parsed > 0 && parsed <= MAX_THRESHOLD_BPS, "threshold out of range");
                Storage.Put(Storage.CurrentContext, AppKey(appId, PREFIX_THRESHOLD_BPS), parsed);
                return;
            }
            ExecutionEngine.Assert(false, "unknown descriptor key");
        }

        private static BigInteger ReadInteger(object value)
        {
            if (value is BigInteger integer) return integer;
            return (BigInteger)(ByteString)value;
        }

        private static BigInteger ReadInteger(byte[] key)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, key);
            return raw == null ? 0 : (BigInteger)raw;
        }

        private static BigInteger ReadConfig(string appId, byte[] prefix, BigInteger fallback)
        {
            BigInteger configured = ReadInteger(AppKey(appId, prefix));
            return configured == 0 ? fallback : configured;
        }

        private static byte[] CreditKey(string appId, UInt160 payer) =>
            (byte[])Helper.Concat((ByteString)AppKey(appId, PREFIX_NEO_CREDIT), (ByteString)(byte[])payer);

        private static byte[] VoteLiabilityKey(string appId) => AppKey(appId, PREFIX_VOTE_LIABILITY);

        private static byte[] ProposalKey(string appId, BigInteger proposalId) =>
            AppKey(appId, PREFIX_PROPOSAL, proposalId);

        private static byte[] VoteKey(string appId, BigInteger proposalId, UInt160 voter) =>
            (byte[])Helper.Concat((ByteString)AppKey(appId, PREFIX_VOTE, proposalId), (ByteString)(byte[])voter);

        private static void ConsumeCredit(string appId, UInt160 payer, BigInteger amount) =>
            MiniAppCreditLedger.Debit(
                (ByteString)CreditKey(appId, payer),
                (ByteString)AppKey(appId, PREFIX_TENANT_LIABILITY),
                (ByteString)PREFIX_NEO_CREDIT_LIABILITY,
                amount);

        private static BigInteger ReadCredit(string appId, UInt160 payer) =>
            MiniAppCreditLedger.Read((ByteString)CreditKey(appId, payer));

        private static void AdjustVoteLiability(string appId, BigInteger delta)
        {
            byte[] appKey = VoteLiabilityKey(appId);
            BigInteger appNext = ReadInteger(appKey) + delta;
            BigInteger totalNext = ReadInteger(PREFIX_TOTAL_VOTE_LIABILITY) + delta;
            ExecutionEngine.Assert(appNext >= 0 && totalNext >= 0, "vote liability underflow");
            if (appNext == 0) Storage.Delete(Storage.CurrentContext, appKey);
            else Storage.Put(Storage.CurrentContext, appKey, appNext);
            if (totalNext == 0) Storage.Delete(Storage.CurrentContext, PREFIX_TOTAL_VOTE_LIABILITY);
            else Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_VOTE_LIABILITY, totalNext);
        }

        private static void TransferNeo(UInt160 recipient, BigInteger amount)
        {
            if (amount <= 0) return;
            ExecutionEngine.Assert(NEO.Transfer(Runtime.ExecutingScriptHash, recipient, amount, null) == true,
                "NEO transfer failed");
        }

        private static void RequireGovernanceLane(string appId)
        {
            RequireRegistered(appId);
            ExecutionEngine.Assert(!IsPaused() && !IsAppPaused(appId), "platform paused");
            RequireRegistryNotPaused(appId);
        }

        private static void ValidateText(string title, string description)
        {
            ExecutionEngine.Assert(title != null && title.Length > 0 && title.Length <= MAX_TITLE_LENGTH, "invalid title");
            ExecutionEngine.Assert(description != null && description.Length <= MAX_DESCRIPTION_LENGTH, "invalid description");
        }

        private static object[] ReadProposal(string appId, BigInteger proposalId)
        {
            ExecutionEngine.Assert(proposalId > 0, "invalid proposal id");
            ByteString raw = Storage.Get(Storage.CurrentContext, ProposalKey(appId, proposalId));
            ExecutionEngine.Assert(raw != null, "proposal not found");
            return (object[])StdLib.Deserialize(raw);
        }

        private static object[] ReadVote(string appId, BigInteger proposalId, UInt160 voter)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, VoteKey(appId, proposalId, voter));
            ExecutionEngine.Assert(raw != null, "vote not found");
            return (object[])StdLib.Deserialize(raw);
        }
    }
}
