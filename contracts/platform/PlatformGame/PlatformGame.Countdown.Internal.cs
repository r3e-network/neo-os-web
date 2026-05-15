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
        //  Internal countdown helpers
        // ===================================================================

        /// <summary>
        /// Settle a countdown round: pay the winner, update stats.
        /// </summary>
        private static void SettleCountdownRound(string appId, BigInteger roundId)
        {
            CountdownRound round = LoadCountdownRound(appId, roundId);
            if (!round.Active || round.Settled) return;

            UInt160 winner = round.LastBuyer;
            BigInteger winnerPrize = round.Pot * CD_WINNER_SHARE_BPS / 10000;
            BigInteger nextRoundPot = round.Pot * CD_NEXT_ROUND_SHARE_BPS / 10000;

            round.Active = false;
            round.Settled = true;
            round.Winner = winner;
            round.WinnerPrize = winnerPrize;
            StoreCountdownRound(appId, roundId, round);

            // Transfer prize to winner
            if (winner != UInt160.Zero && winnerPrize > 0)
            {
                ExecutionEngine.Assert(
                    GAS.Transfer(Runtime.ExecutingScriptHash, winner, winnerPrize),
                    "winner payout failed");

                // Update winner stats
                CountdownPlayerStats stats = LoadCountdownPlayerStats(appId, winner);
                stats.TotalWon += winnerPrize;
                stats.RoundsWon += 1;
                StoreCountdownPlayerStats(appId, winner, stats);
            }

            // Update total distributed
            BigInteger totalDistributed = AppGetInt(appId, CD_PREFIX_TOTAL_POT_DIST);
            AppPut(appId, CD_PREFIX_TOTAL_POT_DIST, totalDistributed + round.Pot);

            OnCountdownWinner(appId, winner, winnerPrize, roundId);
            StartNextCountdownRound(appId, nextRoundPot);
        }

        /// <summary>
        /// Ensure the app has a live round. Expired rounds are settled and
        /// immediately rolled forward so LastSurvivor never remains stopped.
        /// </summary>
        private static CountdownRound EnsureActiveCountdownRound(string appId)
        {
            BigInteger roundId = AppGetInt(appId, CD_PREFIX_ROUND_ID);
            if (roundId == 0)
            {
                return StartNextCountdownRound(appId, 0);
            }

            CountdownRound round = LoadCountdownRound(appId, roundId);
            if (round.Active)
            {
                if (Runtime.Time >= round.EndTime)
                {
                    SettleCountdownRound(appId, roundId);
                    return LoadCountdownRound(appId, AppGetInt(appId, CD_PREFIX_ROUND_ID));
                }

                return round;
            }

            ExecutionEngine.Assert(round.Settled, "round unavailable");
            return StartNextCountdownRound(appId, 0);
        }

        /// <summary>Start the next countdown round with an optional rollover pot.</summary>
        private static CountdownRound StartNextCountdownRound(string appId, BigInteger seedPot)
        {
            BigInteger currentId = AppGetInt(appId, CD_PREFIX_ROUND_ID);
            BigInteger newRoundId = currentId + 1;
            AppPut(appId, CD_PREFIX_ROUND_ID, newRoundId);

            CountdownRound round = new CountdownRound
            {
                Id = newRoundId,
                StartTime = Runtime.Time,
                EndTime = Runtime.Time + CD_INITIAL_DURATION,
                Pot = seedPot,
                TotalKeys = 0,
                LastBuyer = UInt160.Zero,
                Winner = UInt160.Zero,
                WinnerPrize = 0,
                Active = true,
                Settled = false
            };
            StoreCountdownRound(appId, newRoundId, round);

            BigInteger totalRounds = AppGetInt(appId, CD_PREFIX_TOTAL_ROUNDS);
            AppPut(appId, CD_PREFIX_TOTAL_ROUNDS, totalRounds + 1);

            OnCountdownRoundStarted(appId, newRoundId, round.EndTime);
            return round;
        }

        /// <summary>Update player stats after a key purchase.</summary>
        private static void UpdateCountdownPlayerStats(string appId, UInt160 player, BigInteger keyCount, BigInteger spent)
        {
            CountdownPlayerStats stats = LoadCountdownPlayerStats(appId, player);

            bool isNewPlayer = stats.JoinTime == 0;
            if (isNewPlayer)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalPlayers = AppGetInt(appId, CD_PREFIX_TOTAL_PLAYERS);
                AppPut(appId, CD_PREFIX_TOTAL_PLAYERS, totalPlayers + 1);
            }

            stats.TotalKeysOwned += keyCount;
            stats.TotalSpent += spent;
            stats.RoundsPlayed += 1;
            stats.LastActivityTime = Runtime.Time;

            if (spent > stats.HighestSinglePurchase)
            {
                stats.HighestSinglePurchase = spent;
            }

            StoreCountdownPlayerStats(appId, player, stats);

            // Badge checks
            CheckCountdownBadges(appId, player, stats);
        }

        /// <summary>Award badges based on player milestones.</summary>
        private static void CheckCountdownBadges(string appId, UInt160 player, CountdownPlayerStats stats)
        {
            if (stats.TotalKeysOwned >= 1)
                AwardCountdownBadge(appId, player, 1, "First Key");
            if (stats.TotalKeysOwned >= 100)
                AwardCountdownBadge(appId, player, 2, "Key Collector");
            if (stats.TotalSpent >= 1000000000)
                AwardCountdownBadge(appId, player, 3, "Big Spender");
            if (stats.RoundsWon >= 1)
                AwardCountdownBadge(appId, player, 4, "Winner");
            if (stats.RoundsWon >= 5)
                AwardCountdownBadge(appId, player, 5, "Champion");
            if (stats.TotalSpent >= 10000000000)
                AwardCountdownBadge(appId, player, 6, "Whale");
        }

        /// <summary>Award a badge if not already held.</summary>
        private static void AwardCountdownBadge(string appId, UInt160 player, BigInteger badgeType, string badgeName)
        {
            byte[] badgeKey = (byte[])Helper.Concat(
                (ByteString)AppKey(appId, CD_PREFIX_PLAYER_BADGES, player),
                (ByteString)badgeType.ToByteArray());

            if ((BigInteger)Storage.Get(Storage.CurrentContext, badgeKey) == 1) return;

            Storage.Put(Storage.CurrentContext, badgeKey, 1);

            CountdownPlayerStats stats = LoadCountdownPlayerStats(appId, player);
            stats.BadgeCount += 1;
            StoreCountdownPlayerStats(appId, player, stats);

            OnCountdownBadge(appId, player, badgeType, badgeName);
        }

        // ---------------------------------------------------------------
        //  Countdown storage load/store
        // ---------------------------------------------------------------

        private static void StoreCountdownRound(string appId, BigInteger roundId, CountdownRound round)
        {
            Storage.Put(Storage.CurrentContext,
                AppKey(appId, CD_PREFIX_ROUNDS, roundId),
                StdLib.Serialize(round));
        }

        private static CountdownRound LoadCountdownRound(string appId, BigInteger roundId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                AppKey(appId, CD_PREFIX_ROUNDS, roundId));
            if (data == null) return new CountdownRound();
            return (CountdownRound)StdLib.Deserialize(data);
        }

        private static void StoreCountdownPlayerStats(string appId, UInt160 player, CountdownPlayerStats stats)
        {
            Storage.Put(Storage.CurrentContext,
                AppKey(appId, CD_PREFIX_PLAYER_STATS, player),
                StdLib.Serialize(stats));
        }

        private static CountdownPlayerStats LoadCountdownPlayerStats(string appId, UInt160 player)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                AppKey(appId, CD_PREFIX_PLAYER_STATS, player));
            if (data == null) return new CountdownPlayerStats();
            return (CountdownPlayerStats)StdLib.Deserialize(data);
        }
    }
}
