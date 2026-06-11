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
    public abstract class CoinFlipContract : SmartContract
    {
        protected CoinFlipContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract BigInteger? flip(UInt160 player, BigInteger choice, BigInteger amount);
        public abstract void withdrawBankroll(UInt160 to, BigInteger amount);
        public abstract BigInteger? withdraw(UInt160 account);
        public abstract BigInteger? bankroll();
        public abstract BigInteger? creditOf(UInt160 player);
        public abstract BigInteger? lastGameId();
    }

    public class MiniAppCoinFlipTests
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
        private static void AssertSolvent(TestEngine engine, CoinFlipContract flip, params UInt160[] players)
        {
            BigInteger obligations = flip.bankroll() ?? 0;
            foreach (var p in players) obligations += flip.creditOf(p) ?? 0;
            Assert.Equal(obligations, engine.Native.GAS.BalanceOf(flip.Hash));
        }

        [Fact]
        public void CoinFlip_DepositThenFlip_PayoutIsZeroOrDoubleAndContractStaysSolvent()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppCoinFlip");
            var flip = engine.Deploy<CoinFlipContract>(nef, manifest);

            var house = TestEngine.GetNewSigner().Account;
            var player = TestEngine.GetNewSigner().Account;
            FundGas(engine, house, 20L * GAS);
            FundGas(engine, player, 5L * GAS);

            // House funds the bankroll; player prepays a bet credit.
            engine.SetTransactionSigners(house);
            engine.Native.GAS.Transfer(house, flip.Hash, 10L * GAS, "miniapp-fogplay:fund");
            Assert.Equal(new BigInteger(10L * GAS), flip.bankroll());

            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, flip.Hash, 2L * GAS, "miniapp-fogplay:bet");
            Assert.Equal(new BigInteger(2L * GAS), flip.creditOf(player));
            AssertSolvent(engine, flip, player);

            // Flip 1 GAS on heads. The outcome is seed-dependent, so assert the
            // invariants: outcome is binary and the payout is exactly 0 or 2x.
            BigInteger balanceBefore = engine.Native.GAS.BalanceOf(player) ?? 0;
            BigInteger? outcome = flip.flip(player, 0, 1L * GAS);
            Assert.True(outcome == 0 || outcome == 1, $"outcome must be 0/1, got {outcome}");
            BigInteger payout = (engine.Native.GAS.BalanceOf(player) ?? 0) - balanceBefore;
            Assert.True(payout == 0 || payout == 2L * GAS, $"payout must be 0 or 2x, got {payout}");
            bool won = payout == 2L * GAS;

            // Wager consumed from credit; bankroll moved by exactly +-1 GAS.
            Assert.Equal(new BigInteger(1L * GAS), flip.creditOf(player));
            Assert.Equal(new BigInteger(won ? 9L * GAS : 11L * GAS), flip.bankroll());
            Assert.Equal(BigInteger.One, flip.lastGameId());
            AssertSolvent(engine, flip, player);
        }

        [Fact]
        public void CoinFlip_GuardsRejectInvalidFlipsAndDeposits()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppCoinFlip");
            var flip = engine.Deploy<CoinFlipContract>(nef, manifest);

            var player = TestEngine.GetNewSigner().Account;
            var other = TestEngine.GetNewSigner().Account;
            FundGas(engine, player, 10L * GAS);

            // NOTE: the "invalid memo" deposit guard ABORTs inside OnNEP17Payment
            // mid-GAS.Transfer, which the TestEngine host cannot unwind (it hangs
            // natively), so that path is covered by the live testnet harness
            // (deploy/scripts/live_validate_coinflip.mjs) instead of here. Direct
            // entrypoint reverts below are safely catchable.

            // Signing as player but flipping for another account fails the witness gate.
            engine.SetTransactionSigners(player);
            AssertRevert("player witness required", () => flip.flip(other, 0, 1L * GAS));

            // Choice and bet-range guards.
            AssertRevert("choice must be 0 or 1", () => flip.flip(player, 2, 1L * GAS));
            AssertRevert("bet out of range", () => flip.flip(player, 0, 1000000)); // 0.01 GAS < MIN_BET

            // No prepaid credit yet.
            AssertRevert("insufficient bet credit", () => flip.flip(player, 0, 1L * GAS));

            // With credit but an empty bankroll, the house cannot cover a win.
            engine.Native.GAS.Transfer(player, flip.Hash, 2L * GAS, "miniapp-fogplay:bet");
            AssertRevert("bankroll cannot cover this bet", () => flip.flip(player, 0, 1L * GAS));
        }

        [Fact]
        public void CoinFlip_WithdrawRefundsUnusedBetCredit()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppCoinFlip");
            var flip = engine.Deploy<CoinFlipContract>(nef, manifest);

            var player = TestEngine.GetNewSigner().Account;
            FundGas(engine, player, 5L * GAS);

            engine.SetTransactionSigners(player);
            engine.Native.GAS.Transfer(player, flip.Hash, 2L * GAS, "miniapp-fogplay:bet");
            Assert.Equal(new BigInteger(2L * GAS), flip.creditOf(player));

            BigInteger balanceBefore = engine.Native.GAS.BalanceOf(player) ?? 0;
            Assert.Equal(new BigInteger(2L * GAS), flip.withdraw(player));
            Assert.Equal(balanceBefore + 2L * GAS, engine.Native.GAS.BalanceOf(player));
            Assert.Equal(BigInteger.Zero, flip.creditOf(player));
            Assert.Equal(BigInteger.Zero, engine.Native.GAS.BalanceOf(flip.Hash));

            AssertRevert("no credit", () => flip.withdraw(player));
        }

        [Fact]
        public void CoinFlip_BankrollWithdrawIsOwnerOnly()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppCoinFlip");
            var flip = engine.Deploy<CoinFlipContract>(nef, manifest);

            var house = TestEngine.GetNewSigner().Account;
            var stranger = TestEngine.GetNewSigner().Account;
            FundGas(engine, house, 10L * GAS);

            engine.SetTransactionSigners(house);
            engine.Native.GAS.Transfer(house, flip.Hash, 5L * GAS, "miniapp-fogplay:fund");
            Assert.Equal(new BigInteger(5L * GAS), flip.bankroll());

            engine.SetTransactionSigners(stranger);
            AssertRevert("owner only", () => flip.withdrawBankroll(stranger, 1L * GAS));

            // The hardcoded owner can withdraw, but never more than the bankroll.
            engine.SetTransactionSigners(OwnerHash);
            AssertRevert("insufficient bankroll", () => flip.withdrawBankroll(house, 6L * GAS));
            BigInteger houseBefore = engine.Native.GAS.BalanceOf(house) ?? 0;
            flip.withdrawBankroll(house, 2L * GAS);
            Assert.Equal(new BigInteger(3L * GAS), flip.bankroll());
            Assert.Equal(houseBefore + 2L * GAS, engine.Native.GAS.BalanceOf(house));
            Assert.Equal(new BigInteger(3L * GAS), engine.Native.GAS.BalanceOf(flip.Hash));
        }
    }
}
