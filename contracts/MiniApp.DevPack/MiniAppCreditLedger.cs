using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    internal static class MiniAppCreditLedger
    {
        internal static string ReadPaymentMemo(object data)
        {
            if (data == null) return "";
            if (data is string text) return text ?? "";
            if (data is ByteString byteString) return (string)byteString;
            return data.ToString() ?? "";
        }

        internal static string RequireFundingAppId(object data)
        {
            return RequireAppIdWithSuffix(data, ":fund");
        }

        internal static string RequireCreditAppId(object data)
        {
            return RequireAppIdWithSuffix(data, ":credit");
        }

        internal static string RequireVoteAppId(object data)
        {
            return RequireAppIdWithSuffix(data, ":vote");
        }

        internal static string ExtractAppId(string memo)
        {
            for (int index = 0; index < memo.Length; index++)
            {
                if (memo[index] == ':') return memo.Substring(0, index);
            }
            return memo;
        }

        internal static string RequireAppIdWithSuffix(object data, string suffix)
        {
            string memo = ReadPaymentMemo(data);
            int separator = -1;
            for (int index = 0; index < memo.Length; index++)
            {
                if (memo[index] == ':')
                {
                    separator = index;
                    break;
                }
            }
            ExecutionEngine.Assert(
                separator > 0 && memo == memo.Substring(0, separator) + suffix,
                "invalid payment memo");
            return memo.Substring(0, separator);
        }

        internal static BigInteger Read(ByteString key)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, key);
            return raw == null ? 0 : (BigInteger)raw;
        }

        internal static void Credit(ByteString balanceKey, ByteString liabilityKey, BigInteger amount)
        {
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            Storage.Put(Storage.CurrentContext, balanceKey, Read(balanceKey) + amount);
            Storage.Put(Storage.CurrentContext, liabilityKey, Read(liabilityKey) + amount);
        }

        internal static void Credit(
            ByteString balanceKey,
            ByteString appLiabilityKey,
            ByteString totalLiabilityKey,
            BigInteger amount)
        {
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            Storage.Put(Storage.CurrentContext, balanceKey, Read(balanceKey) + amount);
            Storage.Put(Storage.CurrentContext, appLiabilityKey, Read(appLiabilityKey) + amount);
            Storage.Put(Storage.CurrentContext, totalLiabilityKey, Read(totalLiabilityKey) + amount);
        }

        internal static void Debit(ByteString balanceKey, ByteString liabilityKey, BigInteger amount)
        {
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            BigInteger balance = Read(balanceKey);
            BigInteger liability = Read(liabilityKey);
            ExecutionEngine.Assert(balance >= amount, "insufficient credit");
            ExecutionEngine.Assert(liability >= amount, "credit liability underflow");
            PutOrDelete(balanceKey, balance - amount);
            PutOrDelete(liabilityKey, liability - amount);
        }

        internal static void Debit(
            ByteString balanceKey,
            ByteString appLiabilityKey,
            ByteString totalLiabilityKey,
            BigInteger amount)
        {
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            BigInteger balance = Read(balanceKey);
            BigInteger appLiability = Read(appLiabilityKey);
            BigInteger totalLiability = Read(totalLiabilityKey);
            ExecutionEngine.Assert(balance >= amount, "insufficient credit");
            ExecutionEngine.Assert(appLiability >= amount && totalLiability >= amount,
                "credit liability underflow");
            PutOrDelete(balanceKey, balance - amount);
            PutOrDelete(appLiabilityKey, appLiability - amount);
            PutOrDelete(totalLiabilityKey, totalLiability - amount);
        }

        private static void PutOrDelete(ByteString key, BigInteger value)
        {
            if (value == 0) Storage.Delete(Storage.CurrentContext, key);
            else Storage.Put(Storage.CurrentContext, key, value);
        }
    }
}
