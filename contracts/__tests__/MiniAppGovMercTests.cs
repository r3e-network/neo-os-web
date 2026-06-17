using System;
using System.IO;
using System.Numerics;
using Neo;
using Neo.Network.P2P.Payloads;
using Neo.SmartContract;
using Neo.SmartContract.Manifest;
using Neo.SmartContract.Testing;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public abstract class GovMercContract : SmartContract
    {
        protected GovMercContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract BigInteger? bid(UInt160 bidder, BigInteger addAmount);
        public abstract void settleEpoch();
        public abstract BigInteger? claimRewards(UInt160 user);
        public abstract BigInteger? reclaimBid(UInt160 bidder, BigInteger epoch);
        public abstract BigInteger? withdraw(UInt160 account);
        public abstract void withdrawStake(UInt160 user, BigInteger amount);
        public abstract BigInteger? totalStaked();
        public abstract BigInteger? stakeOf(UInt160 user);
        public abstract BigInteger? currentEpoch();
        public abstract BigInteger? highestBid(BigInteger epoch);
        public abstract UInt160 highestBidder(BigInteger epoch);
        public abstract BigInteger? pendingRewards(UInt160 user);
        public abstract BigInteger? gasCreditOf(UInt160 user);
        public abstract BigInteger? bidOf(BigInteger epoch, UInt160 bidder);
        public abstract UInt160 settlementWinner(BigInteger epoch);
        public abstract BigInteger? settlementAmount(BigInteger epoch);
        public abstract BigInteger? epochDuration();
        public abstract BigInteger? epochDeadline(BigInteger epoch);
        public abstract BigInteger? eligibleStaked();
        public abstract BigInteger? eligibleStakeOf(UInt160 user);
        public abstract BigInteger? pendingStakeOf(UInt160 user);
        public abstract BigInteger? pendingStakeEpoch(UInt160 user);
    }

    public class MiniAppGovMercTests
    {
        private static readonly string BuildDir = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "build"));

        private static (NefFile nef, ContractManifest manifest) Load(string name)
        {
            string nefPath = Path.Combine(BuildDir, name + ".nef");
            string manifestPath = Path.Combine(BuildDir, name + ".manifest.json");
            Assert.True(File.Exists(nefPath), $"NEF missing: {nefPath}");
            return (NefFile.Parse(File.ReadAllBytes(nefPath)),
                    ContractManifest.Parse(File.ReadAllText(manifestPath)));
        }

        // Fund an account with NEO + GAS from the genesis committee multisig.
        private static void Fund(TestEngine engine, UInt160 to, BigInteger neo, BigInteger gas)
        {
            UInt160 committee = engine.ValidatorsAddress;
            engine.SetTransactionSigners(committee);
            if (neo > 0) engine.Native.NEO.Transfer(committee, to, neo, null);
            if (gas > 0) engine.Native.GAS.Transfer(committee, to, gas, null);
        }

        // Contract asserts surface as "ABORTMSG is executed. Reason: <text>".
        private static void AssertRevert(string reason, Action act)
        {
            var ex = Assert.ThrowsAny<Exception>(act);
            Assert.Equal($"ABORTMSG is executed. Reason: {reason}", ex.Message);
        }

        // MP-D-01: settle is only valid once the bidding window opened by the
        // epoch's first bid has elapsed; tests jump the persisting block past it.
        private static void AdvancePastDeadline(TestEngine engine, GovMercContract gov)
        {
            engine.PersistingBlock.Advance(TimeSpan.FromMilliseconds((long)(gov.epochDuration() ?? 0) + 1));
        }

        [Fact]
        public void GovMerc_StakeViaNeoTransfer()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppGovMerc");
            var gov = engine.Deploy<GovMercContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            UInt160 committee = engine.ValidatorsAddress;
            Assert.True(engine.Native.NEO.BalanceOf(committee) > 0, "committee should hold genesis NEO");
            Fund(engine, alice, 100, 1_00000000);
            Assert.Equal(new BigInteger(100), engine.Native.NEO.BalanceOf(alice));

            engine.SetTransactionSigners(alice);
            bool? ok = engine.Native.NEO.Transfer(alice, gov.Hash, 100, "govmerc:stake");
            Assert.True(ok == true, "NEO stake transfer should succeed");

            Assert.Equal(new BigInteger(100), gov.totalStaked());
            Assert.Equal(new BigInteger(100), gov.stakeOf(alice));
        }

        [Fact]
        public void GovMerc_FullAuctionAndProRataRewards()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppGovMerc");
            var gov = engine.Deploy<GovMercContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;   // staker 100 NEO
            var bob = TestEngine.GetNewSigner().Account;      // staker 300 NEO
            var carol = TestEngine.GetNewSigner().Account;    // winning bidder 4 GAS
            var dave = TestEngine.GetNewSigner().Account;      // losing bidder 1 GAS

            Fund(engine, alice, 100, 5L * 100000000);
            Fund(engine, bob, 300, 5L * 100000000);
            Fund(engine, carol, 0, 10L * 100000000);
            Fund(engine, dave, 0, 10L * 100000000);

            // Stake: Alice 100, Bob 300 -> totalStaked 400 (shares 25% / 75%)
            engine.SetTransactionSigners(alice);
            engine.Native.NEO.Transfer(alice, gov.Hash, 100, "govmerc:stake");
            engine.SetTransactionSigners(bob);
            engine.Native.NEO.Transfer(bob, gov.Hash, 300, "govmerc:stake");
            Assert.Equal(new BigInteger(400), gov.totalStaked());

            // Bids in epoch 0: Carol deposits 4 GAS credit + bids 4; Dave 1 GAS + bids 1.
            engine.SetTransactionSigners(carol);
            engine.Native.GAS.Transfer(carol, gov.Hash, 4L * 100000000, "govmerc:bid");
            gov.bid(carol, 4L * 100000000);
            engine.SetTransactionSigners(dave);
            engine.Native.GAS.Transfer(dave, gov.Hash, 1L * 100000000, "govmerc:bid");
            gov.bid(dave, 1L * 100000000);

            Assert.Equal(new BigInteger(4L * 100000000), gov.highestBid(0));
            Assert.Equal(carol, gov.highestBidder(0));

            // Settle epoch 0 after the bidding window: Carol wins, her 4 GAS
            // distributed pro-rata to stakers.
            AdvancePastDeadline(engine, gov);
            engine.SetTransactionSigners(carol);
            gov.settleEpoch();
            Assert.Equal(new BigInteger(1), gov.currentEpoch());
            Assert.Equal(carol, gov.settlementWinner(0));

            // Pro-rata: Alice 25% of 4 GAS = 1 GAS, Bob 75% = 3 GAS.
            Assert.Equal(new BigInteger(1L * 100000000), gov.pendingRewards(alice));
            Assert.Equal(new BigInteger(3L * 100000000), gov.pendingRewards(bob));

            // Alice claims 1 GAS, Bob claims 3 GAS.
            engine.SetTransactionSigners(alice);
            Assert.Equal(new BigInteger(1L * 100000000), gov.claimRewards(alice));
            engine.SetTransactionSigners(bob);
            Assert.Equal(new BigInteger(3L * 100000000), gov.claimRewards(bob));
            Assert.Equal(BigInteger.Zero, gov.pendingRewards(alice));

            // Dave (loser) reclaims his 1 GAS bid from settled epoch 0.
            engine.SetTransactionSigners(dave);
            Assert.Equal(new BigInteger(1L * 100000000), gov.reclaimBid(dave, 0));

            // Carol (winner) cannot reclaim her spent bid.
            engine.SetTransactionSigners(carol);
            Assert.ThrowsAny<Exception>(() => gov.reclaimBid(carol, 0));
        }

        // Regression: a pending (window-open) stake must not let already-earned rewards
        // be banked twice. StakeInternal's pending branch Harvests (which banks but does
        // not reset reward debt) and leaves the eligible balance unchanged, so it must
        // re-snapshot the debt; otherwise the next Harvest re-banks the same rewards and
        // the staker can drain the shared pool.
        [Fact]
        public void GovMerc_PendingStakeDoesNotDoubleCountRewards()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppGovMerc");
            var gov = engine.Deploy<GovMercContract>(nef, manifest);

            var mallory = TestEngine.GetNewSigner().Account; // sole staker
            var bidder = TestEngine.GetNewSigner().Account;  // opens the window each epoch
            Fund(engine, mallory, 200, 5L * 100000000);
            Fund(engine, bidder, 0, 20L * 100000000);

            // Mallory stakes 100 NEO before any bid -> eligible for epoch 0.
            engine.SetTransactionSigners(mallory);
            engine.Native.NEO.Transfer(mallory, gov.Hash, 100, "govmerc:stake");

            // Epoch 0: a 4 GAS bid is placed and settled -> Mallory (sole staker) earns 4 GAS.
            engine.SetTransactionSigners(bidder);
            engine.Native.GAS.Transfer(bidder, gov.Hash, 4L * 100000000, "govmerc:bid");
            gov.bid(bidder, 4L * 100000000);
            AdvancePastDeadline(engine, gov);
            gov.settleEpoch();
            Assert.Equal(new BigInteger(1), gov.currentEpoch());
            Assert.Equal(new BigInteger(4L * 100000000), gov.pendingRewards(mallory));

            // Epoch 1: a bid opens the window, THEN Mallory stakes again -> parked pending.
            engine.SetTransactionSigners(bidder);
            engine.Native.GAS.Transfer(bidder, gov.Hash, 1L * 100000000, "govmerc:bid");
            gov.bid(bidder, 1L * 100000000);
            engine.SetTransactionSigners(mallory);
            engine.Native.NEO.Transfer(mallory, gov.Hash, 1, "govmerc:stake");

            // The entitlement is STILL exactly 4 GAS, never 8.
            Assert.Equal(new BigInteger(4L * 100000000), gov.pendingRewards(mallory));
            Assert.Equal(new BigInteger(4L * 100000000), gov.claimRewards(mallory));
            Assert.Equal(BigInteger.Zero, gov.pendingRewards(mallory));
        }

        [Fact]
        public void GovMerc_NoStakersRefundsWinnerAndCreditWithdraw()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppGovMerc");
            var gov = engine.Deploy<GovMercContract>(nef, manifest);

            var carol = TestEngine.GetNewSigner().Account; // only bidder, no stakers exist
            Fund(engine, carol, 0, 10L * 100000000);

            // Deposit 3 GAS credit; bid 2 GAS (1 GAS stays as reclaimable credit).
            engine.SetTransactionSigners(carol);
            engine.Native.GAS.Transfer(carol, gov.Hash, 3L * 100000000, "govmerc:bid");
            gov.bid(carol, 2L * 100000000);
            Assert.Equal(new BigInteger(1L * 100000000), gov.gasCreditOf(carol));

            // Settle with zero stakers: the winner's 2 GAS bid is refunded to credit
            // (nothing distributed) -> credit back to 3 GAS.
            AdvancePastDeadline(engine, gov);
            gov.settleEpoch();
            Assert.Equal(new BigInteger(3L * 100000000), gov.gasCreditOf(carol));

            // Withdraw the full 3 GAS credit.
            Assert.Equal(new BigInteger(3L * 100000000), gov.withdraw(carol));
            Assert.Equal(BigInteger.Zero, gov.gasCreditOf(carol));

            // A first bid below MIN_BID (1 GAS) must revert.
            engine.Native.GAS.Transfer(carol, gov.Hash, 2L * 100000000, "govmerc:bid");
            Assert.ThrowsAny<Exception>(() => gov.bid(carol, 50000000)); // 0.5 GAS < MIN_BID
        }

        [Fact]
        public void GovMerc_WithdrawStakeBanksPendingRewards()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppGovMerc");
            var gov = engine.Deploy<GovMercContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            var carol = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 100, 1_00000000);
            Fund(engine, carol, 0, 10L * 100000000);

            engine.SetTransactionSigners(alice);
            engine.Native.NEO.Transfer(alice, gov.Hash, 100, "govmerc:stake");

            engine.SetTransactionSigners(carol);
            engine.Native.GAS.Transfer(carol, gov.Hash, 2L * 100000000, "govmerc:bid");
            gov.bid(carol, 2L * 100000000);
            AdvancePastDeadline(engine, gov);
            gov.settleEpoch(); // Alice is sole staker -> earns all 2 GAS

            // Withdraw all stake; pending 2 GAS must be banked, then claimable.
            engine.SetTransactionSigners(alice);
            gov.withdrawStake(alice, 100);
            Assert.Equal(BigInteger.Zero, gov.totalStaked());
            Assert.Equal(new BigInteger(2L * 100000000), gov.pendingRewards(alice));
            Assert.Equal(new BigInteger(2L * 100000000), gov.claimRewards(alice));
        }

        // MP-D-01: a mercenary could previously bid MIN_BID and settle in the
        // same block, winning the title (and the reward snapshot) before any
        // competitor could counter-bid. The first bid now opens a fixed bidding
        // window and settle is rejected until it elapses.
        [Fact]
        public void GovMerc_SettleSnipingBeforeDeadlineIsBlocked()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppGovMerc");
            var gov = engine.Deploy<GovMercContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;  // honest staker
            var sniper = TestEngine.GetNewSigner().Account; // bid+settle attacker
            Fund(engine, alice, 100, 1_00000000);
            Fund(engine, sniper, 0, 5L * 100000000);

            engine.SetTransactionSigners(alice);
            engine.Native.NEO.Transfer(alice, gov.Hash, 100, "govmerc:stake");

            // The sniper's first bid opens the epoch's bidding window...
            engine.SetTransactionSigners(sniper);
            engine.Native.GAS.Transfer(sniper, gov.Hash, 1L * 100000000, "govmerc:bid");
            gov.bid(sniper, 1L * 100000000);
            Assert.True((gov.epochDeadline(0) ?? 0) > 0, "first bid should open the bidding window");

            // ...so the same-block settle (the sniping step) must now revert.
            AssertRevert("epoch not ended", () => gov.settleEpoch());
            Assert.Equal(BigInteger.Zero, gov.currentEpoch()); // epoch did not advance

            // Once the window elapses, permissionless settle works as before.
            AdvancePastDeadline(engine, gov);
            gov.settleEpoch();
            Assert.Equal(BigInteger.One, gov.currentEpoch());
            Assert.Equal(sniper, gov.settlementWinner(0));
        }

        [Fact]
        public void GovMerc_LateBidAfterDeadlineIsRejected()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppGovMerc");
            var gov = engine.Deploy<GovMercContract>(nef, manifest);

            var carol = TestEngine.GetNewSigner().Account;
            var dave = TestEngine.GetNewSigner().Account;
            Fund(engine, carol, 0, 5L * 100000000);
            Fund(engine, dave, 0, 5L * 100000000);

            engine.SetTransactionSigners(carol);
            engine.Native.GAS.Transfer(carol, gov.Hash, 2L * 100000000, "govmerc:bid");
            gov.bid(carol, 2L * 100000000);

            // Bids must land strictly before the deadline opened by the first bid.
            AdvancePastDeadline(engine, gov);
            engine.SetTransactionSigners(dave);
            engine.Native.GAS.Transfer(dave, gov.Hash, 3L * 100000000, "govmerc:bid");
            AssertRevert("bidding closed", () => gov.bid(dave, 3L * 100000000));

            // The closed epoch settles with the in-window high bid intact, and
            // the late bidder's credit stays fully withdrawable.
            gov.settleEpoch();
            Assert.Equal(carol, gov.settlementWinner(0));
            Assert.Equal(new BigInteger(3L * 100000000), gov.gasCreditOf(dave));
            Assert.Equal(new BigInteger(3L * 100000000), gov.withdraw(dave));
        }

        // MP-G-02: a just-in-time staker could previously stake large after the bid
        // window closed, capture a pro-rata slice of the winning bid at settle, then
        // unstake — siphoning revenue from long-term stakers. NEO staked once the
        // window is open is now parked as not-yet-eligible and earns nothing from the
        // current epoch's bid; the honest staker keeps the entire distribution.
        [Fact]
        public void GovMerc_JitStakerCannotSiphonCurrentEpochBid()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppGovMerc");
            var gov = engine.Deploy<GovMercContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;    // honest early staker 100 NEO
            var carol = TestEngine.GetNewSigner().Account;    // winning bidder 4 GAS
            var mallory = TestEngine.GetNewSigner().Account;  // JIT staker 10_000 NEO

            Fund(engine, alice, 100, 1_00000000);
            Fund(engine, carol, 0, 10L * 100000000);
            Fund(engine, mallory, 10_000, 1_00000000);

            // Honest staker is present BEFORE bidding opens -> eligible for epoch 0.
            engine.SetTransactionSigners(alice);
            engine.Native.NEO.Transfer(alice, gov.Hash, 100, "govmerc:stake");
            Assert.Equal(new BigInteger(100), gov.eligibleStaked());

            // Carol's first bid opens the bidding window for epoch 0.
            engine.SetTransactionSigners(carol);
            engine.Native.GAS.Transfer(carol, gov.Hash, 4L * 100000000, "govmerc:bid");
            gov.bid(carol, 4L * 100000000);
            Assert.True((gov.epochDeadline(0) ?? 0) > 0, "first bid should open the bidding window");

            // The window elapses: the winning bid is now locked in, no counter-bids.
            AdvancePastDeadline(engine, gov);

            // JIT attacker stakes large AFTER the window opened (and past the deadline),
            // racing to settle. The stake is parked as pending (eligible only next epoch)
            // and is excluded from the live epoch's eligible total.
            engine.SetTransactionSigners(mallory);
            engine.Native.NEO.Transfer(mallory, gov.Hash, 10_000, "govmerc:stake");
            Assert.Equal(new BigInteger(10_000), gov.pendingStakeOf(mallory));
            Assert.Equal(BigInteger.Zero, gov.eligibleStakeOf(mallory));
            Assert.Equal(new BigInteger(1), gov.pendingStakeEpoch(mallory)); // eligible from epoch 1
            Assert.Equal(new BigInteger(100), gov.eligibleStaked());          // still only Alice's 100

            // Settle epoch 0: the 4 GAS bid is divided across eligible stake only.
            gov.settleEpoch();
            Assert.Equal(new BigInteger(1), gov.currentEpoch());
            Assert.Equal(carol, gov.settlementWinner(0));

            // The JIT staker earns ~0 of this epoch's bid; the claim has nothing to pay.
            Assert.Equal(BigInteger.Zero, gov.pendingRewards(mallory));
            AssertRevert("no rewards", () => gov.claimRewards(mallory));

            // The honest staker captures the ENTIRE winning bid (4 GAS), undiluted.
            Assert.Equal(new BigInteger(4L * 100000000), gov.pendingRewards(alice));
            engine.SetTransactionSigners(alice);
            Assert.Equal(new BigInteger(4L * 100000000), gov.claimRewards(alice));

            // The attacker recovers only their NEO principal — no auction revenue.
            engine.SetTransactionSigners(mallory);
            gov.withdrawStake(mallory, 10_000);
            Assert.Equal(new BigInteger(10_000), engine.Native.NEO.BalanceOf(mallory));
            Assert.Equal(BigInteger.Zero, gov.pendingRewards(mallory));
            Assert.Equal(BigInteger.Zero, gov.stakeOf(mallory));
        }
    }
}
