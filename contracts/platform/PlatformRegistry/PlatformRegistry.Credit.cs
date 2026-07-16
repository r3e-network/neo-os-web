using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // ===================================================================
    //  PlatformRegistry — prepaid credit ledger (design section 3.1)
    //
    //  Memo "appId:credit" -> (appId, payer)-scoped prepaid GAS credit,
    //  chosen over payer-global ledgers for attribution completeness. The
    //  ledger carries a MANDATORY total-liability counter (the census
    //  found solvency tracking in only 2 of 23 fleet ledgers). The
    //  callback is validate+credit-only; withdrawCredit is the witness-
    //  gated, pause-immune exit.
    // ===================================================================
    public partial class PlatformRegistry
    {
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            // Pause gate FIRST (the MiniAppCredits ordering pin): no new
            // liabilities while globally paused; the withdrawCredit exit
            // below never consults pause state.
            ExecutionEngine.Assert(
                Storage.Get(Storage.CurrentContext, PREFIX_GLOBAL_PAUSED_AT) == null,
                "registry paused");
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "only GAS accepted");
            ExecutionEngine.Assert(amount > 0, "invalid amount");

            // fundEnginePool transit hop: the one window where a minted
            // AppAccount moves treasury GAS through the registry without a
            // memo. Validate against the note and credit NOTHING — the hop
            // is forwarded to the engine by fundEnginePool after this
            // callback returns, never from inside it.
            ByteString transitRaw = Storage.Get(Storage.CurrentContext, PREFIX_TREASURY_TRANSIT);
            if (transitRaw != null)
            {
                TransitNote note = (TransitNote)StdLib.Deserialize(transitRaw);
                ExecutionEngine.Assert(from != null && from == note.Account, "unexpected payer during treasury hop");
                ExecutionEngine.Assert(amount == note.Amount, "unexpected amount during treasury hop");
                Storage.Delete(Storage.CurrentContext, PREFIX_TREASURY_TRANSIT);
                return;
            }

            ExecutionEngine.Assert(from != null && from.IsValid && from != UInt160.Zero, "invalid payer");
            string memo = ReadPaymentMemo(data);
            string appId = ExtractAppId(memo);
            ValidateAppIdFormat(appId);
            ExecutionEngine.Assert(memo == appId + ":credit", "invalid payment memo");

            ByteString key = CreditKey(appId, from);
            BigInteger balance = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            Storage.Put(Storage.CurrentContext, key, balance + amount);
            Storage.Put(Storage.CurrentContext, PREFIX_CREDIT_LIABILITY, TotalCreditLiability() + amount);
            OnCredited(appId, from, amount);
        }

        /// <summary>
        /// Reclaim unconsumed prepaid credit. Witness-gated to the payer and
        /// deliberately PAUSE-IMMUNE (the anchor invariant): funds are never
        /// trapped by a paused or captured registry. Checks-effects-
        /// interactions: the ledger and liability counter are debited before
        /// the GAS moves.
        /// </summary>
        public static void WithdrawCredit(string appId, BigInteger amount)
        {
            ValidateAppIdFormat(appId);
            UInt160 payer = Runtime.Transaction.Sender;
            ValidateAddress(payer);
            ExecutionEngine.Assert(Runtime.CheckWitness(payer), "unauthorized");
            ExecutionEngine.Assert(amount > 0, "invalid amount");
            DebitCredit(appId, payer, amount);
            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, payer, amount),
                "credit withdrawal failed");
            OnCreditWithdrawn(appId, payer, amount);
        }

        // ---- [Safe] credit reads ----

        [Safe]
        public static BigInteger CreditOf(string appId, UInt160 payer)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, CreditKey(appId, payer));
            return raw == null ? 0 : (BigInteger)raw;
        }

        [Safe]
        public static BigInteger TotalCreditLiability()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_CREDIT_LIABILITY);
            return raw == null ? 0 : (BigInteger)raw;
        }

        [Safe]
        public static BigInteger AccruedFees()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_ACCRUED_FEES);
            return raw == null ? 0 : (BigInteger)raw;
        }

        // ---- internals ----

        // Fee consumption lane: debits the payer's (appId, payer) credit AND
        // the liability counter — the consumed amount stops being user money.
        private static void ConsumeCredit(string appId, UInt160 payer, BigInteger amount)
        {
            DebitCredit(appId, payer, amount);
        }

        private static void DebitCredit(string appId, UInt160 payer, BigInteger amount)
        {
            ByteString key = CreditKey(appId, payer);
            BigInteger balance = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            ExecutionEngine.Assert(balance >= amount, "insufficient credit");
            BigInteger next = balance - amount;
            if (next == 0) Storage.Delete(Storage.CurrentContext, key);
            else Storage.Put(Storage.CurrentContext, key, next);
            BigInteger liability = TotalCreditLiability() - amount;
            ExecutionEngine.Assert(liability >= 0, "credit liability underflow");
            if (liability == 0) Storage.Delete(Storage.CurrentContext, PREFIX_CREDIT_LIABILITY);
            else Storage.Put(Storage.CurrentContext, PREFIX_CREDIT_LIABILITY, liability);
        }

        private static void AccrueFees(BigInteger amount)
        {
            Storage.Put(Storage.CurrentContext, PREFIX_ACCRUED_FEES, AccruedFees() + amount);
        }

        private static string ReadPaymentMemo(object data)
        {
            if (data == null) return "";
            if (data is string text) return text ?? "";
            if (data is ByteString byteString) return (string)byteString;
            return "";
        }

        private static string ExtractAppId(string memo)
        {
            for (int i = 0; i < memo.Length; i++)
            {
                if (memo[i] == ':') return memo.Substring(0, i);
            }
            return memo;
        }

        private static ByteString CreditKey(string appId, UInt160 payer) =>
            Helper.Concat(AppKey(PREFIX_CREDIT, appId), (ByteString)payer);
    }
}
