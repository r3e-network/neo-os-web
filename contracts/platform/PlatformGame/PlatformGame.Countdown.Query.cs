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
    public partial class PlatformGameContract
    {
        // ===================================================================
        //  Read methods
        // ===================================================================

        /// <summary>
        /// Get the current countdown status for an appId.
        /// Returns a Map with round state, timer, key price, etc.
        /// </summary>
        [Safe]
        public static Map<string, object> GetCountdownStatus(string appId)
        {
            Map<string, object> status = new Map<string, object>();

            BigInteger roundId = AppGetInt(appId, CD_PREFIX_ROUND_ID);
            if (roundId == 0)
            {
                status["roundId"] = 0;
                status["active"] = false;
                return status;
            }

            CountdownRound round = LoadCountdownRound(appId, roundId);

            status["roundId"] = roundId;
            status["active"] = round.Active;
            status["pot"] = round.Pot;
            status["totalKeys"] = round.TotalKeys;
            status["lastBuyer"] = round.LastBuyer;
            status["startTime"] = round.StartTime;
            status["endTime"] = round.EndTime;
            status["settled"] = round.Settled;

            // Current key price
            BigInteger keyPrice = CD_BASE_KEY_PRICE +
                (round.TotalKeys * CD_BASE_KEY_PRICE * CD_KEY_PRICE_INCREMENT_BPS / 10000);
            status["currentKeyPrice"] = keyPrice;

            if (round.Active)
            {
                BigInteger remaining = round.EndTime - Runtime.Time;
                status["remainingTime"] = remaining > 0 ? remaining : 0;
                status["status"] = remaining > 0 ? "active" : "ending";
            }
            else
            {
                status["status"] = round.Settled ? "settled" : "ended";
                status["winner"] = round.Winner;
                status["winnerPrize"] = round.WinnerPrize;
            }

            // Constants for frontend calculation
            status["baseKeyPrice"] = CD_BASE_KEY_PRICE;
            status["keyPriceIncrementBps"] = CD_KEY_PRICE_INCREMENT_BPS;
            status["timeAddedPerKeyMs"] = CD_TIME_PER_KEY_MS;
            status["maxDurationMs"] = CD_MAX_DURATION_MS;
            status["platformFeeBps"] = CD_PLATFORM_FEE_BPS;
            status["winnerShareBps"] = CD_WINNER_SHARE_BPS;
            status["dividendShareBps"] = CD_DIVIDEND_SHARE_BPS;

            // Aggregate stats
            status["totalKeysSold"] = AppGetInt(appId, CD_PREFIX_TOTAL_KEYS_SOLD);
            status["totalPotDistributed"] = AppGetInt(appId, CD_PREFIX_TOTAL_POT_DIST);
            status["totalPlayers"] = AppGetInt(appId, CD_PREFIX_TOTAL_PLAYERS);
            status["totalRounds"] = AppGetInt(appId, CD_PREFIX_TOTAL_ROUNDS);

            return status;
        }

        /// <summary>
        /// Get per-player stats for the countdown game.
        /// </summary>
        [Safe]
        public static Map<string, object> GetCountdownPlayerStats(string appId, UInt160 player)
        {
            CountdownPlayerStats stats = LoadCountdownPlayerStats(appId, player);
            Map<string, object> details = new Map<string, object>();

            details["totalKeysOwned"] = stats.TotalKeysOwned;
            details["totalSpent"] = stats.TotalSpent;
            details["totalWon"] = stats.TotalWon;
            details["roundsPlayed"] = stats.RoundsPlayed;
            details["roundsWon"] = stats.RoundsWon;
            details["referralEarnings"] = stats.ReferralEarnings;
            details["badgeCount"] = stats.BadgeCount;
            details["joinTime"] = stats.JoinTime;
            details["lastActivityTime"] = stats.LastActivityTime;
            details["highestSinglePurchase"] = stats.HighestSinglePurchase;
            details["dividendsClaimed"] = stats.DividendsClaimed;
            details["netProfit"] = stats.TotalWon - stats.TotalSpent;

            if (stats.RoundsPlayed > 0)
            {
                details["winRate"] = stats.RoundsWon * 10000 / stats.RoundsPlayed;
            }

            // Current round keys
            BigInteger roundId = AppGetInt(appId, CD_PREFIX_ROUND_ID);
            if (roundId > 0)
            {
                byte[] pkKey = AppKeyAddrId(appId, CD_PREFIX_PLAYER_KEYS, player, roundId);
                details["currentRoundKeys"] = (BigInteger)Storage.Get(Storage.CurrentContext, pkKey);
            }

            return details;
        }

        /// <summary>
        /// Calculate the cost for buying multiple keys using O(1) formula.
        /// Sum of arithmetic sequence: n * firstPrice + d * n * (n-1) / 2
        /// </summary>
        [Safe]
        public static BigInteger CalculateCountdownKeyCost(BigInteger keyCount, BigInteger currentTotalKeys)
        {
            if (keyCount <= 0) return 0;

            BigInteger commonDiff = CD_BASE_KEY_PRICE * CD_KEY_PRICE_INCREMENT_BPS / 10000;
            BigInteger firstKeyPrice = CD_BASE_KEY_PRICE + (currentTotalKeys * commonDiff);
            BigInteger totalCost = keyCount * firstKeyPrice +
                commonDiff * keyCount * (keyCount - 1) / 2;

            return totalCost;
        }
    }
}
