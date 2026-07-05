using System;
using System.ComponentModel;
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
    public abstract class SnakeBountyContract : SmartContract
    {
        protected SnakeBountyContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract void onNEP17Payment(UInt160 from, BigInteger amount, object? data);
        public abstract BigInteger? startGame(UInt160 player, BigInteger difficulty);
        public abstract BigInteger? finalizeGame(BigInteger gameId, string sealedOpLogHex);
        public abstract void onMiniAppResult(BigInteger requestId, string appId, string moduleId, string operation, UInt160 requester, bool success, byte[] result, string error);
        public abstract BigInteger? expireGame(BigInteger gameId);
        public abstract BigInteger? withdraw(UInt160 account);
        public abstract BigInteger? poolBalance();
        public abstract BigInteger? reservedPool();
        public abstract BigInteger? freePool();
        public abstract BigInteger? creditOf(UInt160 player);
        public abstract BigInteger? lastGameId();
        public abstract BigInteger? activeGameOf(UInt160 player);
        public abstract bool? isPaused();
        public abstract BigInteger? dailyCap();
        public abstract BigInteger? dailyStartsOf(UInt160 player);
        public abstract UInt160? oracle();
        public abstract BigInteger? gameOfRequest(BigInteger requestId);
        public abstract BigInteger? networkMagic();
        public abstract Neo.VM.Types.Map? statsOf(UInt160 player);
        public abstract Neo.VM.Types.Map? topPlayer();
        public abstract Neo.VM.Types.Map? getGame(BigInteger gameId);
        public abstract Neo.VM.Types.Map? getConfig();
        public abstract void setPaused(bool paused);
        public abstract void setDailyCap(BigInteger cap);
        public abstract void setOracle(UInt160 oracle);
        public abstract void withdrawPool(UInt160 to, BigInteger amount);

        public delegate void delSolved(BigInteger? gameId, UInt160? player, BigInteger? difficulty, BigInteger? elapsedMs, BigInteger? payout, BigInteger? totalWon);
        [DisplayName("Solved")]
        public event delSolved? OnSolved;
    }

    public class MiniAppSnakeBountyTests
    {
        // The contract hardcodes Owner = NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32
        // (UInt160 form, byte-reversed, as the TestEngine reports it).
        private static readonly UInt160 OwnerHash = UInt160.Parse("0x6d0656f6dd91469db1c90cc1e574380613f43738");
        private const long GAS = 100_000_000;          // 1 GAS base units
        private const long ENTRY0 = 2_000_000;         // 0.02 GAS easy entry
        private const long ENTRY1 = 10_000_000;        // 0.10 GAS medium entry
        private const long ENTRY2 = 20_000_000;        // 0.20 GAS hard entry
        private const long REWARD0 = 10_000_000;       // 0.1 GAS easy reward
        private const long REWARD1 = 50_000_000;       // 0.5 GAS medium reward
        private const long REWARD2 = 100_000_000;      // 1.0 GAS hard reward
        private const long LIMIT0_MS = 180_000;        // 15 min easy limit
        private const long MIN_SOLVE0_MS = 20_000;     // 90s easy min-solve floor
        private const long SETTLE_GRACE_MS = 600_000;  // settle window past the deadline
        private const long MS_PER_DAY = 86_400_000;
        private const int SCORE0 = 12;                  // winning score >= target for this game
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

        private static void AssertRevert(string reason, Action act)
        {
            var ex = Assert.ThrowsAny<Exception>(act);
            Assert.Contains(reason, ex.Message);
        }

        private static void AdvanceMs(TestEngine engine, long ms) =>
            engine.PersistingBlock.Advance(TimeSpan.FromMilliseconds(ms));

        private static void AlignToFreshUtcDay(TestEngine engine)
        {
            long nowMs = (long)engine.PersistingBlock.Timestamp.TotalMilliseconds;
            long msIntoDay = nowMs % MS_PER_DAY;
            AdvanceMs(engine, MS_PER_DAY - msIntoDay + 3_600_000);
        }

        // SOLVENCY INVARIANT: heldGAS == pool + sum(credits of touched players);
        // reserved <= pool. Asserted after every scenario.
        private static void AssertSolvent(TestEngine engine, SnakeBountyContract c, params UInt160[] players)
        {
            BigInteger obligations = c.poolBalance() ?? 0;
            foreach (var p in players) obligations += c.creditOf(p) ?? 0;
            Assert.Equal(obligations, engine.Native.GAS.BalanceOf(c.Hash));
            Assert.True((c.reservedPool() ?? 0) <= (c.poolBalance() ?? 0), "reserved must be <= pool");
        }

        private static BigInteger I(Neo.VM.Types.Map m, string key) =>
            m[(Neo.VM.Types.PrimitiveType)key].GetInteger();
        private static string S(Neo.VM.Types.Map m, string key) =>
            m[(Neo.VM.Types.PrimitiveType)key].GetString()!;

        private static string Hex(byte[] bytes) => Convert.ToHexString(bytes).ToLowerInvariant();

        private static byte[] TestCommitment(BigInteger gameId) =>
            SHA256.HashData(Encoding.UTF8.GetBytes($"snake-problem-{gameId}"));
        private static byte[] TestAnswerHash(BigInteger gameId) =>
            SHA256.HashData(Encoding.UTF8.GetBytes($"snake-answer-{gameId}"));

        private static (TestEngine engine, SnakeBountyContract snake, GameOracleMockFixtureContract oracle, UInt160 funder, UInt160 player)
            Setup(long poolGas, bool setOracle = true)
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppSnakeBounty");
            var snake = engine.Deploy<SnakeBountyContract>(nef, manifest);
            var oracle = GameOracleMockFixture.Deploy(engine, OwnerHash);
            if (setOracle)
            {
                engine.SetTransactionSigners(OwnerHash);
                snake.setOracle(oracle.Hash);
            }
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

        // Drive one settlement: player starts, finalizes (kernel returns a requestId),
        // then the oracle delivers the finalize result to onMiniAppResult.
        private static (BigInteger gameId, BigInteger requestId) StartAndFinalize(
            TestEngine engine, SnakeBountyContract c, GameOracleMockFixtureContract oracle,
            UInt160 player, int difficulty)
        {
            engine.SetTransactionSigners(player);
            BigInteger gameId = c.startGame(player, difficulty)!.Value;
            BigInteger requestId = c.finalizeGame(gameId, "00")!.Value;
            return (gameId, requestId);
        }

        private static byte[] Result(BigInteger gameId, long elapsedMs, int undos, uint score, int difficulty) =>
            GameResultCodec.Build(TestCommitment(gameId), TestAnswerHash(gameId),
                (ulong)elapsedMs, (byte)undos, score, (byte)difficulty);

        private static void Deliver(TestEngine engine, SnakeBountyContract c, GameOracleMockFixtureContract oracle,
            UInt160 player, BigInteger requestId, bool success, byte[] result)
        {
            engine.SetTransactionSigners(OwnerHash);
            oracle.Deliver(c.Hash, requestId, APP_ID, MODULE_ID, OP_FINALIZE, player, success, result, "");
        }

        [Fact]
        public void Deposits_FundAndEntryPathsCreditTheRightLedgers()
        {
            var (engine, snake, _, funder, player) = Setup(0);

            engine.SetTransactionSigners(funder);
            engine.Native.GAS.Transfer(funder, snake.Hash, 5L * GAS, FUND_MEMO);
            Assert.Equal(new BigInteger(5L * GAS), snake.poolBalance());
            Assert.Equal(BigInteger.Zero, snake.creditOf(funder));

            DepositEntry(engine, snake, player, 1L * GAS);
            Assert.Equal(new BigInteger(1L * GAS), snake.creditOf(player));
            Assert.Equal(new BigInteger(5L * GAS), snake.poolBalance());

            AssertRevert("only GAS accepted", () => snake.onNEP17Payment(player, 1L * GAS, ENTRY_MEMO));

            AssertSolvent(engine, snake, funder, player);
        }

        [Fact]
        public void Oracle_RegistrationIsOwnerGatedAndReadable()
        {
            var (engine, snake, oracle, funder, player) = Setup(0, setOracle: false);

            Assert.Equal(UInt160.Zero, snake.oracle());

            engine.SetTransactionSigners(player);
            AssertRevert("owner only", () => snake.setOracle(oracle.Hash));

            engine.SetTransactionSigners(OwnerHash);
            AssertRevert("invalid oracle", () => snake.setOracle(UInt160.Zero));
            snake.setOracle(oracle.Hash);
            Assert.Equal(oracle.Hash, snake.oracle());

            Assert.True(snake.networkMagic()!.Value > 0);
            AssertSolvent(engine, snake, funder, player);
        }

        [Fact]
        public void StartGame_ConsumesEntryReservesRewardAndMarksActive()
        {
            var (engine, snake, _, funder, player) = Setup(10);

            DepositEntry(engine, snake, player, ENTRY0);
            engine.SetTransactionSigners(player);
            BigInteger? gameId = snake.startGame(player, 0);
            Assert.Equal(BigInteger.One, gameId);
            Assert.Equal(BigInteger.One, snake.lastGameId());

            Assert.Equal(BigInteger.Zero, snake.creditOf(player));
            Assert.Equal(new BigInteger(10L * GAS + ENTRY0), snake.poolBalance());
            Assert.Equal(new BigInteger(REWARD0), snake.reservedPool());
            Assert.Equal(new BigInteger(10L * GAS + ENTRY0 - REWARD0), snake.freePool());
            Assert.Equal(BigInteger.One, snake.activeGameOf(player));
            Assert.Equal(BigInteger.One, snake.dailyStartsOf(player));
            Assert.Equal(BigInteger.One, I(snake.statsOf(player)!, "played"));

            var game = snake.getGame(gameId!.Value)!;
            Assert.Equal(BigInteger.One, I(game, "status")); // active immediately
            Assert.Equal(new BigInteger(ENTRY0), I(game, "entry"));
            Assert.Equal(new BigInteger(REWARD0), I(game, "reward"));
            Assert.Equal("", S(game, "commitment"));
            Assert.True(I(game, "dealtAt") > 0);
            Assert.Equal(I(game, "dealtAt") + LIMIT0_MS, I(game, "deadline"));

            DepositEntry(engine, snake, player, ENTRY0);
            engine.SetTransactionSigners(player);
            AssertRevert("finish your active game first", () => snake.startGame(player, 0));

            AssertSolvent(engine, snake, funder, player);
        }

        [Fact]
        public void StartGame_GuardsRejectInvalidStarts()
        {
            var (engine, snake, _, funder, player) = Setup(0);
            var other = TestEngine.GetNewSigner().Account;

            engine.SetTransactionSigners(player);
            AssertRevert("difficulty must be 0..2", () => snake.startGame(player, 3));
            AssertRevert("difficulty must be 0..2", () => snake.startGame(player, -1));
            AssertRevert("player witness required", () => snake.startGame(other, 0));
            AssertRevert("insufficient entry credit", () => snake.startGame(player, 0));

            DepositEntry(engine, snake, player, ENTRY0);
            engine.SetTransactionSigners(player);
            AssertRevert("reward pool cannot cover this game", () => snake.startGame(player, 0));
            Assert.Equal(new BigInteger(ENTRY0), snake.creditOf(player));
            Assert.Equal(BigInteger.Zero, snake.reservedPool());
            AssertSolvent(engine, snake, funder, player);
        }

        [Fact]
        public void Finalize_HappyPathPaysFullRewardAsCredit()
        {
            var (engine, snake, oracle, funder, player) = Setup(10);

            DepositEntry(engine, snake, player, ENTRY0);
            var (gameId, requestId) = StartAndFinalize(engine, snake, oracle, player, 0);
            Assert.Equal(new BigInteger(5), I(snake.getGame(gameId)!, "status")); // settling
            Assert.Equal(gameId, snake.gameOfRequest(requestId));

            long elapsed = MIN_SOLVE0_MS + 1000;
            BigInteger? evGame = null, evDifficulty = null, evElapsed = null, evPayout = null, evTotalWon = null;
            UInt160? evPlayer = null;
            snake.OnSolved += (g, p, d, e, pay, won) =>
            { evGame = g; evPlayer = p; evDifficulty = d; evElapsed = e; evPayout = pay; evTotalWon = won; };

            Deliver(engine, snake, oracle, player, requestId, true, Result(gameId, elapsed, 0, SCORE0, 0));

            Assert.Equal(new BigInteger(REWARD0), snake.creditOf(player));
            Assert.Equal(BigInteger.Zero, snake.reservedPool());
            Assert.Equal(new BigInteger(10L * GAS + ENTRY0 - REWARD0), snake.poolBalance());
            Assert.Equal(BigInteger.Zero, snake.activeGameOf(player));
            Assert.Equal(BigInteger.Zero, snake.gameOfRequest(requestId)); // context consumed

            var stats = snake.statsOf(player)!;
            Assert.Equal(BigInteger.One, I(stats, "solved"));
            Assert.Equal(new BigInteger(REWARD0), I(stats, "totalWon"));

            var top = snake.topPlayer()!;
            Assert.Equal(player, new UInt160(top[(Neo.VM.Types.PrimitiveType)"player"].GetSpan()));
            Assert.Equal(new BigInteger(REWARD0), I(top, "totalWon"));

            var game = snake.getGame(gameId)!;
            Assert.Equal(new BigInteger(2), I(game, "status"));
            Assert.Equal(new BigInteger(REWARD0), I(game, "payout"));
            Assert.Equal(new BigInteger(elapsed), I(game, "solveMs"));
            Assert.Equal(BigInteger.Zero, I(game, "undos"));
            Assert.Equal(Hex(TestCommitment(gameId)), S(game, "commitment"));
            Assert.Equal(Hex(TestAnswerHash(gameId)), S(game, "answerHash"));

            Assert.Equal(gameId, evGame);
            Assert.Equal(player, evPlayer);
            Assert.Equal(BigInteger.Zero, evDifficulty);
            Assert.Equal(new BigInteger(elapsed), evElapsed);
            Assert.Equal(new BigInteger(REWARD0), evPayout);
            Assert.Equal(new BigInteger(REWARD0), evTotalWon);

            // A settled game cannot be re-settled or expired.
            AssertRevert("request context not found",
                () => Deliver(engine, snake, oracle, player, requestId, true, Result(gameId, elapsed, 0, SCORE0, 0)));
            AssertRevert("game not expirable", () => snake.expireGame(gameId));

            AssertSolvent(engine, snake, funder, player);
        }

        [Fact]
        public void OnMiniAppResult_RejectsNonOracleCaller()
        {
            var (engine, snake, oracle, funder, player) = Setup(10);
            DepositEntry(engine, snake, player, ENTRY0);
            var (gameId, requestId) = StartAndFinalize(engine, snake, oracle, player, 0);

            // A direct call from anyone that is not the oracle is rejected.
            engine.SetTransactionSigners(player);
            AssertRevert("oracle only", () => snake.onMiniAppResult(
                requestId, APP_ID, MODULE_ID, OP_FINALIZE, player, true,
                Result(gameId, MIN_SOLVE0_MS + 1000, 0, SCORE0, 0), ""));

            // The game is still settling and untouched.
            Assert.Equal(new BigInteger(5), I(snake.getGame(gameId)!, "status"));
            Assert.Equal(BigInteger.Zero, snake.creditOf(player));
            AssertSolvent(engine, snake, funder, player);
        }

        [Fact]
        public void OnMiniAppResult_RejectsWrongOperationAndBadCodec()
        {
            var (engine, snake, oracle, funder, player) = Setup(10);
            DepositEntry(engine, snake, player, ENTRY0);
            var (gameId, requestId) = StartAndFinalize(engine, snake, oracle, player, 0);
            long elapsed = MIN_SOLVE0_MS + 1000;

            AssertRevert("unexpected operation", () => oracle.Deliver(
                snake.Hash, requestId, APP_ID, MODULE_ID, "session.start", player, true,
                Result(gameId, elapsed, 0, SCORE0, 0), ""));

            // Bad tag / length flips revert during parsing.
            byte[] good = Result(gameId, elapsed, 0, SCORE0, 0);
            byte[] badTag = (byte[])good.Clone(); badTag[0] = 0x01;
            AssertRevert("bad result tag", () => Deliver(engine, snake, oracle, player, requestId, true, badTag));
            byte[] shortResult = new byte[78];
            Array.Copy(good, shortResult, 78);
            AssertRevert("bad result length", () => Deliver(engine, snake, oracle, player, requestId, true, shortResult));

            AssertSolvent(engine, snake, funder, player);
        }

        [Fact]
        public void OnMiniAppResult_RejectsBoundsViolationsAndDifficultyMismatch()
        {
            var (engine, snake, oracle, funder, player) = Setup(10);
            DepositEntry(engine, snake, player, ENTRY0);
            var (gameId, requestId) = StartAndFinalize(engine, snake, oracle, player, 0);

            AssertRevert("difficulty mismatch",
                () => Deliver(engine, snake, oracle, player, requestId, true, Result(gameId, MIN_SOLVE0_MS + 1000, 0, SCORE0, 1)));
            AssertRevert("undos out of range",
                () => Deliver(engine, snake, oracle, player, requestId, true, Result(gameId, MIN_SOLVE0_MS + 1000, 4, SCORE0, 0)));
            AssertRevert("solved too fast",
                () => Deliver(engine, snake, oracle, player, requestId, true, Result(gameId, MIN_SOLVE0_MS - 1, 0, SCORE0, 0)));
            AssertRevert("time limit exceeded",
                () => Deliver(engine, snake, oracle, player, requestId, true, Result(gameId, LIMIT0_MS + 1, 0, SCORE0, 0)));

            // Nothing settled by the rejected attempts.
            Assert.Equal(new BigInteger(5), I(snake.getGame(gameId)!, "status"));
            Assert.Equal(BigInteger.Zero, snake.creditOf(player));
            AssertSolvent(engine, snake, funder, player);
        }

        [Fact]
        public void OnMiniAppResult_ScoreBelowTargetAndOracleFailureAreLosses()
        {
            var (engine, snake, oracle, funder, player) = Setup(10);
            DepositEntry(engine, snake, player, 2 * ENTRY0);

            // Score below target (0 < 1): loss, reservation released, no payout.
            var (g1, r1) = StartAndFinalize(engine, snake, oracle, player, 0);
            Deliver(engine, snake, oracle, player, r1, true, Result(g1, MIN_SOLVE0_MS + 1000, 0, 0, 0));
            Assert.Equal(new BigInteger(2), I(snake.getGame(g1)!, "status"));
            Assert.Equal(BigInteger.Zero, I(snake.getGame(g1)!, "payout"));
            Assert.Equal(new BigInteger(ENTRY0), snake.creditOf(player)); // 2nd entry still unspent, no payout
            Assert.Equal(BigInteger.Zero, snake.reservedPool());
            Assert.Equal(BigInteger.Zero, snake.activeGameOf(player));

            // Oracle failure: loss branch, reservation released.
            var (g2, r2) = StartAndFinalize(engine, snake, oracle, player, 0);
            Deliver(engine, snake, oracle, player, r2, false, new byte[0]);
            Assert.Equal(new BigInteger(2), I(snake.getGame(g2)!, "status"));
            Assert.Equal(BigInteger.Zero, I(snake.getGame(g2)!, "payout"));
            Assert.Equal(BigInteger.Zero, snake.reservedPool());
            Assert.Equal(BigInteger.Zero, snake.activeGameOf(player));
            Assert.Equal(BigInteger.Zero, I(snake.statsOf(player)!, "solved"));

            AssertSolvent(engine, snake, funder, player);
        }

        [Fact]
        public void Undo_SignedUndoCountBurns30PctOfBaseRewardEach()
        {
            var (engine, snake, oracle, funder, player) = Setup(10);
            AlignToFreshUtcDay(engine);
            DepositEntry(engine, snake, player, 3 * ENTRY0);

            long[] expectedPayouts = { REWARD0 * 70 / 100, REWARD0 * 40 / 100, REWARD0 * 10 / 100 };
            for (int undos = 1; undos <= 3; undos++)
            {
                var (gameId, requestId) = StartAndFinalize(engine, snake, oracle, player, 0);
                Deliver(engine, snake, oracle, player, requestId, true, Result(gameId, MIN_SOLVE0_MS + 1000, undos, SCORE0, 0));
                Assert.Equal(new BigInteger(expectedPayouts[undos - 1]), I(snake.getGame(gameId)!, "payout"));
                Assert.Equal(new BigInteger(undos), I(snake.getGame(gameId)!, "undos"));
                AssertSolvent(engine, snake, funder, player);
            }
            Assert.Equal(new BigInteger(3), I(snake.statsOf(player)!, "solved"));
            Assert.Equal(new BigInteger(expectedPayouts[0] + expectedPayouts[1] + expectedPayouts[2]),
                I(snake.statsOf(player)!, "totalWon"));

            AssertSolvent(engine, snake, funder, player);
        }

        [Fact]
        public void FinalizeGame_GuardsOwnershipAndActiveState()
        {
            var (engine, snake, oracle, funder, player) = Setup(10);
            var other = TestEngine.GetNewSigner().Account;
            DepositEntry(engine, snake, player, ENTRY0);

            engine.SetTransactionSigners(player);
            BigInteger gameId = snake.startGame(player, 0)!.Value;

            AssertRevert("game not found", () => snake.finalizeGame(999, "00"));

            engine.SetTransactionSigners(other);
            AssertRevert("player witness required", () => snake.finalizeGame(gameId, "00"));

            // Finalize once; a second finalize on a settling game is rejected.
            engine.SetTransactionSigners(player);
            snake.finalizeGame(gameId, "00");
            AssertRevert("game not in play", () => snake.finalizeGame(gameId, "00"));

            AssertSolvent(engine, snake, funder, player);
        }

        [Fact]
        public void ExpireGame_ActivePastDeadlinePlusGraceReleasesReservation()
        {
            var (engine, snake, _, funder, player) = Setup(10);
            DepositEntry(engine, snake, player, 2 * ENTRY0);

            engine.SetTransactionSigners(player);
            BigInteger gameId = snake.startGame(player, 0)!.Value;

            AssertRevert("game not expirable", () => snake.expireGame(gameId));
            AdvanceMs(engine, LIMIT0_MS + 1000);
            AssertRevert("game not expirable", () => snake.expireGame(gameId));

            AdvanceMs(engine, SETTLE_GRACE_MS);
            engine.SetTransactionSigners(funder); // permissionless
            Assert.Equal(new BigInteger(3), snake.expireGame(gameId));

            Assert.Equal(BigInteger.Zero, snake.reservedPool());
            Assert.Equal(new BigInteger(10L * GAS + ENTRY0), snake.poolBalance());
            Assert.Equal(BigInteger.Zero, snake.activeGameOf(player));
            Assert.Equal(new BigInteger(3), I(snake.getGame(gameId)!, "status"));
            AssertRevert("game not expirable", () => snake.expireGame(gameId));

            engine.SetTransactionSigners(player);
            Assert.Equal(new BigInteger(2), snake.startGame(player, 0));

            AssertSolvent(engine, snake, funder, player);
        }

        [Fact]
        public void ExpireGame_AbandonedSettlingPastGraceReleasesReservation()
        {
            var (engine, snake, oracle, funder, player) = Setup(10);
            DepositEntry(engine, snake, player, ENTRY0);

            var (gameId, _) = StartAndFinalize(engine, snake, oracle, player, 0);
            Assert.Equal(new BigInteger(5), I(snake.getGame(gameId)!, "status"));

            AssertRevert("game not expirable", () => snake.expireGame(gameId));
            AdvanceMs(engine, LIMIT0_MS + SETTLE_GRACE_MS + 1000);
            engine.SetTransactionSigners(funder);
            Assert.Equal(new BigInteger(3), snake.expireGame(gameId));
            Assert.Equal(BigInteger.Zero, snake.reservedPool());
            Assert.Equal(BigInteger.Zero, snake.activeGameOf(player));

            AssertSolvent(engine, snake, funder, player);
        }

        [Fact]
        public void Withdraw_PaysTheWholeCreditOnce()
        {
            var (engine, snake, _, funder, player) = Setup(0);

            DepositEntry(engine, snake, player, 1L * GAS);
            BigInteger before = engine.Native.GAS.BalanceOf(player) ?? 0;
            engine.SetTransactionSigners(player);
            Assert.Equal(new BigInteger(1L * GAS), snake.withdraw(player));
            Assert.Equal(before + 1L * GAS, engine.Native.GAS.BalanceOf(player));
            Assert.Equal(BigInteger.Zero, snake.creditOf(player));
            AssertRevert("no credit", () => snake.withdraw(player));

            AssertSolvent(engine, snake, funder, player);
        }

        [Fact]
        public void Admin_PauseCapAndPoolWithdrawalAreOwnerGated()
        {
            var (engine, snake, _, funder, player) = Setup(10);

            engine.SetTransactionSigners(player);
            AssertRevert("owner only", () => snake.setPaused(true));
            AssertRevert("owner only", () => snake.setDailyCap(5));
            AssertRevert("owner only", () => snake.withdrawPool(player, 1L * GAS));

            engine.SetTransactionSigners(OwnerHash);
            snake.setPaused(true);
            Assert.True(snake.isPaused());
            DepositEntry(engine, snake, player, ENTRY0);
            engine.SetTransactionSigners(player);
            AssertRevert("contract is paused", () => snake.startGame(player, 0));
            engine.SetTransactionSigners(OwnerHash);
            snake.setPaused(false);

            AssertRevert("cap must be 1..100", () => snake.setDailyCap(0));
            AssertRevert("cap must be 1..100", () => snake.setDailyCap(101));
            snake.setDailyCap(2);
            Assert.Equal(new BigInteger(2), snake.dailyCap());
            Assert.Equal(new BigInteger(2), I(snake.getConfig()!, "dailyCap"));

            // WithdrawPool can never touch the reward reserved by an active game.
            engine.SetTransactionSigners(player);
            snake.startGame(player, 0);
            engine.SetTransactionSigners(OwnerHash);
            AssertRevert("insufficient free pool", () => snake.withdrawPool(funder, 10L * GAS));
            BigInteger free = snake.freePool() ?? 0;
            BigInteger funderBefore = engine.Native.GAS.BalanceOf(funder) ?? 0;
            snake.withdrawPool(funder, free);
            Assert.Equal(funderBefore + free, engine.Native.GAS.BalanceOf(funder));
            Assert.Equal(new BigInteger(REWARD0), snake.poolBalance());
            Assert.Equal(BigInteger.Zero, snake.freePool());

            AssertSolvent(engine, snake, funder, player);
        }

        [Fact]
        public void DailyCap_NinthStartRevertsUntilTheNextUtcDay()
        {
            var (engine, snake, oracle, funder, player) = Setup(20);
            AlignToFreshUtcDay(engine);

            DepositEntry(engine, snake, player, 8 * ENTRY0);
            for (int i = 0; i < 8; i++)
            {
                var (gameId, requestId) = StartAndFinalize(engine, snake, oracle, player, 0);
                Deliver(engine, snake, oracle, player, requestId, true, Result(gameId, MIN_SOLVE0_MS + 1000, 0, SCORE0, 0));
            }
            Assert.Equal(new BigInteger(8), snake.dailyStartsOf(player));
            Assert.Equal(new BigInteger(8), I(snake.statsOf(player)!, "solved"));

            engine.SetTransactionSigners(player);
            AssertRevert("daily start cap reached", () => snake.startGame(player, 0));

            AdvanceMs(engine, MS_PER_DAY);
            Assert.Equal(BigInteger.Zero, snake.dailyStartsOf(player));
            engine.SetTransactionSigners(player);
            Assert.Equal(new BigInteger(9), snake.startGame(player, 0));
            Assert.Equal(BigInteger.One, snake.dailyStartsOf(player));

            AssertSolvent(engine, snake, funder, player);
        }

        [Fact]
        public void GetConfig_ExposesTheFullTuningTable()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppSnakeBounty");
            var snake = engine.Deploy<SnakeBountyContract>(nef, manifest);

            var cfg = snake.getConfig()!;
            Assert.Equal(new BigInteger(ENTRY0), I(cfg, "entry0"));
            Assert.Equal(new BigInteger(REWARD0), I(cfg, "reward0"));
            Assert.Equal(new BigInteger(LIMIT0_MS), I(cfg, "limitMs0"));
            Assert.Equal(new BigInteger(MIN_SOLVE0_MS), I(cfg, "minSolveMs0"));
            Assert.Equal(new BigInteger(3), I(cfg, "maxUndos"));
            Assert.Equal(new BigInteger(30), I(cfg, "undoPenaltyPct"));
            Assert.Equal(new BigInteger(8), I(cfg, "dailyCap"));
            Assert.Equal(new BigInteger(SETTLE_GRACE_MS), I(cfg, "settleGraceMs"));

            Assert.Equal(UInt160.Zero, snake.oracle());
            Assert.True(snake.networkMagic()!.Value > 0);

            var top = snake.topPlayer()!;
            Assert.Equal("", top[(Neo.VM.Types.PrimitiveType)"player"].GetString());
            Assert.Equal(BigInteger.Zero, I(top, "totalWon"));
        }

    }
}
