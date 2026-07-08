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
    /// no-undo rule (any reported undo count is rejected).
    /// </summary>
    public class MiniAppCurveArrowIntegrationTests
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
        private const long MIN_SOLVE0_MS = 10_000;
        private const long MIN_SOLVE1_MS = 25_000;
        private const long MIN_SOLVE2_MS = 45_000;
        private const long SETTLE_GRACE_MS = 600_000;
        private const int SCORE = 7; // levels cleared, >= every difficulty target (3 / 5 / 7)
        private const string FUND_MEMO = "miniapp-curve-arrow:fund";
        private const string ENTRY_MEMO = "miniapp-curve-arrow:entry";
        private const string APP_ID = "miniapp-curve-arrow";
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

        private static void AssertSolvent(TestEngine engine, CurveArrowContract c, params UInt160[] players)
        {
            BigInteger obligations = c.poolBalance() ?? 0;
            foreach (var p in players) obligations += c.creditOf(p) ?? 0;
            Assert.Equal(obligations, engine.Native.GAS.BalanceOf(c.Hash));
            Assert.True((c.reservedPool() ?? 0) <= (c.poolBalance() ?? 0), "reserved must be <= pool");
        }

        private static BigInteger I(Neo.VM.Types.Map m, string key) =>
            m[(Neo.VM.Types.PrimitiveType)key].GetInteger();

        private static byte[] Commit(BigInteger gameId) =>
            SHA256.HashData(Encoding.UTF8.GetBytes($"curve-arrow-problem-{gameId}"));
        private static byte[] Answer(BigInteger gameId) =>
            SHA256.HashData(Encoding.UTF8.GetBytes($"curve-arrow-answer-{gameId}"));

        private static (TestEngine engine, CurveArrowContract arrow, GameOracleMockFixtureContract oracle, UInt160 funder, UInt160 player)
            Setup(long poolGas)
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppCurveArrow");
            var arrow = engine.Deploy<CurveArrowContract>(nef, manifest);
            var oracle = GameOracleMockFixture.Deploy(engine, OwnerHash);
            engine.SetTransactionSigners(OwnerHash);
            arrow.setOracle(oracle.Hash);
            var funder = TestEngine.GetNewSigner().Account;
            var player = TestEngine.GetNewSigner().Account;
            FundGas(engine, funder, 60L * GAS);
            FundGas(engine, player, 20L * GAS);
            if (poolGas > 0)
            {
                engine.SetTransactionSigners(funder);
                engine.Native.GAS.Transfer(funder, arrow.Hash, poolGas * GAS, FUND_MEMO);
            }
            return (engine, arrow, oracle, funder, player);
        }

        private static void DepositEntry(TestEngine engine, CurveArrowContract c, UInt160 player, BigInteger amount)
        {
            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, c.Hash, amount, ENTRY_MEMO);
        }

        private static BigInteger Play(TestEngine engine, CurveArrowContract arrow, GameOracleMockFixtureContract oracle,
            UInt160 player, int difficulty, long elapsedMs, int undos)
        {
            engine.SetTransactionSigners(player);
            BigInteger gameId = arrow.startGame(player, difficulty)!.Value;
            BigInteger requestId = arrow.finalizeGame(gameId, "00")!.Value;
            byte[] result = GameResultCodec.Build(Commit(gameId), Answer(gameId), (ulong)elapsedMs, (byte)undos, SCORE, (byte)difficulty);
            engine.SetTransactionSigners(OwnerHash);
            oracle.Deliver(arrow.Hash, requestId, APP_ID, MODULE_ID, OP_FINALIZE, player, true, result, "");
            return I(arrow.getGame(gameId)!, "payout");
        }

        [Fact]
        public void CompleteFlow_EasyDifficulty()
        {
            var (engine, arrow, oracle, funder, player) = Setup(10);
            DepositEntry(engine, arrow, player, ENTRY0);
            BigInteger payout = Play(engine, arrow, oracle, player, 0, MIN_SOLVE0_MS + 5000, 0);
            Assert.Equal(new BigInteger(REWARD0), payout);
            Assert.Equal(new BigInteger(REWARD0), arrow.creditOf(player));

            BigInteger before = engine.Native.GAS.BalanceOf(player) ?? 0;
            engine.SetTransactionSigners(player);
            arrow.withdraw(player);
            Assert.Equal(before + REWARD0, engine.Native.GAS.BalanceOf(player));
            AssertSolvent(engine, arrow, funder, player);
        }

        [Fact]
        public void CompleteFlow_MediumDifficulty()
        {
            var (engine, arrow, oracle, funder, player) = Setup(10);
            DepositEntry(engine, arrow, player, ENTRY1);
            BigInteger payout = Play(engine, arrow, oracle, player, 1, MIN_SOLVE1_MS + 5000, 0);
            Assert.Equal(new BigInteger(REWARD1), payout);
            Assert.Equal(new BigInteger(REWARD1), arrow.creditOf(player));
            AssertSolvent(engine, arrow, funder, player);
        }

        [Fact]
        public void CompleteFlow_HardDifficulty()
        {
            var (engine, arrow, oracle, funder, player) = Setup(10);
            DepositEntry(engine, arrow, player, ENTRY2);
            BigInteger payout = Play(engine, arrow, oracle, player, 2, MIN_SOLVE2_MS + 5000, 0);
            Assert.Equal(new BigInteger(REWARD2), payout);
            Assert.Equal(new BigInteger(REWARD2), arrow.creditOf(player));
            AssertSolvent(engine, arrow, funder, player);
        }

        [Fact]
        public void CompleteFlow_NoUndoRuleRejectsAnyUndoCountThenPaysCleanRunInFull()
        {
            var (engine, arrow, oracle, funder, player) = Setup(10);
            DepositEntry(engine, arrow, player, ENTRY0);

            engine.SetTransactionSigners(player);
            BigInteger gameId = arrow.startGame(player, 0)!.Value;
            BigInteger requestId = arrow.finalizeGame(gameId, "00")!.Value;

            // A result reporting even one undo is rejected (MAX_UNDOS = 0).
            byte[] withUndo = GameResultCodec.Build(Commit(gameId), Answer(gameId),
                (ulong)(MIN_SOLVE0_MS + 5000), 1, SCORE, 0);
            engine.SetTransactionSigners(OwnerHash);
            var ex = Assert.ThrowsAny<Exception>(() => oracle.Deliver(
                arrow.Hash, requestId, APP_ID, MODULE_ID, OP_FINALIZE, player, true, withUndo, ""));
            Assert.Contains("undos out of range", ex.Message);

            // The rejected delivery rolled back: a clean zero-undo result on the same
            // request settles the game at the FULL base reward (no penalty ladder).
            byte[] clean = GameResultCodec.Build(Commit(gameId), Answer(gameId),
                (ulong)(MIN_SOLVE0_MS + 5000), 0, SCORE, 0);
            engine.SetTransactionSigners(OwnerHash);
            oracle.Deliver(arrow.Hash, requestId, APP_ID, MODULE_ID, OP_FINALIZE, player, true, clean, "");
            Assert.Equal(new BigInteger(REWARD0), I(arrow.getGame(gameId)!, "payout"));
            Assert.Equal(new BigInteger(REWARD0), arrow.creditOf(player));
            AssertSolvent(engine, arrow, funder, player);
        }

        [Fact]
        public void ExpireGame_ActivePastDeadlinePlusGrace()
        {
            var (engine, arrow, _, funder, player) = Setup(10);
            DepositEntry(engine, arrow, player, ENTRY0);
            engine.SetTransactionSigners(player);
            BigInteger gameId = arrow.startGame(player, 0)!.Value;

            engine.PersistingBlock.Advance(TimeSpan.FromMilliseconds(LIMIT0_MS + SETTLE_GRACE_MS + 1000));
            engine.SetTransactionSigners(funder);
            Assert.Equal(new BigInteger(3), arrow.expireGame(gameId));
            Assert.Equal(BigInteger.Zero, arrow.reservedPool());
            Assert.Equal(BigInteger.Zero, arrow.activeGameOf(player));
            AssertSolvent(engine, arrow, funder, player);
        }

        [Fact]
        public void AllDifficulties_PayCorrectRewards()
        {
            var (engine, arrow, oracle, funder, player) = Setup(20);
            DepositEntry(engine, arrow, player, ENTRY0 + ENTRY1 + ENTRY2);
            Assert.Equal(new BigInteger(REWARD0), Play(engine, arrow, oracle, player, 0, MIN_SOLVE0_MS + 5000, 0));
            Assert.Equal(new BigInteger(REWARD1), Play(engine, arrow, oracle, player, 1, MIN_SOLVE1_MS + 5000, 0));
            Assert.Equal(new BigInteger(REWARD2), Play(engine, arrow, oracle, player, 2, MIN_SOLVE2_MS + 5000, 0));

            var stats = arrow.statsOf(player)!;
            Assert.Equal(new BigInteger(3), I(stats, "solved"));
            Assert.Equal(new BigInteger(REWARD0 + REWARD1 + REWARD2), I(stats, "totalWon"));

            engine.SetTransactionSigners(player);
            BigInteger totalCredit = arrow.creditOf(player) ?? 0;
            BigInteger before = engine.Native.GAS.BalanceOf(player) ?? 0;
            arrow.withdraw(player);
            Assert.Equal(before + totalCredit, engine.Native.GAS.BalanceOf(player));
            AssertSolvent(engine, arrow, funder, player);
        }
    }
}
