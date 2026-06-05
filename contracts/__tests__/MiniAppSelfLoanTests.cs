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
    public abstract class SelfLoanContract : SmartContract
    {
        protected SelfLoanContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract void setNeoPrice(BigInteger gasPerNeo);
        public abstract void withdrawPool(UInt160 to, BigInteger amount);
        public abstract BigInteger? borrow(UInt160 borrower, BigInteger tier);
        public abstract void addCollateral(UInt160 borrower);
        public abstract BigInteger? repay(UInt160 borrower);
        public abstract BigInteger? withdraw(UInt160 account);
        public abstract BigInteger? withdrawRepayCredit(UInt160 account);
        public abstract BigInteger? neoPrice();
        public abstract BigInteger? pool();
        public abstract BigInteger? collateralCreditOf(UInt160 borrower);
        public abstract BigInteger? repayCreditOf(UInt160 borrower);
        public abstract BigInteger? totalLoans();
        public abstract BigInteger? totalRepaid();
        public abstract UInt160 getOwner();
    }

    public class MiniAppSelfLoanTests
    {
        // The contract hardcodes Owner = NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32
        // (UInt160 form as the contract/getOwner reports it).
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

        private static SelfLoanContract DeployConfigured(TestEngine engine, BigInteger price, BigInteger poolGas)
        {
            var (nef, manifest) = Load("MiniAppSelfLoan");
            var loan = engine.Deploy<SelfLoanContract>(nef, manifest);
            Assert.Equal(OwnerHash, loan.getOwner());

            // Owner sets price and funds the GAS pool.
            Fund(engine, OwnerHash, 0, poolGas + 5 * GAS);
            engine.SetTransactionSigners(OwnerHash);
            loan.setNeoPrice(price);
            engine.Native.GAS.Transfer(OwnerHash, loan.Hash, poolGas, "selfloan:fund");
            Assert.Equal(poolGas, loan.pool());
            Assert.Equal(price, loan.neoPrice());
            return loan;
        }

        [Fact]
        public void SelfLoan_BorrowDisbursesNetAndRepayGrossReleasesCollateral()
        {
            var engine = new TestEngine(true);
            var loan = DeployConfigured(engine, 5 * GAS /* 5 GAS per NEO */, 100 * GAS);

            var alice = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 100, 20 * GAS);

            // Deposit 10 NEO collateral.
            engine.SetTransactionSigners(alice);
            engine.Native.NEO.Transfer(alice, loan.Hash, 10, "selfloan:collateral");
            Assert.Equal(new BigInteger(10), loan.collateralCreditOf(alice));

            // Borrow tier 1 (20%): collateral value 10*5 = 50 GAS; gross = 10 GAS;
            // fee 0.5% = 0.05 GAS; disbursed = 9.95 GAS.
            BigInteger aliceGasBefore = engine.Native.GAS.BalanceOf(alice) ?? 0;
            BigInteger? disbursed = loan.borrow(alice, 1);
            Assert.Equal(new BigInteger(995L * 1000000), disbursed); // 9.95 GAS
            Assert.Equal(BigInteger.Zero, loan.collateralCreditOf(alice)); // consumed into the loan
            Assert.Equal(new BigInteger(90L * GAS + 5L * 1000000), loan.pool()); // 100 - 9.95 = 90.05
            Assert.Equal(new BigInteger(10), engine.Native.NEO.BalanceOf(loan.Hash)); // collateral locked
            Assert.Equal(aliceGasBefore + 995L * 1000000, engine.Native.GAS.BalanceOf(alice));

            // Repay the GROSS debt (10 GAS): deposit repay-credit, then repay() applies it,
            // closes the loan, and releases collateral. (Repaying only the net would NOT
            // clear it, proving DEBT == gross.)
            engine.Native.GAS.Transfer(alice, loan.Hash, 10 * GAS, "selfloan:repay");
            Assert.Equal(new BigInteger(10L * GAS), loan.repayCreditOf(alice));
            Assert.Equal(new BigInteger(10L * GAS), loan.repay(alice));
            Assert.Equal(new BigInteger(100), engine.Native.NEO.BalanceOf(alice)); // collateral fully released
            Assert.Equal(BigInteger.Zero, engine.Native.NEO.BalanceOf(loan.Hash));
            Assert.Equal(new BigInteger(100L * GAS + 5L * 1000000), loan.pool()); // 100 + 0.05 fee revenue
            Assert.Equal(new BigInteger(10L * GAS), loan.totalRepaid());

            // Loan is closed: a fresh borrow is possible again.
            engine.Native.NEO.Transfer(alice, loan.Hash, 10, "selfloan:collateral");
            Assert.True(loan.borrow(alice, 1) > 0);
        }

        [Fact]
        public void SelfLoan_RepayCapsAtDebtAndRefundsExcess()
        {
            var engine = new TestEngine(true);
            var loan = DeployConfigured(engine, 5 * GAS, 100 * GAS);
            var alice = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 100, 50 * GAS);

            engine.SetTransactionSigners(alice);
            engine.Native.NEO.Transfer(alice, loan.Hash, 10, "selfloan:collateral");
            loan.borrow(alice, 1); // gross debt 10 GAS

            // Over-deposit 11 GAS of repay-credit; repay() applies exactly the 10 GAS debt
            // and refunds the 1 GAS excess (no revert, no strand).
            engine.Native.GAS.Transfer(alice, loan.Hash, 11 * GAS, "selfloan:repay");
            BigInteger gasBefore = engine.Native.GAS.BalanceOf(alice) ?? 0;
            Assert.Equal(new BigInteger(10L * GAS), loan.repay(alice)); // applied == debt
            Assert.Equal(BigInteger.Zero, loan.repayCreditOf(alice));   // credit fully consumed
            Assert.Equal(gasBefore + 1L * GAS, engine.Native.GAS.BalanceOf(alice)); // 1 GAS excess refunded
            Assert.Equal(new BigInteger(100), engine.Native.NEO.BalanceOf(alice)); // collateral released
            Assert.Equal(new BigInteger(100L * GAS + 5L * 1000000), loan.pool()); // 100 + 0.05 fee
        }

        [Fact]
        public void SelfLoan_WithdrawUnusedCollateral()
        {
            var engine = new TestEngine(true);
            var loan = DeployConfigured(engine, 5 * GAS, 100 * GAS);
            var bob = TestEngine.GetNewSigner().Account;
            Fund(engine, bob, 30, 0);

            engine.SetTransactionSigners(bob);
            engine.Native.NEO.Transfer(bob, loan.Hash, 30, "selfloan:collateral");
            Assert.Equal(new BigInteger(30), loan.collateralCreditOf(bob));

            // Never borrowed -> reclaim the full 30 NEO.
            Assert.Equal(new BigInteger(30), loan.withdraw(bob));
            Assert.Equal(BigInteger.Zero, loan.collateralCreditOf(bob));
            Assert.Equal(new BigInteger(30), engine.Native.NEO.BalanceOf(bob));
        }

        [Fact]
        public void SelfLoan_OwnerOnlyGuards()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppSelfLoan");
            var loan = engine.Deploy<SelfLoanContract>(nef, manifest);

            var stranger = TestEngine.GetNewSigner().Account;
            Fund(engine, stranger, 0, 10 * GAS);
            engine.SetTransactionSigners(stranger);
            Assert.ThrowsAny<Exception>(() => loan.setNeoPrice(7 * GAS));
            Assert.ThrowsAny<Exception>(() => loan.withdrawPool(stranger, 1 * GAS));
        }

        [Fact]
        public void SelfLoan_AddCollateralGrowsLockedPosition()
        {
            var engine = new TestEngine(true);
            var loan = DeployConfigured(engine, 5 * GAS, 100 * GAS);
            var alice = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 100, 0);

            engine.SetTransactionSigners(alice);
            engine.Native.NEO.Transfer(alice, loan.Hash, 10, "selfloan:collateral");
            loan.borrow(alice, 1);
            Assert.Equal(new BigInteger(10), engine.Native.NEO.BalanceOf(loan.Hash));

            // Add 5 more NEO collateral to the open loan.
            engine.Native.NEO.Transfer(alice, loan.Hash, 5, "selfloan:collateral");
            loan.addCollateral(alice);
            Assert.Equal(new BigInteger(15), engine.Native.NEO.BalanceOf(loan.Hash));
            Assert.Equal(BigInteger.Zero, loan.collateralCreditOf(alice));
        }
    }
}
