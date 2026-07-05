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
    public class MiniAppSnakeBountyIntegrationTests
    {
        private static readonly UInt160 OwnerHash = UInt160.Parse("0x6d0656f6dd91469db1c90cc1e574380613f43738");
        private const long GAS = 100_000_000;
        private const long ENTRY0 = 2_000_000;
        private const long ENTRY1 = 10_000_000;
        private const long ENTRY2 = 20_000_000;
        private const long REWARD0 = 10_000_000;
        private const long REWARD1 = 50_000_000;
        private const long REWARD2 = 100_000_000;
        private const long LIMIT0_MS = 180_000;
        private const long MIN_SOLVE0_MS = 20_000;
        private const long MIN_SOLVE1_MS = 40_000;
        private const long MIN_SOLVE2_MS = 60_000;
        private const long SETTLE_GRACE_MS = 600_000;
        private const int SCORE = 40;
        private const string FUND_MEMO = "miniapp-snake-bounty:fund";
        private const string ENTRY_MEMO = "miniapp-snake-bounty:entry";
        private const string APP_ID = "miniapp-snake-bounty";
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

        private static void AssertSolvent(TestEngine engine, SnakeBountyContract c, params UInt160[] players)
        {
            BigInteger obligations = c.poolBalance() ?? 0;
            foreach (var p in players) obligations += c.creditOf(p) ?? 0;
            Assert.Equal(obligations, engine.Native.GAS.BalanceOf(c.Hash));
            Assert.True((c.reservedPool() ?? 0) <= (c.poolBalance() ?? 0), "reserved must be <= pool");
        }

        private static BigInteger I(Neo.VM.Types.Map m, string key) =>
            m[(Neo.VM.Types.PrimitiveType)key].GetInteger();

        private static byte[] Commit(BigInteger gameId) =>
            SHA256.HashData(Encoding.UTF8.GetBytes($"snake-problem-{gameId}"));
        private static byte[] Answer(BigInteger gameId) =>
            SHA256.HashData(Encoding.UTF8.GetBytes($"snake-answer-{gameId}"));

        private static (TestEngine engine, SnakeBountyContract snake, GameOracleMockFixtureContract oracle, UInt160 funder, UInt160 player)
            Setup(long poolGas)
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppSnakeBounty");
            var snake = engine.Deploy<SnakeBountyContract>(nef, manifest);
            var oracle = GameOracleMockFixture.Deploy(engine, OwnerHash);
            engine.SetTransactionSigners(OwnerHash);
            snake.setOracle(oracle.Hash);
            var funder = TestEngine.GetNewSigner().Account;
            var player = TestEngine.GetNewSigner().Account;
            FundGas(engine, funder, 60L * GAS);
            FundGas(engine, player, 20L * GAS);
            if (poolGas > 0)
            {
                engine.SetTransactionSigners(funder);
                engine.Native.GAS.Transfer(funder, snake.Hash, poolGas * GAS, FUND_MEMO);
            }
            return (engine, snake, oracle, funder, player);
        }

        private static void DepositEntry(TestEngine engine, SnakeBountyContract c, UInt160 player, BigInteger amount)
        {
            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, c.Hash, amount, ENTRY_MEMO);
        }

        private static BigInteger Play(TestEngine engine, SnakeBountyContract snake, GameOracleMockFixtureContract oracle,
            UInt160 player, int difficulty, long elapsedMs, int undos)
        {
            engine.SetTransactionSigners(player);
            BigInteger gameId = snake.startGame(player, difficulty)!.Value;
            BigInteger requestId = snake.finalizeGame(gameId, "00")!.Value;
            byte[] result = GameResultCodec.Build(Commit(gameId), Answer(gameId), (ulong)elapsedMs, (byte)undos, SCORE, (byte)difficulty);
            engine.SetTransactionSigners(OwnerHash);
            oracle.Deliver(snake.Hash, requestId, APP_ID, MODULE_ID, OP_FINALIZE, player, true, result, "");
            return I(snake.getGame(gameId)!, "payout");
        }

        [Fact]
        public void CompleteFlow_EasyDifficulty()
        {
            var (engine, snake, oracle, funder, player) = Setup(10);
            DepositEntry(engine, snake, player, ENTRY0);
            BigInteger payout = Play(engine, snake, oracle, player, 0, MIN_SOLVE0_MS + 5000, 0);
            Assert.Equal(new BigInteger(REWARD0), payout);
            Assert.Equal(new BigInteger(REWARD0), snake.creditOf(player));

            BigInteger before = engine.Native.GAS.BalanceOf(player) ?? 0;
            engine.SetTransactionSigners(player);
            snake.withdraw(player);
            Assert.Equal(before + REWARD0, engine.Native.GAS.BalanceOf(player));
            AssertSolvent(engine, snake, funder, player);
        }

        [Fact]
        public void CompleteFlow_MediumDifficulty()
        {
            var (engine, snake, oracle, funder, player) = Setup(10);
            DepositEntry(engine, snake, player, ENTRY1);
            BigInteger payout = Play(engine, snake, oracle, player, 1, MIN_SOLVE1_MS + 5000, 0);
            Assert.Equal(new BigInteger(REWARD1), payout);
            Assert.Equal(new BigInteger(REWARD1), snake.creditOf(player));
            AssertSolvent(engine, snake, funder, player);
        }

        [Fact]
        public void CompleteFlow_HardDifficulty()
        {
            var (engine, snake, oracle, funder, player) = Setup(10);
            DepositEntry(engine, snake, player, ENTRY2);
            BigInteger payout = Play(engine, snake, oracle, player, 2, MIN_SOLVE2_MS + 5000, 0);
            Assert.Equal(new BigInteger(REWARD2), payout);
            Assert.Equal(new BigInteger(REWARD2), snake.creditOf(player));
            AssertSolvent(engine, snake, funder, player);
        }

        [Fact]
        public void CompleteFlow_UndoLadderPays70_40_10Percent()
        {
            var (engine, snake, oracle, funder, player) = Setup(10);
            DepositEntry(engine, snake, player, 3 * ENTRY0);
            Assert.Equal(new BigInteger(REWARD0 * 70 / 100), Play(engine, snake, oracle, player, 0, MIN_SOLVE0_MS + 5000, 1));
            Assert.Equal(new BigInteger(REWARD0 * 40 / 100), Play(engine, snake, oracle, player, 0, MIN_SOLVE0_MS + 5000, 2));
            Assert.Equal(new BigInteger(REWARD0 * 10 / 100), Play(engine, snake, oracle, player, 0, MIN_SOLVE0_MS + 5000, 3));
            AssertSolvent(engine, snake, funder, player);
        }

        [Fact]
        public void ExpireGame_ActivePastDeadlinePlusGrace()
        {
            var (engine, snake, _, funder, player) = Setup(10);
            DepositEntry(engine, snake, player, ENTRY0);
            engine.SetTransactionSigners(player);
            BigInteger gameId = snake.startGame(player, 0)!.Value;

            engine.PersistingBlock.Advance(TimeSpan.FromMilliseconds(LIMIT0_MS + SETTLE_GRACE_MS + 1000));
            engine.SetTransactionSigners(funder);
            Assert.Equal(new BigInteger(3), snake.expireGame(gameId));
            Assert.Equal(BigInteger.Zero, snake.reservedPool());
            Assert.Equal(BigInteger.Zero, snake.activeGameOf(player));
            AssertSolvent(engine, snake, funder, player);
        }

        [Fact]
        public void AllDifficulties_PayCorrectRewards()
        {
            var (engine, snake, oracle, funder, player) = Setup(20);
            DepositEntry(engine, snake, player, ENTRY0 + ENTRY1 + ENTRY2);
            Assert.Equal(new BigInteger(REWARD0), Play(engine, snake, oracle, player, 0, MIN_SOLVE0_MS + 5000, 0));
            Assert.Equal(new BigInteger(REWARD1), Play(engine, snake, oracle, player, 1, MIN_SOLVE1_MS + 5000, 0));
            Assert.Equal(new BigInteger(REWARD2), Play(engine, snake, oracle, player, 2, MIN_SOLVE2_MS + 5000, 0));

            var stats = snake.statsOf(player)!;
            Assert.Equal(new BigInteger(3), I(stats, "solved"));
            Assert.Equal(new BigInteger(REWARD0 + REWARD1 + REWARD2), I(stats, "totalWon"));

            engine.SetTransactionSigners(player);
            BigInteger totalCredit = snake.creditOf(player) ?? 0;
            BigInteger before = engine.Native.GAS.BalanceOf(player) ?? 0;
            snake.withdraw(player);
            Assert.Equal(before + totalCredit, engine.Native.GAS.BalanceOf(player));
            AssertSolvent(engine, snake, funder, player);
        }
    }
}
