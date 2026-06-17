using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCoinFlipV2
    {
        #region Commit (block N — escrow + reserve, no outcome)
        /// <summary>
        /// Commit a coin-flip wager. choice: 0=heads, 1=tails. Escrows the wager from the
        /// player's prepaid credit and reserves the worst-case house exposure (= amount,
        /// since a 2x win pays an extra `amount` from the house) from the free bankroll.
        /// The outcome is NOT decided here — call settle(betId) in a LATER block.
        /// Returns the betId.
        /// </summary>
        public static BigInteger Commit(UInt160 player, BigInteger choice, BigInteger amount)
        {
            ExecutionEngine.Assert(choice == 0 || choice == 1, "choice must be 0 or 1");
            // A 2x win pays the wager back (from escrow) PLUS an extra `amount` from the house.
            BigInteger exposure = amount;
            BigInteger betId = CommitBet(player, choice, amount, MAX_BET, exposure);
            OnCommitted(betId, player, choice, amount, Ledger.CurrentIndex);
            return betId;
        }
        #endregion
    }
}
