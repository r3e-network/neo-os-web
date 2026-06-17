using System;
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
        #region Admin (machine + items) — per-machine creator-controlled
        public static BigInteger CreateMachine(UInt160 creator, string name, UInt160 prizeAsset, BigInteger price)
        {
            ExecutionEngine.Assert(creator is not null && creator.IsValid && !creator.IsZero, "invalid creator");
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "creator witness required");
            ExecutionEngine.Assert(name is not null && name.Length > 0 && name.Length <= MAX_NAME, "invalid name");
            ExecutionEngine.Assert(prizeAsset == NEO.Hash || prizeAsset == GAS.Hash, "prize asset must be NEO or GAS");
            ExecutionEngine.Assert(price > 0, "price must be > 0");

            StorageContext ctx = Storage.CurrentContext;
            BigInteger machineId = (BigInteger)Storage.Get(ctx, PREFIX_MACHINE_ID) + 1;
            Storage.Put(ctx, PREFIX_MACHINE_ID, machineId);

            Machine m = new Machine
            {
                Creator = creator, Name = name, PrizeAsset = prizeAsset, Price = price,
                ItemCount = 0, TotalWeight = 0, MaxPrize = 0,
                PoolBalance = 0, ReservedPool = 0, Revenue = 0, Active = false,
            };
            Storage.Put(ctx, MachineKey(machineId), StdLib.Serialize(m));
            OnMachineCreated(machineId, creator, prizeAsset, price);
            return machineId;
        }

        public static BigInteger AddItem(UInt160 creator, BigInteger machineId, string name, BigInteger weight, BigInteger amount)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "creator witness required");
            ExecutionEngine.Assert(name is not null && name.Length > 0 && name.Length <= MAX_NAME, "invalid item name");
            ExecutionEngine.Assert(weight > 0, "weight must be > 0");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            StorageContext ctx = Storage.CurrentContext;
            Machine m = LoadMachine(machineId);
            ExecutionEngine.Assert(m.Creator == creator, "only creator");
            ExecutionEngine.Assert(!m.Active, "deactivate before editing");
            // Cannot reshape odds while pulls are mid-flight (would change MaxPrize/odds
            // out from under a committed-but-unsettled bet).
            ExecutionEngine.Assert(m.ReservedPool == 0, "settle pending pulls before editing");
            ExecutionEngine.Assert(m.ItemCount < MAX_ITEMS, "too many items");

            BigInteger index = m.ItemCount + 1;
            Item item = new Item { Name = name, Weight = weight, Amount = amount };
            Storage.Put(ctx, ItemKey(machineId, index), StdLib.Serialize(item));

            m.ItemCount = index;
            m.TotalWeight += weight;
            if (amount > m.MaxPrize) m.MaxPrize = amount;
            Storage.Put(ctx, MachineKey(machineId), StdLib.Serialize(m));
            OnItemAdded(machineId, index, weight, amount);
            return index;
        }

        public static void SetActive(UInt160 creator, BigInteger machineId, bool active)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "creator witness required");
            StorageContext ctx = Storage.CurrentContext;
            Machine m = LoadMachine(machineId);
            ExecutionEngine.Assert(m.Creator == creator, "only creator");
            if (active)
            {
                ExecutionEngine.Assert(m.ItemCount > 0, "no items");
                // The FREE pool (after existing reservations) must cover one more worst-case prize.
                ExecutionEngine.Assert(m.PoolBalance - m.ReservedPool >= m.MaxPrize, "free pool cannot cover max prize");
            }
            m.Active = active;
            Storage.Put(ctx, MachineKey(machineId), StdLib.Serialize(m));
            OnMachineActiveChanged(machineId, active);
        }

        /// <summary>
        /// Creator withdraws accrued GAS play-price revenue (NOT the prize pool).
        /// Revenue accrues only when a pull SETTLES, so it never touches escrowed or
        /// reserved funds.
        /// </summary>
        public static void WithdrawRevenue(UInt160 creator, BigInteger machineId, UInt160 to)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "creator witness required");
            ExecutionEngine.Assert(to is not null && to.IsValid && !to.IsZero, "invalid recipient");
            StorageContext ctx = Storage.CurrentContext;
            Machine m = LoadMachine(machineId);
            ExecutionEngine.Assert(m.Creator == creator, "only creator");
            BigInteger amount = m.Revenue;
            ExecutionEngine.Assert(amount > 0, "no revenue");
            m.Revenue = 0;
            Storage.Put(ctx, MachineKey(machineId), StdLib.Serialize(m));
            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, to, amount, "" });
            ExecutionEngine.Assert(ok, "revenue transfer failed");
            OnRevenueWithdrawn(machineId, to, amount);
        }

        /// <summary>
        /// Creator reclaims FREE prize-pool funds (PoolBalance - ReservedPool) back out.
        /// This is the per-machine "WithdrawBankroll" analog: the creator owns the pool
        /// and may pull out any portion not reserved by an unsettled pending pull, so
        /// every pending win stays fully payable. Auto-deactivates if the remaining free
        /// pool can no longer cover the max prize.
        /// </summary>
        public static void WithdrawPool(UInt160 creator, BigInteger machineId, UInt160 to, BigInteger amount)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "creator witness required");
            ExecutionEngine.Assert(to is not null && to.IsValid && !to.IsZero, "invalid recipient");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            StorageContext ctx = Storage.CurrentContext;
            Machine m = LoadMachine(machineId);
            ExecutionEngine.Assert(m.Creator == creator, "only creator");
            ExecutionEngine.Assert(m.PoolBalance - m.ReservedPool >= amount, "amount exceeds free pool");

            m.PoolBalance -= amount;
            if (m.Active && m.PoolBalance - m.ReservedPool < m.MaxPrize) m.Active = false;
            Storage.Put(ctx, MachineKey(machineId), StdLib.Serialize(m));
            bool ok = (bool)Contract.Call(m.PrizeAsset, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, to, amount, "" });
            ExecutionEngine.Assert(ok, "pool transfer failed");
        }
        #endregion

        #region Upgrade — owner-gated, instant (no timelock)
        /// <summary>
        /// Owner-gated contract upgrade. The global Owner (NR3E4D8N) replaces the
        /// contract's NEF + manifest in place via ContractManagement.Update. This is an
        /// admin maintenance path only; it does not touch any creator's prize pool,
        /// reserved funds, escrowed wagers, or play credits.
        /// </summary>
        public static void Update(ByteString nef, string manifest)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            ContractManagement.Update(nef, manifest, new object[0]);
        }
        #endregion
    }
}
