using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

#pragma warning disable CS8600, CS8601, CS8602, CS8603, CS8604, CS8618

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public partial class PlatformAnchorContract
    {
        private static void AddCredit(byte[] prefix, UInt160 user, BigInteger amount)
        {
            BigInteger existing = GetCredit(prefix, user);
            Put(CreditKey(prefix, user), existing + amount);
        }

        private static void AddGasCredit(UInt160 user, BigInteger amount)
        {
            MiniAppCreditLedger.Credit(
                CreditKey(PREFIX_GAS_CREDIT, user),
                (ByteString)PREFIX_TOTAL_GAS_CREDIT,
                amount);
        }

        private static void AddAppNeoCredit(string appId, UInt160 user, BigInteger amount)
        {
            MiniAppCreditLedger.Credit(
                AppKey(appId, PREFIX_APP_NEO_CREDIT, user),
                AppKey(appId, PREFIX_APP_TOTAL_NEO_CREDIT),
                amount);
        }

        private static void AddAppGasCredit(string appId, UInt160 user, BigInteger amount)
        {
            MiniAppCreditLedger.Credit(
                AppKey(appId, PREFIX_APP_GAS_CREDIT, user),
                AppKey(appId, PREFIX_APP_TOTAL_GAS_CREDIT),
                amount);
        }

        private static void ConsumeCredit(byte[] prefix, UInt160 user, BigInteger amount)
        {
            BigInteger existing = GetCredit(prefix, user);
            ExecutionEngine.Assert(existing >= amount, "insufficient credit");
            BigInteger next = existing - amount;
            if (next == 0) Delete(CreditKey(prefix, user));
            else Put(CreditKey(prefix, user), next);
        }

        private static void ConsumeGasCredit(UInt160 user, BigInteger amount)
        {
            MiniAppCreditLedger.Debit(
                CreditKey(PREFIX_GAS_CREDIT, user),
                (ByteString)PREFIX_TOTAL_GAS_CREDIT,
                amount);
        }

        private static void ConsumeAppNeoCredit(string appId, UInt160 user, BigInteger amount)
        {
            MiniAppCreditLedger.Debit(
                AppKey(appId, PREFIX_APP_NEO_CREDIT, user),
                AppKey(appId, PREFIX_APP_TOTAL_NEO_CREDIT),
                amount);
        }

        private static void ConsumeAppGasCredit(string appId, UInt160 user, BigInteger amount)
        {
            MiniAppCreditLedger.Debit(
                AppKey(appId, PREFIX_APP_GAS_CREDIT, user),
                AppKey(appId, PREFIX_APP_TOTAL_GAS_CREDIT),
                amount);
        }

        private static BigInteger GetCredit(byte[] prefix, UInt160 user) => GetBigInteger(CreditKey(prefix, user));

        private static BigInteger GetAppNeoCredit(string appId, UInt160 user) =>
            GetBigInteger(AppKey(appId, PREFIX_APP_NEO_CREDIT, user));

        private static BigInteger GetAppGasCredit(string appId, UInt160 user) =>
            GetBigInteger(AppKey(appId, PREFIX_APP_GAS_CREDIT, user));

        private static ByteString CreditKey(byte[] prefix, UInt160 user) =>
            Helper.Concat((ByteString)prefix, (ByteString)(byte[])user);

        private static ByteString AppKey(string appId, byte[] prefix) =>
            MiniAppStorageKeys.AppKeyValue(appId, prefix);

        private static ByteString AppKey(string appId, byte[] prefix, BigInteger id) =>
            MiniAppStorageKeys.AppKeyValue(appId, prefix, id);

        private static ByteString AppKey(string appId, byte[] prefix, UInt160 account) =>
            MiniAppStorageKeys.AppKeyValue(appId, prefix, account);
    }
}
