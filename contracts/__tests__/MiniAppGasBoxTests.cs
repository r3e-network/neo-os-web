using System;
using System.IO;
using System.Numerics;
using Neo;
using Neo.Network.P2P.Payloads;
using Neo.SmartContract;
using Neo.SmartContract.Manifest;
using Neo.SmartContract.Testing;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public abstract class GasBoxContract : SmartContract
    {
        protected GasBoxContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract BigInteger? createMachine(UInt160 creator, string name, UInt160 prizeAsset, BigInteger price);
        public abstract BigInteger? addItem(UInt160 creator, BigInteger machineId, string name, BigInteger weight, BigInteger amount);
        public abstract void setActive(UInt160 creator, BigInteger machineId, bool active);
        public abstract void withdrawRevenue(UInt160 creator, BigInteger machineId, UInt160 to);
        public abstract BigInteger? pull(BigInteger machineId, UInt160 player);
        public abstract BigInteger? lastMachineId();
        public abstract BigInteger? playCreditOf(UInt160 player);
    }

    public class MiniAppGasBoxTests
    {
        private const long GAS = 100000000; // 1 GAS base units

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

        private static void Fund(TestEngine engine, UInt160 to, BigInteger neo, BigInteger gas)
        {
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            if (neo > 0) engine.Native.NEO.Transfer(engine.ValidatorsAddress, to, neo, null);
            if (gas > 0) engine.Native.GAS.Transfer(engine.ValidatorsAddress, to, gas, null);
        }

        // Contract asserts surface as "ABORTMSG is executed. Reason: <text>".
        private static void AssertRevert(string reason, Action act)
        {
            var ex = Assert.ThrowsAny<Exception>(act);
            Assert.Equal($"ABORTMSG is executed. Reason: {reason}", ex.Message);
        }

        // A single-item machine makes every pull pay a deterministic prize, so the
        // full lifecycle (fund -> activate -> pull -> auto-deactivate -> revenue
        // withdrawal) is assertable exactly, independent of the GetRandom seed.
        [Fact]
        public void GasBox_SingleItemMachine_LifecycleIsExactAndSolvent()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppGasBox");
            var box = engine.Deploy<GasBoxContract>(nef, manifest);

            var creator = TestEngine.GetNewSigner().Account;
            var player = TestEngine.GetNewSigner().Account;
            Fund(engine, creator, 0, 5L * GAS);
            Fund(engine, player, 0, 5L * GAS);

            engine.SetTransactionSigners(creator);
            Assert.Equal(BigInteger.One, box.createMachine(creator, "Box", engine.Native.GAS.Hash, GAS / 2));
            Assert.Equal(BigInteger.One, box.lastMachineId());
            Assert.Equal(BigInteger.One, box.addItem(creator, 1, "Prize", 1, 1L * GAS));

            // Cannot activate until the pool covers the largest single prize.
            AssertRevert("pool cannot cover max prize", () => box.setActive(creator, 1, true));
            engine.Native.GAS.Transfer(creator, box.Hash, 2L * GAS, "miniapp-gasbox-pool:1");
            box.setActive(creator, 1, true);

            // Player prepays two pulls' worth of play credit.
            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, box.Hash, 2L * GAS, "miniapp-gasbox:play");
            Assert.Equal(new BigInteger(2L * GAS), box.playCreditOf(player));

            // Pull #1: pool 2 -> 1 GAS, still covers the 1 GAS max prize.
            BigInteger before = engine.Native.GAS.BalanceOf(player) ?? 0;
            Assert.Equal(BigInteger.One, box.pull(1, player));
            Assert.Equal(before + 1L * GAS, engine.Native.GAS.BalanceOf(player));
            Assert.Equal(new BigInteger(2L * GAS - GAS / 2), box.playCreditOf(player));

            // Pull #2 drains the pool below the max prize -> machine auto-deactivates.
            Assert.Equal(BigInteger.One, box.pull(1, player));
            AssertRevert("machine not active", () => box.pull(1, player));
            Assert.Equal(new BigInteger(1L * GAS), box.playCreditOf(player));

            // Solvency: pool(0) + revenue(2 x 0.5 GAS) + play credit(1 GAS) = 2 GAS.
            Assert.Equal(new BigInteger(2L * GAS), engine.Native.GAS.BalanceOf(box.Hash));

            // Creator withdraws the accrued 1 GAS revenue exactly once.
            engine.SetTransactionSigners(creator);
            BigInteger creatorBefore = engine.Native.GAS.BalanceOf(creator) ?? 0;
            box.withdrawRevenue(creator, 1, creator);
            Assert.Equal(creatorBefore + 1L * GAS, engine.Native.GAS.BalanceOf(creator));
            AssertRevert("no revenue", () => box.withdrawRevenue(creator, 1, creator));
            Assert.Equal(new BigInteger(1L * GAS), engine.Native.GAS.BalanceOf(box.Hash));
        }

        [Fact]
        public void GasBox_WeightedDraw_PrizeComesFromItemSetAndIsConserved()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppGasBox");
            var box = engine.Deploy<GasBoxContract>(nef, manifest);

            var creator = TestEngine.GetNewSigner().Account;
            var player = TestEngine.GetNewSigner().Account;
            Fund(engine, creator, 0, 5L * GAS);
            Fund(engine, player, 0, 5L * GAS);

            engine.SetTransactionSigners(creator);
            box.createMachine(creator, "Weighted", engine.Native.GAS.Hash, GAS / 5);
            box.addItem(creator, 1, "Common", 8, GAS / 10);  // 0.1 GAS
            box.addItem(creator, 1, "Rare", 2, GAS / 2);     // 0.5 GAS
            engine.Native.GAS.Transfer(creator, box.Hash, 1L * GAS, "miniapp-gasbox-pool:1");
            box.setActive(creator, 1, true);

            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, box.Hash, GAS / 5, "miniapp-gasbox:play");

            // The draw is seed-dependent: assert the prize is one of the configured
            // item amounts and that GAS is conserved (pool + deposits - prize).
            BigInteger before = engine.Native.GAS.BalanceOf(player) ?? 0;
            BigInteger? index = box.pull(1, player);
            Assert.True(index == 1 || index == 2, $"item index must be 1/2, got {index}");
            BigInteger prize = (engine.Native.GAS.BalanceOf(player) ?? 0) - before;
            Assert.True(prize == GAS / 10 || prize == GAS / 2, $"prize must be 0.1 or 0.5 GAS, got {prize}");
            Assert.Equal(1L * GAS + GAS / 5 - prize, engine.Native.GAS.BalanceOf(box.Hash));
            Assert.Equal(BigInteger.Zero, box.playCreditOf(player));
        }

        [Fact]
        public void GasBox_GuardsRejectInvalidOperations()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppGasBox");
            var box = engine.Deploy<GasBoxContract>(nef, manifest);

            var creator = TestEngine.GetNewSigner().Account;
            var stranger = TestEngine.GetNewSigner().Account;
            Fund(engine, creator, 5, 5L * GAS);
            Fund(engine, stranger, 0, 5L * GAS);

            // Prize asset must be NEO or GAS.
            engine.SetTransactionSigners(creator);
            AssertRevert("prize asset must be NEO or GAS", () =>
                box.createMachine(creator, "Bad", box.Hash, 1L * GAS));

            // NOTE: the deposit-time guards ("machine not found", "wrong prize
            // asset") ABORT inside OnNEP17Payment mid-Transfer, which the
            // TestEngine host cannot unwind (it hangs natively), so those paths
            // are exercised by the live testnet harness
            // (deploy/scripts/live_validate_flagship_user_flows.js) instead.
            // Direct entrypoint reverts below are safely catchable.

            // NEO-prize machine funds with NEO and activates normally.
            box.createMachine(creator, "NeoBox", engine.Native.NEO.Hash, 1L * GAS);
            box.addItem(creator, 1, "NeoPrize", 1, 1);
            engine.Native.NEO.Transfer(creator, box.Hash, 1, "miniapp-gasbox-pool:1");
            box.setActive(creator, 1, true);

            // Only the machine creator may edit it, and never while active.
            engine.SetTransactionSigners(stranger);
            AssertRevert("only creator", () => box.addItem(stranger, 1, "Hack", 1, 1));
            engine.SetTransactionSigners(creator);
            AssertRevert("deactivate before editing", () => box.addItem(creator, 1, "Late", 1, 1));

            // A pull demands prepaid play credit.
            engine.SetTransactionSigners(stranger);
            AssertRevert("insufficient play credit", () => box.pull(1, stranger));
        }
    }
}
