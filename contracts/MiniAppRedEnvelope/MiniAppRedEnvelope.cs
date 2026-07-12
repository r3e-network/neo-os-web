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
    /// MiniAppRedEnvelope — self-contained on-chain lucky red envelope (NO oracle).
    ///
    /// WHY: the platform's red-envelope previously routed create/claim through the
    /// OS game/payment kernel, which does not actually distribute packets — so
    /// envelopes funded GAS that was never paid out to claimers. This contract is
    /// the authoritative on-chain implementation: a creator funds a total GAS
    /// amount split into N packets; each claimer draws ONE random share and is paid
    /// ATOMICALLY in the same transaction. After expiry the creator reclaims any
    /// unclaimed remainder. No external settler, no pending state.
    ///
    /// RANDOM SPLIT: the classic WeChat "leftover double-average" algorithm — each
    /// non-final packet draws a share in [1, 2*avg] where avg = remaining/remaining
    /// packets, capped so every later packet still receives at least 1 base unit;
    /// the final packet takes the exact remainder. Randomness is Runtime.GetRandom()
    /// (the per-block consensus beacon, unknown until the tx mines) mixed with the
    /// claimer address + time + envelope id so it differs per claimer and cannot be
    /// cheaply front-run.
    ///
    /// RANDOMNESS LIMITATION (acknowledged, low severity): the share is drawn at
    /// claim time, so a claimer who can read their own draw within the transaction
    /// could in principle abort and retry across blocks until they hit a larger
    /// share ("grinding"). This is bounded — a single packet can never exceed the
    /// double-average cap (~2*avg) and at least 1 base unit is always reserved for
    /// every later packet — so grinding cannot drain the envelope or starve later
    /// claimers, only nudge one share toward its capped maximum at the cost of extra
    /// fees and blocks. Runtime.GetRandom() is NOT VRF-grade and this contract is
    /// intended for low-stakes social packets only; it is grinding-resistant for that
    /// use, not a fair-randomness primitive. A commit/reveal scheme would remove the
    /// residual bias but require a second claim transaction, which would materially
    /// degrade the one-tap social-gifting UX, so it is intentionally not used here.
    ///
    /// SAFETY:
    /// - GAS only (divisible — required to split into random sub-amounts); amounts
    ///   in BASE UNITS (1 GAS = 100_000_000).
    /// - Deposit-then-create: GAS sent with memo "miniapp-redenvelope:create" credits
    ///   the sender; createEnvelope consumes that credit, so an envelope can never be
    ///   created without its funds already escrowed in this contract.
    /// - Checks-effects-interactions: remaining/opened/claimed state is written
    ///   before every transfer; a failed transfer asserts and reverts the whole
    ///   atomic invocation. One claim per address per envelope.
    /// - The sum of all packet payouts plus any creator reclaim equals exactly the
    ///   funded total, so no GAS is ever stranded or double-spent.
    /// </summary>
    [DisplayName("MiniAppRedEnvelope")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.1.0")]
    [ManifestExtra("Description", "Bounded low-stakes lucky red envelope: up to 20 GAS and 100 packets, 1 minute to 7 days, Runtime.GetRandom split, atomic claims — no oracle or VRF.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")] // GAS
    public partial class MiniAppRedEnvelope : SmartContract
    {
        #region Constants
        private const int MAX_PACKETS = 100;
        private const long MAX_TOTAL_AMOUNT = 20_00000000; // 20 GAS
        private const long MIN_DURATION_SECONDS = 60;
        private const long MAX_DURATION_SECONDS = 7 * 24 * 60 * 60;
        private const string CREATE_MEMO = "miniapp-redenvelope:create";
        #endregion

        #region Storage prefixes
        private static readonly byte[] PREFIX_ENV_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_ENV = new byte[] { 0x11 };          // + envId -> Envelope
        private static readonly byte[] PREFIX_CREDIT = new byte[] { 0x12 };       // + creator -> GAS credit
        private static readonly byte[] PREFIX_CLAIMED = new byte[] { 0x13 };      // + envId + claimer -> share (presence = claimed)
        private static readonly byte[] PREFIX_CREATOR_CNT = new byte[] { 0x14 };  // + creator -> count
        private static readonly byte[] PREFIX_CREATOR_ITEM = new byte[] { 0x15 }; // + creator + seq -> envId
        private static readonly byte[] PREFIX_CLAIMER_CNT = new byte[] { 0x16 };  // + claimer -> count
        private static readonly byte[] PREFIX_CLAIMER_ITEM = new byte[] { 0x17 }; // + claimer + seq -> envId
        #endregion

        #region Events
        [DisplayName("Credited")]
        public static event Action<UInt160, BigInteger, BigInteger> OnCredited; // from, amount, balance
        [DisplayName("EnvelopeCreated")]
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger, BigInteger> OnEnvelopeCreated; // id, creator, total, packetCount, expiry
        [DisplayName("Claimed")]
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger> OnClaimed; // id, claimer, share, remainingPackets
        [DisplayName("Reclaimed")]
        public static event Action<BigInteger, UInt160, BigInteger> OnReclaimed; // id, creator, amount
        [DisplayName("CreditWithdrawn")]
        public static event Action<UInt160, BigInteger> OnCreditWithdrawn; // account, amount
        #endregion

        #region Types
        public struct Envelope
        {
            public UInt160 Creator;
            public BigInteger TotalAmount;
            public BigInteger RemainingAmount;
            public BigInteger PacketCount;
            public BigInteger OpenedCount;
            public BigInteger ExpiryTime;      // ms since epoch (Runtime.Time units)
            public UInt160 BestLuckAddress;
            public BigInteger BestLuckAmount;
            public bool Active;                // false once fully claimed or reclaimed
        }
        #endregion

        #region Deposit (prepaid create credit)
        /// <summary>
        /// GAS sent with memo "miniapp-redenvelope:create" credits the sender's
        /// prepaid balance, which createEnvelope() then consumes.
        /// </summary>
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "only GAS accepted");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(data is not null, "memo required");
            string memo = (string)data;
            ExecutionEngine.Assert(memo == CREATE_MEMO, "invalid memo");

            StorageContext ctx = Storage.CurrentContext;
            byte[] key = Helper.Concat(PREFIX_CREDIT, (byte[])from);
            BigInteger bal = (BigInteger)Storage.Get(ctx, key) + amount;
            Storage.Put(ctx, key, bal);
            OnCredited(from, amount, bal);
        }
        #endregion

        #region Create
        /// <summary>
        /// Open a red envelope funded from the creator's prepaid credit. The total
        /// is locked in this contract and split into packetCount random packets that
        /// claimers draw until depleted; unclaimed remainder is reclaimable by the
        /// creator after durationSeconds.
        /// </summary>
        public static BigInteger CreateEnvelope(UInt160 creator, BigInteger totalAmount, BigInteger packetCount, BigInteger durationSeconds)
        {
            ExecutionEngine.Assert(creator is not null && creator.IsValid && !creator.IsZero, "invalid creator");
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "creator witness required");
            ExecutionEngine.Assert(packetCount > 0 && packetCount <= MAX_PACKETS, "packet count 1..100");
            ExecutionEngine.Assert(totalAmount > 0, "total amount must be > 0");
            ExecutionEngine.Assert(totalAmount <= MAX_TOTAL_AMOUNT, "total amount exceeds 20 GAS");
            // Each packet must be able to receive at least 1 base unit.
            ExecutionEngine.Assert(totalAmount >= packetCount, "total must cover one base unit per packet");
            ExecutionEngine.Assert(
                durationSeconds >= MIN_DURATION_SECONDS && durationSeconds <= MAX_DURATION_SECONDS,
                "duration 60..604800 seconds");

            StorageContext ctx = Storage.CurrentContext;

            // Consume prepaid credit (deposit-then-create): funds are already in the
            // contract, so the envelope is always fully backed.
            byte[] creditKey = Helper.Concat(PREFIX_CREDIT, (byte[])creator);
            BigInteger credit = (BigInteger)Storage.Get(ctx, creditKey);
            ExecutionEngine.Assert(credit >= totalAmount, "insufficient deposit credit");
            BigInteger nextCredit = credit - totalAmount;
            if (nextCredit == 0) Storage.Delete(ctx, creditKey); else Storage.Put(ctx, creditKey, nextCredit);

            BigInteger envId = (BigInteger)Storage.Get(ctx, PREFIX_ENV_ID) + 1;
            Storage.Put(ctx, PREFIX_ENV_ID, envId);

            Envelope e = new Envelope
            {
                Creator = creator,
                TotalAmount = totalAmount,
                RemainingAmount = totalAmount,
                PacketCount = packetCount,
                OpenedCount = 0,
                ExpiryTime = (BigInteger)Runtime.Time + durationSeconds * 1000,
                BestLuckAddress = UInt160.Zero,
                BestLuckAmount = 0,
                Active = true,
            };
            Storage.Put(ctx, EnvKey(envId), StdLib.Serialize(e));
            IndexAppend(ctx, PREFIX_CREATOR_CNT, PREFIX_CREATOR_ITEM, creator, envId);

            OnEnvelopeCreated(envId, creator, totalAmount, packetCount, e.ExpiryTime);
            return envId;
        }
        #endregion

        #region Claim
        /// <summary>
        /// Draw one random packet from an active, unexpired envelope and pay the
        /// claimer atomically. One claim per address per envelope.
        /// </summary>
        public static BigInteger Claim(BigInteger envelopeId, UInt160 claimer)
        {
            ExecutionEngine.Assert(claimer is not null && claimer.IsValid && !claimer.IsZero, "invalid claimer");
            ExecutionEngine.Assert(Runtime.CheckWitness(claimer), "claimer witness required");

            StorageContext ctx = Storage.CurrentContext;
            Envelope e = LoadEnvelope(envelopeId);
            ExecutionEngine.Assert(e.Active, "envelope not active");
            ExecutionEngine.Assert((BigInteger)Runtime.Time < e.ExpiryTime, "envelope expired");
            ExecutionEngine.Assert(e.OpenedCount < e.PacketCount, "all packets claimed");

            byte[] claimedKey = ClaimedKey(envelopeId, claimer);
            ExecutionEngine.Assert(Storage.Get(ctx, claimedKey) is null, "already claimed");

            BigInteger remainingPackets = e.PacketCount - e.OpenedCount;
            BigInteger share;
            if (remainingPackets == 1)
            {
                // Final packet takes the exact remainder.
                share = e.RemainingAmount;
            }
            else
            {
                // Double-average upper bound, then a random draw in [1, 2*avg].
                // NOTE: this draw resolves at claim time, so it is grinding-resistant
                // but not grinding-proof — a claimer could abort/retry to push toward a
                // larger share. The outcome is bounded by the 2*avg cap and the
                // 1-base-unit-per-later-packet reservation below, so this only matters
                // for low-stakes social packets and is accepted by design (see class
                // summary). It is NOT VRF-grade randomness.
                BigInteger avg = e.RemainingAmount / remainingPackets;
                BigInteger maxShare = avg * 2;
                if (maxShare < 1) maxShare = 1;

                BigInteger entropy = Runtime.GetRandom();
                if (entropy < 0) entropy = -entropy;
                BigInteger mix = (BigInteger)(ByteString)(byte[])claimer + Runtime.Time + envelopeId;
                if (mix < 0) mix = -mix;
                share = 1 + (entropy + mix) % maxShare;

                // Leave at least 1 base unit for each remaining packet.
                BigInteger cap = e.RemainingAmount - (remainingPackets - 1);
                if (share > cap) share = cap;
                if (share < 1) share = 1;
            }

            // Effects before interaction.
            e.RemainingAmount -= share;
            e.OpenedCount += 1;
            if (share > e.BestLuckAmount) { e.BestLuckAmount = share; e.BestLuckAddress = claimer; }
            if (e.OpenedCount >= e.PacketCount || e.RemainingAmount <= 0) e.Active = false;
            Storage.Put(ctx, EnvKey(envelopeId), StdLib.Serialize(e));
            Storage.Put(ctx, claimedKey, share);
            IndexAppend(ctx, PREFIX_CLAIMER_CNT, PREFIX_CLAIMER_ITEM, claimer, envelopeId);

            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, claimer, share, "" });
            ExecutionEngine.Assert(ok, "claim transfer failed");

            OnClaimed(envelopeId, claimer, share, e.PacketCount - e.OpenedCount);
            return share;
        }
        #endregion

        #region Reclaim
        /// <summary>
        /// After expiry, the creator reclaims any unclaimed remainder.
        /// </summary>
        public static BigInteger Reclaim(BigInteger envelopeId, UInt160 creator)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "creator witness required");
            StorageContext ctx = Storage.CurrentContext;
            Envelope e = LoadEnvelope(envelopeId);
            ExecutionEngine.Assert(e.Creator == creator, "only creator");
            ExecutionEngine.Assert((BigInteger)Runtime.Time >= e.ExpiryTime, "not yet expired");
            ExecutionEngine.Assert(e.Active && e.RemainingAmount > 0, "nothing to reclaim");

            BigInteger amount = e.RemainingAmount;
            e.RemainingAmount = 0;
            e.Active = false;
            Storage.Put(ctx, EnvKey(envelopeId), StdLib.Serialize(e));

            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, creator, amount, "" });
            ExecutionEngine.Assert(ok, "reclaim transfer failed");

            OnReclaimed(envelopeId, creator, amount);
            return amount;
        }
        #endregion

        #region Withdraw credit
        /// <summary>Reclaim any unused prepaid create-credit back to the sender.</summary>
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

    }
}
