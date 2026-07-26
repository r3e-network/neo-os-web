using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public delegate void AppActivatedHandler(string appId, UInt160 appAdmin);
    public delegate void AppPausedChangedHandler(string appId, bool paused);
    public delegate void StreamCreatedHandler(string appId, BigInteger streamId, UInt160 creator, UInt160 beneficiary, UInt160 asset, BigInteger amount);
    public delegate void StreamClaimedHandler(string appId, BigInteger streamId, UInt160 beneficiary, BigInteger amount, BigInteger releasedAmount);
    public delegate void StreamCancelledHandler(string appId, BigInteger streamId, UInt160 creator, BigInteger beneficiaryAmount, BigInteger refundAmount);
    public delegate void GasCreditedHandler(string appId, UInt160 payer, BigInteger amount);
    public delegate void NeoCreditedHandler(string appId, UInt160 payer, BigInteger amount);
    public delegate void CreditWithdrawnHandler(string appId, UInt160 payer, UInt160 asset, BigInteger amount);

    [DisplayName("PlatformVesting")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Multi-tenant GAS and NEO payment streams with linear and cliff vesting.")]
    [ContractPermission("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", "transfer", "balanceOf")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer", "balanceOf")]
    public partial class PlatformVestingContract : MiniAppEngineBase
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x08 };
        private static readonly byte[] PREFIX_PAUSED = new byte[] { 0x09 };
        private static readonly byte[] PREFIX_UPGRADE_TIME = new byte[] { 0x0A };
        private static readonly byte[] PREFIX_UPGRADE_HASH = new byte[] { 0x0B };
        private static readonly byte[] PREFIX_NEXT_ID = new byte[] { 0x0C };
        private static readonly byte[] PREFIX_REENTRANCY = new byte[] { 0x0D };
        private static readonly byte[] PREFIX_TOTAL_GAS_CREDIT_LIABILITY = new byte[] { 0x0E };
        private static readonly byte[] PREFIX_TOTAL_NEO_CREDIT_LIABILITY = new byte[] { 0x0F };

        private static readonly byte[] PREFIX_APP_PAUSED = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_DESCRIPTOR_MAX_INTERVAL = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_GAS_CREDIT = new byte[] { 0x60 };
        private static readonly byte[] PREFIX_NEO_CREDIT = new byte[] { 0x61 };
        private static readonly byte[] PREFIX_GAS_CREDIT_LIABILITY = new byte[] { 0x62 };
        private static readonly byte[] PREFIX_NEO_CREDIT_LIABILITY = new byte[] { 0x63 };
        private static readonly byte[] PREFIX_GAS_STREAM_LIABILITY = new byte[] { 0x64 };
        private static readonly byte[] PREFIX_NEO_STREAM_LIABILITY = new byte[] { 0x65 };
        private static readonly byte[] PREFIX_STREAM_COUNT = new byte[] { 0x70 };
        private static readonly byte[] PREFIX_STREAM = new byte[] { 0x71 };
        private static readonly byte[] PREFIX_CREATOR_COUNT = new byte[] { 0x72 };
        private static readonly byte[] PREFIX_CREATOR_INDEX = new byte[] { 0x73 };
        private static readonly byte[] PREFIX_BENEFICIARY_COUNT = new byte[] { 0x74 };
        private static readonly byte[] PREFIX_BENEFICIARY_INDEX = new byte[] { 0x75 };

        private const long DEFAULT_MAX_INTERVAL_SECONDS = 31_536_000L;
        private const long MAX_TITLE_LENGTH = 60;
        private const long MAX_NOTES_LENGTH = 240;
        private const long MAX_INDEX_ENTRIES = 500;
        private const long MAX_PAGE_SIZE = 100;
        private const long MILLISECONDS_PER_SECOND = 1_000L;
        private const long TIMELOCK_DELAY_MS = 86_400_000L;

        [DisplayName("AppActivated")]
        public static event AppActivatedHandler OnAppActivated;
        [DisplayName("AppPausedChanged")]
        public static event AppPausedChangedHandler OnAppPausedChanged;
        [DisplayName("StreamCreated")]
        public static event StreamCreatedHandler OnStreamCreated;
        [DisplayName("StreamClaimed")]
        public static event StreamClaimedHandler OnStreamClaimed;
        [DisplayName("StreamCancelled")]
        public static event StreamCancelledHandler OnStreamCancelled;
        [DisplayName("GasCredited")]
        public static event GasCreditedHandler OnGasCredited;
        [DisplayName("NeoCredited")]
        public static event NeoCreditedHandler OnNeoCredited;
        [DisplayName("CreditWithdrawn")]
        public static event CreditWithdrawnHandler OnCreditWithdrawn;

        public static void _deploy(object data, bool update)
        {
            if (!update) Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }

        [Safe]
        public static UInt160 Admin()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
            return raw == null ? UInt160.Zero : (UInt160)raw;
        }

        [Safe]
        public static UInt160 Registry() => RegistryHash();

        [Safe]
        public static bool IsPaused()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_PAUSED);
            return raw != null && (BigInteger)raw == 1;
        }

        [Safe]
        public static UInt160 AppAdminOf(string appId) => TenantAdminOf(appId);

        [Safe]
        public static bool IsAppRegistered(string appId) => IsTenantRegistered(appId);

        [Safe]
        public static bool IsAppPaused(string appId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AppKey(appId, PREFIX_APP_PAUSED));
            return raw != null && (BigInteger)raw == 1;
        }

        public static void Update(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ByteString eta = Storage.Get(Storage.CurrentContext, PREFIX_UPGRADE_TIME);
            ExecutionEngine.Assert(eta != null && Runtime.Time >= (BigInteger)eta, "upgrade timelock active");
            ByteString expected = Storage.Get(Storage.CurrentContext, PREFIX_UPGRADE_HASH);
            ExecutionEngine.Assert(expected == CryptoLib.Sha256(Helper.Concat(nef, (ByteString)manifest)), "upgrade data mismatch");
            Storage.Delete(Storage.CurrentContext, PREFIX_UPGRADE_TIME);
            Storage.Delete(Storage.CurrentContext, PREFIX_UPGRADE_HASH);
            ContractManagement.Update(nef, manifest, new object[0]);
        }

        public static void ScheduleUpdate(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(nef != null && nef.Length > 0 && manifest != null && manifest.Length > 0, "invalid upgrade artifact");
            Storage.Put(Storage.CurrentContext, PREFIX_UPGRADE_TIME, Runtime.Time + TIMELOCK_DELAY_MS);
            Storage.Put(Storage.CurrentContext, PREFIX_UPGRADE_HASH, CryptoLib.Sha256(Helper.Concat(nef, (ByteString)manifest)));
        }

        public static void CancelUpdate()
        {
            ValidateAdmin();
            Storage.Delete(Storage.CurrentContext, PREFIX_UPGRADE_TIME);
            Storage.Delete(Storage.CurrentContext, PREFIX_UPGRADE_HASH);
        }

        public static void SetRegistry(UInt160 registry)
        {
            ValidateAdmin();
            ValidateAddress(registry);
            Storage.Put(Storage.CurrentContext, PREFIX_REGISTRY, registry);
        }

        public static void SetPaused(bool paused)
        {
            ValidateAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_PAUSED, paused ? 1 : 0);
        }

        public static void RegisterApp(string appId, UInt160 appAdmin)
        {
            ValidateAdmin();
            ActivateLocalApp(appId, appAdmin);
        }

        public static void ActivateApp(string appId, UInt160 appAdmin, Map<string, object> descriptor)
        {
            RequireRegistryCaller();
            ExecutionEngine.Assert(!IsTenantRegistered(appId), "app already registered");
            ActivateTenant(appId, appAdmin);
            ApplyDescriptorMap(appId, descriptor);
            OnAppActivated(appId, appAdmin);
        }

        public static void ValidateAndApplyDescriptor(string appId, string key, object value)
        {
            RequireRegistryCaller();
            RequireRegistered(appId);
            ApplyDescriptor(appId, key, value);
        }

        public static void SetDescriptor(string appId, string key, object value)
        {
            RequireRegistered(appId);
            RequireAppAdminOrPlatformAdmin(appId, Admin());
            ApplyDescriptor(appId, key, value);
        }

        public static void SetAppPaused(string appId, bool paused)
        {
            RequireRegistered(appId);
            RequireAppAdminOrPlatformAdmin(appId, Admin());
            Storage.Put(Storage.CurrentContext, AppKey(appId, PREFIX_APP_PAUSED), paused ? 1 : 0);
            OnAppPausedChanged(appId, paused);
        }

        private static void ValidateCreateLane(string appId)
        {
            RequireRegistered(appId);
            ExecutionEngine.Assert(!IsPaused() && !IsAppPaused(appId), "platform paused");
        }

        private static bool IsSupportedAsset(UInt160 asset) => asset == GAS.Hash || asset == NEO.Hash;

        private static byte[] CreditKey(string appId, UInt160 asset, UInt160 payer) =>
            (byte[])Helper.Concat((ByteString)AppKey(appId, AssetPrefix(asset, PREFIX_GAS_CREDIT, PREFIX_NEO_CREDIT)), (ByteString)(byte[])payer);

        private static byte[] CreditLiabilityKey(string appId, UInt160 asset) =>
            AppKey(appId, AssetPrefix(asset, PREFIX_GAS_CREDIT_LIABILITY, PREFIX_NEO_CREDIT_LIABILITY));

        private static byte[] StreamLiabilityKey(string appId, UInt160 asset) =>
            AppKey(appId, AssetPrefix(asset, PREFIX_GAS_STREAM_LIABILITY, PREFIX_NEO_STREAM_LIABILITY));

        private static byte[] AssetPrefix(UInt160 asset, byte[] gasPrefix, byte[] neoPrefix)
        {
            ExecutionEngine.Assert(IsSupportedAsset(asset), "unsupported asset");
            return asset == GAS.Hash ? gasPrefix : neoPrefix;
        }

        private static BigInteger ReadInteger(byte[] key)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, key);
            return raw == null ? 0 : (BigInteger)raw;
        }

        private static void AdjustStreamLiability(string appId, UInt160 asset, BigInteger delta)
        {
            byte[] key = StreamLiabilityKey(appId, asset);
            BigInteger next = ReadInteger(key) + delta;
            ExecutionEngine.Assert(next >= 0, "stream liability underflow");
            Storage.Put(Storage.CurrentContext, key, next);
        }

        private static void Enter()
        {
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, PREFIX_REENTRANCY) == null, "reentrancy");
            Storage.Put(Storage.CurrentContext, PREFIX_REENTRANCY, 1);
        }

        private static void Exit() => Storage.Delete(Storage.CurrentContext, PREFIX_REENTRANCY);

        private static void TransferAsset(UInt160 asset, UInt160 recipient, BigInteger amount)
        {
            if (amount <= 0) return;
            bool? ok;
            if (asset == GAS.Hash) ok = GAS.Transfer(Runtime.ExecutingScriptHash, recipient, amount, null);
            else ok = NEO.Transfer(Runtime.ExecutingScriptHash, recipient, amount, null);
            ExecutionEngine.Assert(ok == true, "asset transfer failed");
        }
    }
}
