using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// Reference contract for <see cref="MiniAppMoneyBase"/>.
    ///
    /// This is the canonical wiring every new money contract starts from, and it is
    /// what the MiniAppMoneyBaseTests TestEngine suite deploys to prove the base's
    /// credit ledger, withdraw, checked transfer, and randomness helpers behave on a
    /// real NeoVM. It is NOT deployed to any network.
    ///
    /// Wiring demonstrated:
    /// - OnNEP17Payment forwards straight into CreditGasDeposit (credit only) and
    ///   emits the contract's own Credited event with the returned balance.
    /// - Withdraw exposes WithdrawGasCredit publicly and emits CreditWithdrawn.
    /// - Pay shows the deposit-then-act shape: witness check, ConsumeGasCredit,
    ///   then TransferGasChecked — never inside the payment callback.
    /// - Roll exposes NextRandom so the bounded-roll invariant is testable.
    /// </summary>
    [DisplayName("MiniAppMoneyBaseFixture")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Reference wiring of the MiniApp.DevPack money base; exercised by the contract test suite and never deployed.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")] // GAS
    public class MiniAppMoneyBaseFixture : MiniAppMoneyBase
    {
        private const string DEPOSIT_MEMO = "miniapp-moneybase:deposit";

        #region Events
        [DisplayName("Credited")]
        public static event Action<UInt160, BigInteger, BigInteger> OnCredited; // from, amount, balance
        [DisplayName("CreditWithdrawn")]
        public static event Action<UInt160, BigInteger> OnCreditWithdrawn; // account, amount
        [DisplayName("Paid")]
        public static event Action<UInt160, UInt160, BigInteger> OnPaid; // from, to, amount
        #endregion

        /// <summary>GAS with memo "miniapp-moneybase:deposit" credits the sender.</summary>
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            BigInteger balance = CreditGasDeposit(DEPOSIT_MEMO, from, amount, data);
            OnCredited(from, amount, balance);
        }

        /// <summary>Reclaim the caller's whole unspent prepaid credit.</summary>
        public static BigInteger Withdraw(UInt160 account)
        {
            BigInteger amount = WithdrawGasCredit(account);
            OnCreditWithdrawn(account, amount);
            return amount;
        }

        /// <summary>
        /// Spend `amount` of the payer's prepaid credit as a real GAS payment to
        /// `to` — the canonical deposit-then-act move built from the base helpers.
        /// </summary>
        public static void Pay(UInt160 from, UInt160 to, BigInteger amount)
        {
            ExecutionEngine.Assert(from is not null && from.IsValid && !from.IsZero, "invalid payer");
            ExecutionEngine.Assert(Runtime.CheckWitness(from), "payer witness required");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ConsumeGasCredit(from, amount);
            TransferGasChecked(to, amount);
            OnPaid(from, to, amount);
        }

        /// <summary>Roll a number in [0, bound) from the block randomness beacon.</summary>
        public static BigInteger Roll(BigInteger bound) => NextRandom(bound);
    }
}
