using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public delegate void CreditDepositedHandler(string appId, UInt160 payer, UInt160 asset, BigInteger amount);
    public delegate void CreditWithdrawnHandler(string appId, UInt160 payer, UInt160 asset, BigInteger amount);

    public partial class PlatformDeFiContract
    {
        [DisplayName("CreditDeposited")]
        public static event CreditDepositedHandler OnCreditDeposited;

        [DisplayName("CreditWithdrawn")]
        public static event CreditWithdrawnHandler OnCreditWithdrawn;

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            if (from == Runtime.ExecutingScriptHash) return;

            UInt160 caller = Runtime.CallingScriptHash;
            ExecutionEngine.Assert(caller == NEO.Hash || caller == GAS.Hash, "unsupported asset");
            ExecutionEngine.Assert(from != null && from != UInt160.Zero && from.IsValid, "invalid payer");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            string memo = MiniAppCreditLedger.ReadPaymentMemo(data);
            if (memo == LegacyCreditTopUpMemo)
            {
                ReceiveLegacyCreditTopUp(from, caller, amount);
                return;
            }
            string appId = MiniAppCreditLedger.RequireCreditAppId(data);
            ValidateCreditAppId(appId);
            ValidateCreditDepositApp(appId);

            if (caller == NEO.Hash) CreditNeo(appId, from, amount);
            else CreditGas(appId, from, amount);
        }

        [Safe]
        public static BigInteger GetDirectNeoCredit(string appId, UInt160 payer)
        {
            ValidateCreditAppId(appId);
            if (payer == UInt160.Zero || !payer.IsValid) return 0;
            return GetNeoCreditBalance(appId, payer);
        }

        [Safe]
        public static BigInteger NeoCreditLiabilityOf(string appId)
        {
            ValidateCreditAppId(appId);
            return GetBigInteger(AppKey(appId, PREFIX_APP_NEO_CREDIT_LIABILITY));
        }

        [Safe]
        public static BigInteger TotalNeoCreditLiability() =>
            GetBigInteger((ByteString)PREFIX_TOTAL_NEO_CREDIT_LIABILITY);

        [Safe]
        public static BigInteger GetDirectGasCredit(string appId, UInt160 payer)
        {
            ValidateCreditAppId(appId);
            if (payer == UInt160.Zero || !payer.IsValid) return 0;
            return GetGasCreditBalance(appId, payer);
        }

        [Safe]
        public static BigInteger GasCreditLiabilityOf(string appId)
        {
            ValidateCreditAppId(appId);
            return GetBigInteger(AppKey(appId, PREFIX_APP_GAS_CREDIT_LIABILITY));
        }

        [Safe]
        public static BigInteger TotalGasCreditLiability() =>
            GetBigInteger((ByteString)PREFIX_TOTAL_GAS_CREDIT_LIABILITY);

        public static BigInteger WithdrawNeoCredit(string appId, UInt160 payer, BigInteger amount)
        {
            ValidateCreditAppId(appId);
            ValidateAddress(payer);
            ExecutionEngine.Assert(Runtime.CheckWitness(payer), "unauthorized");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            DebitNeoCredit(appId, payer, amount);
            ExecutionEngine.Assert(
                NEO.Transfer(Runtime.ExecutingScriptHash, payer, amount),
                "neo withdrawal failed");
            EnsureNeoCreditSolvent();
            OnCreditWithdrawn(appId, payer, NEO.Hash, amount);
            return amount;
        }

        public static BigInteger WithdrawGasCredit(string appId, UInt160 payer, BigInteger amount)
        {
            ValidateCreditAppId(appId);
            ValidateAddress(payer);
            ExecutionEngine.Assert(Runtime.CheckWitness(payer), "unauthorized");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            DebitGasCredit(appId, payer, amount);
            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, payer, amount),
                "gas withdrawal failed");
            EnsureGasCreditSolvent();
            OnCreditWithdrawn(appId, payer, GAS.Hash, amount);
            return amount;
        }

        private static void CreditNeo(string appId, UInt160 payer, BigInteger amount)
        {
            MiniAppCreditLedger.Credit(
                AppKey(appId, PREFIX_NEO_CREDIT, payer),
                AppKey(appId, PREFIX_APP_NEO_CREDIT_LIABILITY),
                (ByteString)PREFIX_TOTAL_NEO_CREDIT_LIABILITY,
                amount);
            EnsureNeoCreditSolvent();
            OnCreditDeposited(appId, payer, NEO.Hash, amount);
        }

        private static void CreditGas(string appId, UInt160 payer, BigInteger amount)
        {
            MiniAppCreditLedger.Credit(
                AppKey(appId, PREFIX_GAS_CREDIT, payer),
                AppKey(appId, PREFIX_APP_GAS_CREDIT_LIABILITY),
                (ByteString)PREFIX_TOTAL_GAS_CREDIT_LIABILITY,
                amount);
            EnsureGasCreditSolvent();
            OnCreditDeposited(appId, payer, GAS.Hash, amount);
        }

        private static void ConsumeNeoCredit(string appId, UInt160 payer, BigInteger amount)
        {
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            DebitNeoCredit(appId, payer, amount);
        }

        private static void ConsumeGasCredit(string appId, UInt160 payer, BigInteger amount)
        {
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            DebitGasCredit(appId, payer, amount);
        }

        private static void DebitNeoCredit(string appId, UInt160 payer, BigInteger amount)
        {
            MiniAppCreditLedger.Debit(
                AppKey(appId, PREFIX_NEO_CREDIT, payer),
                AppKey(appId, PREFIX_APP_NEO_CREDIT_LIABILITY),
                (ByteString)PREFIX_TOTAL_NEO_CREDIT_LIABILITY,
                amount);
        }

        private static void DebitGasCredit(string appId, UInt160 payer, BigInteger amount)
        {
            MiniAppCreditLedger.Debit(
                AppKey(appId, PREFIX_GAS_CREDIT, payer),
                AppKey(appId, PREFIX_APP_GAS_CREDIT_LIABILITY),
                (ByteString)PREFIX_TOTAL_GAS_CREDIT_LIABILITY,
                amount);
        }

        private static BigInteger GetNeoCreditBalance(string appId, UInt160 payer) =>
            GetBigInteger(AppKey(appId, PREFIX_NEO_CREDIT, payer));

        private static BigInteger GetGasCreditBalance(string appId, UInt160 payer) =>
            GetBigInteger(AppKey(appId, PREFIX_GAS_CREDIT, payer));

        private static void PutOrDelete(ByteString key, BigInteger value)
        {
            if (value == 0) Delete(key);
            else Put(key, value);
        }

        private static void EnsureNeoCreditSolvent()
        {
            ExecutionEngine.Assert(
                TotalNeoCreditLiability() + LegacyNeoCreditLiability() <=
                NEO.BalanceOf(Runtime.ExecutingScriptHash),
                "NEO credit insolvent");
        }

        private static void EnsureGasCreditSolvent()
        {
            ExecutionEngine.Assert(
                TotalGasCreditLiability() + LegacyGasCreditLiability() <=
                GAS.BalanceOf(Runtime.ExecutingScriptHash),
                "GAS credit insolvent");
        }

        private static void ValidateCreditDepositApp(string appId)
        {
            ExecutionEngine.Assert(GetProductType(appId) > 0, "app not registered");
            ValidateNotPaused();
            ExecutionEngine.Assert(!IsAppPaused(appId), "app paused");
        }

        private static void ValidateCreditAppId(string appId)
        {
            ExecutionEngine.Assert(
                appId != null && appId.Length > 0 && appId.Length <= 64,
                "invalid appId");
        }

    }
}
