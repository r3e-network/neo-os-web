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
    public partial class MiniAppDiceGameV2
    {
        #region Commit (block N — escrow + reserve, no outcome)
        /// <summary>
        /// Commit a dice-roll wager. face: 1..6. Escrows the wager from the player's prepaid
        /// credit and reserves the worst-case house exposure (= amount*47/10, the extra a
        /// 5.70x win pays beyond the wager) from the free bankroll. The outcome is NOT
        /// decided here — call settle(betId) in a LATER block. Returns the betId.
        /// </summary>
        public static BigInteger Commit(UInt160 player, BigInteger face, BigInteger amount)
        {
            ExecutionEngine.Assert(player is not null && player.IsValid && !player.IsZero, "invalid player");
            ExecutionEngine.Assert(Runtime.CheckWitness(player), "player witness required");
            ExecutionEngine.Assert(face >= 1 && face <= 6, "face must be 1..6");
            ExecutionEngine.Assert(amount >= MIN_BET && amount <= MAX_BET, "bet out of range");

            StorageContext ctx = Storage.CurrentContext;

            // Escrow the prepaid wager irrevocably.
            byte[] creditKey = Helper.Concat(PREFIX_CREDIT, (byte[])player);
            BigInteger credit = (BigInteger)Storage.Get(ctx, creditKey);
            ExecutionEngine.Assert(credit >= amount, "insufficient bet credit");
            BigInteger nextCredit = credit - amount;
            if (nextCredit == 0) Storage.Delete(ctx, creditKey); else Storage.Put(ctx, creditKey, nextCredit);

            // Reserve the worst-case house exposure so concurrent pending bets cannot
            // oversubscribe. A 5.70x win pays the wager back (from escrow) PLUS an extra
            // amount*47/10 from the house.
            BigInteger exposure = amount * EXTRA_NUM / PAYOUT_DEN;
            BigInteger bankroll = (BigInteger)Storage.Get(ctx, PREFIX_BANKROLL);
            BigInteger reserved = (BigInteger)Storage.Get(ctx, PREFIX_RESERVED);
            BigInteger free = bankroll - reserved;
            ExecutionEngine.Assert(free >= exposure, "free bankroll cannot cover this bet");
            Storage.Put(ctx, PREFIX_RESERVED, reserved + exposure);

            BigInteger betId = (BigInteger)Storage.Get(ctx, PREFIX_BET_ID) + 1;
            Storage.Put(ctx, PREFIX_BET_ID, betId);

            Bet b = new Bet
            {
                Player = player,
                Face = face,
                Wager = amount,
                Exposure = exposure,
                CommitIndex = Ledger.CurrentIndex,
                CommitTime = Runtime.Time,
                Settled = false,
                Rolled = 0,
                Won = false,
                Payout = 0,
                SettleTime = 0,
            };
            Storage.Put(ctx, BetKey(betId), StdLib.Serialize(b));
            IndexAppend(ctx, player, betId);

            BigInteger pending = (BigInteger)Storage.Get(ctx, PREFIX_PENDING_CNT) + 1;
            Storage.Put(ctx, PREFIX_PENDING_CNT, pending);

            OnCommitted(betId, player, face, amount, b.CommitIndex);
            return betId;
        }
        #endregion
    }
}
