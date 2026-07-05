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
    public abstract class MergeKingdomContract : SmartContract
    {
        protected MergeKingdomContract(SmartContractInitialize initialize) : base(initialize) { }
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

    public class MiniAppMergeKingdomTests
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
        private const long MIN_SOLVE0_MS = 30_000;     // 90s easy min-solve floor
        private const long SETTLE_GRACE_MS = 600_000;  // settle window past the deadline
        private const long MS_PER_DAY = 86_400_000;
        private const int SCORE0 = 128;                  // winning score >= target for this game
        private const string FUND_MEMO = "miniapp-merge-kingdom:fund";
        private const string ENTRY_MEMO = "miniapp-merge-kingdom:entry";
        private const string APP_ID = "miniapp-merge-kingdom";
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
        private static void AssertSolvent(TestEngine engine, MergeKingdomContract c, params UInt160[] players)
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
            SHA256.HashData(Encoding.UTF8.GetBytes($"merge-problem-{gameId}"));
        private static byte[] TestAnswerHash(BigInteger gameId) =>
            SHA256.HashData(Encoding.UTF8.GetBytes($"merge-answer-{gameId}"));

        private static (TestEngine engine, MergeKingdomContract merge, GameOracleMockFixtureContract oracle, UInt160 funder, UInt160 player)
            Setup(long poolGas, bool setOracle = true)
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppMergeKingdom");
            var merge = engine.Deploy<MergeKingdomContract>(nef, manifest);
            var oracle = GameOracleMockFixture.Deploy(engine, OwnerHash);
            if (setOracle)
            {
                engine.SetTransactionSigners(OwnerHash);
                merge.setOracle(oracle.Hash);
            }
            var funder = TestEngine.GetNewSigner().Account;
            var player = TestEngine.GetNewSigner().Account;
            FundGas(engine, funder, 60L * GAS);
            FundGas(engine, player, 20L * GAS);
            if (poolGas > 0)
            {
                engine.SetTransactionSigners(funder);
                engine.Native.GAS.Transfer(funder, merge.Hash, poolGas * GAS, FUND_MEMO);
            }
            return (engine, merge, oracle, funder, player);
        }

        private static void DepositEntry(TestEngine engine, MergeKingdomContract c, UInt160 player, BigInteger amount)
        {
            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, c.Hash, amount, ENTRY_MEMO);
        }

        // Drive one settlement: player starts, finalizes (kernel returns a requestId),
        // then the oracle delivers the finalize result to onMiniAppResult.
        private static (BigInteger gameId, BigInteger requestId) StartAndFinalize(
            TestEngine engine, MergeKingdomContract c, GameOracleMockFixtureContract oracle,
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

        private static void Deliver(TestEngine engine, MergeKingdomContract c, GameOracleMockFixtureContract oracle,
            UInt160 player, BigInteger requestId, bool success, byte[] result)
        {
            engine.SetTransactionSigners(OwnerHash);
            oracle.Deliver(c.Hash, requestId, APP_ID, MODULE_ID, OP_FINALIZE, player, success, result, "");
        }

        [Fact]
        public void Deposits_FundAndEntryPathsCreditTheRightLedgers()
        {
            var (engine, merge, _, funder, player) = Setup(0);

            engine.SetTransactionSigners(funder);
            engine.Native.GAS.Transfer(funder, merge.Hash, 5L * GAS, FUND_MEMO);
            Assert.Equal(new BigInteger(5L * GAS), merge.poolBalance());
            Assert.Equal(BigInteger.Zero, merge.creditOf(funder));

            DepositEntry(engine, merge, player, 1L * GAS);
            Assert.Equal(new BigInteger(1L * GAS), merge.creditOf(player));
            Assert.Equal(new BigInteger(5L * GAS), merge.poolBalance());

            AssertRevert("only GAS accepted", () => merge.onNEP17Payment(player, 1L * GAS, ENTRY_MEMO));

            AssertSolvent(engine, merge, funder, player);
        }

        [Fact]
        public void Oracle_RegistrationIsOwnerGatedAndReadable()
        {
            var (engine, merge, oracle, funder, player) = Setup(0, setOracle: false);

            Assert.Equal(UInt160.Zero, merge.oracle());

            engine.SetTransactionSigners(player);
            AssertRevert("owner only", () => merge.setOracle(oracle.Hash));

            engine.SetTransactionSigners(OwnerHash);
            AssertRevert("invalid oracle", () => merge.setOracle(UInt160.Zero));
            merge.setOracle(oracle.Hash);
            Assert.Equal(oracle.Hash, merge.oracle());

            Assert.True(merge.networkMagic()!.Value > 0);
            AssertSolvent(engine, merge, funder, player);
        }

        [Fact]
        public void StartGame_ConsumesEntryReservesRewardAndMarksActive()
        {
            var (engine, merge, _, funder, player) = Setup(10);

            DepositEntry(engine, merge, player, ENTRY0);
            engine.SetTransactionSigners(player);
            BigInteger? gameId = merge.startGame(player, 0);
            Assert.Equal(BigInteger.One, gameId);
            Assert.Equal(BigInteger.One, merge.lastGameId());

            Assert.Equal(BigInteger.Zero, merge.creditOf(player));
            Assert.Equal(new BigInteger(10L * GAS + ENTRY0), merge.poolBalance());
            Assert.Equal(new BigInteger(REWARD0), merge.reservedPool());
            Assert.Equal(new BigInteger(10L * GAS + ENTRY0 - REWARD0), merge.freePool());
            Assert.Equal(BigInteger.One, merge.activeGameOf(player));
            Assert.Equal(BigInteger.One, merge.dailyStartsOf(player));
            Assert.Equal(BigInteger.One, I(merge.statsOf(player)!, "played"));

            var game = merge.getGame(gameId!.Value)!;
            Assert.Equal(BigInteger.One, I(game, "status")); // active immediately
            Assert.Equal(new BigInteger(ENTRY0), I(game, "entry"));
            Assert.Equal(new BigInteger(REWARD0), I(game, "reward"));
            Assert.Equal("", S(game, "commitment"));
            Assert.True(I(game, "dealtAt") > 0);
            Assert.Equal(I(game, "dealtAt") + LIMIT0_MS, I(game, "deadline"));

            DepositEntry(engine, merge, player, ENTRY0);
            engine.SetTransactionSigners(player);
            AssertRevert("finish your active game first", () => merge.startGame(player, 0));

            AssertSolvent(engine, merge, funder, player);
        }

        [Fact]
        public void StartGame_GuardsRejectInvalidStarts()
        {
            var (engine, merge, _, funder, player) = Setup(0);
            var other = TestEngine.GetNewSigner().Account;

            engine.SetTransactionSigners(player);
            AssertRevert("difficulty must be 0..2", () => merge.startGame(player, 3));
            AssertRevert("difficulty must be 0..2", () => merge.startGame(player, -1));
            AssertRevert("player witness required", () => merge.startGame(other, 0));
            AssertRevert("insufficient entry credit", () => merge.startGame(player, 0));

            DepositEntry(engine, merge, player, ENTRY0);
            engine.SetTransactionSigners(player);
            AssertRevert("reward pool cannot cover this game", () => merge.startGame(player, 0));
            Assert.Equal(new BigInteger(ENTRY0), merge.creditOf(player));
            Assert.Equal(BigInteger.Zero, merge.reservedPool());
            AssertSolvent(engine, merge, funder, player);
        }

        [Fact]
        public void Finalize_HappyPathPaysFullRewardAsCredit()
        {
            var (engine, merge, oracle, funder, player) = Setup(10);

            DepositEntry(engine, merge, player, ENTRY0);
            var (gameId, requestId) = StartAndFinalize(engine, merge, oracle, player, 0);
            Assert.Equal(new BigInteger(5), I(merge.getGame(gameId)!, "status")); // settling
            Assert.Equal(gameId, merge.gameOfRequest(requestId));

            long elapsed = MIN_SOLVE0_MS + 1000;
            BigInteger? evGame = null, evDifficulty = null, evElapsed = null, evUndos = null, evPayout = null, evTotalWon = null;
            UInt160? evPlayer = null;
            merge.OnSolved += (g, p, d, e, u, pay, won) =>
            { evGame = g; evPlayer = p; evDifficulty = d; evElapsed = e; evUndos = u; evPayout = pay; evTotalWon = won; };

            Deliver(engine, merge, oracle, player, requestId, true, Result(gameId, elapsed, 0, SCORE0, 0));

            Assert.Equal(new BigInteger(REWARD0), merge.creditOf(player));
            Assert.Equal(BigInteger.Zero, merge.reservedPool());
            Assert.Equal(new BigInteger(10L * GAS + ENTRY0 - REWARD0), merge.poolBalance());
            Assert.Equal(BigInteger.Zero, merge.activeGameOf(player));
            Assert.Equal(BigInteger.Zero, merge.gameOfRequest(requestId)); // context consumed

            var stats = merge.statsOf(player)!;
            Assert.Equal(BigInteger.One, I(stats, "solved"));
            Assert.Equal(new BigInteger(REWARD0), I(stats, "totalWon"));

            var top = merge.topPlayer()!;
            Assert.Equal(player, new UInt160(top[(Neo.VM.Types.PrimitiveType)"player"].GetSpan()));
            Assert.Equal(new BigInteger(REWARD0), I(top, "totalWon"));

            var game = merge.getGame(gameId)!;
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
                () => Deliver(engine, merge, oracle, player, requestId, true, Result(gameId, elapsed, 0, SCORE0, 0)));
            AssertRevert("game not expirable", () => merge.expireGame(gameId));

            AssertSolvent(engine, merge, funder, player);
        }

        [Fact]
        public void OnMiniAppResult_RejectsNonOracleCaller()
        {
            var (engine, merge, oracle, funder, player) = Setup(10);
            DepositEntry(engine, merge, player, ENTRY0);
            var (gameId, requestId) = StartAndFinalize(engine, merge, oracle, player, 0);

            // A direct call from anyone that is not the oracle is rejected.
            engine.SetTransactionSigners(player);
            AssertRevert("oracle only", () => merge.onMiniAppResult(
                requestId, APP_ID, MODULE_ID, OP_FINALIZE, player, true,
                Result(gameId, MIN_SOLVE0_MS + 1000, 0, SCORE0, 0), ""));

            // The game is still settling and untouched.
            Assert.Equal(new BigInteger(5), I(merge.getGame(gameId)!, "status"));
            Assert.Equal(BigInteger.Zero, merge.creditOf(player));
            AssertSolvent(engine, merge, funder, player);
        }

        [Fact]
        public void OnMiniAppResult_RejectsWrongOperationAndBadCodec()
        {
            var (engine, merge, oracle, funder, player) = Setup(10);
            DepositEntry(engine, merge, player, ENTRY0);
            var (gameId, requestId) = StartAndFinalize(engine, merge, oracle, player, 0);
            long elapsed = MIN_SOLVE0_MS + 1000;

            AssertRevert("unexpected operation", () => oracle.Deliver(
                merge.Hash, requestId, APP_ID, MODULE_ID, "session.start", player, true,
                Result(gameId, elapsed, 0, SCORE0, 0), ""));

            // Bad tag / length flips revert during parsing.
            byte[] good = Result(gameId, elapsed, 0, SCORE0, 0);
            byte[] badTag = (byte[])good.Clone(); badTag[0] = 0x01;
            AssertRevert("bad result tag", () => Deliver(engine, merge, oracle, player, requestId, true, badTag));
            byte[] shortResult = new byte[78];
            Array.Copy(good, shortResult, 78);
            AssertRevert("bad result length", () => Deliver(engine, merge, oracle, player, requestId, true, shortResult));

            AssertSolvent(engine, merge, funder, player);
        }

        [Fact]
        public void OnMiniAppResult_RejectsBoundsViolationsAndDifficultyMismatch()
        {
            var (engine, merge, oracle, funder, player) = Setup(10);
            DepositEntry(engine, merge, player, ENTRY0);
            var (gameId, requestId) = StartAndFinalize(engine, merge, oracle, player, 0);

            AssertRevert("difficulty mismatch",
                () => Deliver(engine, merge, oracle, player, requestId, true, Result(gameId, MIN_SOLVE0_MS + 1000, 0, SCORE0, 1)));
            AssertRevert("undos out of range",
                () => Deliver(engine, merge, oracle, player, requestId, true, Result(gameId, MIN_SOLVE0_MS + 1000, 4, SCORE0, 0)));
            AssertRevert("solved too fast",
                () => Deliver(engine, merge, oracle, player, requestId, true, Result(gameId, MIN_SOLVE0_MS - 1, 0, SCORE0, 0)));
            AssertRevert("time limit exceeded",
                () => Deliver(engine, merge, oracle, player, requestId, true, Result(gameId, LIMIT0_MS + 1, 0, SCORE0, 0)));

            // Nothing settled by the rejected attempts.
            Assert.Equal(new BigInteger(5), I(merge.getGame(gameId)!, "status"));
            Assert.Equal(BigInteger.Zero, merge.creditOf(player));
            AssertSolvent(engine, merge, funder, player);
        }

        [Fact]
        public void OnMiniAppResult_ScoreBelowTargetAndOracleFailureAreLosses()
        {
            var (engine, merge, oracle, funder, player) = Setup(10);
            DepositEntry(engine, merge, player, 2 * ENTRY0);

            // Score below target (0 < 1): loss, reservation released, no payout.
            var (g1, r1) = StartAndFinalize(engine, merge, oracle, player, 0);
            Deliver(engine, merge, oracle, player, r1, true, Result(g1, MIN_SOLVE0_MS + 1000, 0, 0, 0));
            Assert.Equal(new BigInteger(2), I(merge.getGame(g1)!, "status"));
            Assert.Equal(BigInteger.Zero, I(merge.getGame(g1)!, "payout"));
            Assert.Equal(new BigInteger(ENTRY0), merge.creditOf(player)); // 2nd entry still unspent, no payout
            Assert.Equal(BigInteger.Zero, merge.reservedPool());
            Assert.Equal(BigInteger.Zero, merge.activeGameOf(player));

            // Oracle failure: loss branch, reservation released.
            var (g2, r2) = StartAndFinalize(engine, merge, oracle, player, 0);
            Deliver(engine, merge, oracle, player, r2, false, new byte[0]);
            Assert.Equal(new BigInteger(2), I(merge.getGame(g2)!, "status"));
            Assert.Equal(BigInteger.Zero, I(merge.getGame(g2)!, "payout"));
            Assert.Equal(BigInteger.Zero, merge.reservedPool());
            Assert.Equal(BigInteger.Zero, merge.activeGameOf(player));
            Assert.Equal(BigInteger.Zero, I(merge.statsOf(player)!, "solved"));

            AssertSolvent(engine, merge, funder, player);
        }

        [Fact]
        public void Undo_SignedUndoCountBurns30PctOfBaseRewardEach()
        {
            var (engine, merge, oracle, funder, player) = Setup(10);
            AlignToFreshUtcDay(engine);
            DepositEntry(engine, merge, player, 3 * ENTRY0);

            long[] expectedPayouts = { REWARD0 * 70 / 100, REWARD0 * 40 / 100, REWARD0 * 10 / 100 };
            for (int undos = 1; undos <= 3; undos++)
            {
                var (gameId, requestId) = StartAndFinalize(engine, merge, oracle, player, 0);
                Deliver(engine, merge, oracle, player, requestId, true, Result(gameId, MIN_SOLVE0_MS + 1000, undos, SCORE0, 0));
                Assert.Equal(new BigInteger(expectedPayouts[undos - 1]), I(merge.getGame(gameId)!, "payout"));
                Assert.Equal(new BigInteger(undos), I(merge.getGame(gameId)!, "undos"));
                AssertSolvent(engine, merge, funder, player);
            }
            Assert.Equal(new BigInteger(3), I(merge.statsOf(player)!, "solved"));
            Assert.Equal(new BigInteger(expectedPayouts[0] + expectedPayouts[1] + expectedPayouts[2]),
                I(merge.statsOf(player)!, "totalWon"));

            AssertSolvent(engine, merge, funder, player);
        }

        [Fact]
        public void FinalizeGame_GuardsOwnershipAndActiveState()
        {
            var (engine, merge, oracle, funder, player) = Setup(10);
            var other = TestEngine.GetNewSigner().Account;
            DepositEntry(engine, merge, player, ENTRY0);

            engine.SetTransactionSigners(player);
            BigInteger gameId = merge.startGame(player, 0)!.Value;

            AssertRevert("game not found", () => merge.finalizeGame(999, "00"));

            engine.SetTransactionSigners(other);
            AssertRevert("player witness required", () => merge.finalizeGame(gameId, "00"));

            // Finalize once; a second finalize on a settling game is rejected.
            engine.SetTransactionSigners(player);
            merge.finalizeGame(gameId, "00");
            AssertRevert("game not in play", () => merge.finalizeGame(gameId, "00"));

            AssertSolvent(engine, merge, funder, player);
        }

        [Fact]
        public void ExpireGame_ActivePastDeadlinePlusGraceReleasesReservation()
        {
            var (engine, merge, _, funder, player) = Setup(10);
            DepositEntry(engine, merge, player, 2 * ENTRY0);

            engine.SetTransactionSigners(player);
            BigInteger gameId = merge.startGame(player, 0)!.Value;

            AssertRevert("game not expirable", () => merge.expireGame(gameId));
            AdvanceMs(engine, LIMIT0_MS + 1000);
            AssertRevert("game not expirable", () => merge.expireGame(gameId));

            AdvanceMs(engine, SETTLE_GRACE_MS);
            engine.SetTransactionSigners(funder); // permissionless
            Assert.Equal(new BigInteger(3), merge.expireGame(gameId));

            Assert.Equal(BigInteger.Zero, merge.reservedPool());
            Assert.Equal(new BigInteger(10L * GAS + ENTRY0), merge.poolBalance());
            Assert.Equal(BigInteger.Zero, merge.activeGameOf(player));
            Assert.Equal(new BigInteger(3), I(merge.getGame(gameId)!, "status"));
            AssertRevert("game not expirable", () => merge.expireGame(gameId));

            engine.SetTransactionSigners(player);
            Assert.Equal(new BigInteger(2), merge.startGame(player, 0));

            AssertSolvent(engine, merge, funder, player);
        }

        [Fact]
        public void ExpireGame_AbandonedSettlingPastGraceReleasesReservation()
        {
            var (engine, merge, oracle, funder, player) = Setup(10);
            DepositEntry(engine, merge, player, ENTRY0);

            var (gameId, _) = StartAndFinalize(engine, merge, oracle, player, 0);
            Assert.Equal(new BigInteger(5), I(merge.getGame(gameId)!, "status"));

            AssertRevert("game not expirable", () => merge.expireGame(gameId));
            AdvanceMs(engine, LIMIT0_MS + SETTLE_GRACE_MS + 1000);
            engine.SetTransactionSigners(funder);
            Assert.Equal(new BigInteger(3), merge.expireGame(gameId));
            Assert.Equal(BigInteger.Zero, merge.reservedPool());
            Assert.Equal(BigInteger.Zero, merge.activeGameOf(player));

            AssertSolvent(engine, merge, funder, player);
        }

        [Fact]
        public void Withdraw_PaysTheWholeCreditOnce()
        {
            var (engine, merge, _, funder, player) = Setup(0);

            DepositEntry(engine, merge, player, 1L * GAS);
            BigInteger before = engine.Native.GAS.BalanceOf(player) ?? 0;
            engine.SetTransactionSigners(player);
            Assert.Equal(new BigInteger(1L * GAS), merge.withdraw(player));
            Assert.Equal(before + 1L * GAS, engine.Native.GAS.BalanceOf(player));
            Assert.Equal(BigInteger.Zero, merge.creditOf(player));
            AssertRevert("no credit", () => merge.withdraw(player));

            AssertSolvent(engine, merge, funder, player);
        }

        [Fact]
        public void Admin_PauseCapAndPoolWithdrawalAreOwnerGated()
        {
            var (engine, merge, _, funder, player) = Setup(10);

            engine.SetTransactionSigners(player);
            AssertRevert("owner only", () => merge.setPaused(true));
            AssertRevert("owner only", () => merge.setDailyCap(5));
            AssertRevert("owner only", () => merge.withdrawPool(player, 1L * GAS));

            engine.SetTransactionSigners(OwnerHash);
            merge.setPaused(true);
            Assert.True(merge.isPaused());
            DepositEntry(engine, merge, player, ENTRY0);
            engine.SetTransactionSigners(player);
            AssertRevert("contract is paused", () => merge.startGame(player, 0));
            engine.SetTransactionSigners(OwnerHash);
            merge.setPaused(false);

            AssertRevert("cap must be 1..100", () => merge.setDailyCap(0));
            AssertRevert("cap must be 1..100", () => merge.setDailyCap(101));
            merge.setDailyCap(2);
            Assert.Equal(new BigInteger(2), merge.dailyCap());
            Assert.Equal(new BigInteger(2), I(merge.getConfig()!, "dailyCap"));

            // WithdrawPool can never touch the reward reserved by an active game.
            engine.SetTransactionSigners(player);
            merge.startGame(player, 0);
            engine.SetTransactionSigners(OwnerHash);
            AssertRevert("insufficient free pool", () => merge.withdrawPool(funder, 10L * GAS));
            BigInteger free = merge.freePool() ?? 0;
            BigInteger funderBefore = engine.Native.GAS.BalanceOf(funder) ?? 0;
            merge.withdrawPool(funder, free);
            Assert.Equal(funderBefore + free, engine.Native.GAS.BalanceOf(funder));
            Assert.Equal(new BigInteger(REWARD0), merge.poolBalance());
            Assert.Equal(BigInteger.Zero, merge.freePool());

            AssertSolvent(engine, merge, funder, player);
        }

        [Fact]
        public void DailyCap_NinthStartRevertsUntilTheNextUtcDay()
        {
            var (engine, merge, oracle, funder, player) = Setup(20);
            AlignToFreshUtcDay(engine);

            DepositEntry(engine, merge, player, 8 * ENTRY0);
            for (int i = 0; i < 8; i++)
            {
                var (gameId, requestId) = StartAndFinalize(engine, merge, oracle, player, 0);
                Deliver(engine, merge, oracle, player, requestId, true, Result(gameId, MIN_SOLVE0_MS + 1000, 0, SCORE0, 0));
            }
            Assert.Equal(new BigInteger(8), merge.dailyStartsOf(player));
            Assert.Equal(new BigInteger(8), I(merge.statsOf(player)!, "solved"));

            engine.SetTransactionSigners(player);
            AssertRevert("daily start cap reached", () => merge.startGame(player, 0));

            AdvanceMs(engine, MS_PER_DAY);
            Assert.Equal(BigInteger.Zero, merge.dailyStartsOf(player));
            engine.SetTransactionSigners(player);
            Assert.Equal(new BigInteger(9), merge.startGame(player, 0));
            Assert.Equal(BigInteger.One, merge.dailyStartsOf(player));

            AssertSolvent(engine, merge, funder, player);
        }

        [Fact]
        public void GetConfig_ExposesTheFullTuningTable()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppMergeKingdom");
            var merge = engine.Deploy<MergeKingdomContract>(nef, manifest);

            var cfg = merge.getConfig()!;
            Assert.Equal(new BigInteger(ENTRY0), I(cfg, "entry0"));
            Assert.Equal(new BigInteger(REWARD0), I(cfg, "reward0"));
            Assert.Equal(new BigInteger(LIMIT0_MS), I(cfg, "limitMs0"));
            Assert.Equal(new BigInteger(MIN_SOLVE0_MS), I(cfg, "minSolveMs0"));
            Assert.Equal(new BigInteger(3), I(cfg, "maxUndos"));
            Assert.Equal(new BigInteger(30), I(cfg, "undoPenaltyPct"));
            Assert.Equal(new BigInteger(8), I(cfg, "dailyCap"));
            Assert.Equal(new BigInteger(SETTLE_GRACE_MS), I(cfg, "settleGraceMs"));

            Assert.Equal(UInt160.Zero, merge.oracle());
            Assert.True(merge.networkMagic()!.Value > 0);

            var top = merge.topPlayer()!;
            Assert.Equal("", top[(Neo.VM.Types.PrimitiveType)"player"].GetString());
            Assert.Equal(BigInteger.Zero, I(top, "totalWon"));
        }

    }
}
