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
    // Event delegates for GuardianPolicy lifecycle
    public delegate void PolicyCreatedHandler(BigInteger policyId, UInt160 holder, string assetType, BigInteger coverage);
    public delegate void PolicyRenewedHandler(BigInteger policyId, UInt160 holder, BigInteger newEndTime);
    public delegate void PolicyCancelledHandler(BigInteger policyId, UInt160 holder, BigInteger refundAmount);
    public delegate void ClaimRequestedHandler(BigInteger policyId, BigInteger requestId);
    public delegate void ClaimProcessedHandler(BigInteger policyId, UInt160 holder, bool approved, BigInteger payout);
    public delegate void PremiumPaidHandler(UInt160 holder, BigInteger policyId, BigInteger amount);
    public delegate void HolderBadgeEarnedHandler(UInt160 holder, BigInteger badgeType, string badgeName);
    public delegate void PeriodicExecutionTriggeredHandler(BigInteger taskId);

    /// <summary>
    /// Guardian Policy - Decentralized insurance with automation.
    /// </summary>
    [DisplayName("MiniAppGuardianPolicy")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "3.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. GuardianPolicy is a decentralized insurance application for asset protection.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppGuardianPolicy : MiniAppServiceBase
    {
        #region App Constants
        private const string APP_ID = "miniapp-guardianpolicy";
        private const long MIN_COVERAGE = 100000000;      // 1 GAS
        private const long MAX_COVERAGE = 100000000000;   // 1000 GAS
        private const int PREMIUM_RATE_PERCENT = 5;       // 5% of coverage
        private const int EARLY_CANCEL_FEE_PERCENT = 20;  // 20% fee
        private const ulong POLICY_DURATION_SECONDS = 2592000; // 30 days
        private const ulong RENEWAL_GRACE_PERIOD_SECONDS = 86400; // 1 day
        private const int MAX_THRESHOLD_PERCENT = 50;     // Max 50% price drop
        #endregion

        #region App Prefixes (0x20+)
        private static readonly byte[] PREFIX_POLICY_ID = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_POLICIES = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_REQUEST_TO_POLICY = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_HOLDER_STATS = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_HOLDER_BADGES = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_TOTAL_COVERAGE = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_TOTAL_PREMIUMS = new byte[] { 0x26 };
        private static readonly byte[] PREFIX_TOTAL_PAYOUTS = new byte[] { 0x27 };
        private static readonly byte[] PREFIX_TOTAL_HOLDERS = new byte[] { 0x28 };
        private static readonly byte[] PREFIX_ACTIVE_POLICIES = new byte[] { 0x29 };
        private static readonly byte[] PREFIX_HOLDER_POLICIES = new byte[] { 0x2A };
        #endregion

        #region Data Structures
        public struct PolicyData
        {
            public UInt160 Holder;
            public string AssetType;
            public BigInteger PolicyType;
            public BigInteger Coverage;
            public BigInteger Premium;
            public BigInteger StartPrice;
            public BigInteger ThresholdPercent;
            public BigInteger StartTime;
            public BigInteger EndTime;
            public BigInteger RenewalCount;
            public bool Active;
            public bool Claimed;
            public BigInteger PayoutAmount;
        }

        public struct HolderStats
        {
            public BigInteger TotalPolicies;
            public BigInteger ActivePolicies;
            public BigInteger TotalPremiumsPaid;
            public BigInteger TotalCoverage;
            public BigInteger TotalClaims;
            public BigInteger ApprovedClaims;
            public BigInteger TotalPayoutsReceived;
            public BigInteger ClaimFreePolicies;
            public BigInteger BadgeCount;
            public BigInteger JoinTime;
            public BigInteger LastPolicyTime;
        }
        #endregion

        #region App Events
        [DisplayName("PolicyCreated")]
        public static event PolicyCreatedHandler OnPolicyCreated;

        [DisplayName("PolicyRenewed")]
        public static event PolicyRenewedHandler OnPolicyRenewed;

        [DisplayName("PolicyCancelled")]
        public static event PolicyCancelledHandler OnPolicyCancelled;

        [DisplayName("ClaimRequested")]
        public static event ClaimRequestedHandler OnClaimRequested;

        [DisplayName("ClaimProcessed")]
        public static event ClaimProcessedHandler OnClaimProcessed;

        [DisplayName("PremiumPaid")]
        public static event PremiumPaidHandler OnPremiumPaid;

        [DisplayName("HolderBadgeEarned")]
        public static event HolderBadgeEarnedHandler OnHolderBadgeEarned;

        [DisplayName("PeriodicExecutionTriggered")]
        public static event PeriodicExecutionTriggeredHandler OnPeriodicExecutionTriggered;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_POLICY_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_COVERAGE, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PREMIUMS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PAYOUTS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_HOLDERS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_ACTIVE_POLICIES, 0);
        }
        #endregion

        #region Read Methods

        [Safe]
        public static BigInteger GetPolicyCount() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_POLICY_ID);

        [Safe]
        public static BigInteger GetActivePolicyCount() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ACTIVE_POLICIES);

        [Safe]
        public static BigInteger GetTotalCoverage() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_COVERAGE);

        [Safe]
        public static BigInteger GetTotalPremiums() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_PREMIUMS);

        [Safe]
        public static BigInteger GetTotalPayouts() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_PAYOUTS);

        [Safe]
        public static BigInteger GetTotalHolders() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_HOLDERS);

        [Safe]
        public static PolicyData GetPolicy(BigInteger policyId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_POLICIES, (ByteString)policyId.ToByteArray()));
            if (data == null) return new PolicyData();
            return (PolicyData)StdLib.Deserialize(data);
        }

        [Safe]
        public static HolderStats GetHolderStats(UInt160 holder)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_HOLDER_STATS, holder));
            if (data == null) return new HolderStats();
            return (HolderStats)StdLib.Deserialize(data);
        }

        [Safe]
        public static bool HasHolderBadge(UInt160 holder, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_HOLDER_BADGES, holder),
                (ByteString)badgeType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }

        #endregion
    }
}
