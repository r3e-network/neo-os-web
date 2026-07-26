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
using static NeoMiniAppPlatform.Contracts.Tests.RegistryHarness;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    // ===================================================================
    //  TestEngine behavioral suite for the PlatformGame RewardGame module
    //  (gameType 5, design section 8 layer 1): registry-pushed activation,
    //  descriptor economics, the clone-verbatim lifecycle through the
    //  GameOracleMockFixture kernel (start -> finalize -> settle / refund /
    //  expire -> withdraw), and the per-app liability counter.
    // ===================================================================
    public abstract class PlatformGameRewardGameContract : SmartContract
    {
        protected PlatformGameRewardGameContract(SmartContractInitialize initialize) : base(initialize) { }
        // platform infra
        public abstract UInt160? admin();
        public abstract UInt160? oracle();
        public abstract UInt160? registry();
        public abstract void setOracle(UInt160 oracle);
        public abstract void setRegistry(UInt160 registry);
        public abstract void setContractPaused(bool paused);
        public abstract void setPaused(string appId, bool paused);
        public abstract bool? isPaused(string appId);
        // registration
        public abstract void registerGame(string appId, BigInteger gameType, UInt160 appAdmin, byte[] config);
        public abstract BigInteger? getGameType(string appId);
        public abstract UInt160? getGameAdmin(string appId);
        public abstract void activateApp(string appId, UInt160 appAdmin, object? descriptor);
        public abstract void validateAndApplyDescriptor(string appId, string key, object? value);
        // reward game ABI (the clone surface, appId first)
        public abstract void onNEP17Payment(UInt160 from, BigInteger amount, object? data);
        public abstract BigInteger? startGame(string appId, UInt160 player, BigInteger difficulty);
        public abstract BigInteger? finalizeGame(string appId, UInt160 player, string sealedOpLogHex);
        public abstract BigInteger? expireGame(string appId, BigInteger gameId);
        public abstract BigInteger? withdraw(string appId, UInt160 account);
        public abstract void onMiniAppResult(BigInteger requestId, string appId, string moduleId, string operation, UInt160 requester, bool success, byte[] result, string error);
        public abstract BigInteger? poolBalance(string appId);
        public abstract BigInteger? reservedPool(string appId);
        public abstract BigInteger? freePool(string appId);
        public abstract BigInteger? creditOf(string appId, UInt160 player);
        public abstract BigInteger? heldForApp(string appId);
        public abstract BigInteger? lastGameId(string appId);
        public abstract BigInteger? activeGameOf(string appId, UInt160 player);
        public abstract BigInteger? dailyStartsOf(string appId, UInt160 player);
        public abstract BigInteger? gameOfRequest(string appId, BigInteger requestId);
        public abstract Neo.VM.Types.Map? statsOf(string appId, UInt160 player);
        public abstract Neo.VM.Types.Map? getGame(string appId, BigInteger gameId);

        public delegate void delSolved(string? appId, BigInteger? gameId, UInt160? player, BigInteger? difficulty, BigInteger? elapsedMs, BigInteger? score, BigInteger? payout, BigInteger? totalWon);
        [DisplayName("Solved")]
        public event delSolved? OnSolved;
    }

    public class PlatformGameRewardGameTests
    {
        private const long GAS = 100_000_000;           // 1 GAS base units
        private const int GAME_TYPE_REWARD = 5;
        private const long ENTRY0 = 2_000_000;          // clone fleet production defaults
        private const long ENTRY1 = 10_000_000;
        private const long REWARD0 = 10_000_000;
        private const long REWARD1 = 50_000_000;
        private const long LIMIT0_MS = 60_000;
        private const long MIN_SOLVE0_MS = 10_000;
        private const long SETTLE_GRACE_MS = 600_000;
        private const long MS_PER_DAY = 86_400_000;
        private const int SCORE0 = 5;                   // >= default target 3
        private const string MODULE_ID = "game.session";
        private const string OP_FINALIZE = "session.finalize";
        private const string RG_ENGINE_ID = "platform-game";
        private const string APP_A = "rg-app-a";
        private const string APP_B = "rg-app-b";

        private sealed class World
        {
            public TestEngine Engine = null!;
            public PlatformGameRewardGameContract Game = null!;
            public GameOracleMockFixtureContract Oracle = null!;
            public PlatformRegistryContract? Registry;
            public UInt160 Admin = null!;
            public UInt160 AppAdmin = null!;
            public UInt160 Player = null!;
            public UInt160 Funder = null!;
        }

        private static void FundGas(TestEngine engine, UInt160 to, BigInteger gas)
        {
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            engine.Native.GAS.Transfer(engine.ValidatorsAddress, to, gas, null);
        }

        private static void AdvanceMs(TestEngine engine, long ms) =>
            engine.PersistingBlock.Advance(TimeSpan.FromMilliseconds(ms));

        private static BigInteger I(Neo.VM.Types.Map m, string key) =>
            m[(Neo.VM.Types.PrimitiveType)key].GetInteger();
        private static string S(Neo.VM.Types.Map m, string key) =>
            m[(Neo.VM.Types.PrimitiveType)key].GetString()!;

        private static string Hex(byte[] bytes) => Convert.ToHexString(bytes).ToLowerInvariant();

        private static byte[] TestCommitment(BigInteger gameId) =>
            SHA256.HashData(Encoding.UTF8.GetBytes($"rg-problem-{gameId}"));
        private static byte[] TestAnswerHash(BigInteger gameId) =>
            SHA256.HashData(Encoding.UTF8.GetBytes($"rg-answer-{gameId}"));
        private static byte[] Result(BigInteger gameId, long elapsedMs, int undos, uint score, int difficulty) =>
            GameResultCodec.Build(TestCommitment(gameId), TestAnswerHash(gameId),
                (ulong)elapsedMs, (byte)undos, score, (byte)difficulty);

        // SOLVENCY IDENTITY (design section 3.3): for every tenant,
        // heldForApp == freePool + reserved + sum(credits of touched players),
        // reserved <= pool, and the contract's GAS balance is exactly the sum
        // of per-app liabilities (these worlds fund only RewardGame lanes).
        private static void AssertSolvent(World w, string[] apps, params UInt160[] players)
        {
            BigInteger total = 0;
            foreach (string app in apps)
            {
                BigInteger pool = w.Game.poolBalance(app) ?? 0;
                BigInteger reserved = w.Game.reservedPool(app) ?? 0;
                BigInteger credits = 0;
                foreach (UInt160 p in players) credits += w.Game.creditOf(app, p) ?? 0;
                Assert.True(reserved <= pool, $"reserved must be <= pool for {app}");
                Assert.Equal(pool + credits, w.Game.heldForApp(app) ?? 0);
                total += pool + credits;
            }
            Assert.Equal(total, w.Engine.Native.GAS.BalanceOf(w.Game.Hash));
        }

        private static World Setup(bool withRegistry)
        {
            var engine = new TestEngine(true);
            engine.Fee = 1_000L * GAS;
            var (nef, manifest) = Load("PlatformGame");
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            var game = engine.Deploy<PlatformGameRewardGameContract>(nef, manifest);
            var oracle = GameOracleMockFixture.Deploy(engine, engine.ValidatorsAddress);
            game.setOracle(oracle.Hash);

            var w = new World
            {
                Engine = engine,
                Game = game,
                Oracle = oracle,
                Admin = engine.ValidatorsAddress,
                AppAdmin = TestEngine.GetNewSigner().Account,
                Player = TestEngine.GetNewSigner().Account,
                Funder = TestEngine.GetNewSigner().Account,
            };
            FundGas(engine, w.Funder, 500L * GAS);
            FundGas(engine, w.Player, 100L * GAS);
            FundGas(engine, w.AppAdmin, 50L * GAS);

            if (withRegistry)
            {
                var (regNef, regManifest) = Load("PlatformRegistry");
                engine.SetTransactionSigners(engine.ValidatorsAddress);
                var registry = engine.Deploy<PlatformRegistryContract>(regNef, regManifest);
                game.setRegistry(registry.Hash);
                EnsureAbstractAccountCore(engine, registry);
                registry.proposeEngine(RG_ENGINE_ID, game.Hash, 1);
                AdvanceMs(engine, TIMELOCK_MS + 1_000);
                registry.registerEngine(RG_ENGINE_ID);
                w.Registry = registry;
            }
            return w;
        }

        private static void RegisterBackCompat(World w, string appId)
        {
            w.Engine.SetTransactionSigners(w.Admin);
            w.Game.registerGame(appId, GAME_TYPE_REWARD, w.AppAdmin, null!);
        }

        private static void RegisterViaRegistry(World w, string appId, object? descriptor = null)
        {
            w.Engine.SetTransactionSigners(w.Admin);
            w.Registry!.registerAppByPlatform(appId, RG_ENGINE_ID, w.AppAdmin, descriptor);
        }

        private static void FundPool(World w, string appId, UInt160 from, BigInteger amount)
        {
            w.Engine.SetTransactionSigners(from);
            bool? ok = w.Engine.Native.GAS.Transfer(from, w.Game.Hash, amount, appId + ":fund");
            Assert.True(ok == true, "pool funding transfer should land");
        }

        private static void DepositEntry(World w, string appId, UInt160 player, BigInteger amount)
        {
            w.Engine.SetTransactionSigners(player);
            bool? ok = w.Engine.Native.GAS.Transfer(player, w.Game.Hash, amount, appId + ":entry");
            Assert.True(ok == true, "entry deposit transfer should land");
        }

        private static (BigInteger gameId, BigInteger requestId) StartAndFinalize(
            World w, string appId, UInt160 player, int difficulty)
        {
            w.Engine.SetTransactionSigners(player);
            BigInteger gameId = w.Game.startGame(appId, player, difficulty)!.Value;
            BigInteger requestId = w.Game.finalizeGame(appId, player, "00")!.Value;
            return (gameId, requestId);
        }

        private static void Deliver(World w, string appId, UInt160 player, BigInteger requestId, bool success, byte[] result)
        {
            w.Engine.SetTransactionSigners(w.Admin);
            w.Oracle.Deliver(w.Game.Hash, requestId, appId, MODULE_ID, OP_FINALIZE, player, success, result, "");
        }

        [Fact]
        public void RegisterGame_GameType5_BackCompatRegistersTenant()
        {
            var w = Setup(false);
            RegisterBackCompat(w, APP_A);
            Assert.Equal(new BigInteger(GAME_TYPE_REWARD), w.Game.getGameType(APP_A));
            Assert.Equal(w.AppAdmin, w.Game.getGameAdmin(APP_A));

            // The module guards reject the wrong tenancy and strangers.
            w.Engine.SetTransactionSigners(w.Player);
            AssertRevert("appId not registered", () => w.Game.startGame("rg-ghost", w.Player, 0));
            w.Engine.SetTransactionSigners(w.Admin);
            AssertRevert("invalid game type", () => w.Game.registerGame("rg-bad", 9, w.AppAdmin, null!));
        }

        [Fact]
        public void ActivateApp_RegistryPushRegistersTenantAndAppliesDescriptor()
        {
            var w = Setup(true);
            RegisterViaRegistry(w, APP_A,
                VmMap((RG_ENGINE_ID + ":entry0", 5_000_000), (RG_ENGINE_ID + ":dailyCap", 1)));

            Assert.Equal(new BigInteger(GAME_TYPE_REWARD), w.Game.getGameType(APP_A));
            Assert.Equal(w.AppAdmin, w.Game.getGameAdmin(APP_A));
            // The registry keeps the directory copy of every pushed entry.
            Assert.Equal(new BigInteger(5_000_000), AsInt(w.Registry!.getDescriptor(APP_A, RG_ENGINE_ID + ":entry0")));

            // The descriptor economics are live: entry0 is 5_000_000, not the
            // 2_000_000 default, and the daily cap of 1 blocks a second start
            // even after the first game settles.
            FundPool(w, APP_A, w.Funder, GAS);
            DepositEntry(w, APP_A, w.Player, 5_000_000);
            w.Engine.SetTransactionSigners(w.Player);
            Assert.Equal(BigInteger.One, w.Game.startGame(APP_A, w.Player, 0));
            Assert.Equal(BigInteger.Zero, w.Game.creditOf(APP_A, w.Player));
            BigInteger requestId = w.Game.finalizeGame(APP_A, w.Player, "00")!.Value;
            Deliver(w, APP_A, w.Player, requestId, true, Result(BigInteger.One, MIN_SOLVE0_MS + 1000, 0, SCORE0, 0));
            DepositEntry(w, APP_A, w.Player, 5_000_000);
            w.Engine.SetTransactionSigners(w.Player);
            AssertRevert("daily start cap reached", () => w.Game.startGame(APP_A, w.Player, 0));
            AssertSolvent(w, new[] { APP_A }, w.Player, w.Funder);
        }

        [Fact]
        public void ActivateApp_RejectsNonRegistryCallers()
        {
            // Unbound engine: the slot is empty, so the push lane is closed.
            var w = Setup(false);
            w.Engine.SetTransactionSigners(w.Admin);
            AssertRevert("registry not set",
                () => w.Game.activateApp(APP_A, w.AppAdmin, null));

            // Bound engine: a wallet is never the registry.
            var wb = Setup(true);
            wb.Engine.SetTransactionSigners(wb.AppAdmin);
            AssertRevert("registry only",
                () => wb.Game.activateApp(APP_A, wb.AppAdmin, null));

            // A re-activation through the registry refreshes the tenant row
            // instead of failing (the engine schema-upgrade re-attach path).
            RegisterViaRegistry(wb, APP_A);
            wb.Engine.SetTransactionSigners(wb.Admin);
            wb.Registry!.proposeEngine("platform-game-v2", wb.Game.Hash, 2);
            AdvanceMs(wb.Engine, TIMELOCK_MS + 1_000);
            wb.Registry!.registerEngine("platform-game-v2");
            wb.Engine.SetTransactionSigners(wb.AppAdmin);
            wb.Registry!.attachEngine(APP_A, "platform-game-v2");
            Assert.Equal(new BigInteger(GAME_TYPE_REWARD), wb.Game.getGameType(APP_A));
            Assert.Equal(wb.AppAdmin, wb.Game.getGameAdmin(APP_A));
            Assert.Equal("platform-game-v2", wb.Registry!.engineOf(APP_A));
        }

        [Fact]
        public void SetRegistry_IsAdminGated()
        {
            var w = Setup(false);
            Assert.Equal(UInt160.Zero, w.Game.registry());

            w.Engine.SetTransactionSigners(w.Player);
            AssertRevert("unauthorized", () => w.Game.setRegistry(w.Player));
            w.Engine.SetTransactionSigners(w.Admin);
            AssertRevert("invalid address", () => w.Game.setRegistry(UInt160.Zero));
            w.Game.setRegistry(w.Player);
            Assert.Equal(w.Player, w.Game.registry());
        }

        [Fact]
        public void Deposits_FundAndEntryCreditTheRightLedgers()
        {
            var w = Setup(false);
            RegisterBackCompat(w, APP_A);

            FundPool(w, APP_A, w.Funder, 5L * GAS);
            Assert.Equal(new BigInteger(5L * GAS), w.Game.poolBalance(APP_A));
            Assert.Equal(new BigInteger(5L * GAS), w.Game.heldForApp(APP_A));

            DepositEntry(w, APP_A, w.Player, GAS);
            Assert.Equal(new BigInteger(GAS), w.Game.creditOf(APP_A, w.Player));
            Assert.Equal(new BigInteger(6L * GAS), w.Game.heldForApp(APP_A));

            // Memo discipline: direct invocation is not the GAS native. The
            // invalid-memo rejection inside a real GAS transfer callback is
            // source-pinned instead (PlatformGameRewardGameSourceSecurityTests)
            // — a FAULTing NEP-17 callback hangs the TestEngine host.
            w.Engine.SetTransactionSigners(w.Player);
            AssertRevert("only GAS accepted",
                () => w.Game.onNEP17Payment(w.Player, GAS, APP_A + ":entry"));

            AssertSolvent(w, new[] { APP_A }, w.Player, w.Funder);
        }

        [Fact]
        public void StartGame_ConsumesEntryReservesRewardAndMarksActive()
        {
            var w = Setup(false);
            RegisterBackCompat(w, APP_A);
            FundPool(w, APP_A, w.Funder, 10L * GAS);
            DepositEntry(w, APP_A, w.Player, ENTRY0);

            w.Engine.SetTransactionSigners(w.Player);
            BigInteger? gameId = w.Game.startGame(APP_A, w.Player, 0);
            Assert.Equal(BigInteger.One, gameId);
            Assert.Equal(BigInteger.One, w.Game.lastGameId(APP_A));

            Assert.Equal(BigInteger.Zero, w.Game.creditOf(APP_A, w.Player));
            Assert.Equal(new BigInteger(10L * GAS + ENTRY0), w.Game.poolBalance(APP_A));
            Assert.Equal(new BigInteger(REWARD0), w.Game.reservedPool(APP_A));
            Assert.Equal(new BigInteger(10L * GAS + ENTRY0 - REWARD0), w.Game.freePool(APP_A));
            Assert.Equal(BigInteger.One, w.Game.activeGameOf(APP_A, w.Player));
            Assert.Equal(BigInteger.One, w.Game.dailyStartsOf(APP_A, w.Player));
            Assert.Equal(BigInteger.One, I(w.Game.statsOf(APP_A, w.Player)!, "played"));

            var game = w.Game.getGame(APP_A, gameId!.Value)!;
            Assert.Equal(BigInteger.One, I(game, "status"));
            Assert.Equal(new BigInteger(ENTRY0), I(game, "entry"));
            Assert.Equal(new BigInteger(REWARD0), I(game, "reward"));
            Assert.Equal("", S(game, "commitment"));
            Assert.Equal(I(game, "dealtAt") + LIMIT0_MS, I(game, "deadline"));

            DepositEntry(w, APP_A, w.Player, ENTRY0);
            w.Engine.SetTransactionSigners(w.Player);
            AssertRevert("finish your active game first", () => w.Game.startGame(APP_A, w.Player, 0));
            AssertSolvent(w, new[] { APP_A }, w.Player, w.Funder);
        }

        [Fact]
        public void StartGame_GuardsRejectInvalidStarts()
        {
            var w = Setup(false);
            RegisterBackCompat(w, APP_A);
            var other = TestEngine.GetNewSigner().Account;

            w.Engine.SetTransactionSigners(w.Player);
            AssertRevert("difficulty must be 0..2", () => w.Game.startGame(APP_A, w.Player, 3));
            AssertRevert("player witness required", () => w.Game.startGame(APP_A, other, 0));
            AssertRevert("insufficient entry credit — deposit first", () => w.Game.startGame(APP_A, w.Player, 0));

            DepositEntry(w, APP_A, w.Player, ENTRY0);
            w.Engine.SetTransactionSigners(w.Player);
            AssertRevert("reward pool cannot cover this game", () => w.Game.startGame(APP_A, w.Player, 0));
            Assert.Equal(new BigInteger(ENTRY0), w.Game.creditOf(APP_A, w.Player));

            // App pause gates new starts (the app admin pauses their tenant).
            FundPool(w, APP_A, w.Funder, GAS);
            w.Engine.SetTransactionSigners(w.AppAdmin);
            w.Game.setPaused(APP_A, true);
            w.Engine.SetTransactionSigners(w.Player);
            AssertRevert("app paused", () => w.Game.startGame(APP_A, w.Player, 0));
            w.Engine.SetTransactionSigners(w.Admin);
            w.Game.setPaused(APP_A, false);
            AssertSolvent(w, new[] { APP_A }, w.Player, w.Funder);
        }

        [Fact]
        public void StartGame_BlockedWhenRegistryPausesApp_ExitsStayPauseImmune()
        {
            var w = Setup(true);
            RegisterViaRegistry(w, APP_A);
            FundPool(w, APP_A, w.Funder, 10L * GAS);
            DepositEntry(w, APP_A, w.Player, 2 * ENTRY0);

            // The registry's per-app pause consult blocks new starts.
            w.Engine.SetTransactionSigners(w.Admin);
            w.Registry!.setAppPaused(APP_A, true);
            w.Engine.SetTransactionSigners(w.Player);
            AssertRevert("registry paused", () => w.Game.startGame(APP_A, w.Player, 0));

            // The player's credit exit is pause-immune even under the GLOBAL
            // kill switch (the anchor invariant, mirrored engine-side).
            w.Engine.SetTransactionSigners(w.Admin);
            w.Registry!.setAppPaused(APP_A, false);
            w.Registry!.setGlobalPaused(true);
            AssertRevert("registry paused", () => w.Game.startGame(APP_A, w.Player, 0));
            BigInteger before = w.Engine.Native.GAS.BalanceOf(w.Player) ?? 0;
            w.Engine.SetTransactionSigners(w.Player);
            Assert.Equal(new BigInteger(2 * ENTRY0), w.Game.withdraw(APP_A, w.Player));
            Assert.Equal(before + 2 * ENTRY0, w.Engine.Native.GAS.BalanceOf(w.Player));

            w.Engine.SetTransactionSigners(w.Admin);
            w.Registry!.setGlobalPaused(false);
            AssertSolvent(w, new[] { APP_A }, w.Player, w.Funder);
        }

        [Fact]
        public void Finalize_SettleWinPaysScaledRewardAsCredit()
        {
            var w = Setup(false);
            RegisterBackCompat(w, APP_A);
            FundPool(w, APP_A, w.Funder, 10L * GAS);
            DepositEntry(w, APP_A, w.Player, ENTRY0);
            var (gameId, requestId) = StartAndFinalize(w, APP_A, w.Player, 0);
            Assert.Equal(new BigInteger(5), I(w.Game.getGame(APP_A, gameId)!, "status"));
            Assert.Equal(gameId, w.Game.gameOfRequest(APP_A, requestId));

            long elapsed = MIN_SOLVE0_MS + 1000;
            string? evApp = null;
            BigInteger? evGame = null, evDifficulty = null, evElapsed = null, evScore = null, evPayout = null, evTotalWon = null;
            UInt160? evPlayer = null;
            w.Game.OnSolved += (a, g, p, d, e, s, pay, won) =>
            { evApp = a; evGame = g; evPlayer = p; evDifficulty = d; evElapsed = e; evScore = s; evPayout = pay; evTotalWon = won; };

            Deliver(w, APP_A, w.Player, requestId, true, Result(gameId, elapsed, 0, SCORE0, 0));

            Assert.Equal(new BigInteger(REWARD0), w.Game.creditOf(APP_A, w.Player));
            Assert.Equal(BigInteger.Zero, w.Game.reservedPool(APP_A));
            Assert.Equal(new BigInteger(10L * GAS + ENTRY0 - REWARD0), w.Game.poolBalance(APP_A));
            Assert.Equal(BigInteger.Zero, w.Game.activeGameOf(APP_A, w.Player));
            Assert.Equal(BigInteger.Zero, w.Game.gameOfRequest(APP_A, requestId));

            var stats = w.Game.statsOf(APP_A, w.Player)!;
            Assert.Equal(BigInteger.One, I(stats, "solved"));
            Assert.Equal(new BigInteger(REWARD0), I(stats, "totalWon"));

            var game = w.Game.getGame(APP_A, gameId)!;
            Assert.Equal(new BigInteger(2), I(game, "status"));
            Assert.Equal(new BigInteger(REWARD0), I(game, "payout"));
            Assert.Equal(new BigInteger(elapsed), I(game, "solveMs"));
            Assert.Equal(Hex(TestCommitment(gameId)), S(game, "commitment"));
            Assert.Equal(Hex(TestAnswerHash(gameId)), S(game, "answerHash"));

            // Solved carries appId in slot 0, then the clone leaderboard order.
            Assert.Equal(APP_A, evApp);
            Assert.Equal(gameId, evGame);
            Assert.Equal(w.Player, evPlayer);
            Assert.Equal(BigInteger.Zero, evDifficulty);
            Assert.Equal(new BigInteger(elapsed), evElapsed);
            Assert.Equal(new BigInteger(SCORE0), evScore);
            Assert.Equal(new BigInteger(REWARD0), evPayout);
            Assert.Equal(new BigInteger(REWARD0), evTotalWon);

            // A settled game cannot be re-settled or expired.
            AssertRevert("request context not found",
                () => Deliver(w, APP_A, w.Player, requestId, true, Result(gameId, elapsed, 0, SCORE0, 0)));
            AssertRevert("game not expirable", () => w.Game.expireGame(APP_A, gameId));
            AssertSolvent(w, new[] { APP_A }, w.Player, w.Funder);
        }

        [Fact]
        public void OnMiniAppResult_BindsModuleOperationAndRequester()
        {
            // Audit low: the kernel callback must bind the expected moduleId
            // and the game's player as requester, not just caller + operation.
            var w = Setup(false);
            RegisterBackCompat(w, APP_A);
            FundPool(w, APP_A, w.Funder, 10L * GAS);
            DepositEntry(w, APP_A, w.Player, ENTRY0);
            var (gameId, requestId) = StartAndFinalize(w, APP_A, w.Player, 0);

            w.Engine.SetTransactionSigners(w.Admin);
            AssertRevert("unexpected module", () =>
                w.Oracle.Deliver(w.Game.Hash, requestId, APP_A, "game.other", OP_FINALIZE,
                    w.Player, true, Result(gameId, MIN_SOLVE0_MS + 1000, 0, SCORE0, 0), ""));
            AssertRevert("requester mismatch", () =>
                w.Oracle.Deliver(w.Game.Hash, requestId, APP_A, MODULE_ID, OP_FINALIZE,
                    w.AppAdmin, true, Result(gameId, MIN_SOLVE0_MS + 1000, 0, SCORE0, 0), ""));

            // The intact request still settles.
            Deliver(w, APP_A, w.Player, requestId, true, Result(gameId, MIN_SOLVE0_MS + 1000, 0, SCORE0, 0));
            Assert.Equal(new BigInteger(2), I(w.Game.getGame(APP_A, gameId)!, "status"));
            AssertSolvent(w, new[] { APP_A }, w.Player, w.Funder);
        }

        [Fact]
        public void OnMiniAppResult_LateAfterExpiry_IsConsumedAndIdempotent()
        {
            // Audit low: ExpireGame on a settling (Status 5) game used to
            // wedge the late kernel callback (FAULT "game not settling") and
            // leak the request row. The callback now always consumes its
            // context and no-ops when the game is no longer settling.
            var w = Setup(false);
            RegisterBackCompat(w, APP_A);
            FundPool(w, APP_A, w.Funder, 10L * GAS);
            DepositEntry(w, APP_A, w.Player, ENTRY0);
            var (gameId, requestId) = StartAndFinalize(w, APP_A, w.Player, 0);

            AdvanceMs(w.Engine, LIMIT0_MS + SETTLE_GRACE_MS + 1000);
            w.Engine.SetTransactionSigners(w.Player);
            Assert.Equal(new BigInteger(3), w.Game.expireGame(APP_A, gameId));

            BigInteger poolBefore = w.Game.poolBalance(APP_A) ?? 0;
            BigInteger reservedBefore = w.Game.reservedPool(APP_A) ?? 0;

            Deliver(w, APP_A, w.Player, requestId, true, Result(gameId, MIN_SOLVE0_MS + 1000, 0, SCORE0, 0));
            Assert.Equal(BigInteger.Zero, w.Game.gameOfRequest(APP_A, requestId));
            Assert.Equal(poolBefore, w.Game.poolBalance(APP_A));
            Assert.Equal(reservedBefore, w.Game.reservedPool(APP_A));
            Assert.Equal(new BigInteger(3), I(w.Game.getGame(APP_A, gameId)!, "status"));

            AssertRevert("request context not found",
                () => Deliver(w, APP_A, w.Player, requestId, true, Result(gameId, MIN_SOLVE0_MS + 1000, 0, SCORE0, 0)));
            AssertSolvent(w, new[] { APP_A }, w.Player, w.Funder);
        }

        [Fact]
        public void Settle_RefundAndBelowTarget_DoNotFireSolved()
        {
            // Audit low: the Solved event fired on refunded and lost runs,
            // writing phantom leaderboard rows. It now fires only on a
            // verified solve (success && score >= target).
            var w = Setup(false);
            RegisterBackCompat(w, APP_A);
            FundPool(w, APP_A, w.Funder, 10L * GAS);

            int solvedEvents = 0;
            w.Game.OnSolved += (a, g, p, d, e, s, pay, won) => solvedEvents++;

            // Kernel-failure refund: entry returned, Status 4, no Solved.
            DepositEntry(w, APP_A, w.Player, ENTRY0);
            var (gameId1, reqId1) = StartAndFinalize(w, APP_A, w.Player, 0);
            Deliver(w, APP_A, w.Player, reqId1, false, Result(gameId1, 0, 0, 0, 0));
            Assert.Equal(new BigInteger(4), I(w.Game.getGame(APP_A, gameId1)!, "status"));
            Assert.Equal(new BigInteger(ENTRY0), w.Game.creditOf(APP_A, w.Player));
            Assert.Equal(0, solvedEvents);

            // Below-target success: entry stays pooled, Status 2, no Solved.
            DepositEntry(w, APP_A, w.Player, ENTRY0);
            var (gameId2, reqId2) = StartAndFinalize(w, APP_A, w.Player, 0);
            Deliver(w, APP_A, w.Player, reqId2, true, Result(gameId2, MIN_SOLVE0_MS + 1000, 0, 1, 0));
            var game2 = w.Game.getGame(APP_A, gameId2)!;
            Assert.Equal(new BigInteger(2), I(game2, "status"));
            Assert.Equal(BigInteger.Zero, I(game2, "payout"));
            Assert.Equal(0, solvedEvents);

            var stats = w.Game.statsOf(APP_A, w.Player)!;
            Assert.Equal(BigInteger.Zero, I(stats, "solved"));
            AssertSolvent(w, new[] { APP_A }, w.Player, w.Funder);
        }

        [Fact]
        public void Finalize_UndoPenaltyBurns30PctOfBaseRewardEach()
        {
            var w = Setup(false);
            RegisterBackCompat(w, APP_A);
            FundPool(w, APP_A, w.Funder, 10L * GAS);
            DepositEntry(w, APP_A, w.Player, 3 * ENTRY0);

            long[] expectedPayouts = { REWARD0 * 70 / 100, REWARD0 * 40 / 100, REWARD0 * 10 / 100 };
            for (int undos = 1; undos <= 3; undos++)
            {
                var (gameId, requestId) = StartAndFinalize(w, APP_A, w.Player, 0);
                Deliver(w, APP_A, w.Player, requestId, true, Result(gameId, MIN_SOLVE0_MS + 1000, undos, SCORE0, 0));
                Assert.Equal(new BigInteger(expectedPayouts[undos - 1]), I(w.Game.getGame(APP_A, gameId)!, "payout"));
                Assert.Equal(new BigInteger(undos), I(w.Game.getGame(APP_A, gameId)!, "undos"));
                AssertSolvent(w, new[] { APP_A }, w.Player, w.Funder);
            }
            Assert.Equal(new BigInteger(3), I(w.Game.statsOf(APP_A, w.Player)!, "solved"));
        }

        [Fact]
        public void Settle_ScoreBelowTargetIsLoss_OracleFailureRefundsEntry()
        {
            var w = Setup(false);
            RegisterBackCompat(w, APP_A);
            FundPool(w, APP_A, w.Funder, 10L * GAS);
            DepositEntry(w, APP_A, w.Player, 2 * ENTRY0);

            // Score below target: a played loss — reservation released, no
            // payout, and the entry is NOT refunded.
            var (g1, r1) = StartAndFinalize(w, APP_A, w.Player, 0);
            Deliver(w, APP_A, w.Player, r1, true, Result(g1, MIN_SOLVE0_MS + 1000, 0, 0, 0));
            Assert.Equal(new BigInteger(2), I(w.Game.getGame(APP_A, g1)!, "status"));
            Assert.Equal(new BigInteger(ENTRY0), w.Game.creditOf(APP_A, w.Player));
            Assert.Equal(BigInteger.Zero, I(w.Game.getGame(APP_A, g1)!, "payout"));

            // Oracle failure: the kernel could not verify the run, so the
            // entry returns to the player's credit (Status 4, refunded).
            var (g2, r2) = StartAndFinalize(w, APP_A, w.Player, 0);
            Deliver(w, APP_A, w.Player, r2, false, new byte[0]);
            var game = w.Game.getGame(APP_A, g2)!;
            Assert.Equal(new BigInteger(4), I(game, "status"));
            Assert.Equal(BigInteger.Zero, I(game, "payout"));
            Assert.Equal(new BigInteger(ENTRY0), w.Game.creditOf(APP_A, w.Player));
            Assert.Equal(BigInteger.Zero, w.Game.reservedPool(APP_A));
            Assert.Equal(BigInteger.Zero, I(w.Game.statsOf(APP_A, w.Player)!, "solved"));
            AssertSolvent(w, new[] { APP_A }, w.Player, w.Funder);
        }

        [Fact]
        public void OnMiniAppResult_RejectsNonOracleCaller()
        {
            var w = Setup(false);
            RegisterBackCompat(w, APP_A);
            FundPool(w, APP_A, w.Funder, 10L * GAS);
            DepositEntry(w, APP_A, w.Player, ENTRY0);
            var (gameId, requestId) = StartAndFinalize(w, APP_A, w.Player, 0);

            w.Engine.SetTransactionSigners(w.Player);
            AssertRevert("oracle only", () => w.Game.onMiniAppResult(
                requestId, APP_A, MODULE_ID, OP_FINALIZE, w.Player, true,
                Result(gameId, MIN_SOLVE0_MS + 1000, 0, SCORE0, 0), ""));
            Assert.Equal(new BigInteger(5), I(w.Game.getGame(APP_A, gameId)!, "status"));
            AssertSolvent(w, new[] { APP_A }, w.Player, w.Funder);
        }

        [Fact]
        public void OnMiniAppResult_RejectsWrongOperationBadCodecAndBounds()
        {
            var w = Setup(false);
            RegisterBackCompat(w, APP_A);
            FundPool(w, APP_A, w.Funder, 10L * GAS);
            DepositEntry(w, APP_A, w.Player, ENTRY0);
            var (gameId, requestId) = StartAndFinalize(w, APP_A, w.Player, 0);
            long elapsed = MIN_SOLVE0_MS + 1000;

            AssertRevert("unexpected operation", () => w.Oracle.Deliver(
                w.Game.Hash, requestId, APP_A, MODULE_ID, "session.start", w.Player, true,
                Result(gameId, elapsed, 0, SCORE0, 0), ""));

            byte[] good = Result(gameId, elapsed, 0, SCORE0, 0);
            byte[] badTag = (byte[])good.Clone(); badTag[0] = 0x01;
            AssertRevert("bad result tag", () => Deliver(w, APP_A, w.Player, requestId, true, badTag));
            byte[] shortResult = new byte[78];
            Array.Copy(good, shortResult, 78);
            AssertRevert("bad result length", () => Deliver(w, APP_A, w.Player, requestId, true, shortResult));
            AssertRevert("difficulty mismatch",
                () => Deliver(w, APP_A, w.Player, requestId, true, Result(gameId, elapsed, 0, SCORE0, 1)));
            AssertRevert("undos out of range",
                () => Deliver(w, APP_A, w.Player, requestId, true, Result(gameId, elapsed, 4, SCORE0, 0)));
            AssertRevert("solved too fast",
                () => Deliver(w, APP_A, w.Player, requestId, true, Result(gameId, MIN_SOLVE0_MS - 1, 0, SCORE0, 0)));
            AssertRevert("time limit exceeded",
                () => Deliver(w, APP_A, w.Player, requestId, true, Result(gameId, LIMIT0_MS + 1, 0, SCORE0, 0)));

            // Nothing settled by the rejected attempts.
            Assert.Equal(new BigInteger(5), I(w.Game.getGame(APP_A, gameId)!, "status"));
            AssertSolvent(w, new[] { APP_A }, w.Player, w.Funder);
        }

        [Fact]
        public void FinalizeGame_GuardsOwnershipAndActiveState()
        {
            var w = Setup(false);
            RegisterBackCompat(w, APP_A);
            FundPool(w, APP_A, w.Funder, 10L * GAS);
            DepositEntry(w, APP_A, w.Player, ENTRY0);
            var other = TestEngine.GetNewSigner().Account;

            // A player with no active game has nothing to finalize.
            w.Engine.SetTransactionSigners(other);
            AssertRevert("no active game", () => w.Game.finalizeGame(APP_A, other, "00"));

            w.Engine.SetTransactionSigners(w.Player);
            w.Game.startGame(APP_A, w.Player, 0);

            w.Engine.SetTransactionSigners(other);
            AssertRevert("player witness required", () => w.Game.finalizeGame(APP_A, w.Player, "00"));

            // Finalize once; a second finalize on a settling game is rejected.
            w.Engine.SetTransactionSigners(w.Player);
            w.Game.finalizeGame(APP_A, w.Player, "00");
            AssertRevert("game not in play", () => w.Game.finalizeGame(APP_A, w.Player, "00"));

            // The hex guard parses the op-log before any kernel call.
            FundGas(w.Engine, other, GAS);
            DepositEntry(w, APP_A, other, ENTRY0);
            w.Engine.SetTransactionSigners(other);
            w.Game.startGame(APP_A, other, 0);
            AssertRevert("invalid hex argument", () => w.Game.finalizeGame(APP_A, other, "0"));
            AssertSolvent(w, new[] { APP_A }, w.Player, w.Funder, other);
        }

        [Fact]
        public void ExpireGame_ActiveAndAbandonedSettlingReleaseReservation()
        {
            var w = Setup(false);
            RegisterBackCompat(w, APP_A);
            FundPool(w, APP_A, w.Funder, 10L * GAS);
            DepositEntry(w, APP_A, w.Player, 2 * ENTRY0);

            // Active past deadline + grace.
            w.Engine.SetTransactionSigners(w.Player);
            BigInteger g1 = w.Game.startGame(APP_A, w.Player, 0)!.Value;
            AssertRevert("game not expirable", () => w.Game.expireGame(APP_A, g1));
            AdvanceMs(w.Engine, LIMIT0_MS + 1000);
            AssertRevert("game not expirable", () => w.Game.expireGame(APP_A, g1));
            AdvanceMs(w.Engine, SETTLE_GRACE_MS);
            w.Engine.SetTransactionSigners(w.Funder); // permissionless
            Assert.Equal(new BigInteger(3), w.Game.expireGame(APP_A, g1));
            Assert.Equal(BigInteger.Zero, w.Game.reservedPool(APP_A));
            Assert.Equal(BigInteger.Zero, w.Game.activeGameOf(APP_A, w.Player));

            // Abandoned settling past grace.
            var (g2, _) = StartAndFinalize(w, APP_A, w.Player, 0);
            Assert.Equal(new BigInteger(5), I(w.Game.getGame(APP_A, g2)!, "status"));
            AdvanceMs(w.Engine, LIMIT0_MS + SETTLE_GRACE_MS + 1000);
            w.Engine.SetTransactionSigners(w.Funder);
            Assert.Equal(new BigInteger(3), w.Game.expireGame(APP_A, g2));
            Assert.Equal(BigInteger.Zero, w.Game.reservedPool(APP_A));
            AssertSolvent(w, new[] { APP_A }, w.Player, w.Funder);
        }

        [Fact]
        public void Withdraw_PullsTheWholeCreditOnce()
        {
            var w = Setup(false);
            RegisterBackCompat(w, APP_A);
            FundPool(w, APP_A, w.Funder, 10L * GAS);
            DepositEntry(w, APP_A, w.Player, GAS);

            BigInteger before = w.Engine.Native.GAS.BalanceOf(w.Player) ?? 0;
            w.Engine.SetTransactionSigners(w.Player);
            Assert.Equal(new BigInteger(GAS), w.Game.withdraw(APP_A, w.Player));
            Assert.Equal(before + GAS, w.Engine.Native.GAS.BalanceOf(w.Player));
            Assert.Equal(BigInteger.Zero, w.Game.creditOf(APP_A, w.Player));
            Assert.Equal(new BigInteger(10L * GAS), w.Game.heldForApp(APP_A));
            AssertRevert("no credit", () => w.Game.withdraw(APP_A, w.Player));

            // A stranger cannot pull the player's credit.
            var stranger = TestEngine.GetNewSigner().Account;
            DepositEntry(w, APP_A, w.Player, ENTRY0);
            w.Engine.SetTransactionSigners(stranger);
            AssertRevert("account witness required", () => w.Game.withdraw(APP_A, w.Player));
            AssertSolvent(w, new[] { APP_A }, w.Player, w.Funder);
        }

        [Fact]
        public void Descriptor_RangeValidationAppliesEngineSideBounds()
        {
            var w = Setup(true);
            RegisterViaRegistry(w, APP_A);
            string K(string param) => RG_ENGINE_ID + ":" + param;
            void Set(string param, long value)
            {
                w.Engine.SetTransactionSigners(w.AppAdmin);
                w.Registry!.setDescriptor(APP_A, K(param), new BigInteger(value));
            }
            void SetReverts(string reason, string param, long value)
            {
                w.Engine.SetTransactionSigners(w.AppAdmin);
                AssertRevert(reason, () => w.Registry!.setDescriptor(APP_A, K(param), new BigInteger(value)));
            }

            SetReverts("entry out of range", "entry0", -1);
            SetReverts("entry out of range", "entry0", 100_000_000_001);
            SetReverts("reward out of range", "reward1", 100_000_000_001);
            SetReverts("limitMs out of range", "limitMs0", 999);
            SetReverts("limitMs out of range", "limitMs0", 3_600_001);
            SetReverts("minSolveMs out of range", "minSolveMs0", 3_600_001);
            SetReverts("targetScore out of range", "targetScore0", 0);
            SetReverts("dailyCap out of range", "dailyCap", 0);
            SetReverts("dailyCap out of range", "dailyCap", 101);
            SetReverts("undoPenaltyBps out of range", "undoPenaltyBps", 3334);
            SetReverts("settleGraceMs out of range", "settleGraceMs", 59_999);
            SetReverts("minSolveMs above limitMs", "minSolveMs0", LIMIT0_MS + 1);
            SetReverts("unknown descriptor key", "houseEdgeBps", 100);

            // The engine ABI rejects a wallet calling it directly.
            w.Engine.SetTransactionSigners(w.AppAdmin);
            AssertRevert("registry only",
                () => w.Game.validateAndApplyDescriptor(APP_A, K("entry0"), new BigInteger(ENTRY0)));

            // A good write lands and is consumed: entry0 -> 6_000_000.
            Set("entry0", 6_000_000);
            Assert.Equal(new BigInteger(6_000_000), AsInt(w.Registry!.getDescriptor(APP_A, K("entry0"))));
            FundPool(w, APP_A, w.Funder, 10L * GAS);
            DepositEntry(w, APP_A, w.Player, 6_000_000);
            w.Engine.SetTransactionSigners(w.Player);
            Assert.Equal(BigInteger.One, w.Game.startGame(APP_A, w.Player, 0));
            Assert.Equal(new BigInteger(6_000_000), I(w.Game.getGame(APP_A, BigInteger.One)!, "entry"));
            AssertSolvent(w, new[] { APP_A }, w.Player, w.Funder);
        }

        [Fact]
        public void Tenants_AreIsolatedPerApp()
        {
            var w = Setup(false);
            RegisterBackCompat(w, APP_A);
            RegisterBackCompat(w, APP_B);
            FundPool(w, APP_A, w.Funder, 10L * GAS);
            DepositEntry(w, APP_A, w.Player, ENTRY0);
            DepositEntry(w, APP_B, w.Player, ENTRY1);

            // App B has no pool funding: its entry alone cannot cover the
            // reservation, even though app A's pool is flush.
            w.Engine.SetTransactionSigners(w.Player);
            AssertRevert("reward pool cannot cover this game", () => w.Game.startGame(APP_B, w.Player, 1));

            Assert.Equal(new BigInteger(10L * GAS), w.Game.poolBalance(APP_A));
            Assert.Equal(BigInteger.Zero, w.Game.poolBalance(APP_B));
            Assert.Equal(new BigInteger(10L * GAS + ENTRY0), w.Game.heldForApp(APP_A));
            Assert.Equal(new BigInteger(ENTRY1), w.Game.heldForApp(APP_B));

            Assert.Equal(BigInteger.One, w.Game.startGame(APP_A, w.Player, 0));
            AssertSolvent(w, new[] { APP_A, APP_B }, w.Player, w.Funder);
        }
    }
}
