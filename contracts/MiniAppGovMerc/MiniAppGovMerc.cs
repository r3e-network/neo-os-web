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
    /// MiniAppGovMerc — self-contained on-chain "mercenary governance" market (NO oracle / OS kernel).
    ///
    /// WHY: the app previously kept NEO deposits and per-epoch GAS bids in OS
    /// StorageProxy/PaymentProxy that no contract enforced, and "settlement" only wrote
    /// a record — bid GAS entered a vault and was never paid out or refunded (a latent
    /// strand). This contract makes staking, the epoch auction, the payout, and the
    /// refunds authoritative on-chain.
    ///
    /// MODEL — a two-sided market:
    ///   * STAKERS lock NEO (governance power). NEO sent with memo "govmerc:stake"
    ///     credits the staker. Stakers earn the auction revenue pro-rata.
    ///   * MERCENARIES bid GAS each epoch for the "router" title. GAS sent with memo
    ///     "govmerc:bid" credits a bid balance; bid() raises the sender's epoch bid.
    ///   * settleEpoch() resolves the live epoch: the highest bidder wins (recorded), the
    ///     winner's bid is distributed pro-rata to stakers, the epoch advances. Losing
    ///     bidders pull-refund their bid (reclaimBid) — no unbounded loop at settle.
    ///   * Stakers claim accrued GAS rewards (claimRewards); unused bid credit is
    ///     reclaimable (Withdraw). No GAS or NEO is strandable.
    ///
    /// Rewards use the standard accumulator pattern: accRewardPerShare is GAS-per-staked-
    /// NEO scaled by SCALE; a staker's reward debt is snapshotted on every stake change so
    /// distributions are split exactly by stake-share. Floor division can only UNDER-
    /// distribute (dust stays in the contract), never over-distribute.
    ///
    /// JIT-STAKING GUARD (MP-G-02): the winning bid is split only across stake that was
    /// present BEFORE the live epoch's bidding window opened (the epoch's first bid).
    /// NEO staked once the window is open is parked in a per-user PENDING bucket tagged
    /// with the next epoch and is NOT counted in the eligible total that settle divides
    /// by, so it earns nothing from the current epoch's bid. Pending stake folds into the
    /// eligible balance on the staker's next interaction once the epoch advances. This
    /// stops an attacker from staking large after the bid is locked in, snatching a
    /// pro-rata cut at settle, then unstaking — siphoning revenue from long-term stakers.
    /// The accRewardPerShare / rewardDebt math over eligible stake is unchanged.
    /// </summary>
    [DisplayName("MiniAppGovMerc")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Self-contained on-chain mercenary governance market: stake NEO, bid GAS per epoch, winner's bid paid pro-rata to stakers — no oracle.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")] // GAS
    [ContractPermission("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", "transfer")] // NEO
    public partial class MiniAppGovMerc : SmartContract
    {
        #region Constants
        private const long MIN_BID = 1_00000000;        // 1 GAS (base units)
        private const long MIN_STAKE = 1;               // 1 NEO (integer)
        private static readonly BigInteger SCALE = 1_000_000_000_000; // 1e12 reward accumulator scale
        private const string STAKE_MEMO = "govmerc:stake";
        private const string BID_MEMO = "govmerc:bid";
        // Tri-repo review MP-D-01: the first bid of an epoch opens a fixed bidding
        // window; settle is only valid once the window has elapsed, so a sniper can
        // no longer bid MIN_BID and settle in the same block before anyone can
        // counter-bid (and a flash-staker cannot pick the settle block at will).
        // Compile-time const like BurnLeague.SEASON_DURATION — short enough for
        // live validation runs; lengthen for slower production auctions if wanted.
        private const long EPOCH_DURATION_MS = 300_000; // 5 minutes
        #endregion

        #region Storage prefixes
        private static readonly byte[] PREFIX_OWNER = new byte[] { 0x01 };        // contract owner (deployer), gates Update
        private static readonly byte[] PREFIX_STAKED = new byte[] { 0x10 };       // + user -> ELIGIBLE NEO staked (earns the live epoch)
        private static readonly byte[] PREFIX_TOTAL_STAKED = new byte[] { 0x11 }; // total NEO held (eligible + pending)
        private static readonly byte[] PREFIX_ACC_RPS = new byte[] { 0x12 };      // accRewardPerShare (scaled)
        private static readonly byte[] PREFIX_REWARD_DEBT = new byte[] { 0x13 };  // + user -> reward debt (over eligible stake)
        private static readonly byte[] PREFIX_PENDING = new byte[] { 0x14 };      // + user -> banked claimable GAS
        private static readonly byte[] PREFIX_GAS_CREDIT = new byte[] { 0x15 };   // + user -> GAS bid credit
        private static readonly byte[] PREFIX_EPOCH = new byte[] { 0x16 };        // current epoch
        private static readonly byte[] PREFIX_BID = new byte[] { 0x17 };          // + epoch + bidder -> bid
        private static readonly byte[] PREFIX_HIGH_BIDDER = new byte[] { 0x18 };  // + epoch -> top bidder
        private static readonly byte[] PREFIX_HIGH_BID = new byte[] { 0x19 };     // + epoch -> top bid
        private static readonly byte[] PREFIX_SETTLE_WINNER = new byte[] { 0x1a };// + epoch -> winner
        private static readonly byte[] PREFIX_SETTLE_AMOUNT = new byte[] { 0x1b };// + epoch -> winning bid
        private static readonly byte[] PREFIX_EPOCH_END = new byte[] { 0x1c };    // + epoch -> bidding deadline (ms)
        private static readonly byte[] PREFIX_ELIGIBLE_STAKED = new byte[] { 0x1d };  // total ELIGIBLE NEO (the settle divisor)
        private static readonly byte[] PREFIX_PENDING_STAKE = new byte[] { 0x1e };    // + user -> NEO staked after the live window opened
        private static readonly byte[] PREFIX_PENDING_EPOCH = new byte[] { 0x1f };    // + user -> epoch from which PENDING_STAKE becomes eligible
        #endregion

        #region Lifecycle
        /// <summary>
        /// Capture the deployer as the contract owner on first deployment. The owner is
        /// never reset on update so an upgrade cannot silently transfer control.
        /// </summary>
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_OWNER, (ByteString)(byte[])Runtime.Transaction.Sender);
        }

        /// <summary>Owner-gated, instant contract upgrade (no timelock).</summary>
        public static void Update(ByteString nef, string manifest)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(GetOwner()), "unauthorized");
            ContractManagement.Update(nef, manifest, new object[0]);
        }
        #endregion

        #region Deposit (NEO stake / GAS bid credit)
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(data is not null, "memo required");
            UInt160 caller = Runtime.CallingScriptHash;
            StorageContext ctx = Storage.CurrentContext;

            if (caller == NEO.Hash)
            {
                ExecutionEngine.Assert((string)data == STAKE_MEMO, "invalid memo");
                StakeInternal(ctx, from, amount);
            }
            else if (caller == GAS.Hash)
            {
                ExecutionEngine.Assert((string)data == BID_MEMO, "invalid memo");
                byte[] key = Helper.Concat(PREFIX_GAS_CREDIT, (byte[])from);
                BigInteger bal = (BigInteger)Storage.Get(ctx, key) + amount;
                Storage.Put(ctx, key, bal);
                OnCredited(from, amount, bal);
            }
            else
            {
                ExecutionEngine.Assert(false, "only NEO (stake) or GAS (bid) accepted");
            }
        }
        #endregion

        // Staking (StakeInternal / WithdrawStake / pending-eligibility) lives in
        // MiniAppGovMerc.Staking.cs.

        #region Rewards accounting
        // Bank a staker's earned-but-unclaimed rewards into PENDING. Does NOT touch
        // reward debt — the caller resets it after any stake change.
        private static void Harvest(StorageContext ctx, UInt160 user)
        {
            BigInteger staked = (BigInteger)Storage.Get(ctx, Helper.Concat(PREFIX_STAKED, (byte[])user));
            if (staked <= 0) return;
            BigInteger accRps = (BigInteger)Storage.Get(ctx, PREFIX_ACC_RPS);
            BigInteger debt = (BigInteger)Storage.Get(ctx, Helper.Concat(PREFIX_REWARD_DEBT, (byte[])user));
            BigInteger earned = staked * accRps / SCALE - debt;
            if (earned > 0)
            {
                byte[] pKey = Helper.Concat(PREFIX_PENDING, (byte[])user);
                Storage.Put(ctx, pKey, (BigInteger)Storage.Get(ctx, pKey) + earned);
            }
        }

        private static void SetRewardDebt(StorageContext ctx, UInt160 user, BigInteger staked)
        {
            BigInteger accRps = (BigInteger)Storage.Get(ctx, PREFIX_ACC_RPS);
            Storage.Put(ctx, Helper.Concat(PREFIX_REWARD_DEBT, (byte[])user), staked * accRps / SCALE);
        }

        /// <summary>Claim accrued GAS rewards from auction revenue.</summary>
        public static BigInteger ClaimRewards(UInt160 user)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(user), "user witness required");
            StorageContext ctx = Storage.CurrentContext;
            ActivatePending(ctx, user);
            Harvest(ctx, user);
            byte[] sKey = Helper.Concat(PREFIX_STAKED, (byte[])user);
            SetRewardDebt(ctx, user, (BigInteger)Storage.Get(ctx, sKey));

            byte[] pKey = Helper.Concat(PREFIX_PENDING, (byte[])user);
            BigInteger amount = (BigInteger)Storage.Get(ctx, pKey);
            ExecutionEngine.Assert(amount > 0, "no rewards");
            Storage.Delete(ctx, pKey);

            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, user, amount, "" });
            ExecutionEngine.Assert(ok, "reward transfer failed");
            OnRewardsClaimed(user, amount);
            return amount;
        }
        #endregion

        #region Bidding
        /// <summary>
        /// Raise the caller's bid in the current epoch by `addAmount`, drawn from their
        /// GAS bid credit. The first bid must meet MIN_BID. Returns the new total bid.
        /// </summary>
        public static BigInteger Bid(UInt160 bidder, BigInteger addAmount)
        {
            ExecutionEngine.Assert(bidder is not null && bidder.IsValid && !bidder.IsZero, "invalid bidder");
            ExecutionEngine.Assert(Runtime.CheckWitness(bidder), "bidder witness required");
            ExecutionEngine.Assert(addAmount > 0, "amount must be > 0");

            StorageContext ctx = Storage.CurrentContext;
            BigInteger epoch = (BigInteger)Storage.Get(ctx, PREFIX_EPOCH);

            // MP-D-01: the first bid opens the epoch's bidding window; later bids
            // must land strictly before the deadline. Settle only runs after it.
            byte[] endKey = Helper.Concat(PREFIX_EPOCH_END, (byte[])(ByteString)epoch);
            BigInteger deadline = (BigInteger)Storage.Get(ctx, endKey);
            if (deadline == 0)
            {
                deadline = Runtime.Time + EPOCH_DURATION_MS;
                Storage.Put(ctx, endKey, deadline);
                OnEpochOpened(epoch, deadline);
            }
            else
            {
                ExecutionEngine.Assert(Runtime.Time < deadline, "bidding closed");
            }

            byte[] creditKey = Helper.Concat(PREFIX_GAS_CREDIT, (byte[])bidder);
            BigInteger credit = (BigInteger)Storage.Get(ctx, creditKey);
            ExecutionEngine.Assert(credit >= addAmount, "insufficient bid credit");

            byte[] bidKey = Helper.Concat(Helper.Concat(PREFIX_BID, (byte[])(ByteString)epoch), (byte[])bidder);
            BigInteger current = (BigInteger)Storage.Get(ctx, bidKey);
            BigInteger newTotal = current + addAmount;
            if (current == 0) ExecutionEngine.Assert(newTotal >= MIN_BID, "first bid below minimum");

            BigInteger nextCredit = credit - addAmount;
            if (nextCredit == 0) Storage.Delete(ctx, creditKey); else Storage.Put(ctx, creditKey, nextCredit);
            Storage.Put(ctx, bidKey, newTotal);

            byte[] highBidKey = Helper.Concat(PREFIX_HIGH_BID, (byte[])(ByteString)epoch);
            if (newTotal > (BigInteger)Storage.Get(ctx, highBidKey))
            {
                Storage.Put(ctx, highBidKey, newTotal);
                Storage.Put(ctx, Helper.Concat(PREFIX_HIGH_BIDDER, (byte[])(ByteString)epoch), bidder);
            }

            OnBidPlaced(epoch, bidder, newTotal);
            return newTotal;
        }
        #endregion

        // Settlement (SettleEpoch / ReclaimBid) lives in MiniAppGovMerc.Settlement.cs.
    }
}
