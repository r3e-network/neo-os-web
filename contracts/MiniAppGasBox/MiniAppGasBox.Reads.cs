using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGasBox : SmartContract
    {
        #region Read-only
        [Safe]
        public static BigInteger LastMachineId() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_MACHINE_ID);

        [Safe]
        public static BigInteger PlayCreditOf(UInt160 player) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_PLAY_CREDIT, (byte[])player));

        [Safe]
        public static Map<string, object> GetMachine(BigInteger machineId)
        {
            Machine m = LoadMachine(machineId);
            Map<string, object> r = new Map<string, object>();
            r["id"] = machineId; r["creator"] = m.Creator; r["name"] = m.Name;
            r["prizeAsset"] = m.PrizeAsset; r["price"] = m.Price; r["itemCount"] = m.ItemCount;
            r["totalWeight"] = m.TotalWeight; r["maxPrize"] = m.MaxPrize; r["poolBalance"] = m.PoolBalance;
            r["revenue"] = m.Revenue; r["active"] = m.Active;
            return r;
        }

        [Safe]
        public static Map<string, object> GetItem(BigInteger machineId, BigInteger index)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, ItemKey(machineId, index));
            ExecutionEngine.Assert(raw is not null, "item not found");
            Item it = (Item)StdLib.Deserialize(raw);
            Map<string, object> r = new Map<string, object>();
            r["index"] = index; r["name"] = it.Name; r["weight"] = it.Weight; r["amount"] = it.Amount;
            return r;
        }
        #endregion

        #region Internal
        private static Machine LoadMachine(BigInteger machineId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, MachineKey(machineId));
            ExecutionEngine.Assert(raw is not null, "machine not found");
            return (Machine)StdLib.Deserialize(raw);
        }
        private static byte[] MachineKey(BigInteger id) => Helper.Concat(PREFIX_MACHINE, (byte[])(ByteString)id);
        private static byte[] ItemKey(BigInteger machineId, BigInteger index) =>
            Helper.Concat(Helper.Concat(PREFIX_ITEM, (byte[])(ByteString)machineId), (byte[])(ByteString)index);
        #endregion
    }
}
