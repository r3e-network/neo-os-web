using System;
using System.IO;
using System.Numerics;
using System.Security.Cryptography;
using System.Text;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Manifest;
using Neo.SmartContract.Testing;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    /// <summary>
    /// End-to-end user flows over the generic Morpheus kernel path: deploy, set oracle,
    /// deposit, start, finalize (kernel returns a requestId), deliver the finalize
    /// result to onMiniAppResult, then withdraw. Covers all three difficulties and the
    /// undo penalty ladder.
    /// </summary>
    public class MiniAppGame2048IntegrationTests
    {
        private static readonly UInt160 OwnerHash = UInt160.Parse("0x6d0656f6dd91469db1c90cc1e574380613f43738");
        private const long GAS = 100_000_000;
        private const long ENTRY0 = 2_000_000;
        private const long ENTRY1 = 10_000_000;
        private const long ENTRY2 = 20_000_000;
        private const long REWARD0 = 10_000_000;
        private const long REWARD1 = 50_000_000;
        private const long REWARD2 = 100_000_000;
        private const long LIMIT0_MS = 240_000;
        private const long MIN_SOLVE0_MS = 60_000;
        private const long MIN_SOLVE1_MS = 120_000;
        private const long MIN_SOLVE2_MS = 240_000;
        private const long SETTLE_GRACE_MS = 600_000;
        private const int SCORE = 11;
        private const string FUND_MEMO = "miniapp-game-2048:fund";
        private const string ENTRY_MEMO = "miniapp-game-2048:entry";
        private const string APP_ID = "miniapp-game-2048";
        private const string MODULE_ID = "game.session";
        private const string OP_FINALIZE = "session.finalize";

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

        private static void AssertSolvent(TestEngine engine, Game2048Contract c, params UInt160[] players)
        {
            BigInteger obligations = c.poolBalance() ?? 0;
            foreach (var p in players) obligations += c.creditOf(p) ?? 0;
            Assert.Equal(obligations, engine.Native.GAS.BalanceOf(c.Hash));
            Assert.True((c.reservedPool() ?? 0) <= (c.poolBalance() ?? 0), "reserved must be <= pool");
        }

        private static BigInteger I(Neo.VM.Types.Map m, string key) =>
            m[(Neo.VM.Types.PrimitiveType)key].GetInteger();

        private static byte[] Commit(BigInteger gameId) =>
            SHA256.HashData(Encoding.UTF8.GetBytes($"game2048-problem-{gameId}"));
        private static byte[] Answer(BigInteger gameId) =>
            SHA256.HashData(Encoding.UTF8.GetBytes($"game2048-answer-{gameId}"));

        private static (TestEngine engine, Game2048Contract app2048, GameOracleMockFixtureContract oracle, UInt160 funder, UInt160 player)
            Setup(long poolGas)
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppGame2048");
            var app2048 = engine.Deploy<Game2048Contract>(nef, manifest);
            var oracle = GameOracleMockFixture.Deploy(engine, OwnerHash);
            engine.SetTransactionSigners(OwnerHash);
            app2048.setOracle(oracle.Hash);
            var funder = TestEngine.GetNewSigner().Account;
            var player = TestEngine.GetNewSigner().Account;
            FundGas(engine, funder, 60L * GAS);
            FundGas(engine, player, 20L * GAS);
            if (poolGas > 0)
            {
                engine.SetTransactionSigners(funder);
                engine.Native.GAS.Transfer(funder, app2048.Hash, poolGas * GAS, FUND_MEMO);
            }
            return (engine, app2048, oracle, funder, player);
        }

        private static void DepositEntry(TestEngine engine, Game2048Contract c, UInt160 player, BigInteger amount)
        {
            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, c.Hash, amount, ENTRY_MEMO);
        }

        private static BigInteger Play(TestEngine engine, Game2048Contract app2048, GameOracleMockFixtureContract oracle,
            UInt160 player, int difficulty, long elapsedMs, int undos)
        {
            engine.SetTransactionSigners(player);
            BigInteger gameId = app2048.startGame(player, difficulty)!.Value;
            BigInteger requestId = app2048.finalizeGame(gameId, "00")!.Value;
            byte[] result = GameResultCodec.Build(Commit(gameId), Answer(gameId), (ulong)elapsedMs, (byte)undos, SCORE, (byte)difficulty);
            engine.SetTransactionSigners(OwnerHash);
            oracle.Deliver(app2048.Hash, requestId, APP_ID, MODULE_ID, OP_FINALIZE, player, true, result, "");
            return I(app2048.getGame(gameId)!, "payout");
        }

        [Fact]
        public void CompleteFlow_EasyDifficulty()
        {
            var (engine, app2048, oracle, funder, player) = Setup(10);
            DepositEntry(engine, app2048, player, ENTRY0);
            BigInteger payout = Play(engine, app2048, oracle, player, 0, MIN_SOLVE0_MS + 5000, 0);
            Assert.Equal(new BigInteger(REWARD0), payout);
            Assert.Equal(new BigInteger(REWARD0), app2048.creditOf(player));

            BigInteger before = engine.Native.GAS.BalanceOf(player) ?? 0;
            engine.SetTransactionSigners(player);
            app2048.withdraw(player);
            Assert.Equal(before + REWARD0, engine.Native.GAS.BalanceOf(player));
            AssertSolvent(engine, app2048, funder, player);
        }

        [Fact]
        public void CompleteFlow_MediumDifficulty()
        {
            var (engine, app2048, oracle, funder, player) = Setup(10);
            DepositEntry(engine, app2048, player, ENTRY1);
            BigInteger payout = Play(engine, app2048, oracle, player, 1, MIN_SOLVE1_MS + 5000, 0);
            Assert.Equal(new BigInteger(REWARD1), payout);
            Assert.Equal(new BigInteger(REWARD1), app2048.creditOf(player));
            AssertSolvent(engine, app2048, funder, player);
        }

        [Fact]
        public void CompleteFlow_HardDifficulty()
        {
            var (engine, app2048, oracle, funder, player) = Setup(10);
            DepositEntry(engine, app2048, player, ENTRY2);
            BigInteger payout = Play(engine, app2048, oracle, player, 2, MIN_SOLVE2_MS + 5000, 0);
            Assert.Equal(new BigInteger(REWARD2), payout);
            Assert.Equal(new BigInteger(REWARD2), app2048.creditOf(player));
            AssertSolvent(engine, app2048, funder, player);
        }

        [Fact]
        public void CompleteFlow_UndoLadderPays70_40_10Percent()
        {
            var (engine, app2048, oracle, funder, player) = Setup(10);
            DepositEntry(engine, app2048, player, 3 * ENTRY0);
            Assert.Equal(new BigInteger(REWARD0 * 70 / 100), Play(engine, app2048, oracle, player, 0, MIN_SOLVE0_MS + 5000, 1));
            Assert.Equal(new BigInteger(REWARD0 * 40 / 100), Play(engine, app2048, oracle, player, 0, MIN_SOLVE0_MS + 5000, 2));
            Assert.Equal(new BigInteger(REWARD0 * 10 / 100), Play(engine, app2048, oracle, player, 0, MIN_SOLVE0_MS + 5000, 3));
            AssertSolvent(engine, app2048, funder, player);
        }

        [Fact]
        public void ExpireGame_ActivePastDeadlinePlusGrace()
        {
            var (engine, app2048, _, funder, player) = Setup(10);
            DepositEntry(engine, app2048, player, ENTRY0);
            engine.SetTransactionSigners(player);
            BigInteger gameId = app2048.startGame(player, 0)!.Value;

            engine.PersistingBlock.Advance(TimeSpan.FromMilliseconds(LIMIT0_MS + SETTLE_GRACE_MS + 1000));
            engine.SetTransactionSigners(funder);
            Assert.Equal(new BigInteger(3), app2048.expireGame(gameId));
            Assert.Equal(BigInteger.Zero, app2048.reservedPool());
            Assert.Equal(BigInteger.Zero, app2048.activeGameOf(player));
            AssertSolvent(engine, app2048, funder, player);
        }

        [Fact]
        public void AllDifficulties_PayCorrectRewards()
        {
            var (engine, app2048, oracle, funder, player) = Setup(20);
            DepositEntry(engine, app2048, player, ENTRY0 + ENTRY1 + ENTRY2);
            Assert.Equal(new BigInteger(REWARD0), Play(engine, app2048, oracle, player, 0, MIN_SOLVE0_MS + 5000, 0));
            Assert.Equal(new BigInteger(REWARD1), Play(engine, app2048, oracle, player, 1, MIN_SOLVE1_MS + 5000, 0));
            Assert.Equal(new BigInteger(REWARD2), Play(engine, app2048, oracle, player, 2, MIN_SOLVE2_MS + 5000, 0));

            var stats = app2048.statsOf(player)!;
            Assert.Equal(new BigInteger(3), I(stats, "solved"));
            Assert.Equal(new BigInteger(REWARD0 + REWARD1 + REWARD2), I(stats, "totalWon"));

            engine.SetTransactionSigners(player);
            BigInteger totalCredit = app2048.creditOf(player) ?? 0;
            BigInteger before = engine.Native.GAS.BalanceOf(player) ?? 0;
            app2048.withdraw(player);
            Assert.Equal(before + totalCredit, engine.Native.GAS.BalanceOf(player));
            AssertSolvent(engine, app2048, funder, player);
        }
    }
}
