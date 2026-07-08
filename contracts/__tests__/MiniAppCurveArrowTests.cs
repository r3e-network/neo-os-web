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
    public abstract class CurveArrowContract : SmartContract
    {
        protected CurveArrowContract(SmartContractInitialize initialize) : base(initialize) { }
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

    public class MiniAppCurveArrowTests
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
        private const long LIMIT0_MS = 180_000;        // 3 min easy limit
        private const long MIN_SOLVE0_MS = 10_000;     // 10s easy min-solve floor
        private const long SETTLE_GRACE_MS = 600_000;  // settle window past the deadline
        private const long MS_PER_DAY = 86_400_000;
        private const int SCORE0 = 3;                  // winning levels cleared >= easy target (3)
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
        private static void AssertSolvent(TestEngine engine, CurveArrowContract c, params UInt160[] players)
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
            SHA256.HashData(Encoding.UTF8.GetBytes($"curve-arrow-problem-{gameId}"));
        private static byte[] TestAnswerHash(BigInteger gameId) =>
            SHA256.HashData(Encoding.UTF8.GetBytes($"curve-arrow-answer-{gameId}"));

        private static (TestEngine engine, CurveArrowContract arrow, GameOracleMockFixtureContract oracle, UInt160 funder, UInt160 player)
            Setup(long poolGas, bool setOracle = true)
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppCurveArrow");
            var arrow = engine.Deploy<CurveArrowContract>(nef, manifest);
            var oracle = GameOracleMockFixture.Deploy(engine, OwnerHash);
            if (setOracle)
            {
                engine.SetTransactionSigners(OwnerHash);
                arrow.setOracle(oracle.Hash);
            }
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

        // Drive one settlement: player starts, finalizes (kernel returns a requestId),
        // then the oracle delivers the finalize result to onMiniAppResult.
        private static (BigInteger gameId, BigInteger requestId) StartAndFinalize(
            TestEngine engine, CurveArrowContract c, GameOracleMockFixtureContract oracle,
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

        private static void Deliver(TestEngine engine, CurveArrowContract c, GameOracleMockFixtureContract oracle,
            UInt160 player, BigInteger requestId, bool success, byte[] result)
        {
            engine.SetTransactionSigners(OwnerHash);
            oracle.Deliver(c.Hash, requestId, APP_ID, MODULE_ID, OP_FINALIZE, player, success, result, "");
        }

        [Fact]
        public void Deposits_FundAndEntryPathsCreditTheRightLedgers()
        {
            var (engine, arrow, _, funder, player) = Setup(0);

            engine.SetTransactionSigners(funder);
            engine.Native.GAS.Transfer(funder, arrow.Hash, 5L * GAS, FUND_MEMO);
            Assert.Equal(new BigInteger(5L * GAS), arrow.poolBalance());
            Assert.Equal(BigInteger.Zero, arrow.creditOf(funder));

            DepositEntry(engine, arrow, player, 1L * GAS);
            Assert.Equal(new BigInteger(1L * GAS), arrow.creditOf(player));
            Assert.Equal(new BigInteger(5L * GAS), arrow.poolBalance());

            AssertRevert("only GAS accepted", () => arrow.onNEP17Payment(player, 1L * GAS, ENTRY_MEMO));

            AssertSolvent(engine, arrow, funder, player);
        }

        [Fact]
        public void Oracle_RegistrationIsOwnerGatedAndReadable()
        {
            var (engine, arrow, oracle, funder, player) = Setup(0, setOracle: false);

            Assert.Equal(UInt160.Zero, arrow.oracle());

            engine.SetTransactionSigners(player);
            AssertRevert("owner only", () => arrow.setOracle(oracle.Hash));

            engine.SetTransactionSigners(OwnerHash);
            AssertRevert("invalid oracle", () => arrow.setOracle(UInt160.Zero));
            arrow.setOracle(oracle.Hash);
            Assert.Equal(oracle.Hash, arrow.oracle());

            Assert.True(arrow.networkMagic()!.Value > 0);
            AssertSolvent(engine, arrow, funder, player);
        }

        [Fact]
        public void StartGame_ConsumesEntryReservesRewardAndMarksActive()
        {
            var (engine, arrow, _, funder, player) = Setup(10);

            DepositEntry(engine, arrow, player, ENTRY0);
            engine.SetTransactionSigners(player);
            BigInteger? gameId = arrow.startGame(player, 0);
            Assert.Equal(BigInteger.One, gameId);
            Assert.Equal(BigInteger.One, arrow.lastGameId());

            Assert.Equal(BigInteger.Zero, arrow.creditOf(player));
            Assert.Equal(new BigInteger(10L * GAS + ENTRY0), arrow.poolBalance());
            Assert.Equal(new BigInteger(REWARD0), arrow.reservedPool());
            Assert.Equal(new BigInteger(10L * GAS + ENTRY0 - REWARD0), arrow.freePool());
            Assert.Equal(BigInteger.One, arrow.activeGameOf(player));
            Assert.Equal(BigInteger.One, arrow.dailyStartsOf(player));
            Assert.Equal(BigInteger.One, I(arrow.statsOf(player)!, "played"));

            var game = arrow.getGame(gameId!.Value)!;
            Assert.Equal(BigInteger.One, I(game, "status")); // active immediately
            Assert.Equal(new BigInteger(ENTRY0), I(game, "entry"));
            Assert.Equal(new BigInteger(REWARD0), I(game, "reward"));
            Assert.Equal("", S(game, "commitment"));
            Assert.True(I(game, "dealtAt") > 0);
            Assert.Equal(I(game, "dealtAt") + LIMIT0_MS, I(game, "deadline"));

            DepositEntry(engine, arrow, player, ENTRY0);
            engine.SetTransactionSigners(player);
            AssertRevert("finish your active game first", () => arrow.startGame(player, 0));

            AssertSolvent(engine, arrow, funder, player);
        }

        [Fact]
        public void StartGame_GuardsRejectInvalidStarts()
        {
            var (engine, arrow, _, funder, player) = Setup(0);
            var other = TestEngine.GetNewSigner().Account;

            engine.SetTransactionSigners(player);
            AssertRevert("difficulty must be 0..2", () => arrow.startGame(player, 3));
            AssertRevert("difficulty must be 0..2", () => arrow.startGame(player, -1));
            AssertRevert("player witness required", () => arrow.startGame(other, 0));
            AssertRevert("insufficient entry credit", () => arrow.startGame(player, 0));

            DepositEntry(engine, arrow, player, ENTRY0);
            engine.SetTransactionSigners(player);
            AssertRevert("reward pool cannot cover this game", () => arrow.startGame(player, 0));
            Assert.Equal(new BigInteger(ENTRY0), arrow.creditOf(player));
            Assert.Equal(BigInteger.Zero, arrow.reservedPool());
            AssertSolvent(engine, arrow, funder, player);
        }

        [Fact]
        public void Finalize_HappyPathPaysFullRewardAsCredit()
        {
            var (engine, arrow, oracle, funder, player) = Setup(10);

            DepositEntry(engine, arrow, player, ENTRY0);
            var (gameId, requestId) = StartAndFinalize(engine, arrow, oracle, player, 0);
            Assert.Equal(new BigInteger(5), I(arrow.getGame(gameId)!, "status")); // settling
            Assert.Equal(gameId, arrow.gameOfRequest(requestId));

            long elapsed = MIN_SOLVE0_MS + 1000;
            BigInteger? evGame = null, evDifficulty = null, evElapsed = null, evPayout = null, evTotalWon = null;
            UInt160? evPlayer = null;
            arrow.OnSolved += (g, p, d, e, pay, won) =>
            { evGame = g; evPlayer = p; evDifficulty = d; evElapsed = e; evPayout = pay; evTotalWon = won; };

            Deliver(engine, arrow, oracle, player, requestId, true, Result(gameId, elapsed, 0, SCORE0, 0));

            Assert.Equal(new BigInteger(REWARD0), arrow.creditOf(player));
            Assert.Equal(BigInteger.Zero, arrow.reservedPool());
            Assert.Equal(new BigInteger(10L * GAS + ENTRY0 - REWARD0), arrow.poolBalance());
            Assert.Equal(BigInteger.Zero, arrow.activeGameOf(player));
            Assert.Equal(BigInteger.Zero, arrow.gameOfRequest(requestId)); // context consumed

            var stats = arrow.statsOf(player)!;
            Assert.Equal(BigInteger.One, I(stats, "solved"));
            Assert.Equal(new BigInteger(REWARD0), I(stats, "totalWon"));

            var top = arrow.topPlayer()!;
            Assert.Equal(player, new UInt160(top[(Neo.VM.Types.PrimitiveType)"player"].GetSpan()));
            Assert.Equal(new BigInteger(REWARD0), I(top, "totalWon"));

            var game = arrow.getGame(gameId)!;
            Assert.Equal(new BigInteger(2), I(game, "status"));
            Assert.Equal(new BigInteger(REWARD0), I(game, "payout"));
            Assert.Equal(new BigInteger(elapsed), I(game, "solveMs"));
            Assert.Equal(BigInteger.Zero, I(game, "undos"));
            Assert.Equal(new BigInteger(SCORE0), I(game, "levelsCleared"));
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
                () => Deliver(engine, arrow, oracle, player, requestId, true, Result(gameId, elapsed, 0, SCORE0, 0)));
            AssertRevert("game not expirable", () => arrow.expireGame(gameId));

            AssertSolvent(engine, arrow, funder, player);
        }

        [Fact]
        public void OnMiniAppResult_RejectsNonOracleCaller()
        {
            var (engine, arrow, oracle, funder, player) = Setup(10);
            DepositEntry(engine, arrow, player, ENTRY0);
            var (gameId, requestId) = StartAndFinalize(engine, arrow, oracle, player, 0);

            // A direct call from anyone that is not the oracle is rejected.
            engine.SetTransactionSigners(player);
            AssertRevert("oracle only", () => arrow.onMiniAppResult(
                requestId, APP_ID, MODULE_ID, OP_FINALIZE, player, true,
                Result(gameId, MIN_SOLVE0_MS + 1000, 0, SCORE0, 0), ""));

            // The game is still settling and untouched.
            Assert.Equal(new BigInteger(5), I(arrow.getGame(gameId)!, "status"));
            Assert.Equal(BigInteger.Zero, arrow.creditOf(player));
            AssertSolvent(engine, arrow, funder, player);
        }

        [Fact]
        public void OnMiniAppResult_RejectsWrongOperationAndBadCodec()
        {
            var (engine, arrow, oracle, funder, player) = Setup(10);
            DepositEntry(engine, arrow, player, ENTRY0);
            var (gameId, requestId) = StartAndFinalize(engine, arrow, oracle, player, 0);
            long elapsed = MIN_SOLVE0_MS + 1000;

            AssertRevert("unexpected operation", () => oracle.Deliver(
                arrow.Hash, requestId, APP_ID, MODULE_ID, "session.start", player, true,
                Result(gameId, elapsed, 0, SCORE0, 0), ""));

            // Bad tag / length flips revert during parsing.
            byte[] good = Result(gameId, elapsed, 0, SCORE0, 0);
            byte[] badTag = (byte[])good.Clone(); badTag[0] = 0x01;
            AssertRevert("bad result tag", () => Deliver(engine, arrow, oracle, player, requestId, true, badTag));
            byte[] shortResult = new byte[78];
            Array.Copy(good, shortResult, 78);
            AssertRevert("bad result length", () => Deliver(engine, arrow, oracle, player, requestId, true, shortResult));

            AssertSolvent(engine, arrow, funder, player);
        }

        [Fact]
        public void OnMiniAppResult_RejectsBoundsViolationsAndDifficultyMismatch()
        {
            var (engine, arrow, oracle, funder, player) = Setup(10);
            DepositEntry(engine, arrow, player, ENTRY0);
            var (gameId, requestId) = StartAndFinalize(engine, arrow, oracle, player, 0);

            AssertRevert("difficulty mismatch",
                () => Deliver(engine, arrow, oracle, player, requestId, true, Result(gameId, MIN_SOLVE0_MS + 1000, 0, SCORE0, 1)));
            AssertRevert("undos out of range",
                () => Deliver(engine, arrow, oracle, player, requestId, true, Result(gameId, MIN_SOLVE0_MS + 1000, 1, SCORE0, 0)));
            AssertRevert("solved too fast",
                () => Deliver(engine, arrow, oracle, player, requestId, true, Result(gameId, MIN_SOLVE0_MS - 1, 0, SCORE0, 0)));
            AssertRevert("time limit exceeded",
                () => Deliver(engine, arrow, oracle, player, requestId, true, Result(gameId, LIMIT0_MS + 1, 0, SCORE0, 0)));

            // Nothing settled by the rejected attempts.
            Assert.Equal(new BigInteger(5), I(arrow.getGame(gameId)!, "status"));
            Assert.Equal(BigInteger.Zero, arrow.creditOf(player));
            AssertSolvent(engine, arrow, funder, player);
        }

        [Fact]
        public void OnMiniAppResult_ScoreBelowTargetAndOracleFailureAreLosses()
        {
            var (engine, arrow, oracle, funder, player) = Setup(10);
            DepositEntry(engine, arrow, player, 2 * ENTRY0);

            // Levels cleared below target (2 < 3): loss, reservation released, no payout.
            var (g1, r1) = StartAndFinalize(engine, arrow, oracle, player, 0);
            Deliver(engine, arrow, oracle, player, r1, true, Result(g1, MIN_SOLVE0_MS + 1000, 0, 2, 0));
            Assert.Equal(new BigInteger(2), I(arrow.getGame(g1)!, "status"));
            Assert.Equal(BigInteger.Zero, I(arrow.getGame(g1)!, "payout"));
            Assert.Equal(new BigInteger(ENTRY0), arrow.creditOf(player)); // 2nd entry still unspent, no payout
            Assert.Equal(BigInteger.Zero, arrow.reservedPool());
            Assert.Equal(BigInteger.Zero, arrow.activeGameOf(player));

            // Oracle failure: loss branch, reservation released.
            var (g2, r2) = StartAndFinalize(engine, arrow, oracle, player, 0);
            Deliver(engine, arrow, oracle, player, r2, false, new byte[0]);
            Assert.Equal(new BigInteger(2), I(arrow.getGame(g2)!, "status"));
            Assert.Equal(BigInteger.Zero, I(arrow.getGame(g2)!, "payout"));
            Assert.Equal(BigInteger.Zero, arrow.reservedPool());
            Assert.Equal(BigInteger.Zero, arrow.activeGameOf(player));
            Assert.Equal(BigInteger.Zero, I(arrow.statsOf(player)!, "solved"));

            AssertSolvent(engine, arrow, funder, player);
        }

        [Fact]
        public void Undos_NoUndoRuleRejectsAnyReportedUndoCount()
        {
            var (engine, arrow, oracle, funder, player) = Setup(10);
            DepositEntry(engine, arrow, player, ENTRY0);
            var (gameId, requestId) = StartAndFinalize(engine, arrow, oracle, player, 0);

            // This game has no undo mechanic (MAX_UNDOS = 0): any nonzero undo
            // count in an otherwise winning result is rejected outright.
            AssertRevert("undos out of range",
                () => Deliver(engine, arrow, oracle, player, requestId, true, Result(gameId, MIN_SOLVE0_MS + 1000, 1, SCORE0, 0)));
            AssertRevert("undos out of range",
                () => Deliver(engine, arrow, oracle, player, requestId, true, Result(gameId, MIN_SOLVE0_MS + 1000, 3, SCORE0, 0)));
            Assert.Equal(new BigInteger(5), I(arrow.getGame(gameId)!, "status")); // still settling

            // A clean zero-undo result settles and pays the FULL base reward.
            Deliver(engine, arrow, oracle, player, requestId, true, Result(gameId, MIN_SOLVE0_MS + 1000, 0, SCORE0, 0));
            Assert.Equal(new BigInteger(REWARD0), I(arrow.getGame(gameId)!, "payout"));
            Assert.Equal(BigInteger.Zero, I(arrow.getGame(gameId)!, "undos"));

            AssertSolvent(engine, arrow, funder, player);
        }

        [Fact]
        public void FinalizeGame_GuardsOwnershipAndActiveState()
        {
            var (engine, arrow, oracle, funder, player) = Setup(10);
            var other = TestEngine.GetNewSigner().Account;
            DepositEntry(engine, arrow, player, ENTRY0);

            engine.SetTransactionSigners(player);
            BigInteger gameId = arrow.startGame(player, 0)!.Value;

            AssertRevert("game not found", () => arrow.finalizeGame(999, "00"));

            engine.SetTransactionSigners(other);
            AssertRevert("player witness required", () => arrow.finalizeGame(gameId, "00"));

            // Finalize once; a second finalize on a settling game is rejected.
            engine.SetTransactionSigners(player);
            arrow.finalizeGame(gameId, "00");
            AssertRevert("game not in play", () => arrow.finalizeGame(gameId, "00"));

            AssertSolvent(engine, arrow, funder, player);
        }

        [Fact]
        public void ExpireGame_ActivePastDeadlinePlusGraceReleasesReservation()
        {
            var (engine, arrow, _, funder, player) = Setup(10);
            DepositEntry(engine, arrow, player, 2 * ENTRY0);

            engine.SetTransactionSigners(player);
            BigInteger gameId = arrow.startGame(player, 0)!.Value;

            AssertRevert("game not expirable", () => arrow.expireGame(gameId));
            AdvanceMs(engine, LIMIT0_MS + 1000);
            AssertRevert("game not expirable", () => arrow.expireGame(gameId));

            AdvanceMs(engine, SETTLE_GRACE_MS);
            engine.SetTransactionSigners(funder); // permissionless
            Assert.Equal(new BigInteger(3), arrow.expireGame(gameId));

            Assert.Equal(BigInteger.Zero, arrow.reservedPool());
            Assert.Equal(new BigInteger(10L * GAS + ENTRY0), arrow.poolBalance());
            Assert.Equal(BigInteger.Zero, arrow.activeGameOf(player));
            Assert.Equal(new BigInteger(3), I(arrow.getGame(gameId)!, "status"));
            AssertRevert("game not expirable", () => arrow.expireGame(gameId));

            engine.SetTransactionSigners(player);
            Assert.Equal(new BigInteger(2), arrow.startGame(player, 0));

            AssertSolvent(engine, arrow, funder, player);
        }

        [Fact]
        public void ExpireGame_AbandonedSettlingPastGraceReleasesReservation()
        {
            var (engine, arrow, oracle, funder, player) = Setup(10);
            DepositEntry(engine, arrow, player, ENTRY0);

            var (gameId, _) = StartAndFinalize(engine, arrow, oracle, player, 0);
            Assert.Equal(new BigInteger(5), I(arrow.getGame(gameId)!, "status"));

            AssertRevert("game not expirable", () => arrow.expireGame(gameId));
            AdvanceMs(engine, LIMIT0_MS + SETTLE_GRACE_MS + 1000);
            engine.SetTransactionSigners(funder);
            Assert.Equal(new BigInteger(3), arrow.expireGame(gameId));
            Assert.Equal(BigInteger.Zero, arrow.reservedPool());
            Assert.Equal(BigInteger.Zero, arrow.activeGameOf(player));

            AssertSolvent(engine, arrow, funder, player);
        }

        [Fact]
        public void Withdraw_PaysTheWholeCreditOnce()
        {
            var (engine, arrow, _, funder, player) = Setup(0);

            DepositEntry(engine, arrow, player, 1L * GAS);
            BigInteger before = engine.Native.GAS.BalanceOf(player) ?? 0;
            engine.SetTransactionSigners(player);
            Assert.Equal(new BigInteger(1L * GAS), arrow.withdraw(player));
            Assert.Equal(before + 1L * GAS, engine.Native.GAS.BalanceOf(player));
            Assert.Equal(BigInteger.Zero, arrow.creditOf(player));
            AssertRevert("no credit", () => arrow.withdraw(player));

            AssertSolvent(engine, arrow, funder, player);
        }

        [Fact]
        public void Admin_PauseCapAndPoolWithdrawalAreOwnerGated()
        {
            var (engine, arrow, _, funder, player) = Setup(10);

            engine.SetTransactionSigners(player);
            AssertRevert("owner only", () => arrow.setPaused(true));
            AssertRevert("owner only", () => arrow.setDailyCap(5));
            AssertRevert("owner only", () => arrow.withdrawPool(player, 1L * GAS));

            engine.SetTransactionSigners(OwnerHash);
            arrow.setPaused(true);
            Assert.True(arrow.isPaused());
            DepositEntry(engine, arrow, player, ENTRY0);
            engine.SetTransactionSigners(player);
            AssertRevert("contract is paused", () => arrow.startGame(player, 0));
            engine.SetTransactionSigners(OwnerHash);
            arrow.setPaused(false);

            AssertRevert("cap must be 1..100", () => arrow.setDailyCap(0));
            AssertRevert("cap must be 1..100", () => arrow.setDailyCap(101));
            arrow.setDailyCap(2);
            Assert.Equal(new BigInteger(2), arrow.dailyCap());
            Assert.Equal(new BigInteger(2), I(arrow.getConfig()!, "dailyCap"));

            // WithdrawPool can never touch the reward reserved by an active game.
            engine.SetTransactionSigners(player);
            arrow.startGame(player, 0);
            engine.SetTransactionSigners(OwnerHash);
            AssertRevert("insufficient free pool", () => arrow.withdrawPool(funder, 10L * GAS));
            BigInteger free = arrow.freePool() ?? 0;
            BigInteger funderBefore = engine.Native.GAS.BalanceOf(funder) ?? 0;
            arrow.withdrawPool(funder, free);
            Assert.Equal(funderBefore + free, engine.Native.GAS.BalanceOf(funder));
            Assert.Equal(new BigInteger(REWARD0), arrow.poolBalance());
            Assert.Equal(BigInteger.Zero, arrow.freePool());

            AssertSolvent(engine, arrow, funder, player);
        }

        [Fact]
        public void DailyCap_NinthStartRevertsUntilTheNextUtcDay()
        {
            var (engine, arrow, oracle, funder, player) = Setup(20);
            AlignToFreshUtcDay(engine);

            DepositEntry(engine, arrow, player, 8 * ENTRY0);
            for (int i = 0; i < 8; i++)
            {
                var (gameId, requestId) = StartAndFinalize(engine, arrow, oracle, player, 0);
                Deliver(engine, arrow, oracle, player, requestId, true, Result(gameId, MIN_SOLVE0_MS + 1000, 0, SCORE0, 0));
            }
            Assert.Equal(new BigInteger(8), arrow.dailyStartsOf(player));
            Assert.Equal(new BigInteger(8), I(arrow.statsOf(player)!, "solved"));

            engine.SetTransactionSigners(player);
            AssertRevert("daily start cap reached", () => arrow.startGame(player, 0));

            AdvanceMs(engine, MS_PER_DAY);
            Assert.Equal(BigInteger.Zero, arrow.dailyStartsOf(player));
            engine.SetTransactionSigners(player);
            Assert.Equal(new BigInteger(9), arrow.startGame(player, 0));
            Assert.Equal(BigInteger.One, arrow.dailyStartsOf(player));

            AssertSolvent(engine, arrow, funder, player);
        }

        [Fact]
        public void GetConfig_ExposesTheFullTuningTable()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppCurveArrow");
            var arrow = engine.Deploy<CurveArrowContract>(nef, manifest);

            var cfg = arrow.getConfig()!;
            Assert.Equal(new BigInteger(ENTRY0), I(cfg, "entry0"));
            Assert.Equal(new BigInteger(ENTRY1), I(cfg, "entry1"));
            Assert.Equal(new BigInteger(ENTRY2), I(cfg, "entry2"));
            Assert.Equal(new BigInteger(REWARD0), I(cfg, "reward0"));
            Assert.Equal(new BigInteger(REWARD1), I(cfg, "reward1"));
            Assert.Equal(new BigInteger(REWARD2), I(cfg, "reward2"));
            Assert.Equal(new BigInteger(LIMIT0_MS), I(cfg, "limitMs0"));
            Assert.Equal(new BigInteger(300_000), I(cfg, "limitMs1"));
            Assert.Equal(new BigInteger(600_000), I(cfg, "limitMs2"));
            Assert.Equal(new BigInteger(MIN_SOLVE0_MS), I(cfg, "minSolveMs0"));
            Assert.Equal(new BigInteger(25_000), I(cfg, "minSolveMs1"));
            Assert.Equal(new BigInteger(45_000), I(cfg, "minSolveMs2"));
            Assert.Equal(new BigInteger(3), I(cfg, "targetLevels0"));
            Assert.Equal(new BigInteger(5), I(cfg, "targetLevels1"));
            Assert.Equal(new BigInteger(7), I(cfg, "targetLevels2"));
            Assert.Equal(BigInteger.Zero, I(cfg, "maxUndos"));
            Assert.Equal(BigInteger.Zero, I(cfg, "undoPenaltyPct"));
            Assert.Equal(new BigInteger(8), I(cfg, "dailyCap"));
            Assert.Equal(new BigInteger(SETTLE_GRACE_MS), I(cfg, "settleGraceMs"));

            Assert.Equal(UInt160.Zero, arrow.oracle());
            Assert.True(arrow.networkMagic()!.Value > 0);

            var top = arrow.topPlayer()!;
            Assert.Equal("", top[(Neo.VM.Types.PrimitiveType)"player"].GetString());
            Assert.Equal(BigInteger.Zero, I(top, "totalWon"));
        }

    }
}
