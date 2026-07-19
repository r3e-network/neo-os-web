using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // ===================================================================
    //  Event delegates
    // ===================================================================
    public delegate void RegistryAppRegisteredHandler(string appId, string engineId, UInt160 appAdmin, UInt160 accountHash);
    public delegate void RegistryAccountMintedHandler(string appId, UInt160 account, BigInteger artifactVersion);
    public delegate void RegistryAccountUpgradedHandler(string appId, BigInteger artifactVersion);
    public delegate void RegistryUpgradeProposedHandler(string appId, BigInteger artifactVersion, BigInteger executeAfter);
    public delegate void RegistryShimConsentHandler(string appId, bool consented);
    public delegate void RegistryArtifactProposedHandler(BigInteger version, BigInteger executeAfter);
    public delegate void RegistryArtifactActivatedHandler(BigInteger version, BigInteger checksum);
    public delegate void RegistryEngineProposedHandler(string engineId, UInt160 engineHash, BigInteger schemaVersion, bool retire, BigInteger executeAfter);
    public delegate void RegistryEngineRegisteredHandler(string engineId, UInt160 engineHash, BigInteger schemaVersion);
    public delegate void RegistryEngineRetiredHandler(string engineId);
    public delegate void RegistryEngineAttachedHandler(string appId, string engineId);
    public delegate void RegistryDescriptorAppliedHandler(string appId, string key);
    public delegate void RegistryAdminTimelockProposedHandler(UInt160 proposed, BigInteger executeAfter);
    public delegate void RegistryAdminChangedHandler(UInt160 previousAdmin, UInt160 newAdmin);
    public delegate void RegistryAppAdminProposedHandler(string appId, UInt160 newAdmin, BigInteger executeAfter);
    public delegate void RegistryAppAdminRotatedHandler(string appId, UInt160 previousAdmin, UInt160 newAdmin);
    public delegate void RegistryAppPausedChangedHandler(string appId, bool paused);
    public delegate void RegistryGlobalPausedChangedHandler(bool paused, BigInteger pausedAt);
    public delegate void RegistryCreditedHandler(string appId, UInt160 payer, BigInteger amount);
    public delegate void RegistryCreditWithdrawnHandler(string appId, UInt160 payer, BigInteger amount);
    public delegate void RegistryPayoutProposedHandler(string appId, UInt160 value, BigInteger executeAfter);
    public delegate void RegistryPayoutChangedHandler(string appId, UInt160 value);
    public delegate void RegistrySpendProposedHandler(string appId, UInt160 asset, BigInteger amount, BigInteger executeAfter);
    public delegate void RegistryPayoutSpentHandler(string appId, UInt160 asset, BigInteger amount);
    public delegate void RegistryEnginePoolFundedHandler(string appId, UInt160 engineHash, BigInteger amount);
    public delegate void RegistryFeesWithdrawnHandler(UInt160 admin, BigInteger amount);
    public delegate void RegistryUpgradeScheduledHandler(BigInteger executeAfter);
    public delegate void RegistryUpgradedHandler(ByteString nefHash, ByteString manifestHash);
    public delegate void RegistryThresholdRaiseScheduledHandler(string appId, BigInteger threshold, BigInteger executeAfter);

    // ===================================================================
    //  Serialized row types
    // ===================================================================
    public class EngineRow { public UInt160 Hash; public BigInteger SchemaVersion; public bool Active; }
    public class PendingEngine { public UInt160 Hash; public BigInteger SchemaVersion; public BigInteger Eta; public bool Retire; }
    public class PendingAddress { public UInt160 Value; public BigInteger Eta; }
    public class PendingSpend { public UInt160 Asset; public BigInteger Amount; public BigInteger Eta; }
    public class TransitNote { public UInt160 Account; public BigInteger Amount; }

    // ===================================================================
    //  PlatformRegistry — the estate spine
    //  (docs/platform-contract-library-v2.md sections 3.1 + 4)
    //
    //  Permissionless fee-paid app registration, the appId -> AppAccount
    //  directory, the timelocked engine table, descriptor forwarding to
    //  engine-side validation, and the role-bound treasury policy over the
    //  minted AppAccount shims. The registry holds no pooled user funds
    //  beyond the prepaid (appId, payer) GAS credit ledger, whose exits
    //  are witness-gated and pause-immune.
    //
    //  STORAGE LAYOUT (single-byte prefix map, design section 3.1;
    //  0x06/0x07/0x08 are registry-core additions documented here:
    //  upgrade timelock pair + treasury transit note)
    //    0x01        platform admin
    //    0x02 01/02  pending platform admin + eta
    //    0x03        global pausedAt (present == paused)
    //    0x04 01-05  active AppAccount artifact: nef / manifest head /
    //                manifest tail / version / nef checksum
    //    0x04 11-14  pending artifact: nef / head / tail / eta
    //    0x05        accrued platform fees
    //    0x06        scheduled upgrade eta
    //    0x07        scheduled upgrade sha256(nef ++ manifest)
    //    0x08        treasury transit note (fundEnginePool hop)
    //    0x09        mint reentrancy lock
    //    0x10        appId -> appAdmin (row presence == registered)
    //    0x11        appId -> minted AppAccount hash
    //    0x12        appId -> paused flag
    //    0x13        appId ':' key -> descriptor entry (serialized)
    //    0x14        appId -> attached engineId
    //    0x15        appId -> pending app-admin rotation
    //    0x16 01-05  payout address / pending payout / spend threshold /
    //                pending spend / rolling 24h spend window {anchor, spent}
    //    0x17        appId -> shim-upgrade consent (approved artifact version)
    //    0x18        appId -> pending shim-upgrade eta
    //    0x20 01/02  engineId -> engine row / pending engine change
    //    0x21        engineHash -> engineId
    //    0x22        account hash -> appId (permission-anchoring reverse index)
    //    0x70 01/02  (appId, payer) prepaid GAS credit / total liability
    // ===================================================================
    [DisplayName("PlatformRegistry")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Estate spine: permissionless app registration, minted per-app treasury accounts, timelocked engine table, descriptor forwarding, role-bound treasury policy.")]
    // GAS: credit withdrawals, fee withdrawals, engine pool funding.
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")]
    // ContractManagement: account minting, engine existence asserts, self-update.
    [ContractPermission("0xfffdc93764dbaddd97c48f252a53ea4643faa3fd", "deploy", "getContract", "update")]
    // Dynamic targets (minted accounts + registered engines): named methods only.
    [ContractPermission("*", "activateApp", "validateAndApplyDescriptor", "bindRegistry", "onAdminRotated", "executeTransfer", "setPaused", "update")]
    public partial class PlatformRegistry : SmartContract
    {
        // ---- registry core prefixes (0x01-0x0F) ----
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_PENDING_PLATFORM_ADMIN = new byte[] { 0x02, 0x01 };
        private static readonly byte[] PREFIX_PLATFORM_ADMIN_CHANGE_TIME = new byte[] { 0x02, 0x02 };
        private static readonly byte[] PREFIX_GLOBAL_PAUSED_AT = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_ARTIFACT_NEF = new byte[] { 0x04, 0x01 };
        private static readonly byte[] PREFIX_ARTIFACT_MANIFEST_HEAD = new byte[] { 0x04, 0x02 };
        private static readonly byte[] PREFIX_ARTIFACT_MANIFEST_TAIL = new byte[] { 0x04, 0x03 };
        private static readonly byte[] PREFIX_ARTIFACT_VERSION = new byte[] { 0x04, 0x04 };
        private static readonly byte[] PREFIX_ARTIFACT_CHECKSUM = new byte[] { 0x04, 0x05 };
        private static readonly byte[] PREFIX_PENDING_ARTIFACT_NEF = new byte[] { 0x04, 0x11 };
        private static readonly byte[] PREFIX_PENDING_ARTIFACT_HEAD = new byte[] { 0x04, 0x12 };
        private static readonly byte[] PREFIX_PENDING_ARTIFACT_TAIL = new byte[] { 0x04, 0x13 };
        private static readonly byte[] PREFIX_PENDING_ARTIFACT_ETA = new byte[] { 0x04, 0x14 };
        private static readonly byte[] PREFIX_ACCRUED_FEES = new byte[] { 0x05 };
        private static readonly byte[] PREFIX_UPGRADE_TIME = new byte[] { 0x06 };
        private static readonly byte[] PREFIX_UPGRADE_HASH = new byte[] { 0x07 };
        private static readonly byte[] PREFIX_TREASURY_TRANSIT = new byte[] { 0x08 };
        private static readonly byte[] PREFIX_MINT_LOCK = new byte[] { 0x09 };

        // ---- app row prefixes (0x10-0x1F) ----
        private static readonly byte[] PREFIX_APP_ADMIN = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_APP_ACCOUNT = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_APP_PAUSED = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_DESCRIPTOR = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_APP_ENGINE = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_PENDING_APP_ADMIN = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_PAYOUT = new byte[] { 0x16, 0x01 };
        private static readonly byte[] PREFIX_PENDING_PAYOUT = new byte[] { 0x16, 0x02 };
        private static readonly byte[] PREFIX_SPEND_THRESHOLD = new byte[] { 0x16, 0x03 };
        private static readonly byte[] PREFIX_PENDING_SPEND = new byte[] { 0x16, 0x04 };
        private static readonly byte[] PREFIX_SPEND_WINDOW = new byte[] { 0x16, 0x05 };
        private static readonly byte[] PREFIX_PENDING_THRESHOLD_VALUE = new byte[] { 0x16, 0x06 };
        private static readonly byte[] PREFIX_PENDING_THRESHOLD_ETA = new byte[] { 0x16, 0x07 };
        private static readonly byte[] PREFIX_SHIM_CONSENT = new byte[] { 0x17 };
        private static readonly byte[] PREFIX_PENDING_SHIM_UPGRADE = new byte[] { 0x18 };

        // ---- engine table prefixes (0x20-0x2F) ----
        private static readonly byte[] PREFIX_ENGINE_ROW = new byte[] { 0x20, 0x01 };
        private static readonly byte[] PREFIX_PENDING_ENGINE = new byte[] { 0x20, 0x02 };
        private static readonly byte[] PREFIX_ENGINE_ID_BY_HASH = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_APP_ID_BY_ACCOUNT = new byte[] { 0x22 };

        // ---- credit ledger prefixes (0x70) ----
        private static readonly byte[] PREFIX_CREDIT = new byte[] { 0x70, 0x01 };
        private static readonly byte[] PREFIX_CREDIT_LIABILITY = new byte[] { 0x70, 0x02 };

        // Timelock for every platform-authority change. Runtime.Time is the
        // block timestamp in MILLISECONDS on Neo N3, so the delay is stored in
        // ms for `Runtime.Time >= changeTime` to mean "24 hours have passed"
        // (the audited PlatformGame.Admin.cs constant, seconds bug already fixed).
        private const long TIMELOCK_DELAY_MS = 86400000; // 24 hours in milliseconds

        private const int MAX_APP_ID_LENGTH = 64;
        private const int MAX_DESCRIPTOR_KEY_LENGTH = 128;
        private const int MAX_MANIFEST_LENGTH = 65536;

        // Registration fees, consumed from the caller's prepaid (appId, payer)
        // GAS credit — the PlatformAnchor M-11 model. The lite fee is the
        // anti-spam floor; the mint fee mirrors Neo's minimum deployment fee.
        private const long FEE_LITE_REGISTRATION = 100_000_000;      // 1 GAS
        private const long FEE_ACCOUNT_MINT = 1_000_000_000;         // 10 GAS

        // The per-app spend threshold bounds CUMULATIVE instant-lane outflow
        // over a rolling 24h window (not per call): spentInWindow + amount <=
        // threshold. Larger single spends use the timelocked proposeSpend/
        // executeSpend pair. The threshold itself is descriptor data under the
        // registry namespace, range-validated.
        private const long DEFAULT_SPEND_THRESHOLD = 10_000_000_000;    // 100 GAS
        private const long MIN_SPEND_THRESHOLD = 100_000_000;           // 1 GAS
        private const long MAX_SPEND_THRESHOLD = 1_000_000_000_000;     // 10000 GAS

        // Rolling window for the cumulative spendToPayout budget, keyed on an
        // anchor timestamp (the audited PlatformGame.Dice M-4 pattern) so it
        // never resets on a calendar boundary.
        private const long SPEND_WINDOW_MS = 86400000; // 24 hours in milliseconds

        // ---- events ----
        [DisplayName("AppRegistered")] public static event RegistryAppRegisteredHandler OnAppRegistered;
        [DisplayName("AppAccountMinted")] public static event RegistryAccountMintedHandler OnAppAccountMinted;
        [DisplayName("AppAccountUpgraded")] public static event RegistryAccountUpgradedHandler OnAppAccountUpgraded;
        [DisplayName("AppAccountUpgradeProposed")] public static event RegistryUpgradeProposedHandler OnAppAccountUpgradeProposed;
        [DisplayName("ShimUpgradeConsentChanged")] public static event RegistryShimConsentHandler OnShimUpgradeConsentChanged;
        [DisplayName("ArtifactProposed")] public static event RegistryArtifactProposedHandler OnArtifactProposed;
        [DisplayName("ArtifactActivated")] public static event RegistryArtifactActivatedHandler OnArtifactActivated;
        [DisplayName("EngineChangeProposed")] public static event RegistryEngineProposedHandler OnEngineChangeProposed;
        [DisplayName("EngineRegistered")] public static event RegistryEngineRegisteredHandler OnEngineRegistered;
        [DisplayName("EngineRetired")] public static event RegistryEngineRetiredHandler OnEngineRetired;
        [DisplayName("EngineAttached")] public static event RegistryEngineAttachedHandler OnEngineAttached;
        [DisplayName("DescriptorApplied")] public static event RegistryDescriptorAppliedHandler OnDescriptorApplied;
        [DisplayName("SpendThresholdRaiseScheduled")] public static event RegistryThresholdRaiseScheduledHandler OnSpendThresholdRaiseScheduled;
        [DisplayName("AdminTimelockProposed")] public static event RegistryAdminTimelockProposedHandler OnAdminTimelockProposed;
        [DisplayName("AdminChanged")] public static event RegistryAdminChangedHandler OnAdminChanged;
        [DisplayName("AppAdminRotationProposed")] public static event RegistryAppAdminProposedHandler OnAppAdminRotationProposed;
        [DisplayName("AppAdminRotated")] public static event RegistryAppAdminRotatedHandler OnAppAdminRotated;
        [DisplayName("AppPausedChanged")] public static event RegistryAppPausedChangedHandler OnAppPausedChanged;
        [DisplayName("GlobalPausedChanged")] public static event RegistryGlobalPausedChangedHandler OnGlobalPausedChanged;
        [DisplayName("Credited")] public static event RegistryCreditedHandler OnCredited;
        [DisplayName("CreditWithdrawn")] public static event RegistryCreditWithdrawnHandler OnCreditWithdrawn;
        [DisplayName("PayoutAddressProposed")] public static event RegistryPayoutProposedHandler OnPayoutAddressProposed;
        [DisplayName("PayoutAddressChanged")] public static event RegistryPayoutChangedHandler OnPayoutAddressChanged;
        [DisplayName("SpendProposed")] public static event RegistrySpendProposedHandler OnSpendProposed;
        [DisplayName("PayoutSpent")] public static event RegistryPayoutSpentHandler OnPayoutSpent;
        [DisplayName("EnginePoolFunded")] public static event RegistryEnginePoolFundedHandler OnEnginePoolFunded;
        [DisplayName("PlatformFeesWithdrawn")] public static event RegistryFeesWithdrawnHandler OnPlatformFeesWithdrawn;
        [DisplayName("UpgradeScheduled")] public static event RegistryUpgradeScheduledHandler OnUpgradeScheduled;
        [DisplayName("ContractUpgraded")] public static event RegistryUpgradedHandler OnContractUpgraded;

        // ===================================================================
        //  Lifecycle
        // ===================================================================
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }
    }
}
