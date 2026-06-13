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
    public abstract class DiceGameContract : SmartContract
    {
        protected DiceGameContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract BigInteger? roll(UInt160 player, BigInteger face, BigInteger amount);
        public abstract void withdrawBankroll(UInt160 to, BigInteger amount);
        public abstract BigInteger? withdraw(UInt160 account);
        public abstract BigInteger? bankroll();
        public abstract BigInteger? creditOf(UInt160 player);
        public abstract BigInteger? lastGameId();
        // Maps come back as raw Neo.VM.Types.Map — the binding the testing
        // framework's converter supports for Map<string,object>.
        public abstract Neo.VM.Types.Map? getGame(BigInteger gameId);
    }

    public class MiniAppDiceGameTests
    {
        // The contract hardcodes Owner = NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32
        // (UInt160 form as the TestEngine reports it).
        private static readonly UInt160 OwnerHash = UInt160.Parse("0x6d0656f6dd91469db1c90cc1e574380613f43738");
        private const long GAS = 100000000;        // 1 GAS base units
        private const long MIN_BET = 5000000;      // 0.05 GAS
        private const long MAX_BET = 2000000000;   // 20 GAS
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

        // Fund an account with GAS from the genesis validators multisig.
        private static void FundGas(TestEngine engine, UInt160 to, BigInteger gas)
        {
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            engine.Native.GAS.Transfer(engine.ValidatorsAddress, to, gas, null);
        }

        // Contract asserts surface as "ABORTMSG is executed. Reason: <text>".
        private static void AssertRevert(string reason, Action act)
        {
            var ex = Assert.ThrowsAny<Exception>(act);
            Assert.Equal($"ABORTMSG is executed. Reason: {reason}", ex.Message);
        }

        // Solvency invariant: every base unit the contract holds is either house
        // bankroll or a player's reclaimable bet credit.
        private static void AssertSolvent(TestEngine engine, DiceGameContract dice, params UInt160[] players)
        {
            BigInteger obligations = dice.bankroll() ?? 0;
            foreach (var p in players) obligations += dice.creditOf(p) ?? 0;
            Assert.Equal(obligations, engine.Native.GAS.BalanceOf(dice.Hash));
        }

        private static (BigInteger rolled, bool won, BigInteger wager, BigInteger payout) GameOf(DiceGameContract dice, BigInteger gameId)
        {
            Neo.VM.Types.Map? g = dice.getGame(gameId);
            Assert.NotNull(g);
            BigInteger rolled = g![(Neo.VM.Types.PrimitiveType)"rolled"].GetInteger();
            bool won = g[(Neo.VM.Types.PrimitiveType)"won"].GetBoolean();
            BigInteger wager = g[(Neo.VM.Types.PrimitiveType)"wager"].GetInteger();
            BigInteger payout = g[(Neo.VM.Types.PrimitiveType)"payout"].GetInteger();
            return (rolled, won, wager, payout);
        }

        [Fact]
        public void DiceGame_DepositThenRoll_PayoutIsZeroOr570xAndContractStaysSolvent()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppDiceGame");
            var dice = engine.Deploy<DiceGameContract>(nef, manifest);

            var house = TestEngine.GetNewSigner().Account;
            var player = TestEngine.GetNewSigner().Account;
            FundGas(engine, house, 60L * GAS);
            FundGas(engine, player, 40L * GAS);

            // House funds the bankroll; player prepays a big bet credit.
            engine.SetTransactionSigners(house);
            engine.Native.GAS.Transfer(house, dice.Hash, 50L * GAS, FUND_MEMO);
            Assert.Equal(new BigInteger(50L * GAS), dice.bankroll());

            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, dice.Hash, 30L * GAS, BET_MEMO);
            Assert.Equal(new BigInteger(30L * GAS), dice.creditOf(player));
            AssertSolvent(engine, dice, player);

            // Roll 1 GAS on face 1 repeatedly. The outcome is seed/time-dependent, so
            // across many rolls we expect both wins and losses. On EVERY roll assert
            // the exact payout/bankroll math (5.70x on a win, 0 on a loss).
            const long bet = 1L * GAS;
            const long extra = bet * 47 / 10;   // 4.7 GAS the house tops up on a win
            const long payoutWin = bet * 57 / 10; // 5.7 GAS gross to the player on a win
            bool sawWin = false, sawLoss = false;
            BigInteger expectedBankroll = 50L * GAS;
            BigInteger expectedCredit = 30L * GAS;

            for (int i = 1; i <= 24; i++)
            {
                BigInteger balanceBefore = engine.Native.GAS.BalanceOf(player) ?? 0;
                engine.SetTransactionSigners(player);
                BigInteger? rolled = dice.roll(player, 1, bet);
                Assert.True(rolled >= 1 && rolled <= 6, $"rolled must be 1..6, got {rolled}");

                var rec = GameOf(dice, i);
                Assert.Equal(rolled, rec.rolled);
                Assert.Equal(new BigInteger(bet), rec.wager);

                expectedCredit -= bet;
                Assert.Equal(expectedCredit, dice.creditOf(player));

                BigInteger received = (engine.Native.GAS.BalanceOf(player) ?? 0) - balanceBefore;
                if (rec.won)
                {
                    sawWin = true;
                    Assert.Equal(1, (int)rec.rolled); // chosen face == rolled
                    Assert.Equal(new BigInteger(payoutWin), rec.payout);
                    Assert.Equal(new BigInteger(payoutWin), received);
                    expectedBankroll -= extra; // house paid the extra-from-house
                }
                else
                {
                    sawLoss = true;
                    Assert.NotEqual(1, (int)rec.rolled);
                    Assert.Equal(BigInteger.Zero, rec.payout);
                    Assert.Equal(BigInteger.Zero, received);
                    expectedBankroll += bet; // wager funds the house
                }
                Assert.Equal(expectedBankroll, dice.bankroll());
                Assert.Equal(new BigInteger(i), dice.lastGameId());
                AssertSolvent(engine, dice, player);
            }

            Assert.True(sawWin, "expected at least one winning roll across 24 attempts");
            Assert.True(sawLoss, "expected at least one losing roll across 24 attempts");
        }

        [Fact]
        public void DiceGame_GuardsRejectInvalidRollsAndOverLargeBets()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppDiceGame");
            var dice = engine.Deploy<DiceGameContract>(nef, manifest);

            var house = TestEngine.GetNewSigner().Account;
            var player = TestEngine.GetNewSigner().Account;
            var other = TestEngine.GetNewSigner().Account;
            FundGas(engine, house, 20L * GAS);
            FundGas(engine, player, 40L * GAS);

            // Signing as player but rolling for another account fails the witness gate.
            engine.SetTransactionSigners(player);
            AssertRevert("player witness required", () => dice.roll(other, 1, 1L * GAS));

            // Face and bet-range guards.
            AssertRevert("face must be 1..6", () => dice.roll(player, 0, 1L * GAS));
            AssertRevert("face must be 1..6", () => dice.roll(player, 7, 1L * GAS));
            AssertRevert("bet out of range", () => dice.roll(player, 1, 1000000));            // 0.01 GAS < MIN_BET
            AssertRevert("bet out of range", () => dice.roll(player, 1, MAX_BET + 1));        // > MAX_BET

            // No prepaid credit yet.
            AssertRevert("insufficient bet credit", () => dice.roll(player, 1, 1L * GAS));

            // With credit but a too-thin bankroll, the house cannot cover the win.
            // A 10 GAS bet needs bankroll >= 10*47/10 = 47 GAS; fund only 5 GAS.
            engine.SetTransactionSigners(house);
            engine.Native.GAS.Transfer(house, dice.Hash, 5L * GAS, FUND_MEMO);
            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, dice.Hash, 10L * GAS, BET_MEMO);
            AssertRevert("bankroll cannot cover this bet", () => dice.roll(player, 1, 10L * GAS));

            // The credit is untouched by the rejected roll and is fully reclaimable.
            Assert.Equal(new BigInteger(10L * GAS), dice.creditOf(player));
        }

        [Fact]
        public void DiceGame_WithdrawRefundsUnusedBetCredit()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppDiceGame");
            var dice = engine.Deploy<DiceGameContract>(nef, manifest);

            var player = TestEngine.GetNewSigner().Account;
            FundGas(engine, player, 5L * GAS);

            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, dice.Hash, 2L * GAS, BET_MEMO);
            Assert.Equal(new BigInteger(2L * GAS), dice.creditOf(player));

            BigInteger balanceBefore = engine.Native.GAS.BalanceOf(player) ?? 0;
            Assert.Equal(new BigInteger(2L * GAS), dice.withdraw(player));
            Assert.Equal(balanceBefore + 2L * GAS, engine.Native.GAS.BalanceOf(player));
            Assert.Equal(BigInteger.Zero, dice.creditOf(player));
            Assert.Equal(BigInteger.Zero, engine.Native.GAS.BalanceOf(dice.Hash));

            AssertRevert("no credit", () => dice.withdraw(player));
        }

        [Fact]
        public void DiceGame_BankrollWithdrawIsOwnerOnly()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppDiceGame");
            var dice = engine.Deploy<DiceGameContract>(nef, manifest);

            var house = TestEngine.GetNewSigner().Account;
            var stranger = TestEngine.GetNewSigner().Account;
            FundGas(engine, house, 10L * GAS);

            engine.SetTransactionSigners(house);
            engine.Native.GAS.Transfer(house, dice.Hash, 5L * GAS, FUND_MEMO);
            Assert.Equal(new BigInteger(5L * GAS), dice.bankroll());

            engine.SetTransactionSigners(stranger);
            AssertRevert("owner only", () => dice.withdrawBankroll(stranger, 1L * GAS));

            // The hardcoded owner can withdraw, but never more than the bankroll.
            engine.SetTransactionSigners(OwnerHash);
            AssertRevert("insufficient bankroll", () => dice.withdrawBankroll(house, 6L * GAS));
            BigInteger houseBefore = engine.Native.GAS.BalanceOf(house) ?? 0;
            dice.withdrawBankroll(house, 2L * GAS);
            Assert.Equal(new BigInteger(3L * GAS), dice.bankroll());
            Assert.Equal(houseBefore + 2L * GAS, engine.Native.GAS.BalanceOf(house));
            Assert.Equal(new BigInteger(3L * GAS), engine.Native.GAS.BalanceOf(dice.Hash));
        }
    }
}
