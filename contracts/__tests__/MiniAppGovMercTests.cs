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

            // Settle epoch 0: Carol wins, her 4 GAS distributed pro-rata to stakers.
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
            gov.settleEpoch(); // Alice is sole staker -> earns all 2 GAS

            // Withdraw all stake; pending 2 GAS must be banked, then claimable.
            engine.SetTransactionSigners(alice);
            gov.withdrawStake(alice, 100);
            Assert.Equal(BigInteger.Zero, gov.totalStaked());
            Assert.Equal(new BigInteger(2L * 100000000), gov.pendingRewards(alice));
            Assert.Equal(new BigInteger(2L * 100000000), gov.claimRewards(alice));
        }
    }
}
