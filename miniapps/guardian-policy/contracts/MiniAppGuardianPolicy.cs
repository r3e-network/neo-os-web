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
    /// <summary>
    /// GuardianPolicy MiniApp - Decentralized insurance for crypto assets with price protection.
    ///
    /// KEY FEATURES:
    /// - Create insurance policies with configurable coverage
    /// - Multiple policy types: Basic, Premium, Enterprise
    /// - Price-based claim verification via oracle
    /// - Renewable policies with grace period
    /// - Early cancellation with pro-rata refund
    ///
    /// SECURITY:
    /// - Price oracle verification for claims
    /// - Holder authorization required
    /// - Grace period for renewals
    /// - Maximum coverage limits
    ///
    /// PERMISSIONS:
    /// - GAS token transfers for premiums and payouts
    /// </summary>
    [DisplayName("MiniAppGuardianPolicy")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "GuardianPolicy provides decentralized insurance for crypto assets with price drop protection and automated claim verification.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]
    public partial class MiniAppGuardianPolicy : MiniAppBase
    {
        #region App Constants
        /// <summary>Unique application identifier for the GuardianPolicy miniapp.</summary>
        private const string APP_ID = "miniapp-guardian-policy";
        
        /// <summary>Policy duration in seconds (30 days = 2,592,000).</summary>
        private const int POLICY_DURATION_SECONDS = 2592000;
        
        /// <summary>Grace period after expiry for renewals (7 days = 604,800).</summary>
        private const int RENEWAL_GRACE_PERIOD_SECONDS = 604800;
        
        /// <summary>Minimum coverage amount (1 GAS = 100,000,000).</summary>
        private const long MIN_COVERAGE = 100000000;
        
        /// <summary>Maximum coverage amount (1000 GAS = 100,000,000,000).</summary>
        private const long MAX_COVERAGE = 100000000000;
        
        /// <summary>Premium rate as percentage of coverage (2% = 2).</summary>
        private const int PREMIUM_RATE_PERCENT = 2;
        
        /// <summary>Maximum price drop threshold (50%).</summary>
        private const int MAX_THRESHOLD_PERCENT = 50;
        
        /// <summary>Early cancellation fee percentage (10%).</summary>
        private const int EARLY_CANCEL_FEE_PERCENT = 10;
        
        /// <summary>Policy type: Basic coverage.</summary>
        private const int POLICY_TYPE_BASIC = 1;
        
        /// <summary>Policy type: Premium coverage with benefits.</summary>
        private const int POLICY_TYPE_PREMIUM = 2;
        
        /// <summary>Policy type: Enterprise coverage.</summary>
        private const int POLICY_TYPE_ENTERPRISE = 3;
        #endregion

        #region App Prefixes (0x20+ to avoid collision with MiniAppBase)
        /// <summary>Prefix 0x20: Current policy ID counter.</summary>
        private static readonly byte[] PREFIX_POLICY_ID = new byte[] { 0x20 };
        
        /// <summary>Prefix 0x21: Policy data storage.</summary>
        private static readonly byte[] PREFIX_POLICIES = new byte[] { 0x21 };
        
        /// <summary>Prefix 0x22: Holder statistics.</summary>
        private static readonly byte[] PREFIX_HOLDER_STATS = new byte[] { 0x22 };
        
        /// <summary>Prefix 0x23: Total coverage amount across all policies.</summary>
        private static readonly byte[] PREFIX_TOTAL_COVERAGE = new byte[] { 0x23 };
        
        /// <summary>Prefix 0x24: Total premiums collected.</summary>
        private static readonly byte[] PREFIX_TOTAL_PREMIUMS = new byte[] { 0x24 };
        
        /// <summary>Prefix 0x25: Total payouts distributed.</summary>
        private static readonly byte[] PREFIX_TOTAL_PAYOUTS = new byte[] { 0x25 };
        
        /// <summary>Prefix 0x26: Request to policy mapping.</summary>
        private static readonly byte[] PREFIX_REQUEST_TO_POLICY = new byte[] { 0x26 };
        
        /// <summary>Prefix 0x27: Active policy count.</summary>
        private static readonly byte[] PREFIX_ACTIVE_POLICIES = new byte[] { 0x27 };
        
        /// <summary>Prefix 0x28: Total policy holders count.</summary>
        private static readonly byte[] PREFIX_TOTAL_HOLDERS = new byte[] { 0x28 };
        
        /// <summary>Prefix 0x29: Holder badges tracking.</summary>
        private static readonly byte[] PREFIX_HOLDER_BADGES = new byte[] { 0x29 };
        #endregion

        #region Data Structures
        /// <summary>
        /// Represents an insurance policy with coverage details.
        /// FIELDS:
        /// - Holder: Policy owner address
        /// - AssetType: Type of asset being insured (e.g., "NEO", "GAS")
        /// - PolicyType: 1=Basic, 2=Premium, 3=Enterprise
        /// - Coverage: Maximum payout amount
        /// - Premium: Amount paid for the policy
        /// - StartPrice: Initial asset price when policy created
        /// - ThresholdPercent: Price drop % required for claim
        /// - StartTime: Policy creation timestamp
        /// - EndTime: Policy expiration timestamp
        /// - RenewalCount: Number of times renewed
        /// - Active: Whether policy is currently active
        /// - Claimed: Whether claim has been processed
        /// - PayoutAmount: Amount paid out on claim
        /// </summary>
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

        /// <summary>
        /// Statistics for a policy holder.
        /// FIELDS:
        /// - TotalPolicies: Total policies created
        /// - ActivePolicies: Currently active policies
        /// - TotalPremiumsPaid: Total GAS paid in premiums
        /// - TotalCoverage: Total coverage amount
        /// - ApprovedClaims: Number of approved claims
        /// - TotalPayoutsReceived: Total GAS received in payouts
        /// - ClaimFreePolicies: Policies completed without claims
        /// - BadgeCount: Number of badges earned
        /// - JoinTime: First policy timestamp
        /// - LastPolicyTime: Most recent policy timestamp
        /// </summary>
        public struct HolderStats
        {
            public BigInteger TotalPolicies;
            public BigInteger ActivePolicies;
            public BigInteger TotalPremiumsPaid;
            public BigInteger TotalCoverage;
            public BigInteger ApprovedClaims;
            public BigInteger TotalPayoutsReceived;
            public BigInteger ClaimFreePolicies;
            public BigInteger BadgeCount;
            public BigInteger JoinTime;
            public BigInteger LastPolicyTime;
        }
        #endregion

        #region Event Delegates
        /// <summary>Event emitted when policy is created.</summary>
        /// <param name="policyId">Unique policy identifier.</param>
        /// <param name="holder">Policy owner address.</param>
        /// <param name="assetType">Type of asset insured.</param>
        /// <param name="coverage">Coverage amount.</param>
        public delegate void PolicyCreatedHandler(BigInteger policyId, UInt160 holder, string assetType, BigInteger coverage);
        
        /// <summary>Event emitted when policy is renewed.</summary>
        /// <param name="policyId">Policy identifier.</param>
        /// <param name="holder">Policy owner address.</param>
        /// <param name="newEndTime">New expiration timestamp.</param>
        public delegate void PolicyRenewedHandler(BigInteger policyId, UInt160 holder, BigInteger newEndTime);
        
        /// <summary>Event emitted when premium is paid.</summary>
        /// <param name="holder">Paying address.</param>
        /// <param name="policyId">Policy identifier.</param>
        /// <param name="amount">Premium amount paid.</param>
        public delegate void PremiumPaidHandler(UInt160 holder, BigInteger policyId, BigInteger amount);
        
        /// <summary>Event emitted when claim is requested.</summary>
        /// <param name="policyId">Policy identifier.</param>
        /// <param name="requestId">Oracle request identifier.</param>
        public delegate void ClaimRequestedHandler(BigInteger policyId, BigInteger requestId);
        
        /// <summary>Event emitted when claim is processed.</summary>
        /// <param name="policyId">Policy identifier.</param>
        /// <param name="holder">Claimant address.</param>
        /// <param name="approved">Whether claim was approved.</param>
        /// <param name="payout">Payout amount (0 if rejected).</param>
        public delegate void ClaimProcessedHandler(BigInteger policyId, UInt160 holder, bool approved, BigInteger payout);
        
        /// <summary>Event emitted when policy is cancelled.</summary>
        /// <param name="policyId">Policy identifier.</param>
        /// <param name="holder">Policy owner.</param>
        /// <param name="refund">Refund amount.</param>
        public delegate void PolicyCancelledHandler(BigInteger policyId, UInt160 holder, BigInteger refund);
        
        /// <summary>Event emitted when holder earns a badge.</summary>
        /// <param name="holder">Badge recipient.</param>
        /// <param name="badgeType">Badge identifier.</param>
        /// <param name="badgeName">Badge name.</param>
        public delegate void HolderBadgeEarnedHandler(UInt160 holder, BigInteger badgeType, string badgeName);
        #endregion

        #region Events
        [DisplayName("PolicyCreated")]
        public static event PolicyCreatedHandler OnPolicyCreated;

        [DisplayName("PolicyRenewed")]
        public static event PolicyRenewedHandler OnPolicyRenewed;

        [DisplayName("PremiumPaid")]
        public static event PremiumPaidHandler OnPremiumPaid;

        [DisplayName("ClaimRequested")]
        public static event ClaimRequestedHandler OnClaimRequested;

        [DisplayName("ClaimProcessed")]
        public static event ClaimProcessedHandler OnClaimProcessed;

        [DisplayName("PolicyCancelled")]
        public static event PolicyCancelledHandler OnPolicyCancelled;

        [DisplayName("HolderBadgeEarned")]
        public static event HolderBadgeEarnedHandler OnHolderBadgeEarned;
        #endregion

        #region Lifecycle
        /// <summary>
        /// Contract deployment initialization.
        /// </summary>
        /// <param name="data">Deployment data (unused).</param>
        /// <param name="update">True if this is a contract update.</param>
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_POLICY_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_COVERAGE, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PREMIUMS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PAYOUTS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_ACTIVE_POLICIES, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_HOLDERS, 0);
        }
        #endregion

        #region Read Methods
        /// <summary>
        /// Gets total number of policies created.
        /// </summary>
        /// <returns>Total policy count.</returns>
        [Safe]
        public static BigInteger GetPolicyCount() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_POLICY_ID);

        /// <summary>
        /// Gets total coverage across all policies.
        /// </summary>
        /// <returns>Total coverage amount.</returns>
        [Safe]
        public static BigInteger GetTotalCoverage() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_COVERAGE);

        /// <summary>
        /// Gets total premiums collected.
        /// </summary>
        /// <returns>Total premiums amount.</returns>
        [Safe]
        public static BigInteger GetTotalPremiums() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_PREMIUMS);

        /// <summary>
        /// Gets total payouts distributed.
        /// </summary>
        /// <returns>Total payouts amount.</returns>
        [Safe]
        public static BigInteger GetTotalPayouts() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_PAYOUTS);

        /// <summary>
        /// Gets count of active policies.
        /// </summary>
        /// <returns>Active policy count.</returns>
        [Safe]
        public static BigInteger GetActivePolicyCount() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ACTIVE_POLICIES);

        /// <summary>
        /// Gets total number of unique policy holders.
        /// </summary>
        /// <returns>Total holders count.</returns>
        [Safe]
        public static BigInteger GetTotalHolders() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_HOLDERS);

        /// <summary>
        /// Gets policy data by ID.
        /// </summary>
        /// <param name="policyId">Policy identifier.</param>
        /// <returns>Policy data struct.</returns>
        [Safe]
        public static PolicyData GetPolicy(BigInteger policyId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_POLICIES, (ByteString)policyId.ToByteArray()));
            if (data == null) return new PolicyData();
            return (PolicyData)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Gets holder statistics.
        /// </summary>
        /// <param name="holder">Holder address.</param>
        /// <returns>Holder stats struct.</returns>
        [Safe]
        public static HolderStats GetHolderStats(UInt160 holder)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_HOLDER_STATS, holder));
            if (data == null) return new HolderStats();
            return (HolderStats)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Checks if holder has a specific badge.
        /// </summary>
        /// <param name="holder">Holder address.</param>
        /// <param name="badgeType">Badge identifier.</param>
        /// <returns>True if holder has badge.</returns>
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
