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

            string memo = ReadPaymentMemo(data);
            string appId = ExtractAppId(memo);
            ValidateCreditAppId(appId);
            ExecutionEngine.Assert(memo == appId + ":credit", "invalid payment memo");
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

            DebitGasCredit(appId, user, amount);
            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, user, amount),
                "GAS credit withdrawal failed");
            EnsureGasCreditSolvent();
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

            DebitNeoCredit(appId, user, amount);
            ExecutionEngine.Assert(
                NEO.Transfer(Runtime.ExecutingScriptHash, user, amount),
                "NEO credit withdrawal failed");
            EnsureNeoCreditSolvent();
            OnNeoCreditWithdrawn(appId, user, amount);
            return amount;
        }

        private static void CreditGas(string appId, UInt160 payer, BigInteger amount)
        {
            ByteString key = AppKey(appId, PREFIX_DIRECT_GAS_CREDIT, payer);
            Put(key, GetBigInteger(key) + amount);
            ByteString appLiabilityKey = AppKey(appId, PREFIX_APP_GAS_CREDIT_LIABILITY);
            Put(appLiabilityKey, GetBigInteger(appLiabilityKey) + amount);
            Put((ByteString)PREFIX_TOTAL_GAS_CREDIT_LIABILITY, TotalGasCreditLiability() + amount);
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
            ByteString key = AppKey(appId, PREFIX_DIRECT_GAS_CREDIT, payer);
            BigInteger balance = GetBigInteger(key);
            ExecutionEngine.Assert(balance >= amount, "insufficient GAS credit");
            PutOrDelete(key, balance - amount);
            ByteString appLiabilityKey = AppKey(appId, PREFIX_APP_GAS_CREDIT_LIABILITY);
            BigInteger appLiability = GetBigInteger(appLiabilityKey) - amount;
            BigInteger totalLiability = TotalGasCreditLiability() - amount;
            ExecutionEngine.Assert(appLiability >= 0 && totalLiability >= 0, "GAS credit liability underflow");
            PutOrDelete(appLiabilityKey, appLiability);
            PutOrDelete((ByteString)PREFIX_TOTAL_GAS_CREDIT_LIABILITY, totalLiability);
        }

        private static BigInteger GetGasCreditBalance(string appId, UInt160 payer) =>
            GetBigInteger(AppKey(appId, PREFIX_DIRECT_GAS_CREDIT, payer));

        private static void CreditNeo(string appId, UInt160 payer, BigInteger amount)
        {
            ByteString key = AppKey(appId, PREFIX_DIRECT_ASSET_CREDIT, payer);
            Put(key, GetBigInteger(key) + amount);
            ByteString appLiabilityKey = AppKey(appId, PREFIX_APP_NEO_CREDIT_LIABILITY);
            Put(appLiabilityKey, GetBigInteger(appLiabilityKey) + amount);
            Put((ByteString)PREFIX_TOTAL_NEO_CREDIT_LIABILITY, TotalNeoCreditLiability() + amount);
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
            ByteString key = AppKey(appId, PREFIX_DIRECT_ASSET_CREDIT, payer);
            BigInteger balance = GetBigInteger(key);
            ExecutionEngine.Assert(balance >= amount, "insufficient NEO credit");
            PutOrDelete(key, balance - amount);
            ByteString appLiabilityKey = AppKey(appId, PREFIX_APP_NEO_CREDIT_LIABILITY);
            BigInteger appLiability = GetBigInteger(appLiabilityKey) - amount;
            BigInteger totalLiability = TotalNeoCreditLiability() - amount;
            ExecutionEngine.Assert(appLiability >= 0 && totalLiability >= 0, "NEO credit liability underflow");
            PutOrDelete(appLiabilityKey, appLiability);
            PutOrDelete((ByteString)PREFIX_TOTAL_NEO_CREDIT_LIABILITY, totalLiability);
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

        private static void PutOrDelete(ByteString key, BigInteger value)
        {
            if (value == 0) Delete(key);
            else Put(key, value);
        }

        private static void ValidateCreditAppId(string appId)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0 && appId.Length <= 64, "invalid appId");
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
            for (int index = 0; index < memo.Length; index++)
            {
                if (memo[index] == ':') return memo.Substring(0, index);
            }
            return memo;
        }
    }
}
