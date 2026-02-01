using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppMillionPieceMap
    {
        #region Stats Update Methods

        private static void UpdateUserStatsOnClaim(UInt160 user)
        {
            UserStats stats = GetUserStats(user);
            bool isNewUser = stats.JoinTime == 0;
            if (isNewUser)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalUsers = TotalUsers();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_USERS, totalUsers + 1);
            }
            stats.PiecesOwned += 1;
            stats.PiecesClaimed += 1;
            stats.TotalSpent += PIECE_PRICE;
            StoreUserStats(user, stats);
        }

        private static void UpdateUserStatsOnBuy(UInt160 user, BigInteger price)
        {
            UserStats stats = GetUserStats(user);
            bool isNewUser = stats.JoinTime == 0;
            if (isNewUser)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalUsers = TotalUsers();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_USERS, totalUsers + 1);
            }
            stats.PiecesOwned += 1;
            stats.PiecesBought += 1;
            stats.TotalSpent += price;
            StoreUserStats(user, stats);
        }

        private static void UpdateUserStatsOnSell(UInt160 user, BigInteger price)
        {
            UserStats stats = GetUserStats(user);
            stats.PiecesOwned -= 1;
            stats.PiecesSold += 1;
            stats.TotalEarned += price;
            StoreUserStats(user, stats);
        }

        private static void UpdateRegionOnClaim(BigInteger regionId, UInt160 claimer)
        {
            RegionData region = GetRegion(regionId);
            if (region.Id == 0) region.Id = regionId;
            region.ClaimedPieces += 1;

            if (region.ClaimedPieces >= REGION_SIZE * REGION_SIZE && !region.Completed)
            {
                region.Completed = true;
                region.Completer = claimer;
                region.CompletionTime = Runtime.Time;
                region.BonusPaid = REGION_BONUS;

                UserStats stats = GetUserStats(claimer);
                stats.RegionsCompleted += 1;
                StoreUserStats(claimer, stats);

                CheckAndAwardBadge(claimer, 4, "Region Master");

                OnRegionCompleted(regionId, claimer, REGION_BONUS);
            }

            StoreRegion(regionId, region);
        }

        #endregion
    }
}
