using System;
using System.IO;
using Neo;
using Neo.SmartContract.Testing;
using Xunit;
using static NeoMiniAppPlatform.Contracts.Tests.RegistryHarness;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    // ===================================================================
    //  Audit fix H2: PlatformGame's Update / SetOracle used to be INSTANT
    //  admin operations — one compromised admin key could swap the NEF or
    //  repoint the settlement trust root in a single transaction. These
    //  tests pin the timelocked replacements ported from PlatformRegistry:
    //  ScheduleUpdate / Update / CancelUpdate (24h, sha256-pinned) and the
    //  ProposeOracle / ExecuteOracleChange / CancelOracleChange repoint
    //  pair, while the initial SetOracle bind stays instant so existing
    //  deploy/test wiring keeps working.
    // ===================================================================
    public abstract class PlatformGameAdminTimelockContract : SmartContract
    {
        protected PlatformGameAdminTimelockContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract UInt160? admin();
        public abstract UInt160? oracle();
        public abstract void setOracle(UInt160 oracle);
        public abstract void proposeOracle(UInt160 newOracle);
        public abstract void executeOracleChange();
        public abstract void cancelOracleChange();
        public abstract void scheduleUpdate(byte[] nefFile, string manifest);
        public abstract void update(byte[] nefFile, string manifest);
        public abstract void cancelUpdate();
    }

    public class PlatformGameAdminTimelockTests
    {
        private const long GAS = 100_000_000; // 1 GAS base units

        private sealed class World
        {
            public TestEngine Engine = null!;
            public PlatformGameAdminTimelockContract Game = null!;
            public GameOracleMockFixtureContract Oracle = null!;
            public UInt160 Admin = null!;
        }

        // Mirror of the PlatformGameRewardGameTests setup: deploy the engine
        // and bind the mock oracle through the instant initial-bind lane.
        private static World Setup()
        {
            var engine = new TestEngine(true);
            engine.Fee = 1_000L * GAS;
            var (nef, manifest) = Load("PlatformGame");
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            var game = engine.Deploy<PlatformGameAdminTimelockContract>(nef, manifest);
            var oracle = GameOracleMockFixture.Deploy(engine, engine.ValidatorsAddress);
            game.setOracle(oracle.Hash);
            return new World
            {
                Engine = engine,
                Game = game,
                Oracle = oracle,
                Admin = engine.ValidatorsAddress,
            };
        }

        // The engine's own committed artifact, used as the upgrade payload
        // (the PlatformRegistryTests ScheduledUpdate idiom).
        private static (byte[] nefBytes, string manifestJson) OwnArtifact()
        {
            var (_, manifest) = Load("PlatformGame");
            byte[] nefBytes = File.ReadAllBytes(Path.Combine(BuildDir, "PlatformGame.nef"));
            return (nefBytes, manifest.ToJson().ToString());
        }

        private static void AdvanceMs(TestEngine engine, long ms) =>
            engine.PersistingBlock.Advance(TimeSpan.FromMilliseconds(ms));

        [Fact]
        public void SetOracle_InitialBind_StaysInstant()
        {
            // Setup already exercised the instant initial-bind lane.
            World w = Setup();
            Assert.Equal(w.Oracle.Hash, w.Game.oracle());
        }

        [Fact]
        public void SetOracle_Repoint_Faults()
        {
            World w = Setup();
            UInt160 replacement = TestEngine.GetNewSigner().Account;
            w.Engine.SetTransactionSigners(w.Admin);
            AssertRevert("oracle already set: use propose/execute",
                () => w.Game.setOracle(replacement));
            Assert.Equal(w.Oracle.Hash, w.Game.oracle());
        }

        [Fact]
        public void ExecuteOracleChange_BeforeTimelockMatures_Faults()
        {
            World w = Setup();
            UInt160 replacement = TestEngine.GetNewSigner().Account;
            w.Engine.SetTransactionSigners(w.Admin);
            w.Game.proposeOracle(replacement);
            AssertRevert("timelock active", () => w.Game.executeOracleChange());
            Assert.Equal(w.Oracle.Hash, w.Game.oracle());
        }

        [Fact]
        public void ExecuteOracleChange_AfterTimelock_RepointsOracle()
        {
            World w = Setup();
            UInt160 replacement = TestEngine.GetNewSigner().Account;
            w.Engine.SetTransactionSigners(w.Admin);
            w.Game.proposeOracle(replacement);
            AdvanceMs(w.Engine, TIMELOCK_MS + 1_000);
            w.Game.executeOracleChange();
            Assert.Equal(replacement, w.Game.oracle());
        }

        [Fact]
        public void CancelOracleChange_ClearsPendingRepoint()
        {
            World w = Setup();
            UInt160 replacement = TestEngine.GetNewSigner().Account;
            w.Engine.SetTransactionSigners(w.Admin);
            w.Game.proposeOracle(replacement);
            w.Game.cancelOracleChange();
            AdvanceMs(w.Engine, TIMELOCK_MS + 1_000);
            AssertRevert("no pending oracle", () => w.Game.executeOracleChange());
            Assert.Equal(w.Oracle.Hash, w.Game.oracle());
        }

        [Fact]
        public void Update_WithoutSchedule_Faults()
        {
            World w = Setup();
            var (nefBytes, manifestJson) = OwnArtifact();
            w.Engine.SetTransactionSigners(w.Admin);
            AssertRevert("no upgrade scheduled", () => w.Game.update(nefBytes, manifestJson));
        }

        [Fact]
        public void Update_BeforeTimelockMatures_Faults()
        {
            World w = Setup();
            var (nefBytes, manifestJson) = OwnArtifact();
            w.Engine.SetTransactionSigners(w.Admin);
            w.Game.scheduleUpdate(nefBytes, manifestJson);
            AssertRevert("timelock active", () => w.Game.update(nefBytes, manifestJson));
        }

        [Fact]
        public void Update_WithMismatchedArtifact_Faults()
        {
            World w = Setup();
            var (nefBytes, manifestJson) = OwnArtifact();
            w.Engine.SetTransactionSigners(w.Admin);
            w.Game.scheduleUpdate(nefBytes, manifestJson);
            AdvanceMs(w.Engine, TIMELOCK_MS + 1_000);
            // The executed artifact must match the scheduled sha256 pin.
            AssertRevert("upgrade data mismatch", () => w.Game.update(nefBytes, manifestJson + " "));
        }

        [Fact]
        public void Update_AfterTimelock_WithPinnedArtifact_Upgrades()
        {
            World w = Setup();
            var (nefBytes, manifestJson) = OwnArtifact();
            w.Engine.SetTransactionSigners(w.Admin);
            w.Game.scheduleUpdate(nefBytes, manifestJson);
            AdvanceMs(w.Engine, TIMELOCK_MS + 1_000);
            w.Game.update(nefBytes, manifestJson);

            // State survives the in-place upgrade: _deploy(update=true) is a
            // no-op, so the admin and oracle slots keep their old values.
            Assert.Equal(w.Admin, w.Game.admin());
            Assert.Equal(w.Oracle.Hash, w.Game.oracle());
        }

        [Fact]
        public void CancelUpdate_ClearsScheduledUpgrade()
        {
            World w = Setup();
            var (nefBytes, manifestJson) = OwnArtifact();
            w.Engine.SetTransactionSigners(w.Admin);
            w.Game.scheduleUpdate(nefBytes, manifestJson);
            w.Game.cancelUpdate();
            AdvanceMs(w.Engine, TIMELOCK_MS + 1_000);
            AssertRevert("no upgrade scheduled", () => w.Game.update(nefBytes, manifestJson));
        }
    }
}
