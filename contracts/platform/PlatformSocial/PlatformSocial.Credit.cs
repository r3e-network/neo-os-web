using System;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public partial class PlatformSocialContract
    {
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            if (from == Runtime.ExecutingScriptHash) return;

            UInt160 caller = Runtime.CallingScriptHash;
            ExecutionEngine.Assert(caller == GAS.Hash || caller == NEO.Hash, "unsupported asset");
            ExecutionEngine.Assert(from != null && from != UInt160.Zero && from.IsValid, "invalid payer");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            string appId = MiniAppCreditLedger.RequireCreditAppId(data);
            ValidateCreditAppId(appId);
            ExecutionEngine.Assert(GetBigInteger(
                Helper.Concat((ByteString)PREFIX_APP_TYPE, (ByteString)appId)) > 0,
                "app not registered");
            ValidateAppNotPaused(appId);

            if (caller == GAS.Hash) CreditGas(appId, from, amount);
            else CreditNeo(appId, from, amount);
        }

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

        public static BigInteger WithdrawGasCredit(string appId, UInt160 user, BigInteger amount)
        {
            ValidateCreditAppId(appId);
            ExecutionEngine.Assert(user != UInt160.Zero && user.IsValid, "invalid user");
            ExecutionEngine.Assert(Runtime.CheckWitness(user), "unauthorized");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            AcquireSocialLock();
            DebitGasCredit(appId, user, amount);
            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, user, amount),
                "GAS credit withdrawal failed");
            EnsureGasCreditSolvent();
            ReleaseSocialLock();
            OnGasCreditWithdrawn(appId, user, amount);
            return amount;
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

        public static BigInteger WithdrawNeoCredit(string appId, UInt160 user, BigInteger amount)
        {
            ValidateCreditAppId(appId);
            ExecutionEngine.Assert(user != UInt160.Zero && user.IsValid, "invalid user");
            ExecutionEngine.Assert(Runtime.CheckWitness(user), "unauthorized");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            AcquireSocialLock();
            DebitNeoCredit(appId, user, amount);
            ExecutionEngine.Assert(
                NEO.Transfer(Runtime.ExecutingScriptHash, user, amount),
                "NEO credit withdrawal failed");
            EnsureNeoCreditSolvent();
            ReleaseSocialLock();
            OnNeoCreditWithdrawn(appId, user, amount);
            return amount;
        }

        private static void CreditGas(string appId, UInt160 payer, BigInteger amount)
        {
            MiniAppCreditLedger.Credit(
                AppKey(appId, PREFIX_DIRECT_GAS_CREDIT, payer),
                AppKey(appId, PREFIX_APP_GAS_CREDIT_LIABILITY),
                (ByteString)PREFIX_TOTAL_GAS_CREDIT_LIABILITY,
                amount);
            EnsureGasCreditSolvent();
            OnGasCredited(appId, payer, amount);
        }

        private static void ConsumeGasCredit(string appId, UInt160 payer, BigInteger amount)
        {
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            DebitGasCredit(appId, payer, amount);
        }

        private static void DebitGasCredit(string appId, UInt160 payer, BigInteger amount)
        {
            MiniAppCreditLedger.Debit(
                AppKey(appId, PREFIX_DIRECT_GAS_CREDIT, payer),
                AppKey(appId, PREFIX_APP_GAS_CREDIT_LIABILITY),
                (ByteString)PREFIX_TOTAL_GAS_CREDIT_LIABILITY,
                amount);
        }

        private static BigInteger GetGasCreditBalance(string appId, UInt160 payer) =>
            GetBigInteger(AppKey(appId, PREFIX_DIRECT_GAS_CREDIT, payer));

        private static void CreditNeo(string appId, UInt160 payer, BigInteger amount)
        {
            MiniAppCreditLedger.Credit(
                AppKey(appId, PREFIX_DIRECT_ASSET_CREDIT, payer),
                AppKey(appId, PREFIX_APP_NEO_CREDIT_LIABILITY),
                (ByteString)PREFIX_TOTAL_NEO_CREDIT_LIABILITY,
                amount);
            EnsureNeoCreditSolvent();
            OnNeoCredited(appId, payer, amount);
        }

        private static void ConsumeNeoCredit(string appId, UInt160 payer, BigInteger amount)
        {
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            DebitNeoCredit(appId, payer, amount);
        }

        private static void DebitNeoCredit(string appId, UInt160 payer, BigInteger amount)
        {
            MiniAppCreditLedger.Debit(
                AppKey(appId, PREFIX_DIRECT_ASSET_CREDIT, payer),
                AppKey(appId, PREFIX_APP_NEO_CREDIT_LIABILITY),
                (ByteString)PREFIX_TOTAL_NEO_CREDIT_LIABILITY,
                amount);
        }

        private static BigInteger GetNeoCreditBalance(string appId, UInt160 payer) =>
            GetBigInteger(AppKey(appId, PREFIX_DIRECT_ASSET_CREDIT, payer));

        private static void EnsureGasCreditSolvent()
        {
            ExecutionEngine.Assert(
                TotalGasCreditLiability() <= GAS.BalanceOf(Runtime.ExecutingScriptHash),
                "GAS credit insolvent");
        }

        private static void EnsureNeoCreditSolvent()
        {
            ExecutionEngine.Assert(
                TotalNeoCreditLiability() <= NEO.BalanceOf(Runtime.ExecutingScriptHash),
                "NEO credit insolvent");
        }

        private static void ValidateCreditAppId(string appId)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0 && appId.Length <= 64, "invalid appId");
        }

    }
}
