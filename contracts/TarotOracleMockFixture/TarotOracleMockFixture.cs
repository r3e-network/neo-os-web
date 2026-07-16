using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>Fee-aware Morpheus callback simulator used only by contract tests.</summary>
    [DisplayName("TarotOracleMockFixture")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ContractPermission("*", "onOracleResult", "onMiniAppResult", "setPaused")]
    public class TarotOracleMockFixture : SmartContract
    {
        private const long DEFAULT_FEE = 1_000_000;
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_FEE = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_CREDIT = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_ALLOWED = new byte[] { 0x04 };
        private static readonly byte[] PREFIX_COUNTER = new byte[] { 0x05 };
        private static readonly byte[] PREFIX_REQUESTER = new byte[] { 0x06 };
        private static readonly byte[] PREFIX_PAYLOAD_HASH = new byte[] { 0x07 };
        private static readonly byte[] PREFIX_CALLBACK_METHOD = new byte[] { 0x08 };
        private static readonly byte[] PREFIX_REENTER_ADMIN = new byte[] { 0x09 };

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, (ByteString)Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_FEE, DEFAULT_FEE);
        }

        [Safe]
        public static BigInteger RequestFee() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_FEE);

        [Safe]
        public static BigInteger FeeCreditOf(UInt160 account)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AddressKey(PREFIX_CREDIT, account));
            return raw == null ? 0 : (BigInteger)raw;
        }

        [Safe]
        public static bool IsAllowedCallback(UInt160 callback) =>
            Storage.Get(Storage.CurrentContext, AddressKey(PREFIX_ALLOWED, callback)) != null;

        [Safe]
        public static UInt160 RequesterOf(BigInteger requestId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, IntegerKey(PREFIX_REQUESTER, requestId));
            return raw == null ? UInt160.Zero : (UInt160)raw;
        }

        [Safe]
        public static ByteString PayloadHashOf(BigInteger requestId) =>
            Storage.Get(Storage.CurrentContext, IntegerKey(PREFIX_PAYLOAD_HASH, requestId));

        [Safe]
        public static string CallbackMethodOf(BigInteger requestId)
        {
            ByteString raw = Storage.Get(
                Storage.CurrentContext,
                IntegerKey(PREFIX_CALLBACK_METHOD, requestId));
            return raw == null ? "" : (string)raw;
        }

        public static void SetRequestFee(BigInteger fee)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(fee >= 0, "invalid fee");
            Storage.Put(Storage.CurrentContext, PREFIX_FEE, fee);
        }

        public static void SetAllowedCallback(UInt160 callback, bool allowed)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(callback != null && callback.IsValid && callback != UInt160.Zero, "invalid callback");
            byte[] key = AddressKey(PREFIX_ALLOWED, callback);
            if (allowed) Storage.Put(Storage.CurrentContext, key, 1);
            else Storage.Delete(Storage.CurrentContext, key);
        }

        /// <summary>Testing-only control used to prove consumer-side request-id tombstones.</summary>
        public static void SetNextRequestId(BigInteger requestId)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(requestId > 0, "invalid request id");
            BigInteger previous = requestId - 1;
            if (previous == 0) Storage.Delete(Storage.CurrentContext, PREFIX_COUNTER);
            else Storage.Put(Storage.CurrentContext, PREFIX_COUNTER, previous);
        }

        public static void SetReenterAdminDuringRequest(bool enabled)
        {
            ValidateAdmin();
            if (enabled) Storage.Put(Storage.CurrentContext, PREFIX_REENTER_ADMIN, 1);
            else Storage.Delete(Storage.CurrentContext, PREFIX_REENTER_ADMIN);
        }

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "only GAS accepted");
            ExecutionEngine.Assert(from != null && from.IsValid && from != UInt160.Zero, "invalid sender");
            ExecutionEngine.Assert(amount > 0, "invalid amount");
            UInt160 beneficiary = from;
            if (data is ByteString encoded && encoded.Length == 20)
            {
                beneficiary = (UInt160)(byte[])encoded;
            }
            byte[] key = AddressKey(PREFIX_CREDIT, beneficiary);
            Storage.Put(Storage.CurrentContext, key, FeeCreditOf(beneficiary) + amount);
        }

        public static BigInteger RequestFromCallback(
            UInt160 requester,
            string requestType,
            ByteString payload,
            UInt160 callbackContract,
            string callbackMethod)
        {
            ExecutionEngine.Assert(requester != null && requester.IsValid, "invalid requester");
            ExecutionEngine.Assert(callbackContract == Runtime.CallingScriptHash, "only callback contract");
            ExecutionEngine.Assert(IsAllowedCallback(callbackContract), "callback contract not allowed");
            ExecutionEngine.Assert(requestType == "vrf_random", "unexpected request type");
            ExecutionEngine.Assert(
                callbackMethod == "onOracleResult" || callbackMethod == "onMiniAppResult",
                "unexpected callback method");
            ExecutionEngine.Assert(payload != null && payload.Length > 0, "payload required");

            BigInteger fee = RequestFee();
            BigInteger credit = FeeCreditOf(callbackContract);
            ExecutionEngine.Assert(credit >= fee, "request fee not paid");
            byte[] creditKey = AddressKey(PREFIX_CREDIT, callbackContract);
            if (credit == fee) Storage.Delete(Storage.CurrentContext, creditKey);
            else Storage.Put(Storage.CurrentContext, creditKey, credit - fee);

            BigInteger requestId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_COUNTER) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_COUNTER, requestId);
            Storage.Put(Storage.CurrentContext, IntegerKey(PREFIX_REQUESTER, requestId), (ByteString)requester);
            Storage.Put(Storage.CurrentContext, IntegerKey(PREFIX_PAYLOAD_HASH, requestId), CryptoLib.Sha256(payload));
            Storage.Put(
                Storage.CurrentContext,
                IntegerKey(PREFIX_CALLBACK_METHOD, requestId),
                callbackMethod);

            if (Storage.Get(Storage.CurrentContext, PREFIX_REENTER_ADMIN) != null)
            {
                Contract.Call(callbackContract, "setPaused", CallFlags.All, true);
            }
            return requestId;
        }

        public static void DeliverRich(
            UInt160 consumer,
            BigInteger requestId,
            bool success,
            ByteString result,
            string error)
        {
            UInt160 requester = RequesterOf(requestId);
            ExecutionEngine.Assert(requester != UInt160.Zero, "request not found");
            DeliverRichCustom(
                consumer,
                requestId,
                "on-chain-tarot-vrf",
                "vrf_random",
                "vrf_random",
                requester,
                success,
                result,
                error);
        }

        public static void DeliverRichCustom(
            UInt160 consumer,
            BigInteger requestId,
            string appId,
            string moduleId,
            string operation,
            UInt160 requester,
            bool success,
            ByteString result,
            string error)
        {
            Contract.Call(
                consumer,
                "onMiniAppResult",
                CallFlags.All,
                requestId,
                appId,
                moduleId,
                operation,
                requester,
                success,
                result,
                error);
        }

        public static void DeliverLegacy(
            UInt160 consumer,
            BigInteger requestId,
            bool success,
            ByteString result,
            string error)
        {
            Contract.Call(
                consumer,
                "onOracleResult",
                CallFlags.All,
                requestId,
                "vrf_random",
                success,
                result,
                error);
        }

        private static void ValidateAdmin()
        {
            UInt160 admin = (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "admin only");
        }

        private static byte[] AddressKey(byte[] prefix, UInt160 account) =>
            (byte[])Helper.Concat((ByteString)prefix, (ByteString)(byte[])account);

        private static byte[] IntegerKey(byte[] prefix, BigInteger value) =>
            (byte[])Helper.Concat((ByteString)prefix, (ByteString)value.ToByteArray());
    }
}
