using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    // -----------------------------------------------------------------------
    // Event delegates
    // -----------------------------------------------------------------------
    public delegate void AppRegisteredHandler(string appId, BigInteger appType, UInt160 appAdmin);
    public delegate void AppPausedHandler(string appId, bool paused);
    public delegate void EnvelopeCreatedHandler(string appId, BigInteger envelopeId, UInt160 creator, BigInteger totalAmount, BigInteger packetCount);
    public delegate void EnvelopeClaimedHandler(string appId, BigInteger envelopeId, UInt160 claimer, BigInteger amount, BigInteger remaining);
    public delegate void EnvelopeCompletedHandler(string appId, BigInteger envelopeId, UInt160 bestLuckWinner, BigInteger bestLuckAmount);
    public delegate void EnvelopeRefundedHandler(string appId, BigInteger envelopeId, UInt160 creator, BigInteger refundAmount);
    public delegate void TrustCreatedHandler(string appId, BigInteger trustId, UInt160 owner, UInt160 heir, BigInteger principal);
    public delegate void HeartbeatRecordedHandler(string appId, BigInteger trustId, BigInteger newDeadline);
    public delegate void TrustExecutedHandler(string appId, BigInteger trustId, UInt160 heir, BigInteger principal);
    public delegate void TrustCancelledHandler(string appId, BigInteger trustId, UInt160 owner, BigInteger refund);
    public delegate void VaultCreatedHandler(string appId, BigInteger vaultId, UInt160 creator, BigInteger bounty, BigInteger difficulty);
    public delegate void AttemptMadeHandler(string appId, BigInteger vaultId, UInt160 attacker, bool success, BigInteger attemptNumber);
    public delegate void VaultBrokenHandler(string appId, BigInteger vaultId, UInt160 winner, BigInteger reward);
    public delegate void BountyIncreasedHandler(string appId, BigInteger vaultId, BigInteger amount, BigInteger newTotal);

    /// <summary>
    /// PlatformSocial - Multi-tenant social engine consolidating RedEnvelope,
    /// HeritageTrust, and UnbreakableVault into a single reusable contract.
    ///
    /// Each tenant registers an appId with an AppType (Envelope, Trust, Vault).
    /// All storage is scoped via AppKey(appId, PREFIX_*).
    /// </summary>
    [DisplayName("PlatformSocial")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Multi-tenant social engine: RedEnvelope, HeritageTrust, UnbreakableVault.")]
    [ContractPermission("*", "*")]
    public partial class PlatformSocialContract : SmartContract
    {
        // -----------------------------------------------------------------------
        // AppType enum constants
        // -----------------------------------------------------------------------
        private const int APP_TYPE_ENVELOPE = 1;
        private const int APP_TYPE_TRUST    = 2;
        private const int APP_TYPE_VAULT    = 3;

        // -----------------------------------------------------------------------
        // Global storage prefixes (0x01-0x0F reserved for platform)
        // -----------------------------------------------------------------------
        private static readonly byte[] PREFIX_ADMIN          = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_PAUSED         = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_APP_TYPE       = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_APP_ADMIN      = new byte[] { 0x04 };
        private static readonly byte[] PREFIX_APP_CONFIG     = new byte[] { 0x05 };
        private static readonly byte[] PREFIX_APP_PAUSED     = new byte[] { 0x06 };

        // -----------------------------------------------------------------------
        // Envelope storage prefixes (0x10-0x1F)
        // -----------------------------------------------------------------------
        private static readonly byte[] PREFIX_ENVELOPE_ID     = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_ENVELOPES       = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_GRABBER         = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_AMOUNTS         = new byte[] { 0x14 };

        // -----------------------------------------------------------------------
        // Trust storage prefixes (0x20-0x2F)
        // -----------------------------------------------------------------------
        private static readonly byte[] PREFIX_TRUST_ID        = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_TRUSTS          = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_GUARDIANS       = new byte[] { 0x25 };

        // -----------------------------------------------------------------------
        // Vault storage prefixes (0x30-0x3F)
        // -----------------------------------------------------------------------
        private static readonly byte[] PREFIX_VAULT_ID        = new byte[] { 0x30 };
        private static readonly byte[] PREFIX_VAULTS          = new byte[] { 0x31 };

        // -----------------------------------------------------------------------
        // Direct credit prefixes (0x70+)
        // -----------------------------------------------------------------------
        private static readonly byte[] PREFIX_DIRECT_GAS_CREDIT   = new byte[] { 0x70 };
        private static readonly byte[] PREFIX_DIRECT_ASSET_CREDIT = new byte[] { 0x71 };

        // -----------------------------------------------------------------------
        // Constants (from original contracts)
        // -----------------------------------------------------------------------

        // Envelope
        private const long MIN_ENVELOPE_AMOUNT = 10000000;   // 0.1 GAS
        private const long MIN_PER_PACKET      = 1000000;    // 0.01 GAS
        private const int  MAX_PACKETS         = 100;

        // Trust
        private const long MIN_PRINCIPAL          = 1;           // 1 NEO
        private const int  HEARTBEAT_MIN_SECONDS  = 604800;      // 7 days
        private const int  HEARTBEAT_MAX_SECONDS  = 31536000;    // 365 days
        private const int  TRUST_PLATFORM_FEE_BPS = 100;         // 1%
        private const int  CANCEL_PENALTY_BPS     = 500;         // 5%
        private const int  GRACE_PERIOD_SECONDS   = 604800;      // 7 days

        // Vault
        private const long MIN_BOUNTY          = 100000000;   // 1 GAS
        private const long ATTEMPT_FEE_EASY    = 10000000;    // 0.1 GAS
        private const long ATTEMPT_FEE_MEDIUM  = 50000000;    // 0.5 GAS
        private const long ATTEMPT_FEE_HARD    = 100000000;   // 1 GAS
        private const int  VAULT_PLATFORM_FEE_BPS = 200;      // 2%
        private const int  DEFAULT_VAULT_EXPIRY   = 2592000;   // 30 days

        // -----------------------------------------------------------------------
        // Events
        // -----------------------------------------------------------------------
        [DisplayName("AppRegistered")]
        public static event AppRegisteredHandler OnAppRegistered;

        [DisplayName("AppPaused")]
        public static event AppPausedHandler OnAppPaused;

        [DisplayName("EnvelopeCreated")]
        public static event EnvelopeCreatedHandler OnEnvelopeCreated;

        [DisplayName("EnvelopeClaimed")]
        public static event EnvelopeClaimedHandler OnEnvelopeClaimed;

        [DisplayName("EnvelopeCompleted")]
        public static event EnvelopeCompletedHandler OnEnvelopeCompleted;

        [DisplayName("EnvelopeRefunded")]
        public static event EnvelopeRefundedHandler OnEnvelopeRefunded;

        [DisplayName("TrustCreated")]
        public static event TrustCreatedHandler OnTrustCreated;

        [DisplayName("HeartbeatRecorded")]
        public static event HeartbeatRecordedHandler OnHeartbeatRecorded;

        [DisplayName("TrustExecuted")]
        public static event TrustExecutedHandler OnTrustExecuted;

        [DisplayName("TrustCancelled")]
        public static event TrustCancelledHandler OnTrustCancelled;

        [DisplayName("VaultCreated")]
        public static event VaultCreatedHandler OnVaultCreated;

        [DisplayName("AttemptMade")]
        public static event AttemptMadeHandler OnAttemptMade;

        [DisplayName("VaultBroken")]
        public static event VaultBrokenHandler OnVaultBroken;

        [DisplayName("BountyIncreased")]
        public static event BountyIncreasedHandler OnBountyIncreased;

        // -----------------------------------------------------------------------
        // Data Structures
        // -----------------------------------------------------------------------
        public struct EnvelopeData
        {
            public UInt160 Creator;
            public BigInteger TotalAmount;
            public BigInteger PacketCount;
            public BigInteger ClaimedCount;
            public BigInteger RemainingAmount;
            public UInt160 BestLuckAddress;
            public BigInteger BestLuckAmount;
            public BigInteger ExpiryTime;
        }

        public struct TrustData
        {
            public UInt160 Owner;
            public UInt160 Heir;
            public BigInteger Principal;
            public BigInteger CreatedTime;
            public BigInteger LastHeartbeat;
            public BigInteger HeartbeatInterval;
            public BigInteger Deadline;
            public bool Active;
            public bool Executed;
            public bool Cancelled;
        }

        public struct VaultData
        {
            public UInt160 Creator;
            public BigInteger Bounty;
            public ByteString SecretHash;
            public BigInteger AttemptCount;
            public BigInteger Difficulty; // 1=Easy, 2=Medium, 3=Hard
            public BigInteger CreatedTime;
            public BigInteger ExpiryTime;
            public bool Broken;
            public bool Expired;
            public UInt160 Winner;
        }

        // -----------------------------------------------------------------------
        // Lifecycle
        // -----------------------------------------------------------------------
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }

        // -----------------------------------------------------------------------
        // Admin management
        // -----------------------------------------------------------------------

        [Safe]
        public static UInt160 Admin() => ReadAddress(PREFIX_ADMIN);

        [Safe]
        public static bool IsPaused()
        {
            ByteString v = Storage.Get(Storage.CurrentContext, PREFIX_PAUSED);
            return v != null && (BigInteger)v == 1;
        }

        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        private static void ValidateNotPaused()
        {
            ExecutionEngine.Assert(!IsPaused(), "platform paused");
        }

        private static void ValidateAppNotPaused(string appId)
        {
            ValidateNotPaused();
            ByteString v = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_APP_PAUSED, (ByteString)appId));
            ExecutionEngine.Assert(v == null || (BigInteger)v == 0, "app paused");
        }

        private static void ValidateAppRegistered(string appId, int expectedType)
        {
            BigInteger appType = GetBigInteger(
                Helper.Concat((ByteString)PREFIX_APP_TYPE, (ByteString)appId));
            ExecutionEngine.Assert(appType == expectedType, "wrong app type");
        }

        private static void ValidateAppAdmin(string appId)
        {
            UInt160 appAdmin = ReadAppAdmin(appId);
            UInt160 admin = Admin();
            bool isGlobalAdmin = admin != UInt160.Zero && Runtime.CheckWitness(admin);
            bool isAppAdmin = appAdmin != UInt160.Zero && Runtime.CheckWitness(appAdmin);
            ExecutionEngine.Assert(isGlobalAdmin || isAppAdmin, "not app admin");
        }

        private static UInt160 ReadAppAdmin(string appId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_APP_ADMIN, (ByteString)appId));
            return data == null ? UInt160.Zero : (UInt160)data;
        }

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != UInt160.Zero && newAdmin.IsValid, "invalid address");
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
        }

        public static void SetPaused(bool paused)
        {
            ValidateAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_PAUSED, paused ? 1 : 0);
        }

        public static void Update(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nef, manifest, new object[0]);
        }

        // -----------------------------------------------------------------------
        // App registration
        // -----------------------------------------------------------------------

        /// <summary>
        /// Register a social app under a unique appId.
        /// appType: 1=Envelope, 2=Trust, 3=Vault
        /// </summary>
        public static void RegisterApp(string appId, BigInteger appType, UInt160 appAdmin, string config)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(appId.Length > 0 && appId.Length <= 64, "invalid appId");
            ExecutionEngine.Assert(appType >= APP_TYPE_ENVELOPE && appType <= APP_TYPE_VAULT, "invalid appType");
            ExecutionEngine.Assert(appAdmin != UInt160.Zero && appAdmin.IsValid, "invalid appAdmin");

            // Ensure not already registered
            BigInteger existing = GetBigInteger(
                Helper.Concat((ByteString)PREFIX_APP_TYPE, (ByteString)appId));
            ExecutionEngine.Assert(existing == 0, "app already registered");

            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_APP_TYPE, (ByteString)appId), appType);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_APP_ADMIN, (ByteString)appId), appAdmin);
            if (config.Length > 0)
            {
                Storage.Put(Storage.CurrentContext,
                    Helper.Concat((ByteString)PREFIX_APP_CONFIG, (ByteString)appId), config);
            }

            OnAppRegistered(appId, appType, appAdmin);
        }

        /// <summary>
        /// Pause or unpause a specific app.
        /// </summary>
        public static void SetAppPaused(string appId, bool paused)
        {
            ValidateAppAdmin(appId);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_APP_PAUSED, (ByteString)appId),
                paused ? 1 : 0);
            OnAppPaused(appId, paused);
        }

        [Safe]
        public static BigInteger GetAppType(string appId)
        {
            return GetBigInteger(Helper.Concat((ByteString)PREFIX_APP_TYPE, (ByteString)appId));
        }

        [Safe]
        public static bool IsAppPaused(string appId)
        {
            ByteString v = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_APP_PAUSED, (ByteString)appId));
            return v != null && (BigInteger)v == 1;
        }

        // -----------------------------------------------------------------------
        // NEP-17 payment handler -- routes GAS/NEO deposits by appId in memo
        // -----------------------------------------------------------------------

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            if (from == Runtime.ExecutingScriptHash || amount <= 0) return;

            UInt160 caller = Runtime.CallingScriptHash;

            if (caller == GAS.Hash)
            {
                CreditGas(from, amount);
                return;
            }

            if (caller == NEO.Hash)
            {
                CreditNeo(from, amount);
                return;
            }

            ExecutionEngine.Assert(false, "unsupported asset");
        }

        // -----------------------------------------------------------------------
        // Direct credit management
        // -----------------------------------------------------------------------

        private static void CreditGas(UInt160 from, BigInteger amount)
        {
            StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_DIRECT_GAS_CREDIT);
            ByteString key = (ByteString)(byte[])from;
            ByteString existing = credits.Get(key);
            BigInteger balance = existing == null ? 0 : (BigInteger)existing;
            credits.Put(key, balance + amount);
        }

        private static void ConsumeGasCredit(UInt160 payer, BigInteger amount)
        {
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_DIRECT_GAS_CREDIT);
            ByteString key = (ByteString)(byte[])payer;
            ByteString existing = credits.Get(key);
            BigInteger balance = existing == null ? 0 : (BigInteger)existing;
            ExecutionEngine.Assert(balance >= amount, "insufficient GAS credit");
            BigInteger next = balance - amount;
            if (next == 0) credits.Delete(key);
            else credits.Put(key, next);
        }

        private static void CreditNeo(UInt160 from, BigInteger amount)
        {
            StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_DIRECT_ASSET_CREDIT);
            ByteString key = (ByteString)(byte[])from;
            ByteString existing = credits.Get(key);
            BigInteger balance = existing == null ? 0 : (BigInteger)existing;
            credits.Put(key, balance + amount);
        }

        private static void ConsumeNeoCredit(UInt160 payer, BigInteger amount)
        {
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_DIRECT_ASSET_CREDIT);
            ByteString key = (ByteString)(byte[])payer;
            ByteString existing = credits.Get(key);
            BigInteger balance = existing == null ? 0 : (BigInteger)existing;
            ExecutionEngine.Assert(balance >= amount, "insufficient NEO credit");
            BigInteger next = balance - amount;
            if (next == 0) credits.Delete(key);
            else credits.Put(key, next);
        }
    }
}
