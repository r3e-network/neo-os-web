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
    /// MiniAppGasBoxV2 — commit/reveal on-chain gacha / mystery box (NO oracle).
    ///
    /// WHY V2 (the exploit V1 had): V1 drew the weighted prize and paid it ATOMICALLY
    /// in the same transaction as the pull, seeded by Runtime.GetRandom of that block.
    /// An attacker contract can call pull(), read the drawn prize in the SAME tx, and
    /// ABORT the whole transaction whenever the prize is small — reverting the wager —
    /// while letting only the big-prize pulls commit. That makes the expected value
    /// positive and drains the machine prize pool. (Same-tx abort-on-loss.)
    ///
    /// THE FIX — COMMIT / REVEAL ACROSS BLOCKS:
    ///   1. commit(): the player pull is recorded IRREVOCABLY in block N. The wager
    ///      (the machine price) is consumed from the player's prepaid play credit into
    ///      an escrowed pending-bet record, and the machine's worst-case prize
    ///      (MaxPrize) is RESERVED from the prize pool so concurrent pending pulls can
    ///      never oversubscribe the pool.
    ///   2. settle(betId) [PERMISSIONLESS]: the prize is drawn and paid only in a
    ///      STRICTLY LATER block, derived from the hash of the FIXED beacon block
    ///      commitIndex+1 (unknown at commit time, immutable once produced). The player
    ///      can no longer condition an abort on the result: the wager already committed
    ///      in block N, and anyone (a keeper / the frontend) can settle, so a small-prize
    ///      draw cannot be withheld.
    ///
    /// RANDOMNESS: the hash of the FIXED beacon block commitIndex+1 (unknown at commit,
    /// immutable once produced) mixed with betId + player + commitIndex, so re-running
    /// settle in ANY later block yields the SAME draw — closing same-tx abort-and-retry
    /// grinding. NOT VRF-grade (a block producer can still influence/withhold the single
    /// beacon block), so this is intended for low-stakes mystery boxes; high-value draws
    /// should use the VRF oracle when operational.
    ///
    /// PER-MACHINE solvency (V1 model preserved): each machine owns its own prize pool
    /// and its own GAS price-revenue; the machine CREATOR funds/activates/withdraws it.
    /// Reservation is per machine: a commit is accepted only when
    /// freePool = PoolBalance - ReservedPool >= MaxPrize. settle() always releases the
    /// MaxPrize reservation and deducts the actual prize, so the pool can never go
    /// negative and every pending pull is fully payable.
    ///
    /// SOLVENCY INVARIANT (per asset the contract holds):
    ///   heldGAS  == sum(machine.Revenue) + sum(escrowed pending GAS wagers)
    ///                + sum(player GAS play credits)
    ///                + GAS prize pools (for GAS-prize machines)
    ///   heldNEO  == NEO prize pools (for NEO-prize machines)
    ///   per machine: ReservedPool <= PoolBalance, and every pending pull's MaxPrize is
    ///   covered by its reservation.
    ///
    /// SAFETY: OnNEP17Payment is CREDIT-ONLY (no transfer / no business-logic revert in
    /// the callback). Checks-effects-interactions on settle: state is written before
    /// the prize transfer; a failed transfer asserts and reverts.
    /// </summary>
    [DisplayName("MiniAppGasBoxV2")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Commit/reveal on-chain gacha: weighted prize pool drawn across blocks from a fixed past-block beacon — closes the same-tx abort-on-loss exploit, no oracle.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")] // GAS
    [ContractPermission("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", "transfer")] // NEO
    public partial class MiniAppGasBoxV2 : SmartContract
    {
        #region Constants
        private const int MAX_ITEMS = 20;
        private const int MAX_NAME = 60;

        // Owner kept per the template (NR3E4D8N). The owner is a global admin used only
        // for the permissionless safety-net reclaim path; it has NO power to drain a
        // creator's prize pool or revenue (those stay creator-controlled, as in V1).
        [InitialValue("NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32", ContractParameterType.Hash160)]
        private static readonly UInt160 Owner = default;

        private const string PLAY_MEMO = "miniapp-gasbox:play";
        private const string POOL_MEMO_PREFIX = "miniapp-gasbox-pool:"; // + <machineId>, prefix length 20
        #endregion

        #region Storage prefixes
        private static readonly byte[] PREFIX_MACHINE_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_MACHINE = new byte[] { 0x11 };       // + machineId -> Machine
        private static readonly byte[] PREFIX_ITEM = new byte[] { 0x12 };          // + machineId + index -> Item
        private static readonly byte[] PREFIX_PLAY_CREDIT = new byte[] { 0x13 };   // + player -> GAS credit
        private static readonly byte[] PREFIX_BET_ID = new byte[] { 0x14 };        // global last betId
        private static readonly byte[] PREFIX_BET = new byte[] { 0x15 };           // + betId -> PendingBet
        private static readonly byte[] PREFIX_PENDING_CNT = new byte[] { 0x16 };   // count of unsettled bets
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
        [DisplayName("Committed")]
        public static event Action<BigInteger, BigInteger, UInt160, BigInteger, BigInteger> OnCommitted; // betId, machineId, player, wager, commitIndex
        [DisplayName("Settled")]
        public static event Action<BigInteger, BigInteger, UInt160, BigInteger, BigInteger> OnSettled; // betId, machineId, player, itemIndex, prizeAmount
        [DisplayName("RevenueWithdrawn")]
        public static event Action<BigInteger, UInt160, BigInteger> OnRevenueWithdrawn;
        [DisplayName("CreditWithdrawn")]
        public static event Action<UInt160, BigInteger> OnCreditWithdrawn; // account, amount
        #endregion

        #region Types
        public struct Machine
        {
            public UInt160 Creator;
            public string Name;
            public UInt160 PrizeAsset;
            public BigInteger Price;         // GAS base units per pull (the wager)
            public BigInteger ItemCount;
            public BigInteger TotalWeight;
            public BigInteger MaxPrize;      // largest single item prize amount (the house exposure per pull)
            public BigInteger PoolBalance;   // prize asset base units held for this machine
            public BigInteger ReservedPool;  // prize asset base units reserved by unsettled pending pulls
            public BigInteger Revenue;       // accrued GAS play-price revenue (settled wagers)
            public bool Active;
        }

        public struct Item
        {
            public string Name;
            public BigInteger Weight;
            public BigInteger Amount;        // prize amount in the machine's prize asset
        }

        public struct PendingBet
        {
            public BigInteger MachineId;
            public UInt160 Player;
            public BigInteger Wager;         // escrowed GAS price consumed at commit
            public BigInteger Reserved;      // prize-asset reservation (== MaxPrize at commit)
            public BigInteger CommitIndex;   // Ledger.CurrentIndex at commit
            public bool Settled;
        }
        #endregion

        #region Deposit (play credit + prize pool funding) — CREDIT ONLY
        /// <summary>
        /// GAS with memo "miniapp-gasbox:play" credits the sender's play balance.
        /// NEO/GAS with memo "miniapp-gasbox-pool:&lt;machineId&gt;" funds that machine's
        /// prize pool (asset must equal the machine's prize asset).
        ///
        /// CREDIT ONLY: no token transfer and no business-logic revert here beyond
        /// caller/memo/amount validation — all payouts live in direct, witness-gated
        /// methods (commit/settle/withdraw), per the platform money-contract convention.
        /// </summary>
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            UInt160 caller = Runtime.CallingScriptHash;
            ExecutionEngine.Assert(caller == NEO.Hash || caller == GAS.Hash, "only NEO or GAS accepted");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(data is not null, "memo required");
            string memo = (string)data;

            StorageContext ctx = Storage.CurrentContext;
            if (memo == PLAY_MEMO)
            {
                ExecutionEngine.Assert(caller == GAS.Hash, "play credit is GAS only");
                byte[] key = Helper.Concat(PREFIX_PLAY_CREDIT, (byte[])from);
                BigInteger bal = (BigInteger)Storage.Get(ctx, key) + amount;
                Storage.Put(ctx, key, bal);
                OnPlayCredited(from, amount, bal);
                return;
            }
            if (memo.StartsWith(POOL_MEMO_PREFIX))
            {
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
    }
}
