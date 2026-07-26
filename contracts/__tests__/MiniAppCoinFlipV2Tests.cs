using System;
using System.IO;
using System.Numerics;
using System.Text;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Manifest;
using Neo.SmartContract.Testing;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public abstract class CoinFlipV2Contract : SmartContract
    {
        protected CoinFlipV2Contract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract BigInteger? commit(UInt160 player, BigInteger choice, BigInteger amount);
        public abstract BigInteger? settle(BigInteger betId);
        public abstract void withdrawBankroll(UInt160 to, BigInteger amount);
        public abstract BigInteger? withdraw(UInt160 account);
        public abstract BigInteger? bankroll();
        public abstract BigInteger? reservedBankroll();
        public abstract BigInteger? freeBankroll();
        public abstract BigInteger? creditOf(UInt160 player);
        public abstract BigInteger? lastBetId();
        public abstract BigInteger? pendingBetCount();
        public abstract Neo.VM.Types.Map? getPendingBet(BigInteger betId);
    }

    public class MiniAppCoinFlipV2Tests
    {
        // The contract hardcodes Owner = NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32.
        private static readonly UInt160 OwnerHash = UInt160.Parse("0x6d0656f6dd91469db1c90cc1e574380613f43738");
        private const long GAS = 100000000; // 1 GAS base units

        // Mirrors the contract's BEACON_BLOCKS: settle requires CurrentIndex > commitIndex + K
        // and mixes the hashes of the K blocks commitIndex+1 .. commitIndex+K.
        private const int BEACON_BLOCKS = 3;

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
            Assert.Equal($"ABORTMSG is executed. Reason: {reason}", ex.Message);
        }

        // Mine an empty block so Ledger.CurrentIndex advances by one.
        private static void MineBlock(TestEngine engine) => engine.PersistingBlock.Persist();

        // Mine enough blocks to clear the K-block beacon window: settle needs
        // CurrentIndex > commitIndex + BEACON_BLOCKS AND the K beacon blocks (commitIndex+1
        // .. commitIndex+K) persisted. Persisting BEACON_BLOCKS + 1 blocks satisfies both.
        private static void MinePastBeacon(TestEngine engine)
        {
            for (int i = 0; i <= BEACON_BLOCKS; i++) engine.PersistingBlock.Persist();
        }

        // Solvency invariant: held GAS == bankroll + escrowed pending wagers + player credits.
        // The bankroll counter already excludes escrowed wagers (they live in pending bets),
        // so heldGAS - bankroll - sum(credits) must equal the sum of unsettled wagers.
        private static void AssertSolvent(TestEngine engine, CoinFlipV2Contract flip, BigInteger escrowed, params UInt160[] players)
        {
            BigInteger obligations = (flip.bankroll() ?? 0) + escrowed;
            foreach (var p in players) obligations += flip.creditOf(p) ?? 0;
            Assert.Equal(obligations, engine.Native.GAS.BalanceOf(flip.Hash));
            // Reservation never exceeds the bankroll.
            Assert.True((flip.reservedBankroll() ?? 0) <= (flip.bankroll() ?? 0), "reserved must be <= bankroll");
        }

        private static (BigInteger choice, bool settled, BigInteger outcome, bool won, BigInteger wager, BigInteger exposure, BigInteger payout, BigInteger commitIndex)
            BetOf(CoinFlipV2Contract flip, BigInteger betId)
        {
            Neo.VM.Types.Map? b = flip.getPendingBet(betId);
            Assert.NotNull(b);
            return (
                b![(Neo.VM.Types.PrimitiveType)"choice"].GetInteger(),
                b[(Neo.VM.Types.PrimitiveType)"settled"].GetBoolean(),
                b[(Neo.VM.Types.PrimitiveType)"outcome"].GetInteger(),
                b[(Neo.VM.Types.PrimitiveType)"won"].GetBoolean(),
                b[(Neo.VM.Types.PrimitiveType)"wager"].GetInteger(),
                b[(Neo.VM.Types.PrimitiveType)"exposure"].GetInteger(),
                b[(Neo.VM.Types.PrimitiveType)"payout"].GetInteger(),
                b[(Neo.VM.Types.PrimitiveType)"commitIndex"].GetInteger());
        }

        [Fact]
        public void CommitThenSettle_SameOrEarlierBlock_Reverts()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppCoinFlipV2");
            var flip = engine.Deploy<CoinFlipV2Contract>(nef, manifest);

            var house = TestEngine.GetNewSigner().Account;
            var player = TestEngine.GetNewSigner().Account;
            FundGas(engine, house, 20L * GAS);
            FundGas(engine, player, 5L * GAS);

            engine.SetTransactionSigners(house);
            engine.Native.GAS.Transfer(house, flip.Hash, 10L * GAS, "miniapp-fogplay:fund");
            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, flip.Hash, 2L * GAS, "miniapp-fogplay:bet");

            BigInteger? betId = flip.commit(player, 0, 1L * GAS);
            Assert.Equal(BigInteger.One, betId);

            // Settle in the SAME block (no mining) must revert: none of the K beacon blocks
            // exist yet, and the player could have observed the commit block.
            AssertRevert("reveal must be a later block", () => flip.settle(betId!.Value));

            // Settling anywhere inside the K-block beacon window (up to commitIndex + K) must
            // STILL revert: the full multi-block beacon is not yet fixed, so a producer of a
            // not-yet-final beacon block could otherwise grind the outcome.
            for (int i = 0; i < BEACON_BLOCKS; i++)
            {
                MineBlock(engine);
                AssertRevert("reveal must be a later block", () => flip.settle(betId!.Value));
            }

            // The bet stays pending, escrow and reservation intact.
            var bet = BetOf(flip, betId!.Value);
            Assert.False(bet.settled);
            Assert.Equal(new BigInteger(1L * GAS), bet.exposure);
            Assert.Equal(new BigInteger(1L * GAS), flip.reservedBankroll());
            Assert.Equal(BigInteger.One, flip.pendingBetCount());
        }

        [Fact]
        public void CommitEscrowsAndReserves_SolventBeforeAndAfterSettle()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppCoinFlipV2");
            var flip = engine.Deploy<CoinFlipV2Contract>(nef, manifest);

            var house = TestEngine.GetNewSigner().Account;
            var player = TestEngine.GetNewSigner().Account;
            FundGas(engine, house, 20L * GAS);
            FundGas(engine, player, 5L * GAS);

            engine.SetTransactionSigners(house);
            engine.Native.GAS.Transfer(house, flip.Hash, 10L * GAS, "miniapp-fogplay:fund");
            Assert.Equal(new BigInteger(10L * GAS), flip.bankroll());
            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, flip.Hash, 2L * GAS, "miniapp-fogplay:bet");
            Assert.Equal(new BigInteger(2L * GAS), flip.creditOf(player));
            AssertSolvent(engine, flip, 0, player);

            // Commit 1 GAS on heads: wager escrowed (credit 2->1), 1 GAS reserved.
            BigInteger? betId = flip.commit(player, 0, 1L * GAS);
            Assert.Equal(new BigInteger(1L * GAS), flip.creditOf(player));
            Assert.Equal(new BigInteger(1L * GAS), flip.reservedBankroll());
            Assert.Equal(new BigInteger(9L * GAS), flip.freeBankroll());
            Assert.Equal(new BigInteger(10L * GAS), flip.bankroll()); // unchanged until settle
            AssertSolvent(engine, flip, 1L * GAS, player); // 1 GAS is escrowed pending

            // Reveal once the K-block beacon window has fully cleared.
            MinePastBeacon(engine);
            BigInteger balanceBefore = engine.Native.GAS.BalanceOf(player) ?? 0;
            BigInteger? outcome = flip.settle(betId!.Value);
            Assert.True(outcome == 0 || outcome == 1);

            var bet = BetOf(flip, betId!.Value);
            Assert.True(bet.settled);
            BigInteger received = (engine.Native.GAS.BalanceOf(player) ?? 0) - balanceBefore;

            if (bet.won)
            {
                Assert.Equal(new BigInteger(2L * GAS), bet.payout);
                Assert.Equal(new BigInteger(2L * GAS), received);
                Assert.Equal(new BigInteger(9L * GAS), flip.bankroll()); // paid extra 1 GAS
            }
            else
            {
                Assert.Equal(BigInteger.Zero, bet.payout);
                Assert.Equal(BigInteger.Zero, received);
                Assert.Equal(new BigInteger(11L * GAS), flip.bankroll()); // absorbed the wager
            }
            // Reservation fully released, nothing escrowed any more.
            Assert.Equal(BigInteger.Zero, flip.reservedBankroll());
            Assert.Equal(BigInteger.Zero, flip.pendingBetCount());
            AssertSolvent(engine, flip, 0, player);

            // Double settle is rejected (the recorded result is immutable).
            AssertRevert("bet already settled", () => flip.settle(betId!.Value));

            // IDEMPOTENT BEACON: mine further blocks and confirm a (would-be) re-derivation of
            // the outcome from the now-deeper chain still matches the recorded result — the
            // K-block beacon is fixed, so the draw can never be re-rolled by waiting.
            BigInteger recordedOutcome = outcome!.Value;
            MinePastBeacon(engine);
            var betAfter = BetOf(flip, betId!.Value);
            Assert.Equal(recordedOutcome, betAfter.outcome);
            Assert.Equal(bet.won, betAfter.won);
            Assert.Equal(bet.payout, betAfter.payout);
            AssertRevert("bet already settled", () => flip.settle(betId!.Value));
        }

        [Fact]
        public void ByteArrayMemoCreditsTheSharedHouseGameLedger()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppCoinFlipV2");
            var flip = engine.Deploy<CoinFlipV2Contract>(nef, manifest);
            var player = TestEngine.GetNewSigner().Account;
            FundGas(engine, player, 2L * GAS);

            engine.SetTransactionSigners(player);
            Assert.True(engine.Native.GAS.Transfer(
                player,
                flip.Hash,
                2L * GAS,
                Encoding.UTF8.GetBytes("miniapp-fogplay:bet")) == true);

            Assert.Equal(new BigInteger(2L * GAS), flip.creditOf(player));
        }

        [Fact]
        public void Win_PaysExactly2x()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppCoinFlipV2");
            var flip = engine.Deploy<CoinFlipV2Contract>(nef, manifest);

            var house = TestEngine.GetNewSigner().Account;
            var player = TestEngine.GetNewSigner().Account;
            FundGas(engine, house, 60L * GAS);
            FundGas(engine, player, 60L * GAS);

            engine.SetTransactionSigners(house);
            engine.Native.GAS.Transfer(house, flip.Hash, 50L * GAS, "miniapp-fogplay:fund");
            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, flip.Hash, 40L * GAS, "miniapp-fogplay:bet");

            const long bet = 1L * GAS;
            bool sawWin = false, sawLoss = false;
            BigInteger expectedBankroll = 50L * GAS;

            // Commit, mine past the K-block beacon, settle each bet; on EVERY settle assert
            // the exact payout math.
            for (int i = 1; i <= 24 && !(sawWin && sawLoss); i++)
            {
                engine.SetTransactionSigners(player);
                BigInteger? betId = flip.commit(player, 0, bet);
                MinePastBeacon(engine);
                BigInteger balanceBefore = engine.Native.GAS.BalanceOf(player) ?? 0;
                flip.settle(betId!.Value);
                var rec = BetOf(flip, betId!.Value);
                BigInteger received = (engine.Native.GAS.BalanceOf(player) ?? 0) - balanceBefore;
                if (rec.won)
                {
                    sawWin = true;
                    Assert.Equal(0, (int)rec.outcome); // chosen 0 == outcome
                    Assert.Equal(new BigInteger(2L * bet), rec.payout);
                    Assert.Equal(new BigInteger(2L * bet), received);
                    expectedBankroll -= bet;
                }
                else
                {
                    sawLoss = true;
                    Assert.NotEqual(0, (int)rec.outcome);
                    Assert.Equal(BigInteger.Zero, rec.payout);
                    Assert.Equal(BigInteger.Zero, received);
                    expectedBankroll += bet;
                }
                Assert.Equal(expectedBankroll, flip.bankroll());
                Assert.Equal(BigInteger.Zero, flip.reservedBankroll());
            }

            Assert.True(sawWin, "expected at least one winning flip across 24 attempts");
            Assert.True(sawLoss, "expected at least one losing flip across 24 attempts");
        }

        [Fact]
        public void Reservation_RejectsOversubscriptionAndKeepsPriorBetsCovered()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppCoinFlipV2");
            var flip = engine.Deploy<CoinFlipV2Contract>(nef, manifest);

            var house = TestEngine.GetNewSigner().Account;
            var player = TestEngine.GetNewSigner().Account;
            FundGas(engine, house, 20L * GAS);
            FundGas(engine, player, 30L * GAS);

            // Bankroll only 3 GAS. Each 1 GAS bet reserves 1 GAS exposure, so only 3 can be
            // pending at once.
            engine.SetTransactionSigners(house);
            engine.Native.GAS.Transfer(house, flip.Hash, 3L * GAS, "miniapp-fogplay:fund");
            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, flip.Hash, 10L * GAS, "miniapp-fogplay:bet");

            BigInteger? b1 = flip.commit(player, 0, 1L * GAS);
            BigInteger? b2 = flip.commit(player, 0, 1L * GAS);
            BigInteger? b3 = flip.commit(player, 0, 1L * GAS);
            Assert.Equal(new BigInteger(3L * GAS), flip.reservedBankroll());
            Assert.Equal(BigInteger.Zero, flip.freeBankroll());
            Assert.Equal(new BigInteger(3), flip.pendingBetCount());

            // A 4th bet has no free bankroll and is rejected; prior 3 stay fully reserved.
            AssertRevert("free bankroll cannot cover this bet", () => flip.commit(player, 0, 1L * GAS));
            Assert.Equal(new BigInteger(3L * GAS), flip.reservedBankroll());
            Assert.Equal(new BigInteger(3), flip.pendingBetCount());
            // 3 GAS escrowed (3 pending wagers) + 7 GAS leftover credit.
            AssertSolvent(engine, flip, 3L * GAS, player);

            // Owner cannot pull the reserved bankroll out from under the pending wins.
            engine.SetTransactionSigners(OwnerHash);
            AssertRevert("insufficient free bankroll", () => flip.withdrawBankroll(house, 1L * GAS));

            // Settle all three once the K-block beacon window has cleared. Each settle releases
            // its reservation regardless of win/loss (a win spends the reserved exposure from
            // the bankroll; a loss adds the wager to the bankroll), so reservation returns to
            // zero.
            MinePastBeacon(engine);
            engine.SetTransactionSigners(player);
            flip.settle(b1!.Value);
            flip.settle(b2!.Value);
            flip.settle(b3!.Value);
            Assert.Equal(BigInteger.Zero, flip.reservedBankroll());
            Assert.Equal(BigInteger.Zero, flip.pendingBetCount());
            // No escrow left; contract holds exactly bankroll + remaining credit.
            AssertSolvent(engine, flip, 0, player);

            // Top up the bankroll so a fresh commit can reserve again, then it succeeds.
            engine.SetTransactionSigners(house);
            engine.Native.GAS.Transfer(house, flip.Hash, 5L * GAS, "miniapp-fogplay:fund");
            engine.SetTransactionSigners(player);
            Assert.True((flip.freeBankroll() ?? 0) >= 1L * GAS);
            BigInteger? b4 = flip.commit(player, 0, 1L * GAS);
            Assert.NotNull(b4);
            Assert.Equal(new BigInteger(1L * GAS), flip.reservedBankroll());
        }

        [Fact]
        public void Withdraw_RefundsUnusedCredit_NotEscrowedWagers()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppCoinFlipV2");
            var flip = engine.Deploy<CoinFlipV2Contract>(nef, manifest);

            var house = TestEngine.GetNewSigner().Account;
            var player = TestEngine.GetNewSigner().Account;
            FundGas(engine, house, 20L * GAS);
            FundGas(engine, player, 5L * GAS);

            engine.SetTransactionSigners(house);
            engine.Native.GAS.Transfer(house, flip.Hash, 10L * GAS, "miniapp-fogplay:fund");
            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, flip.Hash, 2L * GAS, "miniapp-fogplay:bet");

            // Escrow 1 GAS into a pending bet; only the remaining 1 GAS credit is refundable.
            flip.commit(player, 0, 1L * GAS);
            Assert.Equal(new BigInteger(1L * GAS), flip.creditOf(player));

            BigInteger balanceBefore = engine.Native.GAS.BalanceOf(player) ?? 0;
            Assert.Equal(new BigInteger(1L * GAS), flip.withdraw(player));
            Assert.Equal(balanceBefore + 1L * GAS, engine.Native.GAS.BalanceOf(player));
            Assert.Equal(BigInteger.Zero, flip.creditOf(player));
            // Escrowed wager survives the withdrawal: 10 bankroll + 1 escrowed still held.
            Assert.Equal(new BigInteger(11L * GAS), engine.Native.GAS.BalanceOf(flip.Hash));

            AssertRevert("no credit", () => flip.withdraw(player));
        }

        [Fact]
        public void Guards_RejectInvalidCommits()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppCoinFlipV2");
            var flip = engine.Deploy<CoinFlipV2Contract>(nef, manifest);

            var house = TestEngine.GetNewSigner().Account;
            var player = TestEngine.GetNewSigner().Account;
            var other = TestEngine.GetNewSigner().Account;
            FundGas(engine, house, 20L * GAS);
            FundGas(engine, player, 10L * GAS);

            engine.SetTransactionSigners(player);
            AssertRevert("player witness required", () => flip.commit(other, 0, 1L * GAS));
            AssertRevert("choice must be 0 or 1", () => flip.commit(player, 2, 1L * GAS));
            AssertRevert("bet out of range", () => flip.commit(player, 0, 1000000)); // < MIN_BET
            AssertRevert("insufficient bet credit", () => flip.commit(player, 0, 1L * GAS));

            // Credit but empty bankroll: cannot reserve the exposure.
            engine.Native.GAS.Transfer(player, flip.Hash, 2L * GAS, "miniapp-fogplay:bet");
            AssertRevert("free bankroll cannot cover this bet", () => flip.commit(player, 0, 1L * GAS));

            // Settling a non-existent bet reverts.
            AssertRevert("bet not found", () => flip.settle(999));
        }

        [Fact]
        public void BankrollWithdraw_IsOwnerOnly_RespectingReservation()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppCoinFlipV2");
            var flip = engine.Deploy<CoinFlipV2Contract>(nef, manifest);

            var house = TestEngine.GetNewSigner().Account;
            var stranger = TestEngine.GetNewSigner().Account;
            FundGas(engine, house, 10L * GAS);

            engine.SetTransactionSigners(house);
            engine.Native.GAS.Transfer(house, flip.Hash, 5L * GAS, "miniapp-fogplay:fund");

            engine.SetTransactionSigners(stranger);
            AssertRevert("owner only", () => flip.withdrawBankroll(stranger, 1L * GAS));

            engine.SetTransactionSigners(OwnerHash);
            AssertRevert("insufficient free bankroll", () => flip.withdrawBankroll(house, 6L * GAS));
            BigInteger houseBefore = engine.Native.GAS.BalanceOf(house) ?? 0;
            flip.withdrawBankroll(house, 2L * GAS);
            Assert.Equal(new BigInteger(3L * GAS), flip.bankroll());
            Assert.Equal(houseBefore + 2L * GAS, engine.Native.GAS.BalanceOf(house));
        }
    }
}
