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
    public partial class MiniAppGasBoxV2 : SmartContract
    {
        #region Read-only
        [Safe]
        public static UInt160 GetOwner() => Owner;

        [Safe]
        public static BigInteger LastMachineId() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_MACHINE_ID);

        [Safe]
        public static BigInteger LastBetId() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_BET_ID);

        [Safe]
        public static BigInteger PendingBetCount() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PENDING_CNT);

        [Safe]
        public static BigInteger PlayCreditOf(UInt160 player) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_PLAY_CREDIT, (byte[])player));

        /// <summary>Prize-asset base units currently reserved by unsettled pulls on a machine.</summary>
        [Safe]
        public static BigInteger ReservedPool(BigInteger machineId) => LoadMachine(machineId).ReservedPool;

        /// <summary>Prize-asset base units a new commit can draw against (PoolBalance - ReservedPool).</summary>
        [Safe]
        public static BigInteger FreePool(BigInteger machineId)
        {
            Machine m = LoadMachine(machineId);
            return m.PoolBalance - m.ReservedPool;
        }

        [Safe]
        public static Map<string, object> GetMachine(BigInteger machineId)
        {
            Machine m = LoadMachine(machineId);
            Map<string, object> r = new Map<string, object>();
            r["id"] = machineId; r["creator"] = m.Creator; r["name"] = m.Name;
            r["prizeAsset"] = m.PrizeAsset; r["price"] = m.Price; r["itemCount"] = m.ItemCount;
            r["totalWeight"] = m.TotalWeight; r["maxPrize"] = m.MaxPrize; r["poolBalance"] = m.PoolBalance;
            r["reservedPool"] = m.ReservedPool; r["freePool"] = m.PoolBalance - m.ReservedPool;
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

        [Safe]
        public static Map<string, object> GetPendingBet(BigInteger betId)
        {
            PendingBet bet = LoadBet(betId);
            Map<string, object> r = new Map<string, object>();
            r["betId"] = betId; r["machineId"] = bet.MachineId; r["player"] = bet.Player;
            r["wager"] = bet.Wager; r["reserved"] = bet.Reserved;
            r["commitIndex"] = bet.CommitIndex; r["settled"] = bet.Settled;
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

        private static PendingBet LoadBet(BigInteger betId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, BetKey(betId));
            ExecutionEngine.Assert(raw is not null, "bet not found");
            return (PendingBet)StdLib.Deserialize(raw);
        }

        private static byte[] MachineKey(BigInteger id) => Helper.Concat(PREFIX_MACHINE, (byte[])(ByteString)id);
        private static byte[] ItemKey(BigInteger machineId, BigInteger index) =>
            Helper.Concat(Helper.Concat(PREFIX_ITEM, (byte[])(ByteString)machineId), (byte[])(ByteString)index);
        private static byte[] BetKey(BigInteger betId) => Helper.Concat(PREFIX_BET, (byte[])(ByteString)betId);
        #endregion
    }
}
