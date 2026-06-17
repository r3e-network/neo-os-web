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
    /// MiniAppTarot — self-contained on-chain tarot reading (NO oracle).
    ///
    /// WHY: the app previously paid a "draw fee" to the OS payment kernel (which
    /// moved nothing) and polled OS storage for a reading the kernel never wrote;
    /// the three cards were derived CLIENT-SIDE from the tx id. This contract makes
    /// the reading authoritative and on-chain: draw() consumes a prepaid GAS fee and
    /// picks three DISTINCT cards from the 78-card deck using Neo N3's built-in
    /// block-seeded randomness (Runtime.GetRandom) in the same transaction. No
    /// external settler, no client-trusted seed.
    ///
    /// RANDOMNESS: Runtime.GetRandom() is the per-block consensus beacon (unknown
    /// until the tx mines), mixed with the player + time + reading id so it differs
    /// per player. NOT VRF-grade — fine for an entertainment reading.
    ///
    /// FEE: the 0.1 GAS draw fee accrues to the contract and is withdrawable only by
    /// the Owner (the deployer). Deposit-then-draw: GAS sent with memo
    /// "miniapp-tarot:draw" credits the player; draw() consumes one fee.
    /// </summary>
    [DisplayName("MiniAppTarot")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Self-contained on-chain tarot: three distinct cards drawn with Runtime.GetRandom for a prepaid fee — no oracle.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")] // GAS
    public class MiniAppTarot : SmartContract
    {
        #region Constants
        private const int DECK_SIZE = 78;
        private const int CARDS_PER_READING = 3;
        private const long DRAW_FEE = 10_000_000; // 0.1 GAS
        private const string DRAW_MEMO = "miniapp-tarot:draw";

        [InitialValue("NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32", ContractParameterType.Hash160)]
        private static readonly UInt160 Owner = default;
        #endregion

        #region Storage prefixes
        private static readonly byte[] PREFIX_READING_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_READING = new byte[] { 0x11 };      // + readingId -> Reading
        private static readonly byte[] PREFIX_CREDIT = new byte[] { 0x12 };       // + player -> GAS credit
        private static readonly byte[] PREFIX_PLAYER_CNT = new byte[] { 0x13 };   // + player -> count
        private static readonly byte[] PREFIX_PLAYER_ITEM = new byte[] { 0x14 };  // + player + seq -> readingId
        private static readonly byte[] PREFIX_REVENUE = new byte[] { 0x15 };
        #endregion

        #region Events
        [DisplayName("Credited")]
        public static event Action<UInt160, BigInteger, BigInteger> OnCredited; // from, amount, balance
        [DisplayName("ReadingDrawn")]
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger, BigInteger> OnReadingDrawn; // id, player, c0, c1, c2
        [DisplayName("RevenueWithdrawn")]
        public static event Action<UInt160, BigInteger> OnRevenueWithdrawn; // to, amount
        [DisplayName("CreditWithdrawn")]
        public static event Action<UInt160, BigInteger> OnCreditWithdrawn; // account, amount
        #endregion

        #region Types
        public struct Reading
        {
            public UInt160 Player;
            public BigInteger Card0;
            public BigInteger Card1;
            public BigInteger Card2;
            public BigInteger Time;
        }
        #endregion

        #region Deposit
        /// <summary>GAS with memo "miniapp-tarot:draw" credits the sender's draw balance.</summary>
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "only GAS accepted");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(data is not null, "memo required");
            ExecutionEngine.Assert((string)data == DRAW_MEMO, "invalid memo");

            StorageContext ctx = Storage.CurrentContext;
            byte[] key = Helper.Concat(PREFIX_CREDIT, (byte[])from);
            BigInteger bal = (BigInteger)Storage.Get(ctx, key) + amount;
            Storage.Put(ctx, key, bal);
            OnCredited(from, amount, bal);
        }
        #endregion

        #region Draw
        /// <summary>
        /// Consume one draw fee and reveal three distinct cards drawn on-chain.
        /// Returns the reading id; the cards are also in the ReadingDrawn event.
        /// </summary>
        public static BigInteger Draw(UInt160 player)
        {
            ExecutionEngine.Assert(player is not null && player.IsValid && !player.IsZero, "invalid player");
            ExecutionEngine.Assert(Runtime.CheckWitness(player), "player witness required");

            StorageContext ctx = Storage.CurrentContext;
            byte[] creditKey = Helper.Concat(PREFIX_CREDIT, (byte[])player);
            BigInteger credit = (BigInteger)Storage.Get(ctx, creditKey);
            ExecutionEngine.Assert(credit >= DRAW_FEE, "insufficient draw credit");
            BigInteger nextCredit = credit - DRAW_FEE;
            if (nextCredit == 0) Storage.Delete(ctx, creditKey); else Storage.Put(ctx, creditKey, nextCredit);

            BigInteger readingId = (BigInteger)Storage.Get(ctx, PREFIX_READING_ID) + 1;
            Storage.Put(ctx, PREFIX_READING_ID, readingId);

            // Partial Fisher-Yates over a 0..77 deck, three draws, each roll seeded
            // by a fresh GetRandom mixed with the player + time so it differs per
            // player and cannot be cheaply predicted.
            BigInteger[] deck = new BigInteger[DECK_SIZE];
            for (int i = 0; i < DECK_SIZE; i++) deck[i] = i;
            BigInteger mix = (BigInteger)(ByteString)(byte[])player + Runtime.Time + readingId;
            if (mix < 0) mix = -mix;
            for (int d = 0; d < CARDS_PER_READING; d++)
            {
                BigInteger entropy = Runtime.GetRandom();
                if (entropy < 0) entropy = -entropy;
                int remaining = DECK_SIZE - d;
                int swapWith = d + (int)((entropy + mix + d) % remaining);
                BigInteger tmp = deck[d];
                deck[d] = deck[swapWith];
                deck[swapWith] = tmp;
            }

            Reading r = new Reading
            {
                Player = player, Card0 = deck[0], Card1 = deck[1], Card2 = deck[2], Time = Runtime.Time,
            };
            Storage.Put(ctx, ReadingKey(readingId), StdLib.Serialize(r));

            byte[] cntKey = Helper.Concat(PREFIX_PLAYER_CNT, (byte[])player);
            BigInteger n = (BigInteger)Storage.Get(ctx, cntKey) + 1;
            Storage.Put(ctx, cntKey, n);
            Storage.Put(ctx, Helper.Concat(Helper.Concat(PREFIX_PLAYER_ITEM, (byte[])player), (byte[])(ByteString)n), readingId);

            Storage.Put(ctx, PREFIX_REVENUE, (BigInteger)Storage.Get(ctx, PREFIX_REVENUE) + DRAW_FEE);

            OnReadingDrawn(readingId, player, deck[0], deck[1], deck[2]);
            return readingId;
        }
        #endregion

        #region Owner
        public static void WithdrawRevenue(UInt160 to)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            ExecutionEngine.Assert(to is not null && to.IsValid && !to.IsZero, "invalid recipient");
            StorageContext ctx = Storage.CurrentContext;
            BigInteger revenue = (BigInteger)Storage.Get(ctx, PREFIX_REVENUE);
            ExecutionEngine.Assert(revenue > 0, "no revenue");
            Storage.Put(ctx, PREFIX_REVENUE, 0);
            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, to, revenue, "" });
            ExecutionEngine.Assert(ok, "revenue transfer failed");
            OnRevenueWithdrawn(to, revenue);
        }

        /// <summary>Owner-gated, instant contract upgrade. No timelock.</summary>
        public static void Update(ByteString nef, string manifest)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            ContractManagement.Update(nef, manifest, new object[0]);
        }
        #endregion

        #region Withdraw credit
        /// <summary>Reclaim any unused prepaid draw-credit back to the sender.</summary>
        public static BigInteger Withdraw(UInt160 account)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(account), "account witness required");
            StorageContext ctx = Storage.CurrentContext;
            byte[] key = Helper.Concat(PREFIX_CREDIT, (byte[])account);
            BigInteger credit = (BigInteger)Storage.Get(ctx, key);
            ExecutionEngine.Assert(credit > 0, "no credit");
            Storage.Delete(ctx, key);
            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, account, credit, "" });
            ExecutionEngine.Assert(ok, "withdraw transfer failed");
            OnCreditWithdrawn(account, credit);
            return credit;
        }
        #endregion

        #region Read-only
        [Safe]
        public static BigInteger ReadingsCount() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_READING_ID);

        [Safe]
        public static BigInteger DrawFee() => DRAW_FEE;

        [Safe]
        public static BigInteger CreditOf(UInt160 player) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_CREDIT, (byte[])player));

        [Safe]
        public static BigInteger Revenue() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_REVENUE);

        [Safe]
        public static Map<string, object> GetReading(BigInteger readingId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, ReadingKey(readingId));
            ExecutionEngine.Assert(raw is not null, "reading not found");
            Reading r = (Reading)StdLib.Deserialize(raw);
            Map<string, object> m = new Map<string, object>();
            m["id"] = readingId;
            m["player"] = r.Player;
            m["cards"] = new BigInteger[] { r.Card0, r.Card1, r.Card2 };
            m["time"] = r.Time;
            return m;
        }

        [Safe]
        public static BigInteger PlayerReadingCount(UInt160 player) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_PLAYER_CNT, (byte[])player));

        [Safe]
        public static BigInteger[] GetPlayerReadings(UInt160 player, BigInteger offset, BigInteger limit)
        {
            StorageContext ctx = Storage.CurrentContext;
            BigInteger n = (BigInteger)Storage.Get(ctx, Helper.Concat(PREFIX_PLAYER_CNT, (byte[])player));
            if (offset < 0) offset = 0;
            if (limit <= 0 || limit > 100) limit = 100;
            BigInteger start = offset + 1;
            BigInteger end = start + limit - 1;
            if (end > n) end = n;
            if (start > end) return new BigInteger[0];
            BigInteger count = end - start + 1;
            BigInteger[] result = new BigInteger[(int)count];
            BigInteger idx = 0;
            for (BigInteger i = start; i <= end; i++)
            {
                result[(int)idx] = (BigInteger)Storage.Get(ctx, Helper.Concat(Helper.Concat(PREFIX_PLAYER_ITEM, (byte[])player), (byte[])(ByteString)i));
                idx += 1;
            }
            return result;
        }
        #endregion

        #region Internal
        private static byte[] ReadingKey(BigInteger id) => Helper.Concat(PREFIX_READING, (byte[])(ByteString)id);
        #endregion
    }
}
