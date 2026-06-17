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
    /// MiniAppDiceGameV2 — self-contained on-chain 6-sided dice game with a COMMIT/REVEAL
    /// settlement that closes the same-tx abort-on-loss exploit of v1 (MiniAppDiceGame).
    ///
    /// EXPLOIT IN v1: v1 consumed the wager AND settled the roll in the SAME transaction
    /// with Runtime.GetRandom. An attacker contract could deposit, call roll(), read the
    /// rolled face, and ABORT the whole transaction on a loss (reverting its own wager)
    /// while letting the rare 5.70x win commit. Because losses cost nothing and a win pays
    /// 5.70x, EV was strictly positive and the house bankroll was drainable.
    ///
    /// FIX — COMMIT/REVEAL ACROSS BLOCKS: commit(player, face, amount) escrows the wager and
    /// reserves the worst-case house exposure (= amount*47/10) at block N; settle(betId) is
    /// PERMISSIONLESS and derives the rolled face in a LATER block from a FIXED multi-block
    /// beacon (the concat-hash of Ledger.GetBlock(commit+1..+K).Hash, K = BEACON_BLOCKS = 3)
    /// mixed with betId+player+commitIndex, reduced to [1,6]. Re-calling settle in any later
    /// block yields the SAME roll, so the abort-on-loss drain is closed. The commit/reveal
    /// engine, the reserved-bankroll solvency guard, the pull-payment credit + Withdraw, and
    /// the multi-block beacon all live in <see cref="MiniAppHouseGameBase"/>, shared with the
    /// coin flip so future fixes land once; only the 5.70x payout, the 1..6 face, and this memo
    /// pair are game-specific.
    ///
    /// MULTI-BLOCK BEACON (grinding cost): the entropy mixes K = 3 CONSECUTIVE block hashes,
    /// not a single one, so biasing the roll would require influencing/withholding all K beacon
    /// blocks in a row. This is NOT VRF-grade randomness; it is intended for the low-stakes dice
    /// game — high-value draws should use the VRF oracle when operational.
    ///
    /// PAYOUT / EDGE: a win pays 5.70x the wager (amount*57/10). A fair 1/6 game would pay
    /// 6x; 5.70x leaves the house a 5% edge ((6 - 5.7)/6 = 0.05). The reserved house
    /// exposure per bet is payout - amount = amount*47/10.
    ///
    /// MODEL: GAS only, BASE UNITS (1 GAS = 1e8). Memos and OnNEP17Payment credit-only
    /// behaviour are identical to v1 (fund "miniapp-dice-game:fund", bet
    /// "miniapp-dice-game:stake"). Owner is unchanged.
    ///
    /// SOLVENCY INVARIANT (asserted in tests):
    ///   heldGAS == bankroll + sum(escrowed pending amounts) + sum(player credits)
    ///   reservedBankroll <= bankroll
    /// </summary>
    [DisplayName("MiniAppDiceGameV2")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Commit/reveal on-chain dice: 5.70x payout settled across blocks with reserved bankroll — closes the same-tx abort-on-loss exploit.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")] // GAS
    public partial class MiniAppDiceGameV2 : MiniAppHouseGameBase
    {
        #region Game-specific constants (base units)
        private const long MAX_BET = 2_000_000_000;    // 20 GAS
        private const string FUND_MEMO = "miniapp-dice-game:fund";
        private const string BET_MEMO = "miniapp-dice-game:stake";

        // Dice: rolled face = (beacon mix) % 6 + 1 (faces 1..6). A win pays 5.70x =
        // amount * PAYOUT_NUM / PAYOUT_DEN (5% house edge over 1/6 fair). The per-bet house
        // exposure is payout - amount = amount * EXTRA_NUM / PAYOUT_DEN.
        private const int OUTCOME_MOD = 6;
        private const int OUTCOME_ADD = 1;
        private const int PAYOUT_NUM = 57;
        private const int PAYOUT_DEN = 10;
        private const int EXTRA_NUM = 47; // 57 - 10

        [InitialValue("NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32", ContractParameterType.Hash160)]
        private static readonly UInt160 Owner = default;
        #endregion

        #region Events
        [DisplayName("Credited")]
        public static event Action<UInt160, BigInteger, BigInteger> OnCredited; // from, amount, balance
        [DisplayName("BankrollFunded")]
        public static event Action<UInt160, BigInteger, BigInteger> OnBankrollFunded; // from, amount, bankroll
        [DisplayName("Committed")]
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger, BigInteger> OnCommitted; // betId, player, face, amount, commitIndex
        [DisplayName("Settled")]
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger, bool, BigInteger> OnSettled; // betId, player, face, rolled, won, payout
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
        /// Reveal and settle a committed dice roll. PERMISSIONLESS: anyone can call so losses
        /// can never be withheld. Requires Ledger.CurrentIndex strictly greater than the bet's
        /// commitIndex + BEACON_BLOCKS. On a win pays 5.70x (escrow + reserved house portion);
        /// on a loss the escrowed wager funds the bankroll. Returns the rolled face (1..6).
        /// </summary>
        public static BigInteger Settle(BigInteger betId)
        {
            Bet b = SettleBet(betId, OUTCOME_MOD, OUTCOME_ADD, PAYOUT_NUM, PAYOUT_DEN, true);
            OnSettled(betId, b.Player, b.Selection, b.Result, b.Won, b.Payout);
            return b.Result;
        }
        #endregion
    }
}
