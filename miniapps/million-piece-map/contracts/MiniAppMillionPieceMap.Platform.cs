using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppMillionPieceMap
    {
        #region Platform Query Methods

        [Safe]
        public static Map<string, object> GetUserStatsDetails(UInt160 user)
        {
            UserStats stats = GetUserStats(user);
            Map<string, object> details = new Map<string, object>();

            details["piecesOwned"] = stats.PiecesOwned;
            details["piecesClaimed"] = stats.PiecesClaimed;
            details["piecesBought"] = stats.PiecesBought;
            details["piecesSold"] = stats.PiecesSold;
            details["totalSpent"] = stats.TotalSpent;
            details["totalEarned"] = stats.TotalEarned;
            details["regionsCompleted"] = stats.RegionsCompleted;
            details["badgeCount"] = stats.BadgeCount;
            details["joinTime"] = stats.JoinTime;
            details["pieceCount"] = GetUserPieceCount(user);
            details["netProfit"] = stats.TotalEarned - stats.TotalSpent;

            details["hasFirstPiece"] = HasBadge(user, 1);
            details["hasCollector10"] = HasBadge(user, 2);
            details["hasCollector100"] = HasBadge(user, 3);
            details["hasRegionMaster"] = HasBadge(user, 4);
            details["hasTrader"] = HasBadge(user, 5);

            return details;
        }

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalPieces"] = TOTAL_PIECES;
            stats["totalRegions"] = TOTAL_REGIONS;
            stats["totalClaimed"] = TotalClaimed();
            stats["totalTraded"] = TotalTraded();
            stats["totalVolume"] = TotalVolume();
            stats["totalUsers"] = TotalUsers();
            stats["claimPercent"] = TotalClaimed() * 100 / TOTAL_PIECES;
            stats["piecePrice"] = PIECE_PRICE;
            stats["customizeFee"] = CUSTOMIZE_FEE;
            stats["regionBonus"] = REGION_BONUS;
            stats["mapWidth"] = MAP_WIDTH;
            stats["mapHeight"] = MAP_HEIGHT;
            stats["regionSize"] = REGION_SIZE;
            return stats;
        }

        [Safe]
        public static Map<string, object> GetMapOverview()
        {
            Map<string, object> overview = new Map<string, object>();
            overview["width"] = MAP_WIDTH;
            overview["height"] = MAP_HEIGHT;
            overview["regionSize"] = REGION_SIZE;
            overview["totalPieces"] = TOTAL_PIECES;
            overview["totalRegions"] = TOTAL_REGIONS;
            overview["claimed"] = TotalClaimed();
            overview["available"] = TOTAL_PIECES - TotalClaimed();
            return overview;
        }

        #endregion
    }
}
