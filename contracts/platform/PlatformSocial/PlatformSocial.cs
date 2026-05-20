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
    public delegate void VaultRefundedHandler(string appId, BigInteger vaultId, UInt160 creator, BigInteger refund);

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
    // Audit fix H-11: wildcard `*:*` permission replaced with the actual call surface
    // (NEO + GAS native methods only). PlatformSocial never invokes user-controlled
    // contracts, so an explicit allowlist is strictly tighter than the previous
    // wildcard.
    [ContractPermission("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", "transfer", "balanceOf")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer", "balanceOf")]
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
        // Aggregate NEO liability across all active trusts for the app. Incremented
        // on CreateTrust, decremented on ExecuteTrust/CancelTrust. The vault solvency
        // invariant asserts the contract balance covers this total on every payout so
        // a stale per-trust balance check cannot silently drain principal that has
        // already been promised to another trust.
        private static readonly byte[] PREFIX_TRUST_ACTIVE_PRINCIPAL = new byte[] { 0x26 };

        // -----------------------------------------------------------------------
        // Vault storage prefixes (0x30-0x3F)
        // -----------------------------------------------------------------------
        private static readonly byte[] PREFIX_VAULT_ID        = new byte[] { 0x30 };
        private static readonly byte[] PREFIX_VAULTS          = new byte[] { 0x31 };
        // Audit fix H-10: commit-reveal prevents mempool front-running of solutions.
        // PREFIX_VAULT_COMMIT stores H(salt || solution || attacker) keyed by (vaultId, attacker).
        // Each entry holds {commitBlock, ...}. The reveal must arrive after VAULT_REVEAL_DELAY_BLOCKS.
        private static readonly byte[] PREFIX_VAULT_COMMIT    = new byte[] { 0x32 };

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

        // Trust. Runtime.Time on Neo N3 is BLOCK TIMESTAMP IN MILLISECONDS, so all
        // duration constants must be in milliseconds. The original constants were
        // labelled as seconds and added directly to Runtime.Time, producing
        // deadlines 1000x sooner than documented (e.g. "7 days" → 10 minutes).
        private const long MIN_PRINCIPAL          = 1;                  // 1 NEO
        private const long HEARTBEAT_MIN_MS       = 604800000L;          // 7 days
        private const long HEARTBEAT_MAX_MS       = 31536000000L;        // 365 days
        private const int  TRUST_PLATFORM_FEE_BPS = 100;                 // 1%
        private const int  CANCEL_PENALTY_BPS     = 500;                 // 5%
        private const long GRACE_PERIOD_MS        = 604800000L;          // 7 days

        // Vault
        private const long MIN_BOUNTY              = 100000000;          // 1 GAS
        private const long ATTEMPT_FEE_EASY        = 10000000;           // 0.1 GAS
        private const long ATTEMPT_FEE_MEDIUM      = 50000000;           // 0.5 GAS
        private const long ATTEMPT_FEE_HARD        = 100000000;          // 1 GAS
        private const int  VAULT_PLATFORM_FEE_BPS  = 200;                // 2%
        private const long DEFAULT_VAULT_EXPIRY_MS = 2592000000L;        // 30 days
        // Audit fix H-10: minimum delay between commit and reveal (in ms).
        // Long enough to make front-running impractical even when a block is empty,
        // short enough to keep UX acceptable (~30 seconds).
        private const long VAULT_REVEAL_MIN_DELAY_MS = 30000L;

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

        [DisplayName("VaultRefunded")]
        public static event VaultRefundedHandler OnVaultRefunded;

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
