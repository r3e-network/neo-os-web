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
    /// MiniAppBreakupPact — self-contained on-chain two-party commitment pact (NO oracle).
    ///
    /// WHY: the breakup-contract app routed create/sign/break through the OS escrow
    /// kernel, which never held the stakes or paid anyone — the escrow id never even
    /// materialized (the earlier audit's "revise"). This contract is the authoritative
    /// implementation: two parties each lock a MATCHING GAS stake; if either party
    /// breaks the pact, the OTHER party receives BOTH stakes (the breaker forfeits); if
    /// the pact is honored to expiry, both stakes are returned. No external settler.
    ///
    /// LIFECYCLE: createPact (party1 stakes -> pending) -> signPact (party2 matches ->
    /// active) -> either breakPact (other gets 2x, breaker forfeits -> broken) OR after
    /// expiry settlePact (both refunded -> settled). While pending, party1 may breakPact
    /// to cancel and reclaim their stake (party2 never committed).
    ///
    /// SAFETY: GAS only, BASE UNITS. Deposit-then-stake: GAS sent with memo
    /// "miniapp-breakup:stake" credits the sender; createPact/signPact consume exactly
    /// `stake` from that credit, so a pact is always fully backed by both parties before
    /// it is active. Checks-effects-interactions: state is written before every transfer;
    /// a failed transfer asserts and reverts the whole atomic invocation. The sum of all
    /// payouts equals exactly the funded total — no stranding, no double-spend.
    /// </summary>
    [DisplayName("MiniAppBreakupPact")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Self-contained on-chain two-party commitment pact: matched stakes, breaker forfeits to partner, honored pacts refund both — no oracle.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")] // GAS
    public class MiniAppBreakupPact : SmartContract
    {
        #region Constants
        private const long MIN_STAKE = 100_000_000;            // 1 GAS
        private const long MIN_DURATION_SECONDS = 1;           // contract floor; UI enforces >= 30 days
        private const long MAX_DURATION_SECONDS = 3650L * 86400;
        private const string STAKE_MEMO = "miniapp-breakup:stake";
        private const byte STATUS_PENDING = 0;
        private const byte STATUS_ACTIVE = 1;
        private const byte STATUS_BROKEN = 2;
        private const byte STATUS_SETTLED = 3;
        private const byte STATUS_CANCELLED = 4;
        #endregion

        #region Storage prefixes
        private static readonly byte[] PREFIX_PACT_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_PACT = new byte[] { 0x11 };          // + pactId -> Pact
        private static readonly byte[] PREFIX_CREDIT = new byte[] { 0x12 };        // + party -> GAS credit
        private static readonly byte[] PREFIX_PARTY_CNT = new byte[] { 0x13 };     // + party -> count
        private static readonly byte[] PREFIX_PARTY_ITEM = new byte[] { 0x14 };    // + party + seq -> pactId
        #endregion

        #region Events
        [DisplayName("Credited")]
        public static event Action<UInt160, BigInteger, BigInteger> OnCredited;
        [DisplayName("PactCreated")]
        public static event Action<BigInteger, UInt160, UInt160, BigInteger, BigInteger> OnPactCreated; // id, p1, p2, stake, endTime
        [DisplayName("PactSigned")]
        public static event Action<BigInteger, UInt160> OnPactSigned; // id, party2
        [DisplayName("PactBroken")]
        public static event Action<BigInteger, UInt160, UInt160, BigInteger> OnPactBroken; // id, breaker, paidTo, amount
        [DisplayName("PactSettled")]
        public static event Action<BigInteger, BigInteger> OnPactSettled; // id, eachRefund
        [DisplayName("PactCancelled")]
        public static event Action<BigInteger, UInt160, BigInteger> OnPactCancelled; // id, party1, refund
        #endregion

        #region Types
        public struct Pact
        {
            public UInt160 Party1;
            public UInt160 Party2;
            public BigInteger Stake;       // per-party stake (each party locks this)
            public BigInteger EndTime;     // ms
            public bool Party1Staked;
            public bool Party2Staked;
            public BigInteger Status;      // see STATUS_*
            public UInt160 Breaker;
        }
        #endregion

        #region Deposit (stake credit)
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "only GAS accepted");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(data is not null, "memo required");
            ExecutionEngine.Assert((string)data == STAKE_MEMO, "invalid memo");
            StorageContext ctx = Storage.CurrentContext;
            byte[] key = Helper.Concat(PREFIX_CREDIT, (byte[])from);
            BigInteger bal = (BigInteger)Storage.Get(ctx, key) + amount;
            Storage.Put(ctx, key, bal);
            OnCredited(from, amount, bal);
        }

        private static void ConsumeCredit(StorageContext ctx, UInt160 who, BigInteger amount)
        {
            byte[] key = Helper.Concat(PREFIX_CREDIT, (byte[])who);
            BigInteger credit = (BigInteger)Storage.Get(ctx, key);
            ExecutionEngine.Assert(credit >= amount, "insufficient stake credit");
            BigInteger next = credit - amount;
            if (next == 0) Storage.Delete(ctx, key); else Storage.Put(ctx, key, next);
        }
        #endregion

        #region Create / Sign
        public static BigInteger CreatePact(UInt160 party1, UInt160 party2, BigInteger stake, BigInteger durationSeconds)
        {
            ExecutionEngine.Assert(party1 is not null && party1.IsValid && !party1.IsZero, "invalid party1");
            ExecutionEngine.Assert(party2 is not null && party2.IsValid && !party2.IsZero, "invalid party2");
            ExecutionEngine.Assert(party1 != party2, "parties must differ");
            ExecutionEngine.Assert(Runtime.CheckWitness(party1), "party1 witness required");
            ExecutionEngine.Assert(stake >= MIN_STAKE, "stake below minimum");
            ExecutionEngine.Assert(durationSeconds >= MIN_DURATION_SECONDS && durationSeconds <= MAX_DURATION_SECONDS, "duration out of range");

            StorageContext ctx = Storage.CurrentContext;
            ConsumeCredit(ctx, party1, stake);

            BigInteger pactId = (BigInteger)Storage.Get(ctx, PREFIX_PACT_ID) + 1;
            Storage.Put(ctx, PREFIX_PACT_ID, pactId);
            Pact p = new Pact
            {
                Party1 = party1, Party2 = party2, Stake = stake,
                EndTime = (BigInteger)Runtime.Time + durationSeconds * 1000,
                Party1Staked = true, Party2Staked = false, Status = STATUS_PENDING, Breaker = UInt160.Zero,
            };
            Storage.Put(ctx, PactKey(pactId), StdLib.Serialize(p));
            IndexAppend(ctx, party1, pactId);
            IndexAppend(ctx, party2, pactId);
            OnPactCreated(pactId, party1, party2, stake, p.EndTime);
            return pactId;
        }

        public static void SignPact(BigInteger pactId, UInt160 party2)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(party2), "party2 witness required");
            StorageContext ctx = Storage.CurrentContext;
            Pact p = LoadPact(ctx, pactId);
            ExecutionEngine.Assert(p.Status == STATUS_PENDING, "pact not pending");
            ExecutionEngine.Assert(p.Party2 == party2, "only the named partner");
            ConsumeCredit(ctx, party2, p.Stake);
            p.Party2Staked = true;
            p.Status = STATUS_ACTIVE;
            Storage.Put(ctx, PactKey(pactId), StdLib.Serialize(p));
            OnPactSigned(pactId, party2);
        }
        #endregion

        #region Break / Settle
        /// <summary>
        /// Break the pact. If active, the OTHER party receives both stakes (the breaker
        /// forfeits). If still pending (partner never signed), party1 cancels and reclaims.
        /// </summary>
        public static void BreakPact(BigInteger pactId, UInt160 breaker)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(breaker), "breaker witness required");
            StorageContext ctx = Storage.CurrentContext;
            Pact p = LoadPact(ctx, pactId);

            if (p.Status == STATUS_PENDING)
            {
                // Only party1 has staked; party1 cancels and reclaims their stake.
                ExecutionEngine.Assert(breaker == p.Party1, "only party1 can cancel a pending pact");
                p.Status = STATUS_CANCELLED;
                Storage.Put(ctx, PactKey(pactId), StdLib.Serialize(p));
                Transfer(p.Party1, p.Stake);
                OnPactCancelled(pactId, p.Party1, p.Stake);
                return;
            }

            ExecutionEngine.Assert(p.Status == STATUS_ACTIVE, "pact not active");
            ExecutionEngine.Assert(breaker == p.Party1 || breaker == p.Party2, "not a party to this pact");
            UInt160 paidTo = breaker == p.Party1 ? p.Party2 : p.Party1;
            BigInteger pot = p.Stake * 2;
            p.Status = STATUS_BROKEN;
            p.Breaker = breaker;
            Storage.Put(ctx, PactKey(pactId), StdLib.Serialize(p));
            Transfer(paidTo, pot);
            OnPactBroken(pactId, breaker, paidTo, pot);
        }

        /// <summary>
        /// Permissionless: after expiry, an honored (unbroken) active pact refunds both
        /// parties their stake.
        /// </summary>
        public static void SettlePact(BigInteger pactId)
        {
            StorageContext ctx = Storage.CurrentContext;
            Pact p = LoadPact(ctx, pactId);
            ExecutionEngine.Assert(p.Status == STATUS_ACTIVE, "pact not active");
            ExecutionEngine.Assert((BigInteger)Runtime.Time >= p.EndTime, "not yet expired");
            p.Status = STATUS_SETTLED;
            Storage.Put(ctx, PactKey(pactId), StdLib.Serialize(p));
            Transfer(p.Party1, p.Stake);
            Transfer(p.Party2, p.Stake);
            OnPactSettled(pactId, p.Stake);
        }
        #endregion

        #region Read-only
        [Safe]
        public static BigInteger LastPactId() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PACT_ID);

        [Safe]
        public static BigInteger CreditOf(UInt160 who) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_CREDIT, (byte[])who));

        [Safe]
        public static Map<string, object> GetPact(BigInteger pactId)
        {
            Pact p = LoadPact(Storage.CurrentContext, pactId);
            Map<string, object> r = new Map<string, object>();
            r["id"] = pactId; r["party1"] = p.Party1; r["party2"] = p.Party2; r["stake"] = p.Stake;
            r["endTime"] = p.EndTime; r["party1Staked"] = p.Party1Staked; r["party2Staked"] = p.Party2Staked;
            r["status"] = p.Status; r["breaker"] = p.Breaker;
            return r;
        }

        [Safe]
        public static BigInteger PartyPactCount(UInt160 who) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_PARTY_CNT, (byte[])who));

        [Safe]
        public static BigInteger[] GetPartyPacts(UInt160 who, BigInteger offset, BigInteger limit)
        {
            StorageContext ctx = Storage.CurrentContext;
            BigInteger n = (BigInteger)Storage.Get(ctx, Helper.Concat(PREFIX_PARTY_CNT, (byte[])who));
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
                result[(int)idx] = (BigInteger)Storage.Get(ctx, Helper.Concat(Helper.Concat(PREFIX_PARTY_ITEM, (byte[])who), (byte[])(ByteString)i));
                idx += 1;
            }
            return result;
        }
        #endregion

        #region Internal
        private static void Transfer(UInt160 to, BigInteger amount)
        {
            if (amount <= 0) return;
            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, to, amount, "" });
            ExecutionEngine.Assert(ok, "transfer failed");
        }
        private static Pact LoadPact(StorageContext ctx, BigInteger pactId)
        {
            ByteString raw = Storage.Get(ctx, PactKey(pactId));
            ExecutionEngine.Assert(raw is not null, "pact not found");
            return (Pact)StdLib.Deserialize(raw);
        }
        private static byte[] PactKey(BigInteger id) => Helper.Concat(PREFIX_PACT, (byte[])(ByteString)id);
        private static void IndexAppend(StorageContext ctx, UInt160 who, BigInteger pactId)
        {
            byte[] cntKey = Helper.Concat(PREFIX_PARTY_CNT, (byte[])who);
            BigInteger n = (BigInteger)Storage.Get(ctx, cntKey) + 1;
            Storage.Put(ctx, cntKey, n);
            Storage.Put(ctx, Helper.Concat(Helper.Concat(PREFIX_PARTY_ITEM, (byte[])who), (byte[])(ByteString)n), pactId);
        }
        #endregion
    }
}
