using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public delegate void CallbackReceivedHandler(
        BigInteger requestId, string appId, string serviceType, bool success, string error);

    [DisplayName("MiniAppServiceConsumer")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Minimal callback consumer for ServiceLayerGateway verification")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_GATEWAY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_CALLBACK = new byte[] { 0x10 };

        [DisplayName("CallbackReceived")]
        public static event CallbackReceivedHandler OnCallbackReceived;

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }

        [Safe]
        public static UInt160 Admin()
        {
            return (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
        }

        [Safe]
        public static UInt160 Gateway()
        {
            return (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_GATEWAY);
        }

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != null && newAdmin.IsValid, "invalid");
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
        }

        public static void SetGateway(UInt160 gateway)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "invalid");
            Storage.Put(Storage.CurrentContext, PREFIX_GATEWAY, gateway);
        }

        public static void OnServiceCallback(
            BigInteger requestId,
            string appId,
            string serviceType,
            bool success,
            ByteString result,
            string error)
        {
            ValidateGateway();

            byte[] key = Helper.Concat(PREFIX_CALLBACK, (ByteString)requestId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(new object[] { appId, serviceType, success, result, error }));

            OnCallbackReceived(requestId, appId, serviceType, success, error);
        }

        [Safe]
        public static object[] GetCallback(BigInteger requestId)
        {
            byte[] key = Helper.Concat(PREFIX_CALLBACK, (ByteString)requestId.ToByteArray());
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            if (data == null) return new object[] { };
            return (object[])StdLib.Deserialize(data);
        }

        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != null && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        private static void ValidateGateway()
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");
            ExecutionEngine.Assert(Runtime.CallingScriptHash == gateway, "unauthorized caller");
        }
    }
}
