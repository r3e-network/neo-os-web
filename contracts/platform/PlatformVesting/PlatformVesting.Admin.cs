using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class PlatformVestingContract
    {
        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != UInt160.Zero && Runtime.CheckWitness(admin), "unauthorized");
        }

        private static void ValidateAddress(UInt160 address) =>
            ExecutionEngine.Assert(address != null && address.IsValid && address != UInt160.Zero, "invalid address");

        private static void ValidateAppId(string appId)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0 && appId.Length <= 64, "invalid appId");
        }

        private static void ActivateLocalApp(string appId, UInt160 appAdmin)
        {
            ValidateAppId(appId);
            ValidateAddress(appAdmin);
            ExecutionEngine.Assert(!IsTenantRegistered(appId), "app already registered");
            Storage.Put(Storage.CurrentContext, AppKey(appId, PREFIX_TENANT_ADMIN), appAdmin);
            OnAppActivated(appId, appAdmin);
        }

        private static void ApplyDescriptorMap(string appId, Map<string, object> descriptor)
        {
            if (descriptor == null) return;
            object[] keys = descriptor.Keys;
            for (int i = 0; i < keys.Length; i++)
            {
                string key = (string)keys[i];
                ApplyDescriptor(appId, key, descriptor[key]);
            }
        }

        private static void ApplyDescriptor(string appId, string key, object value)
        {
            ExecutionEngine.Assert(key == "vesting:maxIntervalSeconds", "unknown descriptor key");
            BigInteger maxInterval = ReadInteger(value);
            ExecutionEngine.Assert(maxInterval > 0 && maxInterval <= DEFAULT_MAX_INTERVAL_SECONDS, "max interval out of range");
            Storage.Put(Storage.CurrentContext, AppKey(appId, PREFIX_DESCRIPTOR_MAX_INTERVAL), maxInterval);
        }

        private static BigInteger ReadInteger(object value)
        {
            if (value is BigInteger integer) return integer;
            return (BigInteger)(ByteString)value;
        }

        private static BigInteger MaxIntervalOf(string appId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AppKey(appId, PREFIX_DESCRIPTOR_MAX_INTERVAL));
            return raw == null ? DEFAULT_MAX_INTERVAL_SECONDS : (BigInteger)raw;
        }
    }
}
