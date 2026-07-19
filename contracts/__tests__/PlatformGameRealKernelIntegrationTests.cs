using System;
using System.Collections.Generic;
using System.Numerics;
using Neo;
using Neo.SmartContract.Testing;
using Neo.Wallets;
using Xunit;
using static NeoMiniAppPlatform.Contracts.Tests.RegistryHarness;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    // ===================================================================
    //  Joint-testing centerpiece: the PlatformGame RewardGame lifecycle
    //  driven through the REAL MorpheusOracle kernel NEF (fixtures/
    //  real-kernel — the current-source build whose 70-method ABI carries
    //  the rich 8-arg onMiniAppResult dispatch), not the
    //  GameOracleMockFixture stand-in. Both contracts live in ONE
    //  TestEngine; no chain writes.
    //
    //  The flow exercises every kernel gate on the production path:
    //    kernel admin SetRuntimeVerificationPublicKey + SetUpdater
    //    -> RegisterSystemModule("game.session", ...)
    //    -> RegisterMiniApp(callbackContract = PlatformGame.Hash)
    //    -> GrantModuleToMiniApp -> GAS fee-credit deposit (OnNEP17Payment)
    //    -> PlatformGame registerGame(gameType 5) + SetOracle(kernel)
    //    -> pool fund ("<app>:fund") + player entry deposit ("<app>:entry")
    //    -> startGame -> finalizeGame (the kernel queues the request and
    //       enforces callbackContract == caller)
    //    -> off-chain: the 79-byte finalize result + the fulfillment
    //       digest recomputed in-test exactly as the kernel's
    //       ComputeFulfillmentDigest builds it, signed by the runtime
    //       verifier key
    //    -> FulfillRequest (updater) -> the kernel's RICH onMiniAppResult
    //       dispatch settles the game on PlatformGame.
    //  The negative matrix pins the three decisive kernel gates.
    // ===================================================================
    public class PlatformGameRealKernelIntegrationTests
    {
        private const long GAS_UNIT = 100_000_000;
        private const int GAME_TYPE_REWARD = 5;
        private const string APP_ID = "rk-reward-app";
        private const string MODULE_ID = "game.session";
        private const string OP_FINALIZE = "session.finalize";
        private const long REQUEST_FEE = 1_000_000;   // kernel DEFAULT_REQUEST_FEE
        private const long ENTRY0 = 2_000_000;        // clone fleet defaults (no descriptor)
        private const long REWARD0 = 10_000_000;
        private const long FUND = 1 * GAS_UNIT;
        private const ulong ELAPSED_MS = 30_000;      // within [min 10_000, limit 60_000]
        private const uint SCORE = 5;                 // >= default target 3 -> full payout

        // KernelRequest field order (morpheus repo MorpheusOracle.cs:192).
        private const int REQ_APP_ID = 1;
        private const int REQ_MODULE_ID = 2;
        private const int REQ_OPERATION = 3;
        private const int REQ_CALLBACK = 7;
        private const int REQ_STATUS = 8;             // 0 Pending, 1 Succeeded, 2 Failed
        private const int REQ_FEE_PAID = 14;

        private sealed class World
        {
            public TestEngine Engine = null!;
            public RealKernelContract Kernel = null!;
            public PlatformGameRewardGameContract Game = null!;
            public UInt160 Admin = null!;
            public UInt160 Player = null!;
            public KeyPair Verifier = null!;
        }

        // Deploys kernel + game in one engine and walks the whole
        // registration gauntlet. grantModule=false skips the capability
        // grant (the ungranted-module negative); mismatchedCallback
        // registers the app's kernel callback as the KERNEL ITSELF — any
        // valid hash that is not PlatformGame proves the caller gate.
        private static World Setup(bool grantModule = true, bool mismatchedCallback = false)
        {
            var engine = new TestEngine(true);
            engine.Fee = 1_000L * GAS_UNIT; // real deploys exceed the default budget
            UInt160 admin = engine.ValidatorsAddress;

            RealKernelContract kernel = RealKernelFixture.Deploy(engine, admin);
            var (gameNef, gameManifest) = Load("PlatformGame");
            engine.SetTransactionSigners(admin);
            var game = engine.Deploy<PlatformGameRewardGameContract>(gameNef, gameManifest);

            byte[] verifierPriv = new byte[32];
            verifierPriv[31] = 7;
            var verifier = new KeyPair(verifierPriv);

            engine.SetTransactionSigners(admin);
            kernel.setRuntimeVerificationPublicKey(verifier.PublicKey);
            kernel.setUpdater(admin);
            kernel.registerSystemModule(MODULE_ID, "/game/session/finalize", "miniapp.game.session.v1");
            kernel.registerMiniApp(APP_ID, admin, admin,
                mismatchedCallback ? kernel.Hash : game.Hash, "ipfs://" + APP_ID, "deadbeef");
            if (grantModule) kernel.grantModuleToMiniApp(APP_ID, MODULE_ID);
            // Kernel fee credit: a plain GAS transfer credits the depositor.
            bool? ok = engine.Native.GAS.Transfer(admin, kernel.Hash, 10 * REQUEST_FEE, null);
            Assert.True(ok == true, "kernel fee credit deposit should succeed");

            game.registerGame(APP_ID, GAME_TYPE_REWARD, admin, null!);
            game.setOracle(kernel.Hash);
            ok = engine.Native.GAS.Transfer(admin, game.Hash, FUND, APP_ID + ":fund");
            Assert.True(ok == true, "pool funding transfer should succeed");

            UInt160 player = TestEngine.GetNewSigner().Account;
            ok = engine.Native.GAS.Transfer(admin, player, 100L * GAS_UNIT, null);
            Assert.True(ok == true, "player funding should succeed");
            engine.SetTransactionSigners(player);
            ok = engine.Native.GAS.Transfer(player, game.Hash, ENTRY0, APP_ID + ":entry");
            Assert.True(ok == true, "entry deposit should succeed");

            return new World { Engine = engine, Kernel = kernel, Game = game, Admin = admin, Player = player, Verifier = verifier };
        }

        private static byte[] FinalizeResult() =>
            GameResultCodec.Build(new byte[32], new byte[32], ELAPSED_MS, 0, SCORE, 0);

        private static byte[] Digest(World w, BigInteger requestId, byte[] result) =>
            FulfillmentDigest.Compute(requestId, APP_ID, MODULE_ID, OP_FINALIZE, true,
                result, "", w.Kernel.Hash.GetSpan().ToArray(), w.Engine.ProtocolSettings.Network);

        private static BigInteger I(Neo.VM.Types.Map m, string key) =>
            m[(Neo.VM.Types.PrimitiveType)key].GetInteger();

        [Fact]
        public void RewardGameSettlesThroughRealKernelGates()
        {
            World w = Setup();

            var queued = new List<(BigInteger? Rid, string? App, string? Mod, string? Op, UInt160? Requester, UInt160? Sponsor)>();
            w.Kernel.OnMiniAppRequestQueued += (rid, app, mod, op, requester, sponsor, payload) =>
                queued.Add((rid, app, mod, op, requester, sponsor));
            var solved = new List<BigInteger?>();
            w.Game.OnSolved += (app, gid, player, diff, elapsed, score, payout, totalWon) =>
                solved.Add(payout);

            w.Engine.SetTransactionSigners(w.Player);
            BigInteger gameId = w.Game.startGame(APP_ID, w.Player, 0)!.Value;
            BigInteger requestId = w.Game.finalizeGame(APP_ID, w.Player, "00")!.Value;

            // The kernel queued the request and bound it to PlatformGame.
            Assert.Single(queued);
            Assert.Equal(requestId, queued[0].Rid!.Value);
            Assert.Equal(APP_ID, queued[0].App);
            Assert.Equal(MODULE_ID, queued[0].Mod);
            Assert.Equal(OP_FINALIZE, queued[0].Op);
            Assert.Equal(w.Player, queued[0].Requester);
            Assert.Equal(w.Admin, queued[0].Sponsor); // the app fee payer covered the fee
            IList<object> req = w.Kernel.getRequest(requestId)!;
            Assert.Equal(APP_ID, AsString(req[REQ_APP_ID]));
            Assert.Equal(MODULE_ID, AsString(req[REQ_MODULE_ID]));
            Assert.Equal(OP_FINALIZE, AsString(req[REQ_OPERATION]));
            Assert.Equal(w.Game.Hash, AsHash(req[REQ_CALLBACK]));
            Assert.Equal(0, (int)AsInt(req[REQ_STATUS]));
            Assert.Equal(REQUEST_FEE, (long)AsInt(req[REQ_FEE_PAID]));
            Assert.Equal(10 * REQUEST_FEE - REQUEST_FEE, (long)(w.Kernel.feeCreditOf(w.Admin) ?? 0));

            // Off-chain oracle: 79-byte codec result, digest recomputed
            // in-test, signed by the runtime verifier key.
            byte[] result = FinalizeResult();
            byte[] signature = FulfillmentDigest.SignVerified(Digest(w, requestId, result), w.Verifier);
            w.Engine.SetTransactionSigners(w.Admin); // the updater
            w.Kernel.fulfillRequest(requestId, true, result, "", signature);

            // The RICH dispatch settled the game: the legacy 5-arg fallback
            // faults inside PlatformGame.OnOracleResult (requestType
            // "session.finalize" != "vrf_random") and leaves the game
            // Settling — a status-2 settle is reachable ONLY through the
            // 8-arg onMiniAppResult.
            var g = w.Game.getGame(APP_ID, gameId)!;
            Assert.Equal(new BigInteger(2), I(g, "status"));
            Assert.Equal(new BigInteger(REWARD0), I(g, "payout"));
            Assert.Equal(new BigInteger((long)ELAPSED_MS), I(g, "solveMs"));
            Assert.Single(solved);
            Assert.Equal(REWARD0, (long)solved[0]!);

            // Money: credit posted, reservation released, liability identity.
            Assert.Equal(REWARD0, (long)(w.Game.creditOf(APP_ID, w.Player) ?? 0));
            Assert.Equal(0, (long)(w.Game.activeGameOf(APP_ID, w.Player) ?? 0));
            Assert.Equal(0, (long)(w.Game.reservedPool(APP_ID) ?? 0));
            BigInteger pool = w.Game.poolBalance(APP_ID) ?? 0;
            Assert.Equal(FUND + ENTRY0 - REWARD0, (long)pool);
            BigInteger held = w.Game.heldForApp(APP_ID) ?? 0;
            Assert.Equal(pool + REWARD0, held); // heldForApp == pool + sum(credits)
            Assert.Equal(held, w.Engine.Native.GAS.BalanceOf(w.Game.Hash) ?? 0);

            // Kernel-side completion.
            req = w.Kernel.getRequest(requestId)!;
            Assert.Equal(1, (int)AsInt(req[REQ_STATUS]));
            Assert.Equal(1, (long)(w.Kernel.getMiniAppFulfilledCount(APP_ID) ?? 0));

            // The posted credit is real: withdraw pays the player out.
            w.Engine.SetTransactionSigners(w.Player);
            BigInteger withdrawn = w.Game.withdraw(APP_ID, w.Player)!.Value;
            Assert.Equal(REWARD0, (long)withdrawn);
            Assert.Equal(pool, w.Game.heldForApp(APP_ID) ?? 0);
            Assert.Equal(pool, w.Engine.Native.GAS.BalanceOf(w.Game.Hash) ?? 0);
        }

        [Fact]
        public void SubmitFromNonCallbackContractFaults()
        {
            // The kernel-side app record names the KERNEL as its callback
            // contract, so PlatformGame's finalize call reaches the kernel
            // as a non-callback contract.
            World w = Setup(mismatchedCallback: true);
            w.Engine.SetTransactionSigners(w.Player);
            w.Game.startGame(APP_ID, w.Player, 0);
            AssertRevert("only integration contract", () => w.Game.finalizeGame(APP_ID, w.Player, "00"));
        }

        [Fact]
        public void FulfillWithBadSignatureFaults()
        {
            World w = Setup();
            w.Engine.SetTransactionSigners(w.Player);
            BigInteger gameId = w.Game.startGame(APP_ID, w.Player, 0)!.Value;
            BigInteger requestId = w.Game.finalizeGame(APP_ID, w.Player, "00")!.Value;

            // A well-formed digest signed by the WRONG key must not settle.
            byte[] wrongPriv = new byte[32];
            wrongPriv[31] = 9;
            byte[] result = FinalizeResult();
            byte[] badSig = FulfillmentDigest.SignVerified(Digest(w, requestId, result), new KeyPair(wrongPriv));
            w.Engine.SetTransactionSigners(w.Admin);
            AssertRevert("invalid verification signature",
                () => w.Kernel.fulfillRequest(requestId, true, result, "", badSig));

            // The request stays Pending and the game stays Settling (status 5).
            Assert.Equal(0, (int)AsInt(w.Kernel.getRequest(requestId)![REQ_STATUS]));
            Assert.Equal(new BigInteger(5), I(w.Game.getGame(APP_ID, gameId)!, "status"));
        }

        [Fact]
        public void UngrantedModuleFaults()
        {
            World w = Setup(grantModule: false);
            Assert.False(w.Kernel.isModuleGrantedToMiniApp(APP_ID, MODULE_ID) == true);
            w.Engine.SetTransactionSigners(w.Player);
            w.Game.startGame(APP_ID, w.Player, 0);
            AssertRevert("module not granted", () => w.Game.finalizeGame(APP_ID, w.Player, "00"));
        }
    }
}
