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
    public delegate void RangeGasPoolCreatedHandler(string appId, BigInteger poolId, UInt160 creator, BigInteger totalAmount, BigInteger minClaimAmount, BigInteger maxClaimAmount, BigInteger maxClaims);
    public delegate void RangeGasPoolClaimedHandler(string appId, BigInteger poolId, UInt160 claimer, BigInteger amount, BigInteger remainingAmount, BigInteger remainingClaims);
    public delegate void RangeGasPoolCompletedHandler(string appId, BigInteger poolId, UInt160 bestLuckWinner, BigInteger bestLuckAmount);
    public delegate void RangeGasPoolFundedHandler(string appId, BigInteger poolId, UInt160 creator, BigInteger amount, BigInteger totalAmount, BigInteger remainingAmount);
    public delegate void RangeGasPoolRefundedHandler(string appId, BigInteger poolId, UInt160 creator, BigInteger refundAmount);
    public delegate void GasCreditWithdrawnHandler(UInt160 user, BigInteger amount);
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
        private static readonly byte[] PREFIX_RANGE_POOL_ID   = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_RANGE_POOLS     = new byte[] { 0x16 };
        private static readonly byte[] PREFIX_RANGE_CLAIMER   = new byte[] { 0x17 };

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
        private const long MIN_RANGE_POOL_AMOUNT = 10000000; // 0.1 GAS

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

        [DisplayName("RangeGasPoolCreated")]
        public static event RangeGasPoolCreatedHandler OnRangeGasPoolCreated;

        [DisplayName("RangeGasPoolClaimed")]
        public static event RangeGasPoolClaimedHandler OnRangeGasPoolClaimed;

        [DisplayName("RangeGasPoolCompleted")]
        public static event RangeGasPoolCompletedHandler OnRangeGasPoolCompleted;

        [DisplayName("RangeGasPoolFunded")]
        public static event RangeGasPoolFundedHandler OnRangeGasPoolFunded;

        [DisplayName("RangeGasPoolRefunded")]
        public static event RangeGasPoolRefundedHandler OnRangeGasPoolRefunded;

        [DisplayName("GasCreditWithdrawn")]
        public static event GasCreditWithdrawnHandler OnGasCreditWithdrawn;

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

        public struct RangeGasPoolData
        {
            public UInt160 Creator;
            public BigInteger TotalAmount;
            public BigInteger MinClaimAmount;
            public BigInteger MaxClaimAmount;
            public BigInteger MaxClaims;
            public BigInteger ClaimedCount;
            public BigInteger RemainingAmount;
            public UInt160 BestLuckAddress;
            public BigInteger BestLuckAmount;
            public BigInteger ExpiryTime;
            public bool Active;
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
    }
}
