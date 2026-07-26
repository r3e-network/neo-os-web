using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// Shared money base for NEW standalone miniapp contracts.
    ///
    /// The deployed generation of standalone contracts (RedEnvelope, LastSurvivor,
    /// TimeCapsule, Tarot, TipJar, BreakupPact, ...) each hand-rolled the same four
    /// primitives: a prepaid GAS credit ledger fed by OnNEP17Payment, a witness-gated
    /// credit refund, an assert-checked GAS transfer, and a bounded randomness roll.
    /// Those deployments stay byte-identical and untouched; this base exists so the
    /// NEXT contract inherits the proven primitives instead of copying them again.
    ///
    /// RULES BAKED IN (hard lessons from the deployed fleet):
    /// - OnNEP17Payment must ONLY validate and credit. Token transfers or post-credit
    ///   business logic inside the payment callback crash the Neo TestEngine host and
    ///   complicate reentrancy reasoning, so <see cref="CreditGasDeposit"/> does
    ///   storage writes only; concrete methods do the moves.
    /// - Every outbound GAS transfer asserts success so a failed payout reverts the
    ///   whole invocation atomically (checks-effects-interactions stays intact).
    /// - Credits are deleted when they reach zero to keep storage clean.
    ///
    /// USAGE: the concrete contract declares its own typed events (the C# DevPack
    /// requires events to live on the contract class itself), forwards
    /// OnNEP17Payment into <see cref="CreditGasDeposit"/> with its memo, and exposes
    /// <see cref="WithdrawGasCredit"/> as its public Withdraw method. See
    /// MiniAppMoneyBaseFixture.cs for the reference wiring exercised by the
    /// MiniAppMoneyBaseTests TestEngine suite.
    /// </summary>
    public abstract class MiniAppMoneyBase : SmartContract
    {
        /// <summary>Storage prefix for the prepaid GAS credit ledger (per account).</summary>
        protected static readonly byte[] PREFIX_MONEY_CREDIT = new byte[] { 0x60 };

        /// <summary>
        /// Validate a NEP-17 GAS deposit and credit the sender's prepaid balance.
        /// Call this (and nothing else money-moving) from OnNEP17Payment.
        /// Returns the sender's new credit balance so the caller can emit its event.
        /// </summary>
        protected static BigInteger CreditGasDeposit(string expectedMemo, UInt160 from, BigInteger amount, object data)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "only GAS accepted");
            ExecutionEngine.Assert(from is not null && from.IsValid && !from.IsZero, "invalid sender");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(data is not null, "memo required");
            ExecutionEngine.Assert(ReadPaymentMemo(data) == expectedMemo, "invalid memo");

            StorageContext ctx = Storage.CurrentContext;
            byte[] key = CreditKey(from);
            BigInteger balance = (BigInteger)Storage.Get(ctx, key) + amount;
            Storage.Put(ctx, key, balance);
            return balance;
        }

        /// <summary>
        /// Spend `amount` of `account`'s prepaid credit. Asserts the balance covers
        /// it; deletes the entry when it reaches zero. The caller is responsible for
        /// the witness check that authorizes spending this account's credit.
        /// </summary>
        protected static void ConsumeGasCredit(UInt160 account, BigInteger amount)
        {
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            StorageContext ctx = Storage.CurrentContext;
            byte[] key = CreditKey(account);
            BigInteger balance = (BigInteger)Storage.Get(ctx, key);
            ExecutionEngine.Assert(balance >= amount, "insufficient deposit credit");
            BigInteger next = balance - amount;
            if (next == 0) Storage.Delete(ctx, key); else Storage.Put(ctx, key, next);
        }

        /// <summary>Read an account's unspent prepaid GAS credit.</summary>
        [Safe]
        public static BigInteger CreditOf(UInt160 account) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, CreditKey(account));

        /// <summary>
        /// Refund the caller's whole unspent credit back to their wallet. The concrete
        /// contract exposes this as its public Withdraw method and emits its own
        /// CreditWithdrawn event with the returned amount.
        /// </summary>
        protected static BigInteger WithdrawGasCredit(UInt160 account)
        {
            ExecutionEngine.Assert(account is not null && account.IsValid && !account.IsZero, "invalid account");
            ExecutionEngine.Assert(Runtime.CheckWitness(account), "account witness required");
            StorageContext ctx = Storage.CurrentContext;
            byte[] key = CreditKey(account);
            BigInteger credit = (BigInteger)Storage.Get(ctx, key);
            ExecutionEngine.Assert(credit > 0, "no credit");
            Storage.Delete(ctx, key);
            TransferGasChecked(account, credit);
            return credit;
        }

        /// <summary>
        /// Send GAS from the contract to `to`, reverting the whole invocation if the
        /// transfer fails. Zero is a no-op; negative amounts are rejected.
        /// </summary>
        protected static void TransferGasChecked(UInt160 to, BigInteger amount)
        {
            ExecutionEngine.Assert(amount >= 0, "negative amount");
            if (amount == 0) return;
            ExecutionEngine.Assert(to is not null && to.IsValid && !to.IsZero, "invalid transfer target");
            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, to, amount, "" });
            ExecutionEngine.Assert(ok, "transfer failed");
        }

        /// <summary>
        /// Uniform roll in [0, bound) from the per-block consensus beacon
        /// (Runtime.GetRandom). Block-seeded, not VRF-grade: fine for entertainment
        /// draws, not for adversarial high-value settlement.
        /// </summary>
        protected static BigInteger NextRandom(BigInteger bound)
        {
            ExecutionEngine.Assert(bound > 0, "bound must be > 0");
            BigInteger entropy = Runtime.GetRandom();
            if (entropy < 0) entropy = -entropy;
            return entropy % bound;
        }

        private static string ReadPaymentMemo(object data)
        {
            if (data == null) return "";
            if (data is string text) return text ?? "";
            if (data is ByteString byteString) return (string)byteString;
            return data.ToString();
        }

        private static byte[] CreditKey(UInt160 account) =>
            Helper.Concat(PREFIX_MONEY_CREDIT, (byte[])account);
    }
}
