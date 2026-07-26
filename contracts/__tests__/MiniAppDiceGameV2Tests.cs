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
    public abstract class DiceGameV2Contract : SmartContract
    {
        protected DiceGameV2Contract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract BigInteger? commit(UInt160 player, BigInteger face, BigInteger amount);
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

    public class MiniAppDiceGameV2Tests
    {
        // The contract hardcodes Owner = NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32.
        private static readonly UInt160 OwnerHash = UInt160.Parse("0x6d0656f6dd91469db1c90cc1e574380613f43738");
        private const long GAS = 100000000;        // 1 GAS base units
        private const long MAX_BET = 2000000000;   // 20 GAS

        // Mirrors the contract's BEACON_BLOCKS: settle requires CurrentIndex > commitIndex + K
        // and mixes the hashes of the K blocks commitIndex+1 .. commitIndex+K.
        private const int BEACON_BLOCKS = 3;
        private const string FUND_MEMO = "miniapp-dice-game:fund";
        private const string BET_MEMO = "miniapp-dice-game:stake";

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

        private static void MineBlock(TestEngine engine) => engine.PersistingBlock.Persist();

        // Mine enough blocks to clear the K-block beacon window: settle needs
        // CurrentIndex > commitIndex + BEACON_BLOCKS AND the K beacon blocks (commitIndex+1
        // .. commitIndex+K) persisted. Persisting BEACON_BLOCKS + 1 blocks satisfies both.
        private static void MinePastBeacon(TestEngine engine)
        {
            for (int i = 0; i <= BEACON_BLOCKS; i++) engine.PersistingBlock.Persist();
        }

        private static void AssertSolvent(TestEngine engine, DiceGameV2Contract dice, BigInteger escrowed, params UInt160[] players)
        {
            BigInteger obligations = (dice.bankroll() ?? 0) + escrowed;
            foreach (var p in players) obligations += dice.creditOf(p) ?? 0;
            Assert.Equal(obligations, engine.Native.GAS.BalanceOf(dice.Hash));
            Assert.True((dice.reservedBankroll() ?? 0) <= (dice.bankroll() ?? 0), "reserved must be <= bankroll");
        }

        private static (BigInteger face, bool settled, BigInteger rolled, bool won, BigInteger wager, BigInteger exposure, BigInteger payout, BigInteger commitIndex)
            BetOf(DiceGameV2Contract dice, BigInteger betId)
        {
            Neo.VM.Types.Map? b = dice.getPendingBet(betId);
            Assert.NotNull(b);
            return (
                b![(Neo.VM.Types.PrimitiveType)"face"].GetInteger(),
                b[(Neo.VM.Types.PrimitiveType)"settled"].GetBoolean(),
                b[(Neo.VM.Types.PrimitiveType)"rolled"].GetInteger(),
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
            var (nef, manifest) = Load("MiniAppDiceGameV2");
            var dice = engine.Deploy<DiceGameV2Contract>(nef, manifest);

            var house = TestEngine.GetNewSigner().Account;
            var player = TestEngine.GetNewSigner().Account;
            FundGas(engine, house, 60L * GAS);
            FundGas(engine, player, 10L * GAS);

            engine.SetTransactionSigners(house);
            engine.Native.GAS.Transfer(house, dice.Hash, 50L * GAS, FUND_MEMO);
            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, dice.Hash, 2L * GAS, BET_MEMO);

            BigInteger? betId = dice.commit(player, 1, 1L * GAS);
            Assert.Equal(BigInteger.One, betId);

            // Same block (no mining) reverts: none of the K beacon blocks exist yet.
            AssertRevert("reveal must be a later block", () => dice.settle(betId!.Value));

            // Settling anywhere inside the K-block beacon window (up to commitIndex + K) must
            // STILL revert: the full multi-block beacon is not yet fixed.
            for (int i = 0; i < BEACON_BLOCKS; i++)
            {
                MineBlock(engine);
                AssertRevert("reveal must be a later block", () => dice.settle(betId!.Value));
            }

            var bet = BetOf(dice, betId!.Value);
            Assert.False(bet.settled);
            // Exposure = 1 GAS * 47/10 = 4.7 GAS reserved.
            Assert.Equal(new BigInteger(47L * GAS / 10), bet.exposure);
            Assert.Equal(new BigInteger(47L * GAS / 10), dice.reservedBankroll());
            Assert.Equal(BigInteger.One, dice.pendingBetCount());
        }

        [Fact]
        public void CommitEscrowsAndReserves_SolventBeforeAndAfterSettle()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppDiceGameV2");
            var dice = engine.Deploy<DiceGameV2Contract>(nef, manifest);

            var house = TestEngine.GetNewSigner().Account;
            var player = TestEngine.GetNewSigner().Account;
            FundGas(engine, house, 60L * GAS);
            FundGas(engine, player, 10L * GAS);

            engine.SetTransactionSigners(house);
            engine.Native.GAS.Transfer(house, dice.Hash, 50L * GAS, FUND_MEMO);
            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, dice.Hash, 2L * GAS, BET_MEMO);
            AssertSolvent(engine, dice, 0, player);

            const long bet = 1L * GAS;
            const long extra = bet * 47 / 10;     // 4.7 GAS reserved/spent on a win
            const long payoutWin = bet * 57 / 10; // 5.7 GAS gross to the player on a win

            BigInteger? betId = dice.commit(player, 1, bet);
            Assert.Equal(new BigInteger(1L * GAS), dice.creditOf(player)); // 2 - 1 escrowed
            Assert.Equal(new BigInteger(extra), dice.reservedBankroll());
            Assert.Equal(new BigInteger(50L * GAS - extra), dice.freeBankroll());
            Assert.Equal(new BigInteger(50L * GAS), dice.bankroll()); // unchanged until settle
            AssertSolvent(engine, dice, bet, player);

            // Reveal once the K-block beacon window has fully cleared.
            MinePastBeacon(engine);
            BigInteger balanceBefore = engine.Native.GAS.BalanceOf(player) ?? 0;
            BigInteger? rolled = dice.settle(betId!.Value);
            Assert.True(rolled >= 1 && rolled <= 6);

            var rec = BetOf(dice, betId!.Value);
            Assert.True(rec.settled);
            BigInteger received = (engine.Native.GAS.BalanceOf(player) ?? 0) - balanceBefore;
            if (rec.won)
            {
                Assert.Equal(1, (int)rec.rolled);
                Assert.Equal(new BigInteger(payoutWin), rec.payout);
                Assert.Equal(new BigInteger(payoutWin), received);
                Assert.Equal(new BigInteger(50L * GAS - extra), dice.bankroll());
            }
            else
            {
                Assert.NotEqual(1, (int)rec.rolled);
                Assert.Equal(BigInteger.Zero, rec.payout);
                Assert.Equal(BigInteger.Zero, received);
                Assert.Equal(new BigInteger(50L * GAS + bet), dice.bankroll());
            }
            Assert.Equal(BigInteger.Zero, dice.reservedBankroll());
            Assert.Equal(BigInteger.Zero, dice.pendingBetCount());
            AssertSolvent(engine, dice, 0, player);

            // Double settle is rejected (the recorded result is immutable).
            AssertRevert("bet already settled", () => dice.settle(betId!.Value));

            // IDEMPOTENT BEACON: mine further blocks and confirm the recorded roll is
            // unchanged — the K-block beacon is fixed, so the draw can never be re-rolled by
            // waiting for a deeper chain.
            BigInteger recordedRoll = rolled!.Value;
            MinePastBeacon(engine);
            var recAfter = BetOf(dice, betId!.Value);
            Assert.Equal(recordedRoll, recAfter.rolled);
            Assert.Equal(rec.won, recAfter.won);
            Assert.Equal(rec.payout, recAfter.payout);
            AssertRevert("bet already settled", () => dice.settle(betId!.Value));
        }

        [Fact]
        public void ByteArrayMemoCreditsTheSharedHouseGameLedger()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppDiceGameV2");
            var dice = engine.Deploy<DiceGameV2Contract>(nef, manifest);
            var player = TestEngine.GetNewSigner().Account;
            FundGas(engine, player, 2L * GAS);

            engine.SetTransactionSigners(player);
            Assert.True(engine.Native.GAS.Transfer(
                player,
                dice.Hash,
                2L * GAS,
                Encoding.UTF8.GetBytes(BET_MEMO)) == true);

            Assert.Equal(new BigInteger(2L * GAS), dice.creditOf(player));
        }

        [Fact]
        public void Win_PaysExactly570x()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppDiceGameV2");
            var dice = engine.Deploy<DiceGameV2Contract>(nef, manifest);

            var house = TestEngine.GetNewSigner().Account;
            var player = TestEngine.GetNewSigner().Account;
            FundGas(engine, house, 100L * GAS);
            FundGas(engine, player, 100L * GAS);

            engine.SetTransactionSigners(house);
            engine.Native.GAS.Transfer(house, dice.Hash, 80L * GAS, FUND_MEMO);
            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, dice.Hash, 80L * GAS, BET_MEMO);

            const long bet = 1L * GAS;
            const long extra = bet * 47 / 10;
            const long payoutWin = bet * 57 / 10;
            bool sawWin = false, sawLoss = false;
            BigInteger expectedBankroll = 80L * GAS;

            // Cycle the chosen face 1..6 across many commit/mine/settle rounds so a win is
            // reached; mine past the K-block beacon each round and on EVERY settle assert the
            // exact 5.70x payout math.
            for (int i = 1; i <= 60 && !(sawWin && sawLoss); i++)
            {
                BigInteger face = (i % 6) + 1;
                engine.SetTransactionSigners(player);
                BigInteger? betId = dice.commit(player, face, bet);
                MinePastBeacon(engine);
                BigInteger balanceBefore = engine.Native.GAS.BalanceOf(player) ?? 0;
                dice.settle(betId!.Value);
                var rec = BetOf(dice, betId!.Value);
                BigInteger received = (engine.Native.GAS.BalanceOf(player) ?? 0) - balanceBefore;
                if (rec.won)
                {
                    sawWin = true;
                    Assert.Equal(face, rec.rolled);
                    Assert.Equal(new BigInteger(payoutWin), rec.payout);
                    Assert.Equal(new BigInteger(payoutWin), received);
                    expectedBankroll -= extra;
                }
                else
                {
                    sawLoss = true;
                    Assert.NotEqual(face, rec.rolled);
                    Assert.Equal(BigInteger.Zero, rec.payout);
                    Assert.Equal(BigInteger.Zero, received);
                    expectedBankroll += bet;
                }
                Assert.Equal(expectedBankroll, dice.bankroll());
                Assert.Equal(BigInteger.Zero, dice.reservedBankroll());
            }

            Assert.True(sawWin, "expected at least one winning roll across 60 attempts");
            Assert.True(sawLoss, "expected at least one losing roll across 60 attempts");
        }

        [Fact]
        public void Reservation_RejectsOversubscriptionAndKeepsPriorBetsCovered()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppDiceGameV2");
            var dice = engine.Deploy<DiceGameV2Contract>(nef, manifest);

            var house = TestEngine.GetNewSigner().Account;
            var player = TestEngine.GetNewSigner().Account;
            FundGas(engine, house, 60L * GAS);
            FundGas(engine, player, 30L * GAS);

            // Bankroll exactly 2x4.7 = 9.4 GAS: room for two 1 GAS bets (each reserves 4.7),
            // not a third.
            const long extra = 1L * GAS * 47 / 10; // 4.7 GAS
            engine.SetTransactionSigners(house);
            engine.Native.GAS.Transfer(house, dice.Hash, 2 * extra, FUND_MEMO);
            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, dice.Hash, 10L * GAS, BET_MEMO);

            BigInteger? b1 = dice.commit(player, 1, 1L * GAS);
            BigInteger? b2 = dice.commit(player, 1, 1L * GAS);
            Assert.Equal(new BigInteger(2 * extra), dice.reservedBankroll());
            Assert.Equal(BigInteger.Zero, dice.freeBankroll());
            Assert.Equal(new BigInteger(2), dice.pendingBetCount());

            AssertRevert("free bankroll cannot cover this bet", () => dice.commit(player, 1, 1L * GAS));
            Assert.Equal(new BigInteger(2 * extra), dice.reservedBankroll());
            AssertSolvent(engine, dice, 2L * GAS, player); // two 1 GAS wagers escrowed

            engine.SetTransactionSigners(OwnerHash);
            AssertRevert("insufficient free bankroll", () => dice.withdrawBankroll(house, 1L * GAS));

            // Settle both once the K-block beacon window has cleared; reservation drains to
            // zero.
            MinePastBeacon(engine);
            engine.SetTransactionSigners(player);
            dice.settle(b1!.Value);
            dice.settle(b2!.Value);
            Assert.Equal(BigInteger.Zero, dice.reservedBankroll());
            Assert.Equal(BigInteger.Zero, dice.pendingBetCount());
            AssertSolvent(engine, dice, 0, player);
        }

        [Fact]
        public void Withdraw_RefundsUnusedCredit_NotEscrowedWagers()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppDiceGameV2");
            var dice = engine.Deploy<DiceGameV2Contract>(nef, manifest);

            var house = TestEngine.GetNewSigner().Account;
            var player = TestEngine.GetNewSigner().Account;
            FundGas(engine, house, 60L * GAS);
            FundGas(engine, player, 10L * GAS);

            engine.SetTransactionSigners(house);
            engine.Native.GAS.Transfer(house, dice.Hash, 50L * GAS, FUND_MEMO);
            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, dice.Hash, 2L * GAS, BET_MEMO);

            dice.commit(player, 1, 1L * GAS);
            Assert.Equal(new BigInteger(1L * GAS), dice.creditOf(player));

            BigInteger balanceBefore = engine.Native.GAS.BalanceOf(player) ?? 0;
            Assert.Equal(new BigInteger(1L * GAS), dice.withdraw(player));
            Assert.Equal(balanceBefore + 1L * GAS, engine.Native.GAS.BalanceOf(player));
            Assert.Equal(BigInteger.Zero, dice.creditOf(player));
            // 50 bankroll + 1 escrowed wager still held.
            Assert.Equal(new BigInteger(51L * GAS), engine.Native.GAS.BalanceOf(dice.Hash));

            AssertRevert("no credit", () => dice.withdraw(player));
        }

        [Fact]
        public void Guards_RejectInvalidCommits()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppDiceGameV2");
            var dice = engine.Deploy<DiceGameV2Contract>(nef, manifest);

            var house = TestEngine.GetNewSigner().Account;
            var player = TestEngine.GetNewSigner().Account;
            var other = TestEngine.GetNewSigner().Account;
            FundGas(engine, house, 60L * GAS);
            FundGas(engine, player, 40L * GAS);

            engine.SetTransactionSigners(player);
            AssertRevert("player witness required", () => dice.commit(other, 1, 1L * GAS));
            AssertRevert("face must be 1..6", () => dice.commit(player, 0, 1L * GAS));
            AssertRevert("face must be 1..6", () => dice.commit(player, 7, 1L * GAS));
            AssertRevert("bet out of range", () => dice.commit(player, 1, 1000000));     // < MIN_BET
            AssertRevert("bet out of range", () => dice.commit(player, 1, MAX_BET + 1)); // > MAX_BET
            AssertRevert("insufficient bet credit", () => dice.commit(player, 1, 1L * GAS));

            // 10 GAS bet needs bankroll >= 10*47/10 = 47 GAS; fund only 5 GAS.
            engine.SetTransactionSigners(house);
            engine.Native.GAS.Transfer(house, dice.Hash, 5L * GAS, FUND_MEMO);
            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, dice.Hash, 10L * GAS, BET_MEMO);
            AssertRevert("free bankroll cannot cover this bet", () => dice.commit(player, 1, 10L * GAS));
            Assert.Equal(new BigInteger(10L * GAS), dice.creditOf(player));

            AssertRevert("bet not found", () => dice.settle(999));
        }

        [Fact]
        public void BankrollWithdraw_IsOwnerOnly_RespectingReservation()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppDiceGameV2");
            var dice = engine.Deploy<DiceGameV2Contract>(nef, manifest);

            var house = TestEngine.GetNewSigner().Account;
            var stranger = TestEngine.GetNewSigner().Account;
            FundGas(engine, house, 20L * GAS);

            engine.SetTransactionSigners(house);
            engine.Native.GAS.Transfer(house, dice.Hash, 5L * GAS, FUND_MEMO);

            engine.SetTransactionSigners(stranger);
            AssertRevert("owner only", () => dice.withdrawBankroll(stranger, 1L * GAS));

            engine.SetTransactionSigners(OwnerHash);
            AssertRevert("insufficient free bankroll", () => dice.withdrawBankroll(house, 6L * GAS));
            BigInteger houseBefore = engine.Native.GAS.BalanceOf(house) ?? 0;
            dice.withdrawBankroll(house, 2L * GAS);
            Assert.Equal(new BigInteger(3L * GAS), dice.bankroll());
            Assert.Equal(houseBefore + 2L * GAS, engine.Native.GAS.BalanceOf(house));
        }
    }
}
