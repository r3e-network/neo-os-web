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
    public abstract class BurnLeagueContract : SmartContract
    {
        protected BurnLeagueContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract BigInteger? burn(UInt160 player, BigInteger amount);
        public abstract void settle();
        public abstract BigInteger? withdraw(UInt160 account);
        public abstract BigInteger? currentSeason();
        public abstract BigInteger? seasonEnd();
        public abstract BigInteger? rewardPool();
        public abstract BigInteger? burnCount();
        public abstract BigInteger? userBurned(UInt160 player);
        public abstract UInt160 topBurner();
        public abstract BigInteger? topBurned();
        public abstract BigInteger? creditOf(UInt160 player);
        public abstract BigInteger? seasonDuration();
    }

    public class MiniAppBurnLeagueTests
    {
        private const long GAS = 100000000; // 1 GAS base units

        // MiniAppBurnLeague's NEF is produced into the shared contracts/build dir
        // by contracts/build.sh, like every other contract artifact these suites load.
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

        private static void FundGas(TestEngine engine, UInt160 to, BigInteger gas)
        {
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            engine.Native.GAS.Transfer(engine.ValidatorsAddress, to, gas, null);
        }

        // Contract asserts surface as "ABORTMSG is executed. Reason: <text>".
        private static void AssertRevert(string reason, Action act)
        {
            var ex = Assert.ThrowsAny<Exception>(act);
            Assert.Equal($"ABORTMSG is executed. Reason: {reason}", ex.Message);
        }

        // Solvency invariant: the contract holds exactly the season pool plus the
        // players' unburned deposit credits.
        private static void AssertSolvent(TestEngine engine, BurnLeagueContract league, params UInt160[] players)
        {
            BigInteger obligations = league.rewardPool() ?? 0;
            foreach (var p in players) obligations += league.creditOf(p) ?? 0;
            Assert.Equal(obligations, engine.Native.GAS.BalanceOf(league.Hash));
        }

        [Fact]
        public void BurnLeague_SeasonLifecycle_TopBurnerWinsWholePool()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppBurnLeague");
            var league = engine.Deploy<BurnLeagueContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            var bob = TestEngine.GetNewSigner().Account;
            FundGas(engine, alice, 5L * GAS);
            FundGas(engine, bob, 5L * GAS);

            // Deposit-then-burn: Alice 2 GAS, Bob 3 GAS.
            engine.SetTransactionSigners(alice);
            engine.Native.GAS.Transfer(alice, league.Hash, 2L * GAS, "miniapp-burnleague:burn");
            Assert.Equal(new BigInteger(2L * GAS), league.creditOf(alice));

            // The first burn lazily starts season 1.
            Assert.Equal(new BigInteger(2L * GAS), league.burn(alice, 2L * GAS));
            Assert.Equal(BigInteger.One, league.currentSeason());
            Assert.True(league.seasonEnd() > 0, "season clock must be running");
            Assert.Equal(alice, league.topBurner());

            engine.SetTransactionSigners(bob);
            engine.Native.GAS.Transfer(bob, league.Hash, 3L * GAS, "miniapp-burnleague:burn");
            Assert.Equal(new BigInteger(3L * GAS), league.burn(bob, 3L * GAS));
            Assert.Equal(bob, league.topBurner());
            Assert.Equal(new BigInteger(3L * GAS), league.topBurned());
            Assert.Equal(new BigInteger(5L * GAS), league.rewardPool());
            Assert.Equal(new BigInteger(2), league.burnCount());
            AssertSolvent(engine, league, alice, bob);

            // Settling before the deadline must revert.
            AssertRevert("season not ended", () => league.settle());

            // After the season deadline, anyone may settle: Bob (top burner) is
            // CREDITED the entire 5 GAS pool (pull-payment) and the season rolls over.
            engine.PersistingBlock.Advance(TimeSpan.FromMilliseconds((long)(league.seasonDuration() ?? 0) + 1));
            BigInteger bobBefore = engine.Native.GAS.BalanceOf(bob) ?? 0;
            engine.SetTransactionSigners(alice);
            league.settle();
            // Pull-payment: Bob is credited, not paid directly, so a GAS-rejecting contract
            // winner can never brick settle() and strand the pool.
            Assert.Equal(5L * GAS, league.creditOf(bob));
            Assert.Equal(bobBefore, engine.Native.GAS.BalanceOf(bob)); // not paid until claimed
            Assert.Equal(new BigInteger(2), league.currentSeason());
            Assert.Equal(BigInteger.Zero, league.seasonEnd());
            Assert.Equal(BigInteger.Zero, league.rewardPool());
            Assert.Equal(UInt160.Zero, league.topBurner());

            // Bob claims the prize via Withdraw; the contract is then empty.
            engine.SetTransactionSigners(bob);
            Assert.Equal(5L * GAS, league.withdraw(bob));
            Assert.Equal(bobBefore + 5L * GAS, engine.Native.GAS.BalanceOf(bob));
            Assert.Equal(BigInteger.Zero, engine.Native.GAS.BalanceOf(league.Hash));

            // A settled season cannot be settled twice.
            engine.SetTransactionSigners(alice);
            AssertRevert("no active season", () => league.settle());
        }

        [Fact]
        public void BurnLeague_WithdrawRefundsUnburnedCredit()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppBurnLeague");
            var league = engine.Deploy<BurnLeagueContract>(nef, manifest);

            var carol = TestEngine.GetNewSigner().Account;
            FundGas(engine, carol, 10L * GAS);

            engine.SetTransactionSigners(carol);
            engine.Native.GAS.Transfer(carol, league.Hash, 5L * GAS, "miniapp-burnleague:burn");
            league.burn(carol, 1L * GAS);
            Assert.Equal(new BigInteger(4L * GAS), league.creditOf(carol));
            AssertSolvent(engine, league, carol);

            // Reclaim the unburned 4 GAS; the 1 GAS pool stays committed.
            BigInteger before = engine.Native.GAS.BalanceOf(carol) ?? 0;
            Assert.Equal(new BigInteger(4L * GAS), league.withdraw(carol));
            Assert.Equal(before + 4L * GAS, engine.Native.GAS.BalanceOf(carol));
            Assert.Equal(BigInteger.Zero, league.creditOf(carol));
            Assert.Equal(new BigInteger(1L * GAS), engine.Native.GAS.BalanceOf(league.Hash));

            AssertRevert("no credit", () => league.withdraw(carol));
        }

        [Fact]
        public void BurnLeague_TieKeepsFirstPlayerToReachTheTotal()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppBurnLeague");
            var league = engine.Deploy<BurnLeagueContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            var bob = TestEngine.GetNewSigner().Account;
            FundGas(engine, alice, 2L * GAS);
            FundGas(engine, bob, 2L * GAS);

            engine.SetTransactionSigners(alice);
            engine.Native.GAS.Transfer(alice, league.Hash, 2L * GAS, "miniapp-burnleague:burn");
            league.burn(alice, 2L * GAS);

            engine.SetTransactionSigners(bob);
            engine.Native.GAS.Transfer(bob, league.Hash, 2L * GAS, "miniapp-burnleague:burn");
            league.burn(bob, 2L * GAS);

            // The contract replaces the leader only on a strictly greater total.
            // This pins the UI rule: ties keep the first player to reach the score.
            Assert.Equal(alice, league.topBurner());
            Assert.Equal(new BigInteger(2L * GAS), league.topBurned());
        }

        [Fact]
        public void BurnLeague_GuardsRejectInvalidBurns()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppBurnLeague");
            var league = engine.Deploy<BurnLeagueContract>(nef, manifest);

            var dave = TestEngine.GetNewSigner().Account;
            FundGas(engine, dave, 10L * GAS);

            // Settle with no season ever started.
            engine.SetTransactionSigners(dave);
            AssertRevert("no active season", () => league.settle());

            // NOTE: the "invalid memo" deposit guard ABORTs inside OnNEP17Payment
            // mid-GAS.Transfer, which the TestEngine host cannot unwind (it hangs
            // natively), so that path is covered by the live testnet harness
            // (deploy/scripts/live_validate_burnleague.mjs) instead of here.

            // Burn-range and credit guards.
            engine.Native.GAS.Transfer(dave, league.Hash, 2L * GAS, "miniapp-burnleague:burn");
            AssertRevert("burn out of range", () => league.burn(dave, GAS / 2)); // 0.5 GAS < MIN_BURN
            AssertRevert("insufficient burn credit", () => league.burn(dave, 2L * GAS + 1L * GAS));

            // Once the season deadline passes, burning is blocked until settle().
            league.burn(dave, 1L * GAS);
            engine.PersistingBlock.Advance(TimeSpan.FromMilliseconds((long)(league.seasonDuration() ?? 0) + 1));
            AssertRevert("season ended; settle first", () => league.burn(dave, 1L * GAS));
        }
    }
}
