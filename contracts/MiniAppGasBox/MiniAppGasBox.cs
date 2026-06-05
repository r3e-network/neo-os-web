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
    /// <summary>
    /// MiniAppGasBox — self-contained on-chain gacha / mystery box (NO oracle).
    ///
    /// WHY: the PlatformGame gacha resolves a pull via the Morpheus VRF oracle's
    /// off-chain signer (FulfillRequest needs the oracle updater + a verifier
    /// signature). When that signer is not operational, pulls initiate but never
    /// pay out. This contract removes the dependency entirely: a machine owns a
    /// prize pool, and a Pull draws a weighted prize using Neo N3's built-in
    /// block-seeded randomness (Runtime.GetRandom — the same primitive the
    /// platform's red-envelope distribution uses) and transfers it ATOMICALLY in
    /// the same transaction. No external settler, no pending state.
    ///
    /// RANDOMNESS: Runtime.GetRandom() is the per-block consensus beacon (unknown
    /// until the tx mines), mixed with the player address + time so it differs per
    /// player within a block and cannot be cheaply front-run. It is NOT VRF-grade
    /// (a block producer has some influence), so this is intended for low-stakes
    /// mystery boxes; high-value draws should use the VRF oracle when operational.
    ///
    /// SAFETY:
    /// - Single prize asset per machine (NEO or GAS); amounts in BASE UNITS.
    /// - A machine can only be activated when its pool covers the largest single
    ///   prize, and it auto-deactivates the moment the pool can no longer cover it,
    ///   so EVERY pull on an active machine pays out fully — a pull never reverts
    ///   for lack of funds, which removes the abort-and-retry exploit.
    /// - Checks-effects-interactions: play credit + pool + machine state are
    ///   written before the prize transfer; a failed transfer asserts and reverts
    ///   the whole atomic invocation.
    /// </summary>
    [DisplayName("MiniAppGasBox")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Self-contained on-chain gacha: weighted prize pool drawn with Runtime.GetRandom and paid atomically — no oracle.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")] // GAS
    [ContractPermission("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", "transfer")] // NEO
    public partial class MiniAppGasBox : SmartContract
    {
        #region Constants
        private const int MAX_ITEMS = 20;
        private const int MAX_NAME = 60;
        private const byte ASSET_NEO = 1;
        private const byte ASSET_GAS = 2;
        #endregion

        #region Storage prefixes
        private static readonly byte[] PREFIX_MACHINE_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_MACHINE = new byte[] { 0x11 };   // + machineId -> Machine
        private static readonly byte[] PREFIX_ITEM = new byte[] { 0x12 };      // + machineId + index -> Item
        private static readonly byte[] PREFIX_PLAY_CREDIT = new byte[] { 0x13 }; // + player -> GAS credit
        private static readonly byte[] PREFIX_PLAY_ID = new byte[] { 0x14 };
        #endregion

        #region Events
        [DisplayName("MachineCreated")]
        public static event Action<BigInteger, UInt160, UInt160, BigInteger> OnMachineCreated; // id, creator, prizeAsset, price
        [DisplayName("ItemAdded")]
        public static event Action<BigInteger, BigInteger, BigInteger, BigInteger> OnItemAdded; // machineId, index, weight, amount
        [DisplayName("PrizePoolFunded")]
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger> OnPrizePoolFunded; // machineId, from, amount, poolBalance
        [DisplayName("PlayCredited")]
        public static event Action<UInt160, BigInteger, BigInteger> OnPlayCredited; // player, amount, balance
        [DisplayName("MachineActiveChanged")]
        public static event Action<BigInteger, bool> OnMachineActiveChanged;
        [DisplayName("Pulled")]
        public static event Action<BigInteger, BigInteger, UInt160, BigInteger, BigInteger> OnPulled; // playId, machineId, player, itemIndex, prizeAmount
        [DisplayName("RevenueWithdrawn")]
        public static event Action<BigInteger, UInt160, BigInteger> OnRevenueWithdrawn;
        #endregion

        #region Types
        public struct Machine
        {
            public UInt160 Creator;
            public string Name;
            public UInt160 PrizeAsset;
            public BigInteger Price;        // GAS base units per pull
            public BigInteger ItemCount;
            public BigInteger TotalWeight;
            public BigInteger MaxPrize;     // largest single item prize amount
            public BigInteger PoolBalance;  // prize asset base units available
            public BigInteger Revenue;      // accrued GAS play-price revenue
            public bool Active;
        }

        public struct Item
        {
            public string Name;
            public BigInteger Weight;
            public BigInteger Amount;       // prize amount in the machine's prize asset
        }
        #endregion

        #region Deposit (play credit + prize pool funding)
        /// <summary>
        /// GAS with memo "miniapp-gasbox:play" credits the sender's play balance.
        /// NEO/GAS with memo "miniapp-gasbox-pool:&lt;machineId&gt;" funds that machine's
        /// prize pool (asset must equal the machine's prize asset).
        /// </summary>
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            UInt160 caller = Runtime.CallingScriptHash;
            ExecutionEngine.Assert(caller == NEO.Hash || caller == GAS.Hash, "only NEO or GAS accepted");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(data is not null, "memo required");
            string memo = (string)data;

            StorageContext ctx = Storage.CurrentContext;
            if (memo == "miniapp-gasbox:play")
            {
                ExecutionEngine.Assert(caller == GAS.Hash, "play credit is GAS only");
                byte[] key = Helper.Concat(PREFIX_PLAY_CREDIT, (byte[])from);
                BigInteger bal = (BigInteger)Storage.Get(ctx, key) + amount;
                Storage.Put(ctx, key, bal);
                OnPlayCredited(from, amount, bal);
                return;
            }
            if (memo.StartsWith("miniapp-gasbox-pool:"))
            {
                // memo = "miniapp-gasbox-pool:<machineId>" (prefix length 20)
                BigInteger machineId = StdLib.Atoi(memo.Substring(20), 10);
                ByteString raw = Storage.Get(ctx, MachineKey(machineId));
                ExecutionEngine.Assert(raw is not null, "machine not found");
                Machine m = (Machine)StdLib.Deserialize(raw);
                ExecutionEngine.Assert(caller == m.PrizeAsset, "wrong prize asset");
                m.PoolBalance += amount;
                Storage.Put(ctx, MachineKey(machineId), StdLib.Serialize(m));
                OnPrizePoolFunded(machineId, from, amount, m.PoolBalance);
                return;
            }
            ExecutionEngine.Assert(false, "invalid memo");
        }
        #endregion

        #region Admin (machine + items)
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
                ItemCount = 0, TotalWeight = 0, MaxPrize = 0, PoolBalance = 0, Revenue = 0, Active = false,
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
                ExecutionEngine.Assert(m.PoolBalance >= m.MaxPrize, "pool cannot cover max prize");
            }
            m.Active = active;
            Storage.Put(ctx, MachineKey(machineId), StdLib.Serialize(m));
            OnMachineActiveChanged(machineId, active);
        }

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
        #endregion

        #region Pull (the gacha draw + atomic payout)
        /// <summary>
        /// Draw a weighted prize from an active machine and pay it out in the same
        /// transaction. The player must have prepaid the machine price as play
        /// credit; the price is consumed and accrues to the machine as revenue.
        /// </summary>
        public static BigInteger Pull(BigInteger machineId, UInt160 player)
        {
            ExecutionEngine.Assert(player is not null && player.IsValid && !player.IsZero, "invalid player");
            ExecutionEngine.Assert(Runtime.CheckWitness(player), "player witness required");

            StorageContext ctx = Storage.CurrentContext;
            Machine m = LoadMachine(machineId);
            ExecutionEngine.Assert(m.Active, "machine not active");

            // Consume the play price from the player's prepaid credit.
            byte[] creditKey = Helper.Concat(PREFIX_PLAY_CREDIT, (byte[])player);
            BigInteger credit = (BigInteger)Storage.Get(ctx, creditKey);
            ExecutionEngine.Assert(credit >= m.Price, "insufficient play credit");
            BigInteger nextCredit = credit - m.Price;
            if (nextCredit == 0) Storage.Delete(ctx, creditKey); else Storage.Put(ctx, creditKey, nextCredit);

            // Weighted selection with the per-block beacon mixed with the player +
            // time, so the outcome differs per player and cannot be cheaply
            // predicted/front-run (mirrors the platform's red-envelope draw).
            BigInteger entropy = Runtime.GetRandom();
            if (entropy < 0) entropy = -entropy;
            BigInteger mix = (BigInteger)(ByteString)(byte[])player + Runtime.Time + machineId;
            if (mix < 0) mix = -mix;
            BigInteger roll = (entropy + mix) % m.TotalWeight;

            BigInteger chosenIndex = 1;
            BigInteger acc = 0;
            BigInteger prize = 0;
            for (BigInteger i = 1; i <= m.ItemCount; i++)
            {
                Item it = (Item)StdLib.Deserialize(Storage.Get(ctx, ItemKey(machineId, i)));
                acc += it.Weight;
                if (roll < acc) { chosenIndex = i; prize = it.Amount; break; }
            }

            // Effects before interaction. Pool always covers MaxPrize on an active
            // machine, so this never underflows; auto-deactivate once it can't.
            m.PoolBalance -= prize;
            m.Revenue += m.Price;
            if (m.PoolBalance < m.MaxPrize) m.Active = false;
            BigInteger playId = (BigInteger)Storage.Get(ctx, PREFIX_PLAY_ID) + 1;
            Storage.Put(ctx, PREFIX_PLAY_ID, playId);
            Storage.Put(ctx, MachineKey(machineId), StdLib.Serialize(m));

            bool ok = (bool)Contract.Call(m.PrizeAsset, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, player, prize, "" });
            ExecutionEngine.Assert(ok, "prize transfer failed");

            OnPulled(playId, machineId, player, chosenIndex, prize);
            return chosenIndex;
        }
        #endregion
    }
}
