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
        #region Owner (bankroll withdrawal)
        /// <summary>
        /// Owner-only bankroll withdrawal. Never withdraws funds reserved against pending
        /// bets, so every committed-but-unsettled win stays fully payable.
        /// </summary>
        public static void WithdrawBankroll(UInt160 to, BigInteger amount)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            WithdrawBankrollChecked(to, amount);
            OnBankrollWithdrawn(to, amount);
        }
        #endregion

        #region Upgrade (owner-gated, instant)
        /// <summary>
        /// Owner-only contract upgrade. Replaces the contract NEF and manifest in place via
        /// ContractManagement.Update. Instant (no timelock): gated solely by the owner witness.
        /// </summary>
        public static void Update(ByteString nef, string manifest)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            ContractManagement.Update(nef, manifest, new object[0]);
        }
        #endregion

        #region Withdraw credit
        /// <summary>Reclaim any unused prepaid bet-credit back to the sender. Does NOT touch
        /// escrowed pending wagers — those are settled via settle().</summary>
        public static BigInteger Withdraw(UInt160 account)
        {
            BigInteger credit = WithdrawCredit(account);
            OnCreditWithdrawn(account, credit);
            return credit;
        }
        #endregion

        #region Read-only
        [Safe]
        public static BigInteger Bankroll() => ReadBankroll();

        [Safe]
        public static BigInteger ReservedBankroll() => ReadReserved();

        [Safe]
        public static BigInteger FreeBankroll() => ReadFreeBankroll();

        [Safe]
        public static BigInteger CreditOf(UInt160 player) => ReadCredit(player);

        [Safe]
        public static BigInteger LastBetId() => ReadLastBetId();

        [Safe]
        public static BigInteger PendingBetCount() => ReadPendingBetCount();

        [Safe]
        public static Map<string, object> GetStats(UInt160 player) => StatsMap(player);

        [Safe]
        public static Map<string, object> GetPendingBet(BigInteger betId)
        {
            Bet b = LoadBet(betId);
            Map<string, object> r = new Map<string, object>();
            r["id"] = betId; r["player"] = b.Player; r["face"] = b.Selection;
            r["wager"] = b.Wager; r["exposure"] = b.Exposure;
            r["commitIndex"] = b.CommitIndex; r["commitTime"] = b.CommitTime;
            r["settled"] = b.Settled; r["rolled"] = b.Result; r["won"] = b.Won;
            r["payout"] = b.Payout; r["settleTime"] = b.SettleTime;
            return r;
        }

        [Safe]
        public static BigInteger PlayerBetCount(UInt160 player) => ReadPlayerBetCount(player);

        [Safe]
        public static BigInteger[] GetPlayerBets(UInt160 player, BigInteger offset, BigInteger limit) =>
            ReadPlayerBets(player, offset, limit);
        #endregion
    }
}
