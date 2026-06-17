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
    /// MiniAppTimeCapsule — self-contained on-chain time-lock vault (NO oracle).
    ///
    /// WHY: the app previously routed bury/reveal/fish through the OS escrow/payment
    /// kernel, which never actually held the capsule's GAS or moved the fishing fee.
    /// This contract is the authoritative implementation as a REFUNDABLE VAULT:
    /// - bury() locks the owner's GAS together with a content hash until an unlock
    ///   time; the funds are the owner's, held in escrow by this contract.
    /// - reveal() after the unlock time returns the locked GAS to the owner ATOMICALLY
    ///   and marks the capsule opened.
    /// - fish() lets another user pay a discovery fee on a PUBLIC, unrevealed capsule;
    ///   the fee is credited to the capsule owner's fish-revenue balance, which the
    ///   owner pulls out with withdrawFishRevenue().
    /// No external settler, no pending state.
    ///
    /// SAFETY:
    /// - GAS only; amounts in BASE UNITS (1 GAS = 100_000_000).
    /// - Deposit-then-bury: GAS sent with memo "miniapp-timecapsule:bury" credits the
    ///   sender; bury() consumes that credit as the locked amount, so a capsule is
    ///   always fully backed.
    /// - fish is a one-shot GAS transfer with memo "miniapp-timecapsule:fish:<id>".
    ///   OnNEP17Payment is credit-only: it validates the conditions (public, not
    ///   revealed, not yet fished, fisher != owner), marks the capsule fished and
    ///   credits the fee to the owner's fish-revenue ledger. The owner later pulls the
    ///   accrued fees with withdrawFishRevenue(); the deposit callback never performs an
    ///   outbound transfer, avoiding reentrancy surface and TestEngine host crashes.
    /// - Checks-effects-interactions: every direct withdrawal debits its ledger before
    ///   transferring; a failed transfer asserts and reverts the whole atomic
    ///   invocation. reveal() is guarded by the Revealed flag so the deposit can never
    ///   be withdrawn twice.
    /// </summary>
    [DisplayName("MiniAppTimeCapsule")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Self-contained on-chain time-lock vault: bury locks GAS until an unlock time, reveal returns it, fishing fee tips the owner — no oracle.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")] // GAS
    public partial class MiniAppTimeCapsule : SmartContract
    {
        #region Constants
        private const long MIN_DURATION_SECONDS = 1;            // contract floor; UI enforces >= 1 day
        private const long MAX_DURATION_SECONDS = 3650L * 86400; // 10 years
        private const long MIN_FISH_FEE = 1_000_000;           // 0.01 GAS
        private const int MAX_CONTENT_HASH = 128;
        private const string BURY_MEMO = "miniapp-timecapsule:bury";
        private const string FISH_MEMO_PREFIX = "miniapp-timecapsule:fish:";
        #endregion

        #region Storage prefixes
        private static readonly byte[] PREFIX_OWNER = new byte[] { 0x01 };         // contract owner (deployer)
        private static readonly byte[] PREFIX_CAP_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_CAP = new byte[] { 0x11 };          // + capsuleId -> Capsule
        private static readonly byte[] PREFIX_CREDIT = new byte[] { 0x12 };       // + owner -> GAS credit
        private static readonly byte[] PREFIX_OWNER_CNT = new byte[] { 0x13 };    // + owner -> count
        private static readonly byte[] PREFIX_OWNER_ITEM = new byte[] { 0x14 };   // + owner + seq -> capsuleId
        private static readonly byte[] PREFIX_FISH_REV = new byte[] { 0x15 };     // + owner -> accrued fish fees
        #endregion

        #region Events
        [DisplayName("Credited")]
        public static event Action<UInt160, BigInteger, BigInteger> OnCredited; // from, amount, balance
        [DisplayName("Buried")]
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger, bool> OnBuried; // id, owner, amount, unlockTime, isPublic
        [DisplayName("Revealed")]
        public static event Action<BigInteger, UInt160, BigInteger> OnRevealed; // id, owner, amount
        [DisplayName("Fished")]
        public static event Action<BigInteger, UInt160, UInt160, BigInteger> OnFished; // id, fisher, owner, fee
        [DisplayName("CreditWithdrawn")]
        public static event Action<UInt160, BigInteger> OnCreditWithdrawn; // account, amount
        [DisplayName("FishRevenueWithdrawn")]
        public static event Action<UInt160, BigInteger> OnFishRevenueWithdrawn; // owner, amount
        #endregion

        #region Types
        public struct Capsule
        {
            public UInt160 Owner;
            public ByteString ContentHash;
            public BigInteger UnlockTime;  // ms
            public bool IsPublic;
            public BigInteger Category;
            public bool Revealed;
            public BigInteger Amount;      // locked GAS base units
            public bool Fished;
        }
        #endregion

        #region Deposit + fish (NEP-17 entry)
        /// <summary>
        /// - memo "miniapp-timecapsule:bury" credits the sender's prepaid balance (bury consumes it).
        /// - memo "miniapp-timecapsule:fish:&lt;id&gt;" pays a discovery fee that is credited to
        ///   the public capsule owner's fish-revenue balance (pulled via withdrawFishRevenue()).
        ///
        /// Credit-only by design: this callback never performs an outbound transfer; it
        /// only validates, writes storage and credits ledgers.
        /// </summary>
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "only GAS accepted");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(data is not null, "memo required");
            string memo = (string)data;

            StorageContext ctx = Storage.CurrentContext;
            if (memo == BURY_MEMO)
            {
                byte[] key = Helper.Concat(PREFIX_CREDIT, (byte[])from);
                BigInteger bal = (BigInteger)Storage.Get(ctx, key) + amount;
                Storage.Put(ctx, key, bal);
                OnCredited(from, amount, bal);
                return;
            }
            if (memo.StartsWith(FISH_MEMO_PREFIX))
            {
                ExecutionEngine.Assert(amount >= MIN_FISH_FEE, "fee below minimum");
                BigInteger capsuleId = StdLib.Atoi(memo.Substring(FISH_MEMO_PREFIX.Length), 10);
                Capsule c = LoadCapsule(ctx, capsuleId);
                ExecutionEngine.Assert(c.IsPublic, "capsule not public");
                ExecutionEngine.Assert(!c.Revealed, "capsule already revealed");
                ExecutionEngine.Assert(!c.Fished, "capsule already fished");
                ExecutionEngine.Assert(from != c.Owner, "cannot fish your own capsule");

                // Effects only: mark the capsule fished and credit the discovery fee to
                // the owner's fish-revenue ledger. No transfer here — the owner pulls
                // the accrued fees with withdrawFishRevenue().
                c.Fished = true;
                Storage.Put(ctx, CapKey(capsuleId), StdLib.Serialize(c));

                byte[] revKey = Helper.Concat(PREFIX_FISH_REV, (byte[])c.Owner);
                BigInteger revBal = (BigInteger)Storage.Get(ctx, revKey) + amount;
                Storage.Put(ctx, revKey, revBal);

                OnFished(capsuleId, from, c.Owner, amount);
                return;
            }
            ExecutionEngine.Assert(false, "invalid memo");
        }
        #endregion

        #region Bury
        /// <summary>
        /// Lock `amount` GAS (from the owner's prepaid credit) with a content hash
        /// until now + durationSeconds. Returns the new capsule id.
        /// </summary>
        public static BigInteger Bury(UInt160 owner, ByteString contentHash, BigInteger durationSeconds, bool isPublic, BigInteger category, BigInteger amount)
        {
            ExecutionEngine.Assert(owner is not null && owner.IsValid && !owner.IsZero, "invalid owner");
            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "owner witness required");
            ExecutionEngine.Assert(contentHash is not null && contentHash.Length > 0 && contentHash.Length <= MAX_CONTENT_HASH, "invalid content hash");
            ExecutionEngine.Assert(durationSeconds >= MIN_DURATION_SECONDS && durationSeconds <= MAX_DURATION_SECONDS, "duration out of range");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            StorageContext ctx = Storage.CurrentContext;
            byte[] creditKey = Helper.Concat(PREFIX_CREDIT, (byte[])owner);
            BigInteger credit = (BigInteger)Storage.Get(ctx, creditKey);
            ExecutionEngine.Assert(credit >= amount, "insufficient deposit credit");
            BigInteger nextCredit = credit - amount;
            if (nextCredit == 0) Storage.Delete(ctx, creditKey); else Storage.Put(ctx, creditKey, nextCredit);

            BigInteger capsuleId = (BigInteger)Storage.Get(ctx, PREFIX_CAP_ID) + 1;
            Storage.Put(ctx, PREFIX_CAP_ID, capsuleId);

            Capsule c = new Capsule
            {
                Owner = owner,
                ContentHash = contentHash,
                UnlockTime = (BigInteger)Runtime.Time + durationSeconds * 1000,
                IsPublic = isPublic,
                Category = category,
                Revealed = false,
                Amount = amount,
                Fished = false,
            };
            Storage.Put(ctx, CapKey(capsuleId), StdLib.Serialize(c));
            IndexAppend(ctx, owner, capsuleId);

            OnBuried(capsuleId, owner, amount, c.UnlockTime, isPublic);
            return capsuleId;
        }
        #endregion

        #region Reveal
        /// <summary>
        /// After the unlock time, the owner reveals the capsule and the locked GAS is
        /// returned to them.
        /// </summary>
        public static BigInteger Reveal(UInt160 owner, BigInteger capsuleId)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "owner witness required");
            StorageContext ctx = Storage.CurrentContext;
            Capsule c = LoadCapsule(ctx, capsuleId);
            ExecutionEngine.Assert(c.Owner == owner, "only owner");
            ExecutionEngine.Assert(!c.Revealed, "already revealed");
            ExecutionEngine.Assert((BigInteger)Runtime.Time >= c.UnlockTime, "not yet unlocked");

            BigInteger amount = c.Amount;
            c.Revealed = true;
            Storage.Put(ctx, CapKey(capsuleId), StdLib.Serialize(c));

            if (amount > 0)
            {
                bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                    new object[] { Runtime.ExecutingScriptHash, owner, amount, "" });
                ExecutionEngine.Assert(ok, "refund transfer failed");
            }
            OnRevealed(capsuleId, owner, amount);
            return amount;
        }
        #endregion

        #region Withdraw credit
        /// <summary>Reclaim any unused prepaid bury-credit back to the sender.</summary>
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

        #region Withdraw fish revenue
        /// <summary>
        /// Pull the discovery fees accrued to `owner` from other users fishing their
        /// public capsules. Witness-gated; checks-effects-interactions (the ledger is
        /// debited before the transfer).
        /// </summary>
        public static BigInteger WithdrawFishRevenue(UInt160 owner)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "owner witness required");
            StorageContext ctx = Storage.CurrentContext;
            byte[] key = Helper.Concat(PREFIX_FISH_REV, (byte[])owner);
            BigInteger revenue = (BigInteger)Storage.Get(ctx, key);
            ExecutionEngine.Assert(revenue > 0, "no fish revenue");
            Storage.Delete(ctx, key);
            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, owner, revenue, "" });
            ExecutionEngine.Assert(ok, "fish revenue transfer failed");
            OnFishRevenueWithdrawn(owner, revenue);
            return revenue;
        }
        #endregion

        #region Internal
        private static Capsule LoadCapsule(StorageContext ctx, BigInteger capsuleId)
        {
            ByteString raw = Storage.Get(ctx, CapKey(capsuleId));
            ExecutionEngine.Assert(raw is not null, "capsule not found");
            return (Capsule)StdLib.Deserialize(raw);
        }
        private static byte[] CapKey(BigInteger id) => Helper.Concat(PREFIX_CAP, (byte[])(ByteString)id);
        private static void IndexAppend(StorageContext ctx, UInt160 owner, BigInteger capsuleId)
        {
            byte[] cntKey = Helper.Concat(PREFIX_OWNER_CNT, (byte[])owner);
            BigInteger n = (BigInteger)Storage.Get(ctx, cntKey) + 1;
            Storage.Put(ctx, cntKey, n);
            byte[] itemKey = Helper.Concat(Helper.Concat(PREFIX_OWNER_ITEM, (byte[])owner), (byte[])(ByteString)n);
            Storage.Put(ctx, itemKey, capsuleId);
        }
        #endregion
    }
}
