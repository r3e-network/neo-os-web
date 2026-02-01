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
    /// <summary>Event emitted when sponsorship pool is created.</summary>
    /// <param name="sponsor">Sponsor address</param>
    /// <param name="amount">Pool amount in GAS</param>
    /// <param name="poolId">Pool identifier</param>
    /// <param name="poolType">Pool type (1=Public, 2=Whitelist, 3=AppSpecific)</param>
    /// <summary>Event emitted when sponsorship created.</summary>
    public delegate void SponsorshipCreatedHandler(UInt160 sponsor, BigInteger amount, BigInteger poolId, BigInteger poolType);
    
    /// <summary>Event emitted when gas is claimed from pool.</summary>
    /// <param name="beneficiary">Beneficiary address</param>
    /// <param name="amount">Claimed amount</param>
    /// <param name="poolId">Pool identifier</param>
    /// <summary>Event emitted when sponsorship claimed.</summary>
    public delegate void SponsorshipClaimedHandler(UInt160 beneficiary, BigInteger amount, BigInteger poolId);
    
    /// <summary>Event emitted when pool is depleted.</summary>
    /// <param name="poolId">Pool identifier</param>
    /// <param name="totalClaimed">Total amount claimed</param>
    /// <summary>Event emitted when pool depleted.</summary>
    public delegate void PoolDepletedHandler(BigInteger poolId, BigInteger totalClaimed);
    
    /// <summary>Event emitted when expired pool is refunded.</summary>
    /// <param name="poolId">Pool identifier</param>
    /// <param name="sponsor">Sponsor address</param>
    /// <param name="amount">Refund amount</param>
    /// <summary>Event emitted when pool refunded.</summary>
    public delegate void PoolRefundedHandler(BigInteger poolId, UInt160 sponsor, BigInteger amount);
    
    /// <summary>Event emitted when whitelist is updated.</summary>
    /// <param name="poolId">Pool identifier</param>
    /// <param name="user">User address</param>
    /// <param name="added">True if added, false if removed</param>
    /// <summary>Event emitted when whitelist updated.</summary>
    public delegate void WhitelistUpdatedHandler(BigInteger poolId, UInt160 user, bool added);
    
    /// <summary>Event emitted when pool expiry is extended.</summary>
    /// <param name="poolId">Pool identifier</param>
    /// <param name="newExpiry">New expiry timestamp</param>
    /// <summary>Event emitted when pool extended.</summary>
    public delegate void PoolExtendedHandler(BigInteger poolId, BigInteger newExpiry);
    
    /// <summary>Event emitted when sponsor earns a badge.</summary>
    /// <param name="sponsor">Sponsor address</param>
    /// <param name="badgeType">Badge type identifier</param>
    /// <param name="badgeName">Badge name</param>
    /// <summary>Event emitted when sponsor badge earned.</summary>
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
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]  // GAS token
    public partial class MiniAppGasSponsor : MiniAppBase
    {
        #region App Constants
        /// <summary>Unique app identifier.</summary>
        /// <summary>Unique application identifier for the gas-sponsor miniapp.</summary>
        private const string APP_ID = "miniapp-gas-sponsor";
        /// <summary>Minimum sponsorship amount: 1 GAS (100,000,000 neo-atomic units).</summary>
        /// <summary>Minimum value for operation.</summary>
        private const long MIN_SPONSORSHIP = 100000000;
        /// <summary>Maximum claim per transaction: 0.1 GAS (10,000,000 neo-atomic units).</summary>
        private const long MAX_CLAIM_PER_TX = 10000000;
        /// <summary>Default pool expiry: 30 days (2,592,000 seconds).</summary>
        private const long DEFAULT_EXPIRY_SECONDS = 2592000;
        /// <summary>Minimum top-up amount: 0.5 GAS (50,000,000 neo-atomic units).</summary>
        private const long TOP_UP_MIN = 50000000;
        /// <summary>Maximum whitelist size per pool.</summary>
        private const int MAX_WHITELIST_SIZE = 100;
        // Pool types: 1=Public, 2=Whitelist, 3=AppSpecific
        // Badge types: 1=FirstPool, 2=Generous(10 GAS), 3=Patron(100 GAS), 4=Benefactor(1000 GAS)
        #endregion

        #region Storage Prefixes (0x20-0x2B)
        // STORAGE LAYOUT: Gas Sponsor app data (0x20-0x2B)
        
        /// <summary>Prefix 0x20: Pool data storage.</summary>
        /// <summary>Storage prefix for pools.</summary>
        private static readonly byte[] PREFIX_POOLS = new byte[] { 0x20 };
        /// <summary>Prefix 0x21: User claimed amounts storage.</summary>
        /// <summary>Storage prefix for user claimed.</summary>
        private static readonly byte[] PREFIX_USER_CLAIMED = new byte[] { 0x21 };
        /// <summary>Prefix 0x22: Total sponsored amount storage.</summary>
        /// <summary>Storage prefix for total sponsored.</summary>
        private static readonly byte[] PREFIX_TOTAL_SPONSORED = new byte[] { 0x22 };
        /// <summary>Prefix 0x23: Total claimed amount storage.</summary>
        /// <summary>Storage prefix for total claimed.</summary>
        private static readonly byte[] PREFIX_TOTAL_CLAIMED = new byte[] { 0x23 };
        /// <summary>Prefix 0x24: Pool count storage.</summary>
        /// <summary>Storage prefix for pool count.</summary>
        private static readonly byte[] PREFIX_POOL_COUNT = new byte[] { 0x24 };
        /// <summary>Prefix 0x25: Whitelist storage.</summary>
        /// <summary>Storage prefix for whitelist.</summary>
        private static readonly byte[] PREFIX_WHITELIST = new byte[] { 0x25 };
        /// <summary>Prefix 0x26: Sponsor statistics storage.</summary>
        /// <summary>Storage prefix for sponsor stats.</summary>
        private static readonly byte[] PREFIX_SPONSOR_STATS = new byte[] { 0x26 };
        /// <summary>Prefix 0x27: Beneficiary statistics storage.</summary>
        /// <summary>Storage prefix for beneficiary stats.</summary>
        private static readonly byte[] PREFIX_BENEFICIARY_STATS = new byte[] { 0x27 };
        /// <summary>Prefix 0x28: Sponsor badges storage.</summary>
        /// <summary>Storage prefix for sponsor badges.</summary>
        private static readonly byte[] PREFIX_SPONSOR_BADGES = new byte[] { 0x28 };
        /// <summary>Prefix 0x29: Active pools list storage.</summary>
        /// <summary>Storage prefix for active pools.</summary>
        private static readonly byte[] PREFIX_ACTIVE_POOLS = new byte[] { 0x29 };
        /// <summary>Prefix 0x2A: Total sponsors count storage.</summary>
        /// <summary>Storage prefix for total sponsors.</summary>
        private static readonly byte[] PREFIX_TOTAL_SPONSORS = new byte[] { 0x2A };
        /// <summary>Prefix 0x2B: Total beneficiaries count storage.</summary>
        /// <summary>Storage prefix for total beneficiaries.</summary>
        private static readonly byte[] PREFIX_TOTAL_BENEFICIARIES = new byte[] { 0x2B };
        #endregion

        #region Data Structures

        /// <summary>
        /// Sponsorship pool data structure.
        /// 
        /// FIELDS:
        /// - Sponsor: Pool creator address
        /// - PoolType: 1=Public, 2=Whitelist, 3=AppSpecific
        /// - InitialAmount: Starting pool amount
        /// - RemainingAmount: Current available amount
        /// - MaxClaimPerUser: Maximum claim per beneficiary
        /// - TotalClaimed: Amount claimed so far
        /// - ClaimCount: Number of claims
        /// - CreateTime: Pool creation timestamp
        /// - ExpiryTime: Pool expiration timestamp
        /// - Active: Whether pool is active
        /// - Description: Pool description
        /// </summary>
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

        /// <summary>
        /// Sponsor statistics structure.
        /// 
        /// FIELDS:
        /// - PoolsCreated: Total pools created
        /// - TotalSponsored: Total GAS sponsored
        /// - TotalClaimed: Total GAS claimed from pools
        /// - BeneficiariesHelped: Number of users helped
        /// - BadgeCount: Achievements earned
        /// - JoinTime: First sponsorship timestamp
        /// - LastActivityTime: Most recent activity
        /// - ActivePools: Currently active pools
        /// - HighestSinglePool: Largest single pool
        /// - TopUpsCount: Number of top-ups performed
        /// </summary>
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

        /// <summary>
        /// Beneficiary statistics structure.
        /// 
        /// FIELDS:
        /// - TotalClaimed: Total GAS claimed
        /// - ClaimCount: Number of claims
        /// - PoolsUsed: Number of pools used
        /// - JoinTime: First claim timestamp
        /// - LastActivityTime: Most recent claim
        /// - HighestSingleClaim: Largest single claim
        /// </summary>
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
