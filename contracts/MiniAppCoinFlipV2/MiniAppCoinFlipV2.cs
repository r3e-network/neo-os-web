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
    /// <summary>
    /// MiniAppCoinFlipV2 — self-contained on-chain coin-flip game with a COMMIT/REVEAL
    /// settlement that closes the same-tx abort-on-loss exploit of v1 (MiniAppCoinFlip).
    ///
    /// EXPLOIT IN v1: v1 consumed the wager AND settled the flip in the SAME transaction
    /// with Runtime.GetRandom. An attacker contract could deposit, call flip(), read the
    /// outcome, and ABORT the whole transaction on a loss (reverting its own wager) while
    /// letting wins commit. Because losses cost nothing and wins pay 2x, EV was strictly
    /// positive and the house bankroll was drainable.
    ///
    /// FIX — COMMIT/REVEAL ACROSS BLOCKS: commit(player, choice, amount) escrows the wager
    /// and reserves the house exposure (= amount) at block N; settle(betId) is PERMISSIONLESS
    /// and derives the outcome in a LATER block from a FIXED multi-block beacon (the
    /// concat-hash of Ledger.GetBlock(commit+1..+K).Hash, K = BEACON_BLOCKS = 3) mixed with
    /// betId+player+commitIndex, taken mod 2. Re-calling settle in any later block yields the
    /// SAME outcome, so the abort-on-loss drain is closed. The commit/reveal engine, the
    /// reserved-bankroll solvency guard, the pull-payment credit + Withdraw, and the multi-
    /// block beacon all live in <see cref="MiniAppHouseGameBase"/>, shared with the dice game
    /// so future fixes land once; only the 2x payout, the heads/tails choice, and this memo
    /// pair are game-specific.
    ///
    /// MULTI-BLOCK BEACON (grinding cost): the entropy mixes K = 3 CONSECUTIVE block hashes,
    /// not a single one, so biasing the outcome would require influencing/withholding all K
    /// beacon blocks in a row. This is NOT VRF-grade randomness; it is intended for the low-
    /// stakes coin flip — high-value draws should use the VRF oracle when operational.
    ///
    /// MODEL: GAS only, BASE UNITS (1 GAS = 1e8). House funds the bankroll (memo
    /// "miniapp-fogplay:fund"); a player prepays a wager (memo "miniapp-fogplay:bet"). Memos
    /// and OnNEP17Payment credit-only behaviour are identical to v1. Owner is unchanged.
    ///
    /// SOLVENCY INVARIANT (asserted in tests):
    ///   heldGAS == bankroll + sum(escrowed pending amounts) + sum(player credits)
    ///   reservedBankroll <= bankroll
    /// </summary>
    [DisplayName("MiniAppCoinFlipV2")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Commit/reveal on-chain coin flip: 2x payout settled across blocks with reserved bankroll — closes the same-tx abort-on-loss exploit.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")] // GAS
    public partial class MiniAppCoinFlipV2 : MiniAppHouseGameBase
    {
        #region Game-specific constants (base units)
        private const long MAX_BET = 10_000_000_000;   // 100 GAS
        private const string FUND_MEMO = "miniapp-fogplay:fund";
        private const string BET_MEMO = "miniapp-fogplay:bet";

        // Coin flip: outcome = (beacon mix) % 2 (0 = heads, 1 = tails); a win pays 2x, so the
        // per-bet house exposure is the extra `amount` a 2x win pays beyond the wager.
        private const int OUTCOME_MOD = 2;
        private const int OUTCOME_ADD = 0;
        private const int PAYOUT_NUM = 2;
        private const int PAYOUT_DEN = 1;

        [InitialValue("NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32", ContractParameterType.Hash160)]
        private static readonly UInt160 Owner = default;
        #endregion

        #region Events
        [DisplayName("Credited")]
        public static event Action<UInt160, BigInteger, BigInteger> OnCredited; // from, amount, balance
        [DisplayName("BankrollFunded")]
        public static event Action<UInt160, BigInteger, BigInteger> OnBankrollFunded; // from, amount, bankroll
        [DisplayName("Committed")]
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger, BigInteger> OnCommitted; // betId, player, choice, amount, commitIndex
        [DisplayName("Settled")]
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger, bool, BigInteger> OnSettled; // betId, player, choice, outcome, won, payout
        [DisplayName("BankrollWithdrawn")]
        public static event Action<UInt160, BigInteger> OnBankrollWithdrawn;
        [DisplayName("CreditWithdrawn")]
        public static event Action<UInt160, BigInteger> OnCreditWithdrawn; // account, amount
        #endregion

        #region Deposit (bankroll + bet credit) — CREDIT ONLY, no transfers/business logic
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            string memo = ValidateDeposit(amount, data);
            if (memo == FUND_MEMO)
            {
                OnBankrollFunded(from, amount, CreditBankroll(amount));
                return;
            }
            if (memo == BET_MEMO)
            {
                OnCredited(from, amount, CreditBet(from, amount));
                return;
            }
            ExecutionEngine.Assert(false, "invalid memo");
        }
        #endregion

        #region Settle (later block — reveal + pay) — PERMISSIONLESS
        /// <summary>
        /// Reveal and settle a committed coin flip. PERMISSIONLESS: anyone can call so losses
        /// can never be withheld. Requires Ledger.CurrentIndex strictly greater than the bet's
        /// commitIndex + BEACON_BLOCKS. On a win pays 2x (escrow + reserved house portion); on a
        /// loss the escrowed wager funds the bankroll. Returns the outcome (0/1).
        /// </summary>
        public static BigInteger Settle(BigInteger betId)
        {
            Bet b = SettleBet(betId, OUTCOME_MOD, OUTCOME_ADD, PAYOUT_NUM, PAYOUT_DEN, false);
            OnSettled(betId, b.Player, b.Selection, b.Result, b.Won, b.Payout);
            return b.Result;
        }
        #endregion
    }
}
