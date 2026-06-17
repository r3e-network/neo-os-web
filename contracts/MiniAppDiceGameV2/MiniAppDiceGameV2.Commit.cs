using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;

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
            ExecutionEngine.Assert(face >= 1 && face <= 6, "face must be 1..6");
            // A 5.70x win pays the wager back (from escrow) PLUS an extra amount*47/10 from the
            // house.
            BigInteger exposure = amount * EXTRA_NUM / PAYOUT_DEN;
            BigInteger betId = CommitBet(player, face, amount, MAX_BET, exposure);
            OnCommitted(betId, player, face, amount, Ledger.CurrentIndex);
            return betId;
        }
        #endregion
    }
}
