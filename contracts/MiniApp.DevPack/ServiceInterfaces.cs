using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// Service Interface Definitions for MiniApp Platform
    ///
    /// This file defines the standard interfaces and constants for service
    /// communication between MiniApps and the Service Layer Gateway.
    ///
    /// SERVICE FLOW:
    /// 1. MiniApp calls RequestService() with serviceType and payload
    /// 2. Gateway processes request off-chain via TEE
    /// 3. Gateway calls OnServiceCallback() with result
    /// 4. MiniApp processes callback and updates state
    /// </summary>
    public static class ServiceTypes
    {
        #region Service Type Constants

        /// <summary>Random Number Generation service</summary>
        public const string RNG = "rng";

        /// <summary>Price Feed oracle service</summary>
        public const string PRICE_FEED = "pricefeed";

        /// <summary>TEE Encryption service</summary>
        public const string ENCRYPTION = "encryption";

        /// <summary>TEE Decryption service</summary>
        public const string DECRYPTION = "decryption";

        /// <summary>External API call service</summary>
        public const string API_CALL = "apicall";

        /// <summary>Automation/Scheduled task service</summary>
        public const string AUTOMATION = "automation";

        #endregion
    }

    /// <summary>
    /// Standard service callback result structure.
    /// Used to parse and validate callback data.
    /// </summary>
    public struct ServiceCallbackResult
    {
        /// <summary>Unique request identifier</summary>
        public BigInteger RequestId;

        /// <summary>Application identifier</summary>
        public string AppId;

        /// <summary>Type of service (rng, pricefeed, etc.)</summary>
        public string ServiceType;

        /// <summary>Whether the service call succeeded</summary>
        public bool Success;

        /// <summary>Result data (service-specific format)</summary>
        public ByteString Result;

        /// <summary>Error message if Success is false</summary>
        public string Error;
    }

    /// <summary>
    /// Service request payload structure for RNG service.
    /// </summary>
    public struct RngRequestPayload
    {
        /// <summary>Application-specific context data</summary>
        public ByteString Context;

        /// <summary>Number of random bytes requested (default: 32)</summary>
        public int ByteCount;
    }

    /// <summary>
    /// Service request payload structure for Price Feed service.
    /// </summary>
    public struct PriceFeedRequestPayload
    {
        /// <summary>Token symbol (e.g., "NEO", "GAS")</summary>
        public string Symbol;

        /// <summary>Quote currency (e.g., "USD", "GAS")</summary>
        public string QuoteCurrency;
    }

    // =========================================================================
    // Composable Capability Module Identifiers and Method Signatures
    // =========================================================================
    //
    // These constants define the standard module IDs registered in the
    // ModuleRegistry (deprecated - see OS service contracts) and the canonical method signatures that miniapp instances
    // (and routers) use to interact with shared capability modules.
    //
    // USAGE:
    //   - Recipe definitions reference modules by ModuleIds.*
    //   - Instance bindings map binding names to module IDs
    //   - Router contracts call modules using the method signatures below
    //   - Off-chain indexers use these constants for event filtering
    // =========================================================================

    /// <summary>
    /// Standard module identifiers for the composable miniapp platform.
    /// These match the module IDs registered in ModuleRegistry (deprecated - see OS service contracts).
    /// </summary>
    public static class ModuleIds
    {
        /// <summary>Shared funding vault for deposits, locks, and releases.</summary>
        public const string FUNDING_VAULT = "module.funding_vault";

        /// <summary>Stream-based vesting and payment streams.</summary>
        public const string STREAM_VESTING = "module.stream_vesting";

        /// <summary>Universal prepaid GAS credit module.</summary>
        public const string PREPAID_GAS = "module.prepaid_gas";

        /// <summary>Universal check-in with streak tracking and rewards.</summary>
        public const string CHECKIN = "module.checkin";

        /// <summary>On-chain leaderboard with configurable scoring.</summary>
        public const string LEADERBOARD = "module.leaderboard";

        /// <summary>Oracle callback handler for RNG, PriceFeed, HTTP results.</summary>
        public const string ORACLE_CALLBACK = "module.oracle_callback";

        /// <summary>Random allocation / gacha mechanics.</summary>
        public const string RANDOM_ALLOCATION = "module.random_allocation";

        /// <summary>NFT-based ticketing.</summary>
        public const string TICKET_NFT = "module.ticket_nft";

        /// <summary>Marketplace listing and trading.</summary>
        public const string MARKETPLACE_LISTING = "module.marketplace_listing";

        /// <summary>Achievement and badge tracking.</summary>
        public const string STATS_BADGE = "module.stats_badge";
    }

    /// <summary>
    /// Standard method signatures for the PrepaidGasModule.
    /// Use these when building cross-contract calls or router dispatch tables.
    /// </summary>
    public static class PrepaidGasModuleMethods
    {
        /// <summary>Initialize an instance: (string instanceId, UInt160 owner, UInt160 operator)</summary>
        public const string INITIALIZE_INSTANCE = "initializeInstance";

        /// <summary>Query balance: (string instanceId, UInt160 user) -> BigInteger</summary>
        public const string GET_BALANCE = "getBalance";

        /// <summary>Consume credit: (string instanceId, UInt160 user, BigInteger amount)</summary>
        public const string CONSUME_CREDIT = "consumeCredit";

        /// <summary>Refund credit: (string instanceId, UInt160 user, BigInteger amount, UInt160 recipient)</summary>
        public const string REFUND_CREDIT = "refundCredit";
    }

    /// <summary>
    /// Standard method signatures for the CheckinModule.
    /// </summary>
    public static class CheckinModuleMethods
    {
        /// <summary>Initialize: (string instanceId, UInt160 owner, UInt160 operator, BigInteger interval, BigInteger reward, BigInteger minStreak)</summary>
        public const string INITIALIZE_INSTANCE = "initializeInstance";

        /// <summary>Check in: (string instanceId, UInt160 user)</summary>
        public const string CHECK_IN = "checkIn";

        /// <summary>Claim rewards: (string instanceId, UInt160 user)</summary>
        public const string CLAIM_REWARDS = "claimRewards";

        /// <summary>Get user stats: (string instanceId, UInt160 user) -> UserCheckinStats</summary>
        public const string GET_USER_STATS = "getUserStats";

        /// <summary>Get user streak: (string instanceId, UInt160 user) -> BigInteger</summary>
        public const string GET_USER_STREAK = "getUserStreak";

        /// <summary>Get user highest streak: (string instanceId, UInt160 user) -> BigInteger</summary>
        public const string GET_USER_HIGHEST_STREAK = "getUserHighestStreak";

        /// <summary>Update config: (string instanceId, BigInteger interval, BigInteger reward, BigInteger minStreak)</summary>
        public const string UPDATE_INSTANCE_CONFIG = "updateInstanceConfig";
    }

    /// <summary>
    /// Standard method signatures for the LeaderboardModule.
    /// </summary>
    public static class LeaderboardModuleMethods
    {
        /// <summary>Initialize: (string instanceId, UInt160 owner, UInt160 operator, byte scoringMode, int capacity)</summary>
        public const string INITIALIZE_INSTANCE = "initializeInstance";

        /// <summary>Submit score: (string instanceId, UInt160 user, BigInteger scoreDelta)</summary>
        public const string SUBMIT_SCORE = "submitScore";

        /// <summary>Increment score: (string instanceId, UInt160 user, BigInteger delta)</summary>
        public const string INCREMENT_SCORE = "incrementScore";

        /// <summary>Get score: (string instanceId, UInt160 user) -> BigInteger</summary>
        public const string GET_SCORE = "getScore";

        /// <summary>Get rank: (string instanceId, UInt160 user) -> BigInteger</summary>
        public const string GET_RANK = "getRank";

        /// <summary>Get top N: (string instanceId, int count) -> LeaderboardEntry[]</summary>
        public const string GET_TOP_N = "getTopN";

        /// <summary>Reset leaderboard: (string instanceId)</summary>
        public const string RESET_LEADERBOARD = "resetLeaderboard";

        /// <summary>Scoring mode: additive (0)</summary>
        public const byte SCORING_ADDITIVE = 0;

        /// <summary>Scoring mode: maximum (1)</summary>
        public const byte SCORING_MAXIMUM = 1;

        /// <summary>Scoring mode: replace (2)</summary>
        public const byte SCORING_REPLACE = 2;
    }

    /// <summary>
    /// Standard method signatures for the OracleCallbackModule.
    /// </summary>
    public static class OracleCallbackModuleMethods
    {
        /// <summary>Initialize: (string instanceId, UInt160 owner, UInt160 operator, UInt160 callbackContract, string callbackMethod)</summary>
        public const string INITIALIZE_INSTANCE = "initializeInstance";

        /// <summary>Request oracle: (string instanceId, string requestType, ByteString payload) -> BigInteger requestId</summary>
        public const string REQUEST_ORACLE = "requestOracle";

        /// <summary>Set callback: (string instanceId, UInt160 callbackContract, string callbackMethod)</summary>
        public const string SET_CALLBACK = "setCallback";

        /// <summary>Get request: (BigInteger requestId) -> OracleRequest</summary>
        public const string GET_REQUEST = "getRequest";

        /// <summary>Get latest result: (string instanceId, string requestType) -> OracleResult</summary>
        public const string GET_LATEST_RESULT = "getLatestResult";

        /// <summary>Oracle request type: RNG</summary>
        public const string TYPE_RNG = "rng";

        /// <summary>Oracle request type: price feed</summary>
        public const string TYPE_PRICE_FEED = "pricefeed";

        /// <summary>Oracle request type: HTTP</summary>
        public const string TYPE_HTTP = "http";
    }

    /// <summary>
    /// Standard method signatures for the RandomAllocationModule.
    /// </summary>
    public static class RandomAllocationModuleMethods
    {
        /// <summary>Initialize: (string instanceId, UInt160 owner, UInt160 operator)</summary>
        public const string INITIALIZE_INSTANCE = "initializeInstance";

        /// <summary>Create pool: (string instanceId, string poolId, int participantCount, int slotCount)</summary>
        public const string CREATE_POOL = "createPool";

        /// <summary>Request allocation: (string instanceId, string poolId) — emits AllocationRequested for VRF</summary>
        public const string REQUEST_ALLOCATION = "requestAllocation";

        /// <summary>Resolve allocation: (string instanceId, string poolId, ByteString randomSeed)</summary>
        public const string RESOLVE_ALLOCATION = "resolveAllocation";

        /// <summary>Get allocation: (string instanceId, string poolId, int participantIndex) -> int slotIndex</summary>
        public const string GET_ALLOCATION = "getAllocation";

        /// <summary>Get pool status: (string instanceId, string poolId) -> PoolInfo</summary>
        public const string GET_POOL_STATUS = "getPoolStatus";

        /// <summary>Cancel pool: (string instanceId, string poolId)</summary>
        public const string CANCEL_POOL = "cancelPool";
    }

    /// <summary>
    /// Standard method signatures for the TicketNFTModule.
    /// </summary>
    public static class TicketNFTModuleMethods
    {
        /// <summary>Initialize: (string instanceId, UInt160 owner, UInt160 operator)</summary>
        public const string INITIALIZE_INSTANCE = "initializeInstance";

        /// <summary>Mint ticket: (string instanceId, UInt160 to, string metadata) -> BigInteger tokenId</summary>
        public const string MINT = "mint";

        /// <summary>Burn ticket: (string instanceId, BigInteger tokenId)</summary>
        public const string BURN = "burn";

        /// <summary>Transfer ticket: (string instanceId, UInt160 from, UInt160 to, BigInteger tokenId)</summary>
        public const string TRANSFER = "transfer";

        /// <summary>Get balance: (string instanceId, UInt160 owner) -> BigInteger</summary>
        public const string GET_BALANCE = "getBalance";

        /// <summary>Get token info: (string instanceId, BigInteger tokenId) -> TokenInfo</summary>
        public const string GET_TOKEN = "getToken";

        /// <summary>Get total supply: (string instanceId) -> BigInteger</summary>
        public const string TOTAL_SUPPLY = "totalSupply";
    }

    /// <summary>
    /// Standard method signatures for the MarketplaceListingModule.
    /// </summary>
    public static class MarketplaceListingModuleMethods
    {
        /// <summary>Initialize: (string instanceId, UInt160 owner, UInt160 operator)</summary>
        public const string INITIALIZE_INSTANCE = "initializeInstance";

        /// <summary>Create listing: (string instanceId, UInt160 seller, string asset, BigInteger price) -> BigInteger listingId</summary>
        public const string CREATE_LISTING = "createListing";

        /// <summary>Cancel listing: (string instanceId, BigInteger listingId)</summary>
        public const string CANCEL_LISTING = "cancelListing";

        /// <summary>Purchase listing: (string instanceId, BigInteger listingId, UInt160 buyer)</summary>
        public const string PURCHASE = "purchase";

        /// <summary>Get listing: (string instanceId, BigInteger listingId) -> ListingInfo</summary>
        public const string GET_LISTING = "getListing";

        /// <summary>Get active listings: (string instanceId, int offset, int count) -> ListingInfo[]</summary>
        public const string GET_ACTIVE_LISTINGS = "getActiveListings";

        /// <summary>Get seller listings: (string instanceId, UInt160 seller) -> BigInteger[]</summary>
        public const string GET_SELLER_LISTINGS = "getSellerListings";
    }

    /// <summary>
    /// Standard method signatures for the StatsBadgeModule.
    /// </summary>
    public static class StatsBadgeModuleMethods
    {
        /// <summary>Initialize: (string instanceId, UInt160 owner, UInt160 operator)</summary>
        public const string INITIALIZE_INSTANCE = "initializeInstance";

        /// <summary>Define badge: (string instanceId, string badgeId, string name, string criteria)</summary>
        public const string DEFINE_BADGE = "defineBadge";

        /// <summary>Award badge: (string instanceId, string badgeId, UInt160 recipient)</summary>
        public const string AWARD_BADGE = "awardBadge";

        /// <summary>Revoke badge: (string instanceId, string badgeId, UInt160 recipient)</summary>
        public const string REVOKE_BADGE = "revokeBadge";

        /// <summary>Has badge: (string instanceId, string badgeId, UInt160 address) -> bool</summary>
        public const string HAS_BADGE = "hasBadge";

        /// <summary>Get user badges: (string instanceId, UInt160 address) -> string[]</summary>
        public const string GET_USER_BADGES = "getUserBadges";

        /// <summary>Increment stat: (string instanceId, UInt160 address, string statKey, BigInteger amount)</summary>
        public const string INCREMENT_STAT = "incrementStat";

        /// <summary>Get stat: (string instanceId, UInt160 address, string statKey) -> BigInteger</summary>
        public const string GET_STAT = "getStat";
    }

    /// <summary>
    /// Standard event names emitted by composable capability modules.
    /// Off-chain indexers and the host runtime should filter on these.
    /// </summary>
    public static class ModuleEventNames
    {
        // PrepaidGasModule events
        public const string CREDIT_RECEIVED = "CreditReceived";
        public const string CREDIT_CONSUMED = "CreditConsumed";
        public const string CREDIT_REFUNDED = "CreditRefunded";

        // CheckinModule events
        public const string CHECKED_IN = "CheckedIn";
        public const string STREAK_UPDATED = "StreakUpdated";
        public const string REWARDS_CLAIMED = "RewardsClaimed";
        public const string REWARD_POOL_FUNDED = "RewardPoolFunded";

        // LeaderboardModule events
        public const string SCORE_UPDATED = "ScoreUpdated";
        public const string LEADERBOARD_RESET = "LeaderboardReset";

        // OracleCallbackModule events
        public const string ORACLE_REQUESTED = "OracleRequested";
        public const string ORACLE_CALLBACK_RECEIVED = "OracleCallbackReceived";
        public const string ORACLE_RESULT_FORWARDED = "OracleResultForwarded";

        // RandomAllocationModule events
        public const string ALLOCATION_REQUESTED = "AllocationRequested";
        public const string ALLOCATION_RESOLVED = "AllocationResolved";
        public const string ALLOCATION_CLAIMED = "AllocationClaimed";
        public const string POOL_CANCELLED = "PoolCancelled";

        // TicketNFTModule events
        public const string TICKET_MINTED = "TicketMinted";
        public const string TICKET_BURNED = "TicketBurned";
        public const string TICKET_TRANSFERRED = "TicketTransferred";

        // MarketplaceListingModule events
        public const string LISTING_CREATED = "ListingCreated";
        public const string LISTING_CANCELLED = "ListingCancelled";
        public const string LISTING_PURCHASED = "ListingPurchased";

        // StatsBadgeModule events
        public const string BADGE_DEFINED = "BadgeDefined";
        public const string BADGE_AWARDED = "BadgeAwarded";
        public const string BADGE_REVOKED = "BadgeRevoked";
        public const string STAT_UPDATED = "StatUpdated";

        // Common instance lifecycle events
        public const string INSTANCE_INITIALIZED = "InstanceInitialized";
        public const string INSTANCE_STATUS_CHANGED = "InstanceStatusChanged";
    }
}
