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
    // Event delegates for map piece lifecycle
    public delegate void PieceClaimedHandler(BigInteger pieceId, UInt160 owner, BigInteger x, BigInteger y, BigInteger regionId);
    public delegate void PieceTradedHandler(BigInteger pieceId, UInt160 from, UInt160 to, BigInteger price);
    public delegate void PieceListedHandler(BigInteger pieceId, UInt160 owner, BigInteger price);
    public delegate void PieceDelistedHandler(BigInteger pieceId, UInt160 owner);
    public delegate void RegionCompletedHandler(BigInteger regionId, UInt160 completer, BigInteger bonus);
    public delegate void PieceCustomizedHandler(BigInteger pieceId, UInt160 owner, string metadata);
    public delegate void AchievementUnlockedHandler(UInt160 user, BigInteger achievementId, string name);

    /// <summary>
    /// MillionPieceMap MiniApp - Complete collaborative world map ownership platform.
    /// </summary>
    [DisplayName("MiniAppMillionPieceMap")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. MillionPieceMap is a complete collaborative world map ownership platform with 10,000 pieces, 100 regions, trading marketplace, customization, achievements, and region completion bonuses.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppMillionPieceMap : MiniAppBase
    {
        #region App Constants
        private const string APP_ID = "miniapp-millionpiecemap";
        private const long PIECE_PRICE = 10000000;
        private const long CUSTOMIZE_FEE = 5000000;
        private const long REGION_BONUS = 100000000;
        private const int MAP_WIDTH = 100;
        private const int MAP_HEIGHT = 100;
        private const int REGION_SIZE = 10;
        private const int TOTAL_PIECES = 10000;
        private const int TOTAL_REGIONS = 100;
        private const int MAX_METADATA_LENGTH = 500;
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_PIECES = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_LISTINGS = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_USER_STATS = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_USER_PIECES = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_USER_PIECE_COUNT = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_REGIONS = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_TOTAL_CLAIMED = new byte[] { 0x26 };
        private static readonly byte[] PREFIX_TOTAL_TRADED = new byte[] { 0x27 };
        private static readonly byte[] PREFIX_TOTAL_VOLUME = new byte[] { 0x28 };
        private static readonly byte[] PREFIX_USER_BADGES = new byte[] { 0x29 };
        private static readonly byte[] PREFIX_TOTAL_USERS = new byte[] { 0x2A };
        #endregion

        #region Data Structures
        public struct PieceData
        {
            public UInt160 Owner;
            public BigInteger X;
            public BigInteger Y;
            public BigInteger RegionId;
            public BigInteger PurchaseTime;
            public BigInteger Price;
            public string Metadata;
            public BigInteger TradeCount;
            public BigInteger LastTradeTime;
        }

        public struct RegionData
        {
            public BigInteger Id;
            public BigInteger ClaimedPieces;
            public UInt160 Completer;
            public BigInteger CompletionTime;
            public bool Completed;
            public BigInteger BonusPaid;
        }

        public struct UserStats
        {
            public BigInteger PiecesOwned;
            public BigInteger PiecesClaimed;
            public BigInteger PiecesBought;
            public BigInteger PiecesSold;
            public BigInteger TotalSpent;
            public BigInteger TotalEarned;
            public BigInteger RegionsCompleted;
            public BigInteger BadgeCount;
            public BigInteger JoinTime;
        }
        #endregion

        #region App Events
        [DisplayName("PieceClaimed")]
        public static event PieceClaimedHandler OnPieceClaimed;

        [DisplayName("PieceTraded")]
        public static event PieceTradedHandler OnPieceTraded;

        [DisplayName("PieceListed")]
        public static event PieceListedHandler OnPieceListed;

        [DisplayName("PieceDelisted")]
        public static event PieceDelistedHandler OnPieceDelisted;

        [DisplayName("RegionCompleted")]
        public static event RegionCompletedHandler OnRegionCompleted;

        [DisplayName("PieceCustomized")]
        public static event PieceCustomizedHandler OnPieceCustomized;

        [DisplayName("AchievementUnlocked")]
        public static event AchievementUnlockedHandler OnAchievementUnlocked;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_CLAIMED, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_TRADED, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_VOLUME, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_USERS, 0);
        }
        #endregion

        #region Read Methods
        [Safe]
        public static BigInteger TotalClaimed() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_CLAIMED);

        [Safe]
        public static BigInteger TotalTraded() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_TRADED);

        [Safe]
        public static BigInteger TotalVolume() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_VOLUME);

        [Safe]
        public static BigInteger TotalUsers() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_USERS);

        [Safe]
        public static PieceData GetPiece(BigInteger x, BigInteger y)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, GetPieceKey(x, y));
            if (data == null) return new PieceData();
            return (PieceData)StdLib.Deserialize(data);
        }

        [Safe]
        public static RegionData GetRegion(BigInteger regionId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_REGIONS, (ByteString)regionId.ToByteArray()));
            if (data == null) return new RegionData();
            return (RegionData)StdLib.Deserialize(data);
        }

        [Safe]
        public static UserStats GetUserStats(UInt160 user)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_USER_STATS, user));
            if (data == null) return new UserStats();
            return (UserStats)StdLib.Deserialize(data);
        }

        [Safe]
        public static BigInteger GetUserPieceCount(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_PIECE_COUNT, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetListingPrice(BigInteger x, BigInteger y)
        {
            ByteString listingKey = Helper.Concat((ByteString)PREFIX_LISTINGS, GetPieceKey(x, y));
            ByteString priceData = Storage.Get(Storage.CurrentContext, listingKey);
            if (priceData == null) return 0;
            return (BigInteger)priceData;
        }

        [Safe]
        public static bool HasBadge(UInt160 user, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_BADGES, user),
                (ByteString)badgeType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }
        #endregion
    }
}
