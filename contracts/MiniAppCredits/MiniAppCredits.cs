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
    /// MiniAppCredits — platform credit system v2: on-chain purchases, DB-first
    /// spends, batched on-chain settlement checkpoints.
    ///
    /// CUSTODY MODEL — HONEST TRADE-OFF (read before integrating):
    ///   * BUY (on-chain): a user sends GAS to this contract with the buy memo.
    ///     Credits mint at the FIXED integer rate of 50 credits per GAS
    ///     (1 credit = 0.02 GAS = 2_000_000 base units). The platform indexer
    ///     watches CreditsPurchased and credits the interactive DB balance once
    ///     the transfer confirms.
    ///   * SPEND (off-chain): apps debit the platform ledger endpoint instantly
    ///     and feelessly — NO transaction and NO fee here; an idempotency key on
    ///     the endpoint prevents double-spends. Between settlements the DB is the
    ///     authoritative interactive balance. That IS a custody concession: the
    ///     platform operator could misreport spends until the next checkpoint.
    ///   * SETTLE (on-chain, batched): the platform batcher periodically posts
    ///     each user's NET SPEND since the last epoch (PostSettlement). The chain
    ///     is therefore a trailing, auditable checkpoint — purchases are provable
    ///     in real time, spends are provable with one-epoch lag.
    ///   * EXIT (user trust mitigation): a user can always burn their LAST
    ///     SETTLED on-chain balance back to GAS at the same fixed rate (Exit),
    ///     even while the contract is paused. Known limit: spends made since the
    ///     last settlement are not yet reflected on-chain, so a user can exit
    ///     credits the DB already debited; the next settlement clamps their
    ///     on-chain balance at zero and the platform absorbs the gap (mitigated
    ///     by settling frequently). Promotional credits granted off-chain are
    ///     DB-only and NEVER exitable — only purchased-and-settled credits are
    ///     GAS-backed here.
    ///
    /// SOLVENCY INVARIANT: heldGas >= TotalSettledCredits * GAS_PER_CREDIT at
    /// all times. Purchases add the full GAS amount in; Exit removes exactly the
    /// fixed-rate value; WithdrawGas (owner) may only take the surplus (settled
    /// spend revenue plus sub-credit purchase remainders), so every settled
    /// credit stays exitable.
    ///
    /// PURCHASE ROUNDING: credits = floor(amount * 50 / 1e8). Amounts below one
    /// credit (0.02 GAS) are rejected as dust; a remainder above a whole credit
    /// mints nothing and stays as owner surplus. The frontend sends exact
    /// multiples; the CreditsPurchased event carries the exact minted credits so
    /// the indexer never has to re-derive the rate.
    ///
    /// SAFETY: OnNEP17Payment is CREDIT-ONLY (no outbound transfer, per the
    /// platform money-contract convention); all transfers live in direct,
    /// witness-gated methods (Exit / WithdrawGas) with checks-effects-
    /// interactions ordering.
    /// </summary>
    [DisplayName("MiniAppCredits")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Platform credit ledger: GAS purchases mint credits at a fixed 50/GAS rate; off-chain spends checkpoint on-chain via operator-signed settlement epochs; users can always exit their last settled balance back to GAS.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")] // GAS
    public partial class MiniAppCredits : SmartContract
    {
        #region Constants
        /// <summary>Fixed integer purchase/exit rate: 1 GAS mints 50 credits.</summary>
        public const long CREDITS_PER_GAS = 50;
        /// <summary>GAS base units backing one credit: 1e8 / 50 = 0.02 GAS.</summary>
        public const long GAS_PER_CREDIT = 2_000_000;
        /// <summary>Max (user, delta) pairs per settlement call — see Settlement.</summary>
        private const int MAX_BATCH = 500;
        /// <summary>Required transfer memo so stray GAS sends cannot mint credits.</summary>
        private const string BUY_MEMO = "miniapp-credits:buy";
        #endregion

        #region Storage prefixes
        private static readonly byte[] PREFIX_OWNER = new byte[] { 0x10 };           // deployer, upgrade + admin authority
        private static readonly byte[] PREFIX_SETTLER = new byte[] { 0x11 };         // designated settlement operator key
        private static readonly byte[] PREFIX_PAUSED = new byte[] { 0x12 };          // 1 = purchases + settlements blocked
        private static readonly byte[] PREFIX_EPOCH = new byte[] { 0x13 };           // last settled epoch (starts at 0)
        private static readonly byte[] PREFIX_BALANCE = new byte[] { 0x14 };         // + user -> settled credit balance
        private static readonly byte[] PREFIX_TOTAL_GAS = new byte[] { 0x15 };       // lifetime purchase GAS (monotonic)
        private static readonly byte[] PREFIX_TOTAL_CREDITS = new byte[] { 0x16 };   // sum of all settled balances (exit liability)
        private static readonly byte[] PREFIX_HELD_GAS = new byte[] { 0x17 };        // GAS held: purchases - exits - withdrawals
        private static readonly byte[] PREFIX_LAST_SETTLED_AT = new byte[] { 0x18 }; // Runtime.Time of the latest settlement
        #endregion

        #region Events
        [DisplayName("CreditsPurchased")]
        public static event Action<UInt160, BigInteger, BigInteger> OnCreditsPurchased; // user, gasAmount, credits
        [DisplayName("SettlementPosted")]
        public static event Action<BigInteger, BigInteger, BigInteger> OnSettlementPosted; // epoch, count, totalDebited
        [DisplayName("CreditsExited")]
        public static event Action<UInt160, BigInteger, BigInteger> OnCreditsExited; // user, credits, gasAmount
        [DisplayName("SettlerChanged")]
        public static event Action<UInt160> OnSettlerChanged; // settler
        [DisplayName("PausedChanged")]
        public static event Action<bool> OnPausedChanged; // paused
        [DisplayName("GasWithdrawn")]
        public static event Action<UInt160, BigInteger> OnGasWithdrawn; // to, amount
        #endregion

        #region Lifecycle
        /// <summary>
        /// Captures the deployer as the contract owner on first deployment. The
        /// owner is never reset on update, so an upgrade cannot hijack control.
        /// </summary>
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_OWNER, Runtime.Transaction.Sender);
        }
        #endregion

        #region Purchase — CREDIT ONLY
        /// <summary>
        /// GAS with memo "miniapp-credits:buy" mints floor(amount / 0.02 GAS)
        /// credits to the sender's settled on-chain balance and emits
        /// CreditsPurchased for the platform indexer.
        ///
        /// The pause gate runs FIRST: while paused, a purchase transfer FAULTs
        /// inside this callback, the whole transfer reverts, and the sender's
        /// GAS never leaves their wallet. CREDIT ONLY: no outbound transfer
        /// happens here — exits and withdrawals are direct, witness-gated
        /// methods, per the platform money-contract convention.
        /// </summary>
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            ExecutionEngine.Assert(!IsPaused(), "contract paused");
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "only GAS accepted");
            ExecutionEngine.Assert(from is not null && from.IsValid && !from.IsZero, "invalid sender");
            ExecutionEngine.Assert(data is not null, "memo required");
            ExecutionEngine.Assert((string)data == BUY_MEMO, "invalid memo");

            // Fixed integer rate: floor(amount * 50 / 1e8) == amount / GAS_PER_CREDIT.
            BigInteger credits = amount / GAS_PER_CREDIT;
            ExecutionEngine.Assert(credits >= 1, "dust: below one credit");

            StorageContext ctx = Storage.CurrentContext;
            byte[] key = BalanceKey(from);
            Storage.Put(ctx, key, (BigInteger)Storage.Get(ctx, key) + credits);
            Storage.Put(ctx, PREFIX_TOTAL_GAS, (BigInteger)Storage.Get(ctx, PREFIX_TOTAL_GAS) + amount);
            Storage.Put(ctx, PREFIX_TOTAL_CREDITS, (BigInteger)Storage.Get(ctx, PREFIX_TOTAL_CREDITS) + credits);
            Storage.Put(ctx, PREFIX_HELD_GAS, (BigInteger)Storage.Get(ctx, PREFIX_HELD_GAS) + amount);

            OnCreditsPurchased(from, amount, credits);
        }
        #endregion

        #region Internal
        private static byte[] BalanceKey(UInt160 user) => Helper.Concat(PREFIX_BALANCE, (byte[])user);
        #endregion
    }
}
