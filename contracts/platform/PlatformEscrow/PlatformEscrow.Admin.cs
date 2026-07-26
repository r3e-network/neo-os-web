using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class PlatformEscrowContract
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
            if (key == "escrow:maxMilestones")
            {
                ExecutionEngine.Assert(parsed > 0 && parsed <= DEFAULT_MAX_MILESTONES, "max milestones out of range");
                Storage.Put(Storage.CurrentContext, AppKey(appId, PREFIX_MAX_MILESTONES), parsed);
                return;
            }
            if (key == "escrow:approvalGraceMs")
            {
                ExecutionEngine.Assert(parsed > 0 && parsed <= 31_536_000_000L, "approval grace out of range");
                Storage.Put(Storage.CurrentContext, AppKey(appId, PREFIX_APPROVAL_GRACE), parsed);
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

        private static bool IsSupportedAsset(UInt160 asset) => asset == GAS.Hash || asset == NEO.Hash;

        private static byte[] AssetPrefix(UInt160 asset, byte[] gasPrefix, byte[] neoPrefix)
        {
            ExecutionEngine.Assert(IsSupportedAsset(asset), "unsupported asset");
            return asset == GAS.Hash ? gasPrefix : neoPrefix;
        }

        private static byte[] CreditKey(string appId, UInt160 asset, UInt160 payer) =>
            (byte[])Helper.Concat((ByteString)AppKey(appId, AssetPrefix(asset, PREFIX_GAS_CREDIT, PREFIX_NEO_CREDIT)), (ByteString)(byte[])payer);

        private static byte[] CreditLiabilityKey(string appId, UInt160 asset) =>
            AppKey(appId, AssetPrefix(asset, PREFIX_GAS_CREDIT_LIABILITY, PREFIX_NEO_CREDIT_LIABILITY));

        private static byte[] EscrowLiabilityKey(string appId, UInt160 asset) =>
            AppKey(appId, AssetPrefix(asset, PREFIX_GAS_ESCROW_LIABILITY, PREFIX_NEO_ESCROW_LIABILITY));

        private static byte[] TotalCreditLiabilityKey(UInt160 asset) =>
            asset == GAS.Hash ? PREFIX_TOTAL_GAS_CREDIT_LIABILITY : PREFIX_TOTAL_NEO_CREDIT_LIABILITY;

        private static byte[] TotalEscrowLiabilityKey(UInt160 asset) =>
            asset == GAS.Hash ? PREFIX_TOTAL_GAS_ESCROW_LIABILITY : PREFIX_TOTAL_NEO_ESCROW_LIABILITY;

        private static void AdjustEscrowLiability(string appId, UInt160 asset, BigInteger delta)
        {
            byte[] appKey = EscrowLiabilityKey(appId, asset);
            BigInteger appNext = ReadInteger(appKey) + delta;
            ExecutionEngine.Assert(appNext >= 0, "escrow liability underflow");
            Storage.Put(Storage.CurrentContext, appKey, appNext);
            byte[] totalKey = TotalEscrowLiabilityKey(asset);
            BigInteger totalNext = ReadInteger(totalKey) + delta;
            ExecutionEngine.Assert(totalNext >= 0, "total escrow liability underflow");
            Storage.Put(Storage.CurrentContext, totalKey, totalNext);
        }

        private static void ConsumeCredit(string appId, UInt160 asset, UInt160 payer, BigInteger amount)
        {
            MiniAppCreditLedger.Debit(
                (ByteString)CreditKey(appId, asset, payer),
                (ByteString)CreditLiabilityKey(appId, asset),
                (ByteString)(asset == GAS.Hash
                    ? PREFIX_TOTAL_GAS_CREDIT_LIABILITY
                    : PREFIX_TOTAL_NEO_CREDIT_LIABILITY),
                amount);
        }

        private static BigInteger ReadCredit(string appId, UInt160 asset, UInt160 payer)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, CreditKey(appId, asset, payer));
            return raw == null ? 0 : (BigInteger)raw;
        }

        private static void TransferAsset(UInt160 asset, UInt160 recipient, BigInteger amount)
        {
            if (amount <= 0) return;
            bool? ok = asset == GAS.Hash
                ? GAS.Transfer(Runtime.ExecutingScriptHash, recipient, amount, null)
                : NEO.Transfer(Runtime.ExecutingScriptHash, recipient, amount, null);
            ExecutionEngine.Assert(ok == true, "asset transfer failed");
        }

        private static void RequireCreateLane(string appId)
        {
            RequireRegistered(appId);
            ExecutionEngine.Assert(!IsPaused() && !IsAppPaused(appId), "platform paused");
            RequireRegistryNotPaused(appId);
        }

        private static void ValidateText(string title, string notes)
        {
            ExecutionEngine.Assert(title != null && title.Length <= MAX_TITLE_LENGTH, "invalid title");
            ExecutionEngine.Assert(notes != null && notes.Length <= MAX_NOTES_LENGTH, "invalid notes");
        }

        private static void ValidateApprovers(UInt160[] approvers, BigInteger approvalThreshold)
        {
            ExecutionEngine.Assert(approvers != null && approvers.Length > 0 && approvers.Length <= MAX_APPROVERS,
                "invalid approvers");
            ExecutionEngine.Assert(approvalThreshold > 0 && approvalThreshold <= approvers.Length,
                "invalid approval threshold");
            for (int i = 0; i < approvers.Length; i++)
            {
                ValidateAddress(approvers[i]);
                for (int j = 0; j < i; j++)
                {
                    ExecutionEngine.Assert(approvers[i] != approvers[j], "duplicate approver");
                }
            }
        }
    }
}
