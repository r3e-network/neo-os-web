using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppTarotVrf
    {
        [Safe]
        public static UInt160 Admin() => ReadAddress(PREFIX_ADMIN);

        [Safe]
        public static UInt160 PendingAdmin() => ReadAddress(PREFIX_PENDING_ADMIN);

        [Safe]
        public static UInt160 Oracle() => ReadAddress(PREFIX_ORACLE);

        [Safe]
        public static UInt160 PendingOracle() => ReadAddress(PREFIX_PENDING_ORACLE);

        [Safe]
        public static BigInteger OracleActivationTime() => ReadInteger(PREFIX_ORACLE_ACTIVATE_AT);

        [Safe]
        public static BigInteger UpdateActivationTime() => ReadInteger(PREFIX_UPDATE_ACTIVATE_AT);

        [Safe]
        public static bool IsPaused() => ReadInteger(PREFIX_PAUSED) == 1;

        [Safe]
        public static BigInteger ReadingFee() => READING_FEE;

        [Safe]
        public static BigInteger ReadingExpiryMs() => READING_EXPIRY_MS;

        [Safe]
        public static BigInteger ReadingsCount() => ReadInteger(PREFIX_READING_ID);

        [Safe]
        public static BigInteger CompletedReadingsCount() => ReadInteger(PREFIX_COMPLETED_COUNT);

        [Safe]
        public static BigInteger PendingCount() => ReadInteger(PREFIX_PENDING_COUNT);

        [Safe]
        public static BigInteger PendingFees() => ReadInteger(PREFIX_PENDING_FEES);

        [Safe]
        public static BigInteger Revenue() => ReadInteger(PREFIX_REVENUE);

        [Safe]
        public static BigInteger OracleReserve() => ReadInteger(PREFIX_ORACLE_RESERVE);

        [Safe]
        public static BigInteger TotalCreditLiability() => ReadInteger(PREFIX_TOTAL_CREDIT);

        [Safe]
        public static BigInteger CreditOf(UInt160 account)
        {
            if (account == null || !account.IsValid) return 0;
            return CreditOfInternal(account);
        }

        [Safe]
        public static BigInteger ActiveReadingOf(UInt160 player)
        {
            if (player == null || !player.IsValid) return 0;
            return ActiveReadingInternal(player);
        }

        [Safe]
        public static BigInteger RequestIdForReading(BigInteger readingId)
        {
            Reading reading = LoadReading(readingId);
            return reading.Player == UInt160.Zero ? 0 : reading.RequestId;
        }

        [Safe]
        public static BigInteger ReadingIdForRequest(BigInteger requestId) => ReadingForRequest(requestId);

        [Safe]
        public static bool RequestIdSeen(BigInteger requestId) => RequestIdSeenInternal(requestId);

        [Safe]
        public static BigInteger PlayerReadingCount(UInt160 player)
        {
            if (player == null || !player.IsValid) return 0;
            ByteString raw = Storage.Get(Storage.CurrentContext, AddressKey(PREFIX_PLAYER_COUNT, player));
            return raw == null ? 0 : (BigInteger)raw;
        }

        [Safe]
        public static BigInteger PlayerCompletedReadingCount(UInt160 player)
        {
            if (player == null || !player.IsValid) return 0;
            ByteString raw = Storage.Get(
                Storage.CurrentContext,
                AddressKey(PREFIX_PLAYER_COMPLETED_COUNT, player));
            return raw == null ? 0 : (BigInteger)raw;
        }

        [Safe]
        public static BigInteger[] GetPlayerReadings(UInt160 player, BigInteger offset, BigInteger limit)
        {
            if (offset < 0) offset = 0;
            if (limit <= 0 || limit > 100) limit = 100;
            BigInteger total = PlayerReadingCount(player);
            BigInteger start = offset + 1;
            BigInteger end = start + limit - 1;
            if (end > total) end = total;
            if (start > end) return new BigInteger[0];

            BigInteger[] result = new BigInteger[(int)(end - start + 1)];
            int index = 0;
            for (BigInteger sequence = start; sequence <= end; sequence++)
            {
                result[index] = (BigInteger)Storage.Get(
                    Storage.CurrentContext,
                    PlayerItemKey(player, sequence));
                index += 1;
            }
            return result;
        }

        [Safe]
        public static Map<string, object> GetReading(BigInteger readingId)
        {
            Reading reading = LoadReading(readingId);
            ExecutionEngine.Assert(reading.Player != UInt160.Zero, "reading not found");
            Map<string, object> value = new Map<string, object>();
            value["id"] = readingId;
            value["player"] = reading.Player;
            value["oracle"] = reading.Oracle;
            value["network"] = reading.Network;
            value["requestId"] = reading.RequestId;
            value["status"] = reading.Status;
            value["cards"] = new BigInteger[] { reading.Card0, reading.Card1, reading.Card2 };
            value["requestedAt"] = reading.RequestedAt;
            value["resolvedAt"] = reading.ResolvedAt;
            value["expiresAt"] = reading.RequestedAt + READING_EXPIRY_MS;
            value["fee"] = reading.Fee;
            value["oracleFee"] = reading.OracleFee;
            value["callbackMethod"] = reading.CallbackMethod;
            value["payloadHash"] = reading.PayloadHash;
            return value;
        }

        [Safe]
        public static BigInteger CurrentOracleFee()
        {
            ValidateConfiguredOracle();
            return ReadOracleRequestFee(Oracle());
        }

        [Safe]
        public static BigInteger CurrentOracleFeeCredit()
        {
            ValidateConfiguredOracle();
            return ReadOracleFeeCredit(Oracle());
        }

        [Safe]
        public static Map<string, object> Accounting()
        {
            BigInteger balance = GAS.BalanceOf(Runtime.ExecutingScriptHash);
            BigInteger accounted = TotalCreditLiability() + PendingFees() + Revenue() + OracleReserve();
            Map<string, object> value = new Map<string, object>();
            value["gasBalance"] = balance;
            value["creditLiability"] = TotalCreditLiability();
            value["pendingFees"] = PendingFees();
            value["revenue"] = Revenue();
            value["oracleReserve"] = OracleReserve();
            value["accounted"] = accounted;
            value["surplus"] = balance - accounted;
            value["solvent"] = balance >= accounted;
            return value;
        }

        [Safe]
        public static Map<string, object> IntegrationConfig()
        {
            Map<string, object> value = new Map<string, object>();
            value["appId"] = APP_ID;
            value["requestType"] = REQUEST_TYPE;
            value["legacyCallbackMethod"] = LEGACY_CALLBACK_METHOD;
            value["richCallbackMethod"] = RICH_CALLBACK_METHOD;
            value["legacyAdapterEnabled"] = IsLegacyTestnetOracle();
            value["legacyTestnetOracle"] = LegacyTestnetOracle;
            value["network"] = (BigInteger)Runtime.GetNetwork();
            return value;
        }
    }
}
