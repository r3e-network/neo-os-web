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
    /// <summary>
    /// Tests for MiniAppGasBoxV2 — the COMMIT/REVEAL gacha that closes the V1 same-tx
    /// abort-on-loss exploit. The wager commits irrevocably in block N; the weighted
    /// prize is drawn and paid only in a STRICTLY LATER block, so a player can no longer
    /// read the result and abort the wager on a bad draw.
    ///
    /// Block advancement: in the Neo.SmartContract.Testing host, the in-VM
    /// Ledger.CurrentIndex equals the last PERSISTED block height. engine.PersistingBlock
    /// .Persist() finalizes the current block and increments that height, so calling it
    /// between commit and settle moves the reveal into a strictly later block (and gives
    /// the settle a fresh GetRandom beacon). settle WITHOUT persisting (same block) must
    /// revert.
    /// </summary>
    public abstract class GasBoxV2Contract : SmartContract
    {
        protected GasBoxV2Contract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract BigInteger? createMachine(UInt160 creator, string name, UInt160 prizeAsset, BigInteger price);
        public abstract BigInteger? addItem(UInt160 creator, BigInteger machineId, string name, BigInteger weight, BigInteger amount);
        public abstract void setActive(UInt160 creator, BigInteger machineId, bool active);
        public abstract void withdrawRevenue(UInt160 creator, BigInteger machineId, UInt160 to);
        public abstract void withdrawPool(UInt160 creator, BigInteger machineId, UInt160 to, BigInteger amount);
        public abstract BigInteger? commit(BigInteger machineId, UInt160 player);
        public abstract BigInteger? settle(BigInteger betId);
        public abstract BigInteger? withdraw(UInt160 account);
        public abstract UInt160 getOwner();
        public abstract BigInteger? lastMachineId();
        public abstract BigInteger? lastBetId();
        public abstract BigInteger? pendingBetCount();
        public abstract BigInteger? playCreditOf(UInt160 player);
        public abstract BigInteger? reservedPool(BigInteger machineId);
        public abstract BigInteger? freePool(BigInteger machineId);
    }

    public class MiniAppGasBoxV2Tests
    {
        // The contract hardcodes Owner = NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32
        // (UInt160 form as the TestEngine reports it).
        private static readonly UInt160 OwnerHash = UInt160.Parse("0x6d0656f6dd91469db1c90cc1e574380613f43738");
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

        // Advance the persisted block height so the in-VM Ledger.CurrentIndex strictly
        // increases (this is what makes settle's "reveal must be a later block" gate pass
        // and what gives the reveal a fresh GetRandom beacon).
        private static void AdvanceBlock(TestEngine engine)
        {
            engine.PersistingBlock.Persist();
        }

        // Contract asserts surface as "ABORTMSG is executed. Reason: <text>".
        private static void AssertRevert(string reason, Action act)
        {
            var ex = Assert.ThrowsAny<Exception>(act);
            Assert.Equal($"ABORTMSG is executed. Reason: {reason}", ex.Message);
        }

        // Per-machine GAS solvency for a GAS-prize machine. The full invariant is:
        //   heldGAS == prizePool + revenue + sum(playCredits) + sum(escrowed pending wagers)
        // - prizePool is held in full (free + reserved are both still on the contract).
        // - a committed-but-unsettled wager has LEFT playCredit but has NOT yet become
        //   revenue: it sits escrowed in the pending bet, so it must be counted separately.
        // - at settle the escrowed wager moves into revenue (no net held change).
        private static void AssertGasSolventSingleMachine(
            TestEngine engine, GasBoxV2Contract box,
            BigInteger expectedPool, BigInteger expectedRevenue, BigInteger expectedEscrow,
            params UInt160[] players)
        {
            BigInteger held = engine.Native.GAS.BalanceOf(box.Hash) ?? 0;
            BigInteger credits = 0;
            foreach (var p in players) credits += box.playCreditOf(p) ?? 0;
            Assert.Equal(expectedPool + expectedRevenue + expectedEscrow + credits, held);
        }

        [Fact]
        public void Owner_IsTheHardcodedDeployerAddress()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppGasBoxV2");
            var box = engine.Deploy<GasBoxV2Contract>(nef, manifest);
            Assert.Equal(OwnerHash, box.getOwner());
        }

        // (a)+(b)+(c)+(f): single-item machine -> the draw is deterministic (one prize),
        // so the full commit/reveal lifecycle and exact payout are assertable.
        [Fact]
        public void CommitReveal_SameBlockReverts_LaterBlockPaysExactPrizeAndStaysSolvent()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppGasBoxV2");
            var box = engine.Deploy<GasBoxV2Contract>(nef, manifest);

            var creator = TestEngine.GetNewSigner().Account;
            var player = TestEngine.GetNewSigner().Account;
            Fund(engine, creator, 0, 5L * GAS);
            Fund(engine, player, 0, 5L * GAS);

            // price 0.5 GAS, single 1 GAS prize, pool funded to 2 GAS (covers two pulls).
            engine.SetTransactionSigners(creator);
            Assert.Equal(BigInteger.One, box.createMachine(creator, "Box", engine.Native.GAS.Hash, GAS / 2));
            Assert.Equal(BigInteger.One, box.addItem(creator, 1, "Prize", 1, 1L * GAS));
            AssertRevert("free pool cannot cover max prize", () => box.setActive(creator, 1, true));
            engine.Native.GAS.Transfer(creator, box.Hash, 2L * GAS, "miniapp-gasbox-pool:1");
            box.setActive(creator, 1, true);

            // Player prepays two pulls' worth of play credit.
            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, box.Hash, 1L * GAS, "miniapp-gasbox:play");
            Assert.Equal(new BigInteger(1L * GAS), box.playCreditOf(player));
            // Solvency before any pull: pool 2 + revenue 0 + escrow 0 + credit 1 = 3 GAS held.
            AssertGasSolventSingleMachine(engine, box, 2L * GAS, 0, 0, player);

            // COMMIT (block N): wager escrowed, MaxPrize reserved from the pool.
            Assert.Equal(BigInteger.One, box.commit(1, player));
            Assert.Equal(BigInteger.One, box.lastBetId());
            Assert.Equal(BigInteger.One, box.pendingBetCount());
            Assert.Equal(new BigInteger(GAS / 2), box.playCreditOf(player));       // 1 - 0.5 wager
            Assert.Equal(new BigInteger(1L * GAS), box.reservedPool(1));           // MaxPrize reserved
            Assert.Equal(new BigInteger(1L * GAS), box.freePool(1));               // 2 - 1 reserved
            // Solvency after commit: held GAS unchanged at 3 (escrow+reserve are internal).
            // pool 2 + revenue 0 + escrow 0.5 (wager) + credit 0.5 = 3 GAS held.
            AssertGasSolventSingleMachine(engine, box, 2L * GAS, 0, GAS / 2, player);

            // (a) settle in the SAME block (no block advance) must revert.
            AssertRevert("reveal must be a later block", () => box.settle(1));

            // (b)+(f) advance one block, then settle reveals the (single) prize and pays it.
            AdvanceBlock(engine);
            engine.SetTransactionSigners(player);
            BigInteger before = engine.Native.GAS.BalanceOf(player) ?? 0;
            Assert.Equal(BigInteger.One, box.settle(1));                            // only item index
            Assert.Equal(before + 1L * GAS, engine.Native.GAS.BalanceOf(player));   // exact 1 GAS prize
            Assert.Equal(BigInteger.Zero, box.pendingBetCount());
            Assert.Equal(BigInteger.Zero, box.reservedPool(1));                     // reservation released
            // pool 2 - 1 prize = 1; the escrowed 0.5 wager became revenue (escrow now 0).
            // (c) solvency after settle: pool 1 + revenue 0.5 + escrow 0 + credit 0.5 = 2 GAS held.
            AssertGasSolventSingleMachine(engine, box, 1L * GAS, GAS / 2, 0, player);

            // Re-settling the same bet is rejected.
            AssertRevert("already settled", () => box.settle(1));

            // Creator withdraws the accrued 0.5 GAS revenue exactly once.
            engine.SetTransactionSigners(creator);
            BigInteger creatorBefore = engine.Native.GAS.BalanceOf(creator) ?? 0;
            box.withdrawRevenue(creator, 1, creator);
            Assert.Equal(creatorBefore + GAS / 2, engine.Native.GAS.BalanceOf(creator));
            AssertRevert("no revenue", () => box.withdrawRevenue(creator, 1, creator));
        }

        // (d) reservation guard: a second concurrent commit that the FREE pool cannot
        // cover reverts, and the already-committed bet stays fully covered + payable.
        [Fact]
        public void Reservation_OversubscribingCommitReverts_PriorPendingStaysCovered()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppGasBoxV2");
            var box = engine.Deploy<GasBoxV2Contract>(nef, manifest);

            var creator = TestEngine.GetNewSigner().Account;
            var p1 = TestEngine.GetNewSigner().Account;
            var p2 = TestEngine.GetNewSigner().Account;
            Fund(engine, creator, 0, 5L * GAS);
            Fund(engine, p1, 0, 5L * GAS);
            Fund(engine, p2, 0, 5L * GAS);

            // price 0.2 GAS, single 1 GAS prize, pool funded to EXACTLY 1 GAS -> covers a
            // SINGLE worst-case prize, so a second concurrent commit must be rejected.
            engine.SetTransactionSigners(creator);
            box.createMachine(creator, "Tight", engine.Native.GAS.Hash, GAS / 5);
            box.addItem(creator, 1, "Prize", 1, 1L * GAS);
            engine.Native.GAS.Transfer(creator, box.Hash, 1L * GAS, "miniapp-gasbox-pool:1");
            box.setActive(creator, 1, true);

            engine.SetTransactionSigners(p1);
            engine.Native.GAS.Transfer(p1, box.Hash, GAS / 5, "miniapp-gasbox:play");
            engine.SetTransactionSigners(p2);
            engine.Native.GAS.Transfer(p2, box.Hash, GAS / 5, "miniapp-gasbox:play");

            // p1 commits -> reserves the whole pool; machine auto-deactivates (free pool
            // can no longer cover another max prize).
            engine.SetTransactionSigners(p1);
            Assert.Equal(BigInteger.One, box.commit(1, p1));
            Assert.Equal(new BigInteger(1L * GAS), box.reservedPool(1));
            Assert.Equal(BigInteger.Zero, box.freePool(1));

            // p2's commit reverts: the machine is now inactive precisely because the free
            // pool cannot cover a second worst-case prize. p1's pending bet stays covered.
            engine.SetTransactionSigners(p2);
            AssertRevert("machine not active", () => box.commit(1, p2));
            Assert.Equal(new BigInteger(1L * GAS), box.reservedPool(1));
            Assert.Equal(BigInteger.One, box.pendingBetCount());
            // p2's wager was NOT consumed (commit reverted).
            Assert.Equal(new BigInteger(GAS / 5), box.playCreditOf(p2));

            // p1's pending pull settles and is fully paid in a later block.
            AdvanceBlock(engine);
            engine.SetTransactionSigners(p1);
            BigInteger before = engine.Native.GAS.BalanceOf(p1) ?? 0;
            box.settle(1);
            Assert.Equal(before + 1L * GAS, engine.Native.GAS.BalanceOf(p1));
            Assert.Equal(BigInteger.Zero, box.reservedPool(1));
        }

        // A separate explicit "free-pool guard while active" check: when a machine is
        // funded for two prizes, the SECOND commit still succeeds, the THIRD reverts.
        [Fact]
        public void Reservation_TwoPrizePoolAcceptsTwoCommitsRejectsThird()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppGasBoxV2");
            var box = engine.Deploy<GasBoxV2Contract>(nef, manifest);

            var creator = TestEngine.GetNewSigner().Account;
            var player = TestEngine.GetNewSigner().Account;
            Fund(engine, creator, 0, 5L * GAS);
            Fund(engine, player, 0, 5L * GAS);

            engine.SetTransactionSigners(creator);
            box.createMachine(creator, "TwoDeep", engine.Native.GAS.Hash, GAS / 10);
            box.addItem(creator, 1, "Prize", 1, 1L * GAS);
            engine.Native.GAS.Transfer(creator, box.Hash, 2L * GAS, "miniapp-gasbox-pool:1");
            box.setActive(creator, 1, true);

            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, box.Hash, 1L * GAS, "miniapp-gasbox:play");

            Assert.Equal(BigInteger.One, box.commit(1, player));     // reserves 1 GAS, free 1 GAS
            Assert.Equal(new BigInteger(2), box.commit(1, player));  // reserves 2 GAS, free 0, auto-deactivates
            Assert.Equal(new BigInteger(2L * GAS), box.reservedPool(1));
            Assert.Equal(BigInteger.Zero, box.freePool(1));
            AssertRevert("machine not active", () => box.commit(1, player)); // third blocked
            Assert.Equal(new BigInteger(2), box.pendingBetCount());

            // Both settle and are paid; pool covers both exactly.
            AdvanceBlock(engine);
            BigInteger before = engine.Native.GAS.BalanceOf(player) ?? 0;
            box.settle(1);
            box.settle(2);
            Assert.Equal(before + 2L * GAS, engine.Native.GAS.BalanceOf(player));
            Assert.Equal(BigInteger.Zero, box.reservedPool(1));
            Assert.Equal(BigInteger.Zero, box.pendingBetCount());
        }

        // (e) Withdraw refunds unused play credit back to the sender.
        [Fact]
        public void Withdraw_RefundsUnusedPlayCredit()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppGasBoxV2");
            var box = engine.Deploy<GasBoxV2Contract>(nef, manifest);

            var player = TestEngine.GetNewSigner().Account;
            Fund(engine, player, 0, 5L * GAS);

            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, box.Hash, 2L * GAS, "miniapp-gasbox:play");
            Assert.Equal(new BigInteger(2L * GAS), box.playCreditOf(player));

            BigInteger before = engine.Native.GAS.BalanceOf(player) ?? 0;
            Assert.Equal(new BigInteger(2L * GAS), box.withdraw(player));
            Assert.Equal(before + 2L * GAS, engine.Native.GAS.BalanceOf(player));
            Assert.Equal(BigInteger.Zero, box.playCreditOf(player));
            Assert.Equal(BigInteger.Zero, engine.Native.GAS.BalanceOf(box.Hash));
            AssertRevert("no credit", () => box.withdraw(player));
        }

        // Weighted draw: the revealed prize is always one of the configured item amounts
        // and GAS is conserved across the commit/reveal — and the draw happens in a
        // strictly later block than the commit (the exploit-closing property).
        [Fact]
        public void WeightedDraw_RevealedPrizeIsFromItemSet_AndGasIsConserved()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppGasBoxV2");
            var box = engine.Deploy<GasBoxV2Contract>(nef, manifest);

            var creator = TestEngine.GetNewSigner().Account;
            var player = TestEngine.GetNewSigner().Account;
            Fund(engine, creator, 0, 5L * GAS);
            Fund(engine, player, 0, 5L * GAS);

            engine.SetTransactionSigners(creator);
            box.createMachine(creator, "Weighted", engine.Native.GAS.Hash, GAS / 5);
            box.addItem(creator, 1, "Common", 8, GAS / 10); // 0.1 GAS
            box.addItem(creator, 1, "Rare", 2, GAS / 2);    // 0.5 GAS (== MaxPrize)
            engine.Native.GAS.Transfer(creator, box.Hash, 1L * GAS, "miniapp-gasbox-pool:1");
            box.setActive(creator, 1, true);

            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, box.Hash, GAS / 5, "miniapp-gasbox:play");

            // Commit reserves the MAX prize (0.5 GAS), not the eventual draw.
            Assert.Equal(BigInteger.One, box.commit(1, player));
            Assert.Equal(new BigInteger(GAS / 2), box.reservedPool(1));

            AdvanceBlock(engine);
            BigInteger before = engine.Native.GAS.BalanceOf(player) ?? 0;
            BigInteger? index = box.settle(1);
            Assert.True(index == 1 || index == 2, $"item index must be 1/2, got {index}");
            BigInteger prize = (engine.Native.GAS.BalanceOf(player) ?? 0) - before;
            Assert.True(prize == GAS / 10 || prize == GAS / 2, $"prize must be 0.1 or 0.5 GAS, got {prize}");

            // GAS conserved: held == pool(1 - prize) + revenue(0.2 wager) + credit(0).
            Assert.Equal((1L * GAS - prize) + GAS / 5, engine.Native.GAS.BalanceOf(box.Hash));
            Assert.Equal(BigInteger.Zero, box.reservedPool(1));
            Assert.Equal(BigInteger.Zero, box.playCreditOf(player));
        }

        [Fact]
        public void Guards_RejectInvalidOperations()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppGasBoxV2");
            var box = engine.Deploy<GasBoxV2Contract>(nef, manifest);

            var creator = TestEngine.GetNewSigner().Account;
            var stranger = TestEngine.GetNewSigner().Account;
            Fund(engine, creator, 5, 5L * GAS);
            Fund(engine, stranger, 0, 5L * GAS);

            // Prize asset must be NEO or GAS.
            engine.SetTransactionSigners(creator);
            AssertRevert("prize asset must be NEO or GAS", () =>
                box.createMachine(creator, "Bad", box.Hash, 1L * GAS));

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

            // A commit demands prepaid play credit.
            engine.SetTransactionSigners(stranger);
            AssertRevert("insufficient play credit", () => box.commit(1, stranger));

            // Settling a non-existent bet reverts cleanly.
            AssertRevert("bet not found", () => box.settle(999));
        }

        // The per-machine "WithdrawBankroll" analog: the creator may pull FREE pool funds
        // out, but never the portion reserved by an unsettled pending pull.
        [Fact]
        public void WithdrawPool_OnlyFreeFunds_ReservedStaysLocked()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppGasBoxV2");
            var box = engine.Deploy<GasBoxV2Contract>(nef, manifest);

            var creator = TestEngine.GetNewSigner().Account;
            var player = TestEngine.GetNewSigner().Account;
            Fund(engine, creator, 0, 5L * GAS);
            Fund(engine, player, 0, 5L * GAS);

            engine.SetTransactionSigners(creator);
            box.createMachine(creator, "Box", engine.Native.GAS.Hash, GAS / 10);
            box.addItem(creator, 1, "Prize", 1, 1L * GAS);
            engine.Native.GAS.Transfer(creator, box.Hash, 3L * GAS, "miniapp-gasbox-pool:1");
            box.setActive(creator, 1, true);

            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, box.Hash, GAS / 10, "miniapp-gasbox:play");
            box.commit(1, player); // reserves 1 GAS, free pool now 2 GAS

            engine.SetTransactionSigners(creator);
            // Cannot withdraw more than the FREE pool (2 GAS).
            AssertRevert("amount exceeds free pool", () => box.withdrawPool(creator, 1, creator, 2L * GAS + 1));
            BigInteger before = engine.Native.GAS.BalanceOf(creator) ?? 0;
            box.withdrawPool(creator, 1, creator, 2L * GAS);
            Assert.Equal(before + 2L * GAS, engine.Native.GAS.BalanceOf(creator));
            Assert.Equal(new BigInteger(1L * GAS), box.reservedPool(1));
            Assert.Equal(BigInteger.Zero, box.freePool(1));
            // Only a stranger / non-creator is rejected.
            engine.SetTransactionSigners(player);
            AssertRevert("only creator", () => box.withdrawPool(player, 1, player, 1));

            // The reserved pending pull is still fully payable.
            AdvanceBlock(engine);
            engine.SetTransactionSigners(player);
            BigInteger pBefore = engine.Native.GAS.BalanceOf(player) ?? 0;
            box.settle(1);
            Assert.Equal(pBefore + 1L * GAS, engine.Native.GAS.BalanceOf(player));
        }
    }
}
