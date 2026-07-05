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
    public abstract class Game2048Contract : SmartContract
    {
        protected Game2048Contract(SmartContractInitialize initialize) : base(initialize) { }
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

        public delegate void delSolved(BigInteger? gameId, UInt160? player, BigInteger? difficulty, BigInteger? elapsedMs, BigInteger? undos, BigInteger? payout, BigInteger? totalWon);
        [DisplayName("Solved")]
        public event delSolved? OnSolved;
    }

    public class MiniAppGame2048Tests
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
        private const long LIMIT0_MS = 240_000;        // 15 min easy limit
        private const long MIN_SOLVE0_MS = 60_000;     // 90s easy min-solve floor
        private const long SETTLE_GRACE_MS = 600_000;  // settle window past the deadline
        private const long MS_PER_DAY = 86_400_000;
        private const int SCORE0 = 11;                  // winning score >= target for this game
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
        private static void AssertSolvent(TestEngine engine, Game2048Contract c, params UInt160[] players)
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
            SHA256.HashData(Encoding.UTF8.GetBytes($"game2048-problem-{gameId}"));
        private static byte[] TestAnswerHash(BigInteger gameId) =>
            SHA256.HashData(Encoding.UTF8.GetBytes($"game2048-answer-{gameId}"));

        private static (TestEngine engine, Game2048Contract app2048, GameOracleMockFixtureContract oracle, UInt160 funder, UInt160 player)
            Setup(long poolGas, bool setOracle = true)
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppGame2048");
            var app2048 = engine.Deploy<Game2048Contract>(nef, manifest);
            var oracle = GameOracleMockFixture.Deploy(engine, OwnerHash);
            if (setOracle)
            {
                engine.SetTransactionSigners(OwnerHash);
                app2048.setOracle(oracle.Hash);
            }
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

        // Drive one settlement: player starts, finalizes (kernel returns a requestId),
        // then the oracle delivers the finalize result to onMiniAppResult.
        private static (BigInteger gameId, BigInteger requestId) StartAndFinalize(
            TestEngine engine, Game2048Contract c, GameOracleMockFixtureContract oracle,
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

        private static void Deliver(TestEngine engine, Game2048Contract c, GameOracleMockFixtureContract oracle,
            UInt160 player, BigInteger requestId, bool success, byte[] result)
        {
            engine.SetTransactionSigners(OwnerHash);
            oracle.Deliver(c.Hash, requestId, APP_ID, MODULE_ID, OP_FINALIZE, player, success, result, "");
        }

        [Fact]
        public void Deposits_FundAndEntryPathsCreditTheRightLedgers()
        {
            var (engine, app2048, _, funder, player) = Setup(0);

            engine.SetTransactionSigners(funder);
            engine.Native.GAS.Transfer(funder, app2048.Hash, 5L * GAS, FUND_MEMO);
            Assert.Equal(new BigInteger(5L * GAS), app2048.poolBalance());
            Assert.Equal(BigInteger.Zero, app2048.creditOf(funder));

            DepositEntry(engine, app2048, player, 1L * GAS);
            Assert.Equal(new BigInteger(1L * GAS), app2048.creditOf(player));
            Assert.Equal(new BigInteger(5L * GAS), app2048.poolBalance());

            AssertRevert("only GAS accepted", () => app2048.onNEP17Payment(player, 1L * GAS, ENTRY_MEMO));

            AssertSolvent(engine, app2048, funder, player);
        }

        [Fact]
        public void Oracle_RegistrationIsOwnerGatedAndReadable()
        {
            var (engine, app2048, oracle, funder, player) = Setup(0, setOracle: false);

            Assert.Equal(UInt160.Zero, app2048.oracle());

            engine.SetTransactionSigners(player);
            AssertRevert("owner only", () => app2048.setOracle(oracle.Hash));

            engine.SetTransactionSigners(OwnerHash);
            AssertRevert("invalid oracle", () => app2048.setOracle(UInt160.Zero));
            app2048.setOracle(oracle.Hash);
            Assert.Equal(oracle.Hash, app2048.oracle());

            Assert.True(app2048.networkMagic()!.Value > 0);
            AssertSolvent(engine, app2048, funder, player);
        }

        [Fact]
        public void StartGame_ConsumesEntryReservesRewardAndMarksActive()
        {
            var (engine, app2048, _, funder, player) = Setup(10);

            DepositEntry(engine, app2048, player, ENTRY0);
            engine.SetTransactionSigners(player);
            BigInteger? gameId = app2048.startGame(player, 0);
            Assert.Equal(BigInteger.One, gameId);
            Assert.Equal(BigInteger.One, app2048.lastGameId());

            Assert.Equal(BigInteger.Zero, app2048.creditOf(player));
            Assert.Equal(new BigInteger(10L * GAS + ENTRY0), app2048.poolBalance());
            Assert.Equal(new BigInteger(REWARD0), app2048.reservedPool());
            Assert.Equal(new BigInteger(10L * GAS + ENTRY0 - REWARD0), app2048.freePool());
            Assert.Equal(BigInteger.One, app2048.activeGameOf(player));
            Assert.Equal(BigInteger.One, app2048.dailyStartsOf(player));
            Assert.Equal(BigInteger.One, I(app2048.statsOf(player)!, "played"));

            var game = app2048.getGame(gameId!.Value)!;
            Assert.Equal(BigInteger.One, I(game, "status")); // active immediately
            Assert.Equal(new BigInteger(ENTRY0), I(game, "entry"));
            Assert.Equal(new BigInteger(REWARD0), I(game, "reward"));
            Assert.Equal("", S(game, "commitment"));
            Assert.True(I(game, "dealtAt") > 0);
            Assert.Equal(I(game, "dealtAt") + LIMIT0_MS, I(game, "deadline"));

            DepositEntry(engine, app2048, player, ENTRY0);
            engine.SetTransactionSigners(player);
            AssertRevert("finish your active game first", () => app2048.startGame(player, 0));

            AssertSolvent(engine, app2048, funder, player);
        }

        [Fact]
        public void StartGame_GuardsRejectInvalidStarts()
        {
            var (engine, app2048, _, funder, player) = Setup(0);
            var other = TestEngine.GetNewSigner().Account;

            engine.SetTransactionSigners(player);
            AssertRevert("difficulty must be 0..2", () => app2048.startGame(player, 3));
            AssertRevert("difficulty must be 0..2", () => app2048.startGame(player, -1));
            AssertRevert("player witness required", () => app2048.startGame(other, 0));
            AssertRevert("insufficient entry credit", () => app2048.startGame(player, 0));

            DepositEntry(engine, app2048, player, ENTRY0);
            engine.SetTransactionSigners(player);
            AssertRevert("reward pool cannot cover this game", () => app2048.startGame(player, 0));
            Assert.Equal(new BigInteger(ENTRY0), app2048.creditOf(player));
            Assert.Equal(BigInteger.Zero, app2048.reservedPool());
            AssertSolvent(engine, app2048, funder, player);
        }

        [Fact]
        public void Finalize_HappyPathPaysFullRewardAsCredit()
        {
            var (engine, app2048, oracle, funder, player) = Setup(10);

            DepositEntry(engine, app2048, player, ENTRY0);
            var (gameId, requestId) = StartAndFinalize(engine, app2048, oracle, player, 0);
            Assert.Equal(new BigInteger(5), I(app2048.getGame(gameId)!, "status")); // settling
            Assert.Equal(gameId, app2048.gameOfRequest(requestId));

            long elapsed = MIN_SOLVE0_MS + 1000;
            BigInteger? evGame = null, evDifficulty = null, evElapsed = null, evUndos = null, evPayout = null, evTotalWon = null;
            UInt160? evPlayer = null;
            app2048.OnSolved += (g, p, d, e, u, pay, won) =>
            { evGame = g; evPlayer = p; evDifficulty = d; evElapsed = e; evUndos = u; evPayout = pay; evTotalWon = won; };

            Deliver(engine, app2048, oracle, player, requestId, true, Result(gameId, elapsed, 0, SCORE0, 0));

            Assert.Equal(new BigInteger(REWARD0), app2048.creditOf(player));
            Assert.Equal(BigInteger.Zero, app2048.reservedPool());
            Assert.Equal(new BigInteger(10L * GAS + ENTRY0 - REWARD0), app2048.poolBalance());
            Assert.Equal(BigInteger.Zero, app2048.activeGameOf(player));
            Assert.Equal(BigInteger.Zero, app2048.gameOfRequest(requestId)); // context consumed

            var stats = app2048.statsOf(player)!;
            Assert.Equal(BigInteger.One, I(stats, "solved"));
            Assert.Equal(new BigInteger(REWARD0), I(stats, "totalWon"));

            var top = app2048.topPlayer()!;
            Assert.Equal(player, new UInt160(top[(Neo.VM.Types.PrimitiveType)"player"].GetSpan()));
            Assert.Equal(new BigInteger(REWARD0), I(top, "totalWon"));

            var game = app2048.getGame(gameId)!;
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
            Assert.Equal(BigInteger.Zero, evUndos);
            Assert.Equal(new BigInteger(REWARD0), evPayout);
            Assert.Equal(new BigInteger(REWARD0), evTotalWon);

            // A settled game cannot be re-settled or expired.
            AssertRevert("request context not found",
                () => Deliver(engine, app2048, oracle, player, requestId, true, Result(gameId, elapsed, 0, SCORE0, 0)));
            AssertRevert("game not expirable", () => app2048.expireGame(gameId));

            AssertSolvent(engine, app2048, funder, player);
        }

        [Fact]
        public void OnMiniAppResult_RejectsNonOracleCaller()
        {
            var (engine, app2048, oracle, funder, player) = Setup(10);
            DepositEntry(engine, app2048, player, ENTRY0);
            var (gameId, requestId) = StartAndFinalize(engine, app2048, oracle, player, 0);

            // A direct call from anyone that is not the oracle is rejected.
            engine.SetTransactionSigners(player);
            AssertRevert("oracle only", () => app2048.onMiniAppResult(
                requestId, APP_ID, MODULE_ID, OP_FINALIZE, player, true,
                Result(gameId, MIN_SOLVE0_MS + 1000, 0, SCORE0, 0), ""));

            // The game is still settling and untouched.
            Assert.Equal(new BigInteger(5), I(app2048.getGame(gameId)!, "status"));
            Assert.Equal(BigInteger.Zero, app2048.creditOf(player));
            AssertSolvent(engine, app2048, funder, player);
        }

        [Fact]
        public void OnMiniAppResult_RejectsWrongOperationAndBadCodec()
        {
            var (engine, app2048, oracle, funder, player) = Setup(10);
            DepositEntry(engine, app2048, player, ENTRY0);
            var (gameId, requestId) = StartAndFinalize(engine, app2048, oracle, player, 0);
            long elapsed = MIN_SOLVE0_MS + 1000;

            AssertRevert("unexpected operation", () => oracle.Deliver(
                app2048.Hash, requestId, APP_ID, MODULE_ID, "session.start", player, true,
                Result(gameId, elapsed, 0, SCORE0, 0), ""));

            // Bad tag / length flips revert during parsing.
            byte[] good = Result(gameId, elapsed, 0, SCORE0, 0);
            byte[] badTag = (byte[])good.Clone(); badTag[0] = 0x01;
            AssertRevert("bad result tag", () => Deliver(engine, app2048, oracle, player, requestId, true, badTag));
            byte[] shortResult = new byte[78];
            Array.Copy(good, shortResult, 78);
            AssertRevert("bad result length", () => Deliver(engine, app2048, oracle, player, requestId, true, shortResult));

            AssertSolvent(engine, app2048, funder, player);
        }

        [Fact]
        public void OnMiniAppResult_RejectsBoundsViolationsAndDifficultyMismatch()
        {
            var (engine, app2048, oracle, funder, player) = Setup(10);
            DepositEntry(engine, app2048, player, ENTRY0);
            var (gameId, requestId) = StartAndFinalize(engine, app2048, oracle, player, 0);

            AssertRevert("difficulty mismatch",
                () => Deliver(engine, app2048, oracle, player, requestId, true, Result(gameId, MIN_SOLVE0_MS + 1000, 0, SCORE0, 1)));
            AssertRevert("undos out of range",
                () => Deliver(engine, app2048, oracle, player, requestId, true, Result(gameId, MIN_SOLVE0_MS + 1000, 4, SCORE0, 0)));
            AssertRevert("solved too fast",
                () => Deliver(engine, app2048, oracle, player, requestId, true, Result(gameId, MIN_SOLVE0_MS - 1, 0, SCORE0, 0)));
            AssertRevert("time limit exceeded",
                () => Deliver(engine, app2048, oracle, player, requestId, true, Result(gameId, LIMIT0_MS + 1, 0, SCORE0, 0)));

            // Nothing settled by the rejected attempts.
            Assert.Equal(new BigInteger(5), I(app2048.getGame(gameId)!, "status"));
            Assert.Equal(BigInteger.Zero, app2048.creditOf(player));
            AssertSolvent(engine, app2048, funder, player);
        }

        [Fact]
        public void OnMiniAppResult_ScoreBelowTargetAndOracleFailureAreLosses()
        {
            var (engine, app2048, oracle, funder, player) = Setup(10);
            DepositEntry(engine, app2048, player, 2 * ENTRY0);

            // Score below target (0 < 1): loss, reservation released, no payout.
            var (g1, r1) = StartAndFinalize(engine, app2048, oracle, player, 0);
            Deliver(engine, app2048, oracle, player, r1, true, Result(g1, MIN_SOLVE0_MS + 1000, 0, 0, 0));
            Assert.Equal(new BigInteger(2), I(app2048.getGame(g1)!, "status"));
            Assert.Equal(BigInteger.Zero, I(app2048.getGame(g1)!, "payout"));
            Assert.Equal(new BigInteger(ENTRY0), app2048.creditOf(player)); // 2nd entry still unspent, no payout
            Assert.Equal(BigInteger.Zero, app2048.reservedPool());
            Assert.Equal(BigInteger.Zero, app2048.activeGameOf(player));

            // Oracle failure: loss branch, reservation released.
            var (g2, r2) = StartAndFinalize(engine, app2048, oracle, player, 0);
            Deliver(engine, app2048, oracle, player, r2, false, new byte[0]);
            Assert.Equal(new BigInteger(2), I(app2048.getGame(g2)!, "status"));
            Assert.Equal(BigInteger.Zero, I(app2048.getGame(g2)!, "payout"));
            Assert.Equal(BigInteger.Zero, app2048.reservedPool());
            Assert.Equal(BigInteger.Zero, app2048.activeGameOf(player));
            Assert.Equal(BigInteger.Zero, I(app2048.statsOf(player)!, "solved"));

            AssertSolvent(engine, app2048, funder, player);
        }

        [Fact]
        public void Undo_SignedUndoCountBurns30PctOfBaseRewardEach()
        {
            var (engine, app2048, oracle, funder, player) = Setup(10);
            AlignToFreshUtcDay(engine);
            DepositEntry(engine, app2048, player, 3 * ENTRY0);

            long[] expectedPayouts = { REWARD0 * 70 / 100, REWARD0 * 40 / 100, REWARD0 * 10 / 100 };
            for (int undos = 1; undos <= 3; undos++)
            {
                var (gameId, requestId) = StartAndFinalize(engine, app2048, oracle, player, 0);
                Deliver(engine, app2048, oracle, player, requestId, true, Result(gameId, MIN_SOLVE0_MS + 1000, undos, SCORE0, 0));
                Assert.Equal(new BigInteger(expectedPayouts[undos - 1]), I(app2048.getGame(gameId)!, "payout"));
                Assert.Equal(new BigInteger(undos), I(app2048.getGame(gameId)!, "undos"));
                AssertSolvent(engine, app2048, funder, player);
            }
            Assert.Equal(new BigInteger(3), I(app2048.statsOf(player)!, "solved"));
            Assert.Equal(new BigInteger(expectedPayouts[0] + expectedPayouts[1] + expectedPayouts[2]),
                I(app2048.statsOf(player)!, "totalWon"));

            AssertSolvent(engine, app2048, funder, player);
        }

        [Fact]
        public void FinalizeGame_GuardsOwnershipAndActiveState()
        {
            var (engine, app2048, oracle, funder, player) = Setup(10);
            var other = TestEngine.GetNewSigner().Account;
            DepositEntry(engine, app2048, player, ENTRY0);

            engine.SetTransactionSigners(player);
            BigInteger gameId = app2048.startGame(player, 0)!.Value;

            AssertRevert("game not found", () => app2048.finalizeGame(999, "00"));

            engine.SetTransactionSigners(other);
            AssertRevert("player witness required", () => app2048.finalizeGame(gameId, "00"));

            // Finalize once; a second finalize on a settling game is rejected.
            engine.SetTransactionSigners(player);
            app2048.finalizeGame(gameId, "00");
            AssertRevert("game not in play", () => app2048.finalizeGame(gameId, "00"));

            AssertSolvent(engine, app2048, funder, player);
        }

        [Fact]
        public void ExpireGame_ActivePastDeadlinePlusGraceReleasesReservation()
        {
            var (engine, app2048, _, funder, player) = Setup(10);
            DepositEntry(engine, app2048, player, 2 * ENTRY0);

            engine.SetTransactionSigners(player);
            BigInteger gameId = app2048.startGame(player, 0)!.Value;

            AssertRevert("game not expirable", () => app2048.expireGame(gameId));
            AdvanceMs(engine, LIMIT0_MS + 1000);
            AssertRevert("game not expirable", () => app2048.expireGame(gameId));

            AdvanceMs(engine, SETTLE_GRACE_MS);
            engine.SetTransactionSigners(funder); // permissionless
            Assert.Equal(new BigInteger(3), app2048.expireGame(gameId));

            Assert.Equal(BigInteger.Zero, app2048.reservedPool());
            Assert.Equal(new BigInteger(10L * GAS + ENTRY0), app2048.poolBalance());
            Assert.Equal(BigInteger.Zero, app2048.activeGameOf(player));
            Assert.Equal(new BigInteger(3), I(app2048.getGame(gameId)!, "status"));
            AssertRevert("game not expirable", () => app2048.expireGame(gameId));

            engine.SetTransactionSigners(player);
            Assert.Equal(new BigInteger(2), app2048.startGame(player, 0));

            AssertSolvent(engine, app2048, funder, player);
        }

        [Fact]
        public void ExpireGame_AbandonedSettlingPastGraceReleasesReservation()
        {
            var (engine, app2048, oracle, funder, player) = Setup(10);
            DepositEntry(engine, app2048, player, ENTRY0);

            var (gameId, _) = StartAndFinalize(engine, app2048, oracle, player, 0);
            Assert.Equal(new BigInteger(5), I(app2048.getGame(gameId)!, "status"));

            AssertRevert("game not expirable", () => app2048.expireGame(gameId));
            AdvanceMs(engine, LIMIT0_MS + SETTLE_GRACE_MS + 1000);
            engine.SetTransactionSigners(funder);
            Assert.Equal(new BigInteger(3), app2048.expireGame(gameId));
            Assert.Equal(BigInteger.Zero, app2048.reservedPool());
            Assert.Equal(BigInteger.Zero, app2048.activeGameOf(player));

            AssertSolvent(engine, app2048, funder, player);
        }

        [Fact]
        public void Withdraw_PaysTheWholeCreditOnce()
        {
            var (engine, app2048, _, funder, player) = Setup(0);

            DepositEntry(engine, app2048, player, 1L * GAS);
            BigInteger before = engine.Native.GAS.BalanceOf(player) ?? 0;
            engine.SetTransactionSigners(player);
            Assert.Equal(new BigInteger(1L * GAS), app2048.withdraw(player));
            Assert.Equal(before + 1L * GAS, engine.Native.GAS.BalanceOf(player));
            Assert.Equal(BigInteger.Zero, app2048.creditOf(player));
            AssertRevert("no credit", () => app2048.withdraw(player));

            AssertSolvent(engine, app2048, funder, player);
        }

        [Fact]
        public void Admin_PauseCapAndPoolWithdrawalAreOwnerGated()
        {
            var (engine, app2048, _, funder, player) = Setup(10);

            engine.SetTransactionSigners(player);
            AssertRevert("owner only", () => app2048.setPaused(true));
            AssertRevert("owner only", () => app2048.setDailyCap(5));
            AssertRevert("owner only", () => app2048.withdrawPool(player, 1L * GAS));

            engine.SetTransactionSigners(OwnerHash);
            app2048.setPaused(true);
            Assert.True(app2048.isPaused());
            DepositEntry(engine, app2048, player, ENTRY0);
            engine.SetTransactionSigners(player);
            AssertRevert("contract is paused", () => app2048.startGame(player, 0));
            engine.SetTransactionSigners(OwnerHash);
            app2048.setPaused(false);

            AssertRevert("cap must be 1..100", () => app2048.setDailyCap(0));
            AssertRevert("cap must be 1..100", () => app2048.setDailyCap(101));
            app2048.setDailyCap(2);
            Assert.Equal(new BigInteger(2), app2048.dailyCap());
            Assert.Equal(new BigInteger(2), I(app2048.getConfig()!, "dailyCap"));

            // WithdrawPool can never touch the reward reserved by an active game.
            engine.SetTransactionSigners(player);
            app2048.startGame(player, 0);
            engine.SetTransactionSigners(OwnerHash);
            AssertRevert("insufficient free pool", () => app2048.withdrawPool(funder, 10L * GAS));
            BigInteger free = app2048.freePool() ?? 0;
            BigInteger funderBefore = engine.Native.GAS.BalanceOf(funder) ?? 0;
            app2048.withdrawPool(funder, free);
            Assert.Equal(funderBefore + free, engine.Native.GAS.BalanceOf(funder));
            Assert.Equal(new BigInteger(REWARD0), app2048.poolBalance());
            Assert.Equal(BigInteger.Zero, app2048.freePool());

            AssertSolvent(engine, app2048, funder, player);
        }

        [Fact]
        public void DailyCap_NinthStartRevertsUntilTheNextUtcDay()
        {
            var (engine, app2048, oracle, funder, player) = Setup(20);
            AlignToFreshUtcDay(engine);

            DepositEntry(engine, app2048, player, 8 * ENTRY0);
            for (int i = 0; i < 8; i++)
            {
                var (gameId, requestId) = StartAndFinalize(engine, app2048, oracle, player, 0);
                Deliver(engine, app2048, oracle, player, requestId, true, Result(gameId, MIN_SOLVE0_MS + 1000, 0, SCORE0, 0));
            }
            Assert.Equal(new BigInteger(8), app2048.dailyStartsOf(player));
            Assert.Equal(new BigInteger(8), I(app2048.statsOf(player)!, "solved"));

            engine.SetTransactionSigners(player);
            AssertRevert("daily start cap reached", () => app2048.startGame(player, 0));

            AdvanceMs(engine, MS_PER_DAY);
            Assert.Equal(BigInteger.Zero, app2048.dailyStartsOf(player));
            engine.SetTransactionSigners(player);
            Assert.Equal(new BigInteger(9), app2048.startGame(player, 0));
            Assert.Equal(BigInteger.One, app2048.dailyStartsOf(player));

            AssertSolvent(engine, app2048, funder, player);
        }

        [Fact]
        public void GetConfig_ExposesTheFullTuningTable()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppGame2048");
            var app2048 = engine.Deploy<Game2048Contract>(nef, manifest);

            var cfg = app2048.getConfig()!;
            Assert.Equal(new BigInteger(ENTRY0), I(cfg, "entry0"));
            Assert.Equal(new BigInteger(REWARD0), I(cfg, "reward0"));
            Assert.Equal(new BigInteger(LIMIT0_MS), I(cfg, "limitMs0"));
            Assert.Equal(new BigInteger(MIN_SOLVE0_MS), I(cfg, "minSolveMs0"));
            Assert.Equal(new BigInteger(3), I(cfg, "maxUndos"));
            Assert.Equal(new BigInteger(30), I(cfg, "undoPenaltyPct"));
            Assert.Equal(new BigInteger(8), I(cfg, "dailyCap"));
            Assert.Equal(new BigInteger(SETTLE_GRACE_MS), I(cfg, "settleGraceMs"));

            Assert.Equal(UInt160.Zero, app2048.oracle());
            Assert.True(app2048.networkMagic()!.Value > 0);

            var top = app2048.topPlayer()!;
            Assert.Equal("", top[(Neo.VM.Types.PrimitiveType)"player"].GetString());
            Assert.Equal(BigInteger.Zero, I(top, "totalWon"));
        }

    }
}
