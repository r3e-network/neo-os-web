using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public abstract partial class MiniAppHouseGameBase : SmartContract
    {
        #region Settle (later block — reveal + pay) — PERMISSIONLESS
        /// <summary>
        /// Shared settle engine. Loads the bet, asserts it is unsettled and past the K-block
        /// beacon window, derives the result from the FIXED multi-block beacon as
        /// `(beaconEntropy + mix) % outcomeMod + outcomeAdd` (CoinFlip: mod 2, add 0; Dice:
        /// mod 6, add 1), computes the win (result == selection) and `payout = wager *
        /// payoutNum / payoutDen` on a win, releases the reservation, applies the bankroll
        /// /stats/bet effects (effects-before-interaction), decrements pending, pays the
        /// winner, and returns the settled Bet so the caller emits its own Settled event.
        /// </summary>
        protected static Bet SettleBet(BigInteger betId, BigInteger outcomeMod, BigInteger outcomeAdd, BigInteger payoutNum, BigInteger payoutDen, bool totalWonIsExposure)
        {
            StorageContext ctx = Storage.CurrentContext;
            ByteString raw = Storage.Get(ctx, BetKey(betId));
            ExecutionEngine.Assert(raw is not null, "bet not found");
            Bet b = (Bet)StdLib.Deserialize(raw);
            ExecutionEngine.Assert(!b.Settled, "bet already settled");
            ExecutionEngine.Assert(Ledger.CurrentIndex > b.CommitIndex + BEACON_BLOCKS, "reveal must be a later block");

            // FIXED multi-block beacon: the concat-hash of the K blocks commitIndex+1 ..
            // commitIndex+K (all unknown at commit, immutable once produced), mixed with
            // betId+player+commitIndex. Re-calling settle in any later block yields the SAME
            // result, so an abort-and-retry via a wrapper contract gains nothing — this is what
            // closes the v1-class abort-on-loss bankroll drain.
            ByteString beaconBytes = (ByteString)new byte[0];
            for (int i = 1; i <= BEACON_BLOCKS; i++)
            {
                var beacon = Ledger.GetBlock((uint)(b.CommitIndex + i));
                ExecutionEngine.Assert(beacon is not null, "beacon block unavailable");
                beaconBytes = Helper.Concat(beaconBytes, (ByteString)(byte[])beacon.Hash);
            }
            BigInteger entropy = (BigInteger)CryptoLib.Sha256(beaconBytes);
            if (entropy < 0) entropy = -entropy;
            BigInteger mix = (BigInteger)(ByteString)(byte[])b.Player + betId + b.CommitIndex;
            if (mix < 0) mix = -mix;
            BigInteger result = (entropy + mix) % outcomeMod + outcomeAdd;
            bool won = result == b.Selection;

            BigInteger bankroll = (BigInteger)Storage.Get(ctx, PREFIX_BANKROLL);
            BigInteger reserved = (BigInteger)Storage.Get(ctx, PREFIX_RESERVED) - b.Exposure;

            Stats s = LoadStats(ctx, b.Player);
            BigInteger payout = 0;
            if (won)
            {
                payout = b.Wager * payoutNum / payoutDen;
                bankroll -= b.Exposure;   // the reserved extra-from-house is spent on the win
                s.Wins += 1;
                s.TotalWon += totalWonIsExposure ? b.Exposure : b.Wager;
            }
            else
            {
                bankroll += b.Wager;      // the escrowed wager funds the house
                s.Losses += 1;
            }

            // Effects before interaction.
            Storage.Put(ctx, PREFIX_BANKROLL, bankroll);
            Storage.Put(ctx, PREFIX_RESERVED, reserved);
            Storage.Put(ctx, StatsKey(b.Player), StdLib.Serialize(s));

            b.Settled = true;
            b.Result = result;
            b.Won = won;
            b.Payout = payout;
            b.SettleTime = Runtime.Time;
            Storage.Put(ctx, BetKey(betId), StdLib.Serialize(b));

            BigInteger pending = (BigInteger)Storage.Get(ctx, PREFIX_PENDING_CNT);
            if (pending > 0) Storage.Put(ctx, PREFIX_PENDING_CNT, pending - 1);

            if (won)
            {
                bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                    new object[] { Runtime.ExecutingScriptHash, b.Player, payout, "" });
                ExecutionEngine.Assert(ok, "payout transfer failed");
            }
            return b;
        }
        #endregion

        #region Shared read helpers
        protected static BigInteger ReadBankroll() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_BANKROLL);
        protected static BigInteger ReadReserved() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_RESERVED);
        protected static BigInteger ReadFreeBankroll()
        {
            StorageContext ctx = Storage.CurrentContext;
            return (BigInteger)Storage.Get(ctx, PREFIX_BANKROLL) - (BigInteger)Storage.Get(ctx, PREFIX_RESERVED);
        }
        protected static BigInteger ReadCredit(UInt160 player) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_CREDIT, (byte[])player));
        protected static BigInteger ReadLastBetId() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_BET_ID);
        protected static BigInteger ReadPendingBetCount() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PENDING_CNT);
        protected static BigInteger ReadPlayerBetCount(UInt160 player) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_PLAYER_CNT, (byte[])player));

        protected static Map<string, object> StatsMap(UInt160 player)
        {
            Stats s = LoadStats(Storage.CurrentContext, player);
            Map<string, object> r = new Map<string, object>();
            r["wins"] = s.Wins; r["losses"] = s.Losses; r["totalWon"] = s.TotalWon;
            return r;
        }

        protected static Bet LoadBet(BigInteger betId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, BetKey(betId));
            ExecutionEngine.Assert(raw is not null, "bet not found");
            return (Bet)StdLib.Deserialize(raw);
        }

        protected static BigInteger[] ReadPlayerBets(UInt160 player, BigInteger offset, BigInteger limit)
        {
            StorageContext ctx = Storage.CurrentContext;
            BigInteger n = (BigInteger)Storage.Get(ctx, Helper.Concat(PREFIX_PLAYER_CNT, (byte[])player));
            if (offset < 0) offset = 0;
            if (limit <= 0 || limit > 100) limit = 100;
            BigInteger start = offset + 1;
            BigInteger end = start + limit - 1;
            if (end > n) end = n;
            if (start > end) return new BigInteger[0];
            BigInteger count = end - start + 1;
            BigInteger[] result = new BigInteger[(int)count];
            BigInteger idx = 0;
            for (BigInteger i = start; i <= end; i++)
            {
                result[(int)idx] = (BigInteger)Storage.Get(ctx, Helper.Concat(Helper.Concat(PREFIX_PLAYER_ITEM, (byte[])player), (byte[])(ByteString)i));
                idx += 1;
            }
            return result;
        }
        #endregion

        #region Internal
        private static Stats LoadStats(StorageContext ctx, UInt160 player)
        {
            ByteString raw = Storage.Get(ctx, StatsKey(player));
            if (raw is null) return new Stats { Wins = 0, Losses = 0, TotalWon = 0 };
            return (Stats)StdLib.Deserialize(raw);
        }
        private static byte[] StatsKey(UInt160 player) => Helper.Concat(PREFIX_STATS, (byte[])player);
        private static byte[] BetKey(BigInteger id) => Helper.Concat(PREFIX_BET, (byte[])(ByteString)id);
        private static void IndexAppend(StorageContext ctx, UInt160 player, BigInteger betId)
        {
            byte[] cntKey = Helper.Concat(PREFIX_PLAYER_CNT, (byte[])player);
            BigInteger n = (BigInteger)Storage.Get(ctx, cntKey) + 1;
            Storage.Put(ctx, cntKey, n);
            Storage.Put(ctx, Helper.Concat(Helper.Concat(PREFIX_PLAYER_ITEM, (byte[])player), (byte[])(ByteString)n), betId);
        }
        #endregion
    }
}
