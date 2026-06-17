using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppTipJar : SmartContract
    {
        #region Read-only
        [Safe]
        public static BigInteger TotalDevelopers() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_DEV_COUNT);

        [Safe]
        public static BigInteger TotalDonated() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_DONATED);

        [Safe]
        public static BigInteger TipsCount() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TIP_COUNT);

        [Safe]
        public static BigInteger MinTip() => MIN_TIP;

        [Safe]
        public static BigInteger CreditOf(UInt160 tipper) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_CREDIT, (byte[])tipper));

        [Safe]
        public static BigInteger DeveloperIdOf(UInt160 wallet)
        {
            ByteString v = Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_WALLET_DEV, (byte[])wallet));
            return v is null ? 0 : (BigInteger)v;
        }

        [Safe]
        public static Map<string, object> GetDeveloper(BigInteger devId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, DevKey(devId));
            ExecutionEngine.Assert(raw is not null, "developer not found");
            Developer dev = (Developer)StdLib.Deserialize(raw);
            Map<string, object> m = new Map<string, object>();
            m["id"] = devId;
            m["wallet"] = dev.Wallet;
            m["name"] = dev.Name;
            m["role"] = dev.Role;
            m["totalReceived"] = dev.TotalReceived;
            m["tipCount"] = dev.TipCount;
            m["balance"] = dev.Balance;
            return m;
        }
        #endregion
    }
}
