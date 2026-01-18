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
    // Event delegates for GasSponsor lifecycle
    public delegate void SponsorshipCreatedHandler(UInt160 sponsor, BigInteger amount, BigInteger poolId, BigInteger poolType);
    public delegate void SponsorshipClaimedHandler(UInt160 beneficiary, BigInteger amount, BigInteger poolId);
    public delegate void PoolDepletedHandler(BigInteger poolId, BigInteger totalClaimed);
    public delegate void PoolRefundedHandler(BigInteger poolId, UInt160 sponsor, BigInteger amount);
    public delegate void WhitelistUpdatedHandler(BigInteger poolId, UInt160 user, bool added);
    public delegate void PoolExtendedHandler(BigInteger poolId, BigInteger newExpiry);
    public delegate void SponsorBadgeEarnedHandler(UInt160 sponsor, BigInteger badgeType, string badgeName);

    /// <summary>
    /// Gas Sponsor MiniApp - Complete decentralized gas sponsorship marketplace.
    ///
    /// FEATURES:
    /// - Multiple pool types (public, whitelist, app-specific)
    /// - Pool expiration and auto-refund
    /// - Whitelist management for private pools
    /// - Sponsor statistics and badges
    /// - Beneficiary tracking and limits
    /// - Pool top-up functionality
    /// - Platform statistics
    ///
    /// MECHANICS:
    /// - Sponsors create pools with GAS deposits
    /// - Beneficiaries claim gas for transaction fees
    /// - Pools can be public or whitelist-restricted
    /// - Sponsors earn badges for contributions
    /// - Expired pools auto-refund to sponsors
    /// </summary>
    [DisplayName("MiniAppGasSponsor")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. GasSponsor is a complete decentralized gas sponsorship marketplace with pool types, whitelists, expiration, badges, and beneficiary tracking.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppGasSponsor : MiniAppBase
    {
        #region App Constants
        private const string APP_ID = "miniapp-gas-sponsor";
        private const long MIN_SPONSORSHIP = 100000000;    // 1 GAS minimum
        private const long MAX_CLAIM_PER_TX = 10000000;    // 0.1 GAS max per claim
        private const long DEFAULT_EXPIRY_SECONDS = 2592000;    // 30 days default expiry
        private const long TOP_UP_MIN = 50000000;          // 0.5 GAS min top-up
        private const int MAX_WHITELIST_SIZE = 100;
        // Pool types: 1=Public, 2=Whitelist, 3=AppSpecific
        // Badge types: 1=FirstPool, 2=Generous(10 GAS), 3=Patron(100 GAS), 4=Benefactor(1000 GAS)
        #endregion

        #region App Prefixes (0x20+ to avoid collision with MiniAppBase)
        private static readonly byte[] PREFIX_POOLS = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_USER_CLAIMED = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_TOTAL_SPONSORED = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_TOTAL_CLAIMED = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_POOL_COUNT = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_WHITELIST = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_SPONSOR_STATS = new byte[] { 0x26 };
        private static readonly byte[] PREFIX_BENEFICIARY_STATS = new byte[] { 0x27 };
        private static readonly byte[] PREFIX_SPONSOR_BADGES = new byte[] { 0x28 };
        private static readonly byte[] PREFIX_ACTIVE_POOLS = new byte[] { 0x29 };
        private static readonly byte[] PREFIX_TOTAL_SPONSORS = new byte[] { 0x2A };
        private static readonly byte[] PREFIX_TOTAL_BENEFICIARIES = new byte[] { 0x2B };
        #endregion

        #region Data Structures

        public struct PoolData
        {
            public UInt160 Sponsor;
            public BigInteger PoolType;
            public BigInteger InitialAmount;
            public BigInteger RemainingAmount;
            public BigInteger MaxClaimPerUser;
            public BigInteger TotalClaimed;
            public BigInteger ClaimCount;
            public BigInteger CreateTime;
            public BigInteger ExpiryTime;
            public bool Active;
            public string Description;
        }

        public struct SponsorStats
        {
            public BigInteger PoolsCreated;
            public BigInteger TotalSponsored;
            public BigInteger TotalClaimed;
            public BigInteger BeneficiariesHelped;
            public BigInteger BadgeCount;
            public BigInteger JoinTime;
            public BigInteger LastActivityTime;
            public BigInteger ActivePools;
            public BigInteger HighestSinglePool;
            public BigInteger TopUpsCount;
        }

        public struct BeneficiaryStats
        {
            public BigInteger TotalClaimed;
            public BigInteger ClaimCount;
            public BigInteger PoolsUsed;
            public BigInteger JoinTime;
            public BigInteger LastActivityTime;
            public BigInteger HighestSingleClaim;
        }

        #endregion

        #region Events
        [DisplayName("SponsorshipCreated")]
        public static event SponsorshipCreatedHandler OnSponsorshipCreated;

        [DisplayName("SponsorshipClaimed")]
        public static event SponsorshipClaimedHandler OnSponsorshipClaimed;

        [DisplayName("PoolDepleted")]
        public static event PoolDepletedHandler OnPoolDepleted;

        [DisplayName("PoolRefunded")]
        public static event PoolRefundedHandler OnPoolRefunded;

        [DisplayName("WhitelistUpdated")]
        public static event WhitelistUpdatedHandler OnWhitelistUpdated;

        [DisplayName("PoolExtended")]
        public static event PoolExtendedHandler OnPoolExtended;

        [DisplayName("SponsorBadgeEarned")]
        public static event SponsorBadgeEarnedHandler OnSponsorBadgeEarned;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_POOL_COUNT, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_SPONSORED, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_CLAIMED, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_ACTIVE_POOLS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_SPONSORS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BENEFICIARIES, 0);
        }
        #endregion

        #region Read Methods

        [Safe]
        public static BigInteger GetPoolCount() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_POOL_COUNT);

        [Safe]
        public static BigInteger GetActivePoolCount() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ACTIVE_POOLS);

        [Safe]
        public static BigInteger GetTotalSponsored() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_SPONSORED);

        [Safe]
        public static BigInteger GetTotalClaimed() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_CLAIMED);

        [Safe]
        public static BigInteger GetTotalSponsors() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_SPONSORS);

        [Safe]
        public static BigInteger GetTotalBeneficiaries() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_BENEFICIARIES);

        [Safe]
        public static PoolData GetPoolData(BigInteger poolId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_POOLS, (ByteString)poolId.ToByteArray()));
            if (data == null) return new PoolData();
            return (PoolData)StdLib.Deserialize(data);
        }

        [Safe]
        public static SponsorStats GetSponsorStats(UInt160 sponsor)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_SPONSOR_STATS, sponsor));
            if (data == null) return new SponsorStats();
            return (SponsorStats)StdLib.Deserialize(data);
        }

        [Safe]
        public static BeneficiaryStats GetBeneficiaryStats(UInt160 beneficiary)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_BENEFICIARY_STATS, beneficiary));
            if (data == null) return new BeneficiaryStats();
            return (BeneficiaryStats)StdLib.Deserialize(data);
        }

        [Safe]
        public static BigInteger GetUserClaimedFromPool(UInt160 user, BigInteger poolId)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_CLAIMED, user),
                (ByteString)poolId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static bool IsWhitelisted(BigInteger poolId, UInt160 user)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_WHITELIST, (ByteString)poolId.ToByteArray()),
                user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }

        [Safe]
        public static bool HasSponsorBadge(UInt160 sponsor, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_SPONSOR_BADGES, sponsor),
                (ByteString)badgeType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }

        #endregion

        // Sponsorship methods moved to MiniAppGasSponsor.Methods.cs
        // Query methods moved to MiniAppGasSponsor.Query.cs
        // Internal helpers moved to MiniAppGasSponsor.Internal.cs
        // Badge logic moved to MiniAppGasSponsor.Badge.cs
    }
}
