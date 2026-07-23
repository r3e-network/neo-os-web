using System;
using System.IO;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Manifest;
using Neo.SmartContract.Testing;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    /// <summary>
    /// Binding for PlatformDeFi used by the A9 / A10 / A12 fund-safety regression
    /// tests. Method names mirror the on-chain manifest (camelCase).
    /// </summary>
    public abstract class PlatformDeFiFixContract : SmartContract
    {
        protected PlatformDeFiFixContract(SmartContractInitialize initialize) : base(initialize) { }

        public abstract UInt160 admin();
        public abstract void registerProduct(string appId, BigInteger productType, UInt160 appAdmin, byte[]? config);
        public abstract void onNEP17Payment(UInt160 from, BigInteger amount, object? data);

        // Lending
        public abstract void setNeoGasPrice(string appId, BigInteger price);
        public abstract void lendingDeposit(string appId, UInt160 funder, BigInteger amount);
        public abstract BigInteger? getLendingLiquidity(string appId);
        public abstract BigInteger? createLoan(string appId, UInt160 borrower, BigInteger ltvTier, BigInteger collateralAmount);
        public abstract void repayLoan(string appId, BigInteger loanId);
        public abstract void withdrawLendingLiquidity(string appId, UInt160 to, BigInteger amount);
        public abstract BigInteger? getTotalLendingFees(string appId);
        public abstract void withdrawLendingFees(string appId, UInt160 to);

        // FlashLoan
        public abstract void flashDeposit(string appId, UInt160 depositor, BigInteger amount);
        public abstract BigInteger? getFlashTotalLpDeposits(string appId);

        // Capsule
        public abstract BigInteger? createCapsule(string appId, UInt160 owner, BigInteger lockDays, BigInteger principalAmount);
        public abstract void fundCapsuleYieldReserve(string appId, UInt160 funder, BigInteger amount);
        public abstract BigInteger? getCapsuleYieldReserve(string appId);
        public abstract void withdrawCapsuleYieldReserve(string appId, UInt160 to, BigInteger amount);
    }

    /// <summary>
    /// Regression coverage for the PlatformDeFi fund-safety fixes:
    ///   A10 - per-product GAS segregation (lending / capsule never spend FlashLoan LP GAS).
    ///   A12 - lending CreateLoan requires backing liquidity, decremented on disbursement.
    ///   A9  - capsule compound yield is paid only from an app-funded GAS reserve.
    /// </summary>
    public class Fix_platformdefi_Tests
    {
        private const long GAS = 100000000; // 1 GAS base units
        private const int Lending = 1;
        private const int FlashLoan = 2;
        private const int Capsule = 3;

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

        private static void FundNeo(TestEngine engine, UInt160 to, BigInteger neo)
        {
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            engine.Native.NEO.Transfer(engine.ValidatorsAddress, to, neo, null);
        }

        private static void FundGas(TestEngine engine, UInt160 to, BigInteger gas)
        {
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            engine.Native.GAS.Transfer(engine.ValidatorsAddress, to, gas, null);
        }

        // Deploy and capture the admin (the deploying tx sender).
        private static (PlatformDeFiFixContract defi, UInt160 admin) Deploy(TestEngine engine)
        {
            var (nef, manifest) = Load("PlatformDeFi");
            // PlatformDeFi is a large multi-product contract; raise the system-fee
            // ceiling so the deployment is not rejected with "Insufficient GAS".
            engine.Fee = 5000L * 100000000;
            // Deploy with the engine's default (genesis-funded) signer; PlatformDeFi
            // records the deploying tx Sender as platform admin.
            var defi = engine.Deploy<PlatformDeFiFixContract>(nef, manifest);
            UInt160 admin = defi.admin();
            Assert.NotEqual(UInt160.Zero, admin);
            return (defi, admin);
        }

        // ---- A10 / A12 : lending requires backing liquidity --------------------

        [Fact]
        public void Lending_CreateLoanRequiresFundedLiquidity_RevertsWhenEmpty()
        {
            var engine = new TestEngine(true);
            var (defi, admin) = Deploy(engine);

            engine.SetTransactionSigners(admin);
            defi.registerProduct("app-lend", Lending, admin, null);
            defi.setNeoGasPrice("app-lend", 5 * GAS); // 5 GAS per NEO

            // Borrower deposits NEO collateral but NO lending liquidity has been funded.
            var alice = TestEngine.GetNewSigner().Account;
            FundNeo(engine, alice, 100);
            engine.SetTransactionSigners(alice);
            engine.Native.NEO.Transfer(alice, defi.Hash, 10, "app-lend:credit");

            Assert.Equal(BigInteger.Zero, defi.getLendingLiquidity("app-lend"));

            // tier1 = 20% of (10 NEO * 5 GAS) = 10 GAS gross loan, no liquidity funded.
            Assert.ThrowsAny<Exception>(() => defi.createLoan("app-lend", alice, 1, 10));
        }

        [Fact]
        public void Lending_DisbursementDecrementsLiquidity_RepayRefillsIt()
        {
            var engine = new TestEngine(true);
            var (defi, admin) = Deploy(engine);

            engine.SetTransactionSigners(admin);
            defi.registerProduct("app-lend", Lending, admin, null);
            defi.setNeoGasPrice("app-lend", 5 * GAS);

            // Admin funds the lending GAS pool with 100 GAS.
            FundGas(engine, admin, 200 * GAS);
            engine.SetTransactionSigners(admin);
            engine.Native.GAS.Transfer(admin, defi.Hash, 100 * GAS, "app-lend:credit");
            defi.lendingDeposit("app-lend", admin, 100 * GAS);
            Assert.Equal(new BigInteger(100 * GAS), defi.getLendingLiquidity("app-lend"));

            var alice = TestEngine.GetNewSigner().Account;
            FundNeo(engine, alice, 100);
            engine.SetTransactionSigners(alice);
            engine.Native.NEO.Transfer(alice, defi.Hash, 10, "app-lend:credit");

            BigInteger grossLoan = 10 * GAS;            // 20% of 50 GAS
            BigInteger fee = grossLoan * 50 / 10000;    // 0.5%
            BigInteger net = grossLoan - fee;

            BigInteger aliceGasBefore = engine.Native.GAS.BalanceOf(alice) ?? 0;
            BigInteger loanId = defi.createLoan("app-lend", alice, 1, 10) ?? 0;
            Assert.True(loanId > 0);

            // Lending liquidity excludes the retained fee because that amount is
            // separately withdrawable protocol revenue.
            BigInteger expectedLiquidity = 100 * GAS - grossLoan;
            Assert.Equal(expectedLiquidity, defi.getLendingLiquidity("app-lend"));
            Assert.Equal(aliceGasBefore + net, engine.Native.GAS.BalanceOf(alice));
            Assert.Equal(fee, defi.getTotalLendingFees("app-lend"));

            // Repay full gross debt (10 GAS) -> liquidity refilled by the repaid GAS.
            // Fund alice with enough GAS to cover the gross debt (she only received net).
            FundGas(engine, alice, grossLoan);
            engine.SetTransactionSigners(alice);
            engine.Native.GAS.Transfer(alice, defi.Hash, grossLoan, "app-lend:credit");
            defi.repayLoan("app-lend", loanId);
            Assert.Equal(expectedLiquidity + grossLoan, defi.getLendingLiquidity("app-lend"));
        }

        [Fact]
        public void Lending_FeeSweepCannotLeaveLiquidityOverstated()
        {
            var engine = new TestEngine(true);
            var (defi, admin) = Deploy(engine);

            engine.SetTransactionSigners(admin);
            defi.registerProduct("app-lend", Lending, admin, null);
            defi.setNeoGasPrice("app-lend", 5 * GAS);

            FundGas(engine, admin, 200 * GAS);
            engine.SetTransactionSigners(admin);
            engine.Native.GAS.Transfer(admin, defi.Hash, 100 * GAS, "app-lend:credit");
            defi.lendingDeposit("app-lend", admin, 100 * GAS);

            var alice = TestEngine.GetNewSigner().Account;
            FundNeo(engine, alice, 100);
            engine.SetTransactionSigners(alice);
            engine.Native.NEO.Transfer(alice, defi.Hash, 10, "app-lend:credit");

            BigInteger grossLoan = 10 * GAS;
            BigInteger fee = grossLoan * 50 / 10000;
            defi.createLoan("app-lend", alice, 1, 10);

            Assert.Equal(new BigInteger(90 * GAS), defi.getLendingLiquidity("app-lend"));
            Assert.Equal(fee, defi.getTotalLendingFees("app-lend"));

            engine.SetTransactionSigners(admin);
            BigInteger before = engine.Native.GAS.BalanceOf(admin) ?? 0;
            defi.withdrawLendingFees("app-lend", admin);

            Assert.Equal(before + fee, engine.Native.GAS.BalanceOf(admin));
            Assert.Equal(BigInteger.Zero, defi.getTotalLendingFees("app-lend"));
            Assert.Equal(new BigInteger(90 * GAS), defi.getLendingLiquidity("app-lend"));
            Assert.ThrowsAny<Exception>(() =>
                defi.withdrawLendingLiquidity("app-lend", admin, 90 * GAS + 1));
        }

        [Fact]
        public void Lending_CannotSpendFlashLoanLpGas()
        {
            // A10: a FlashLoan LP funds the SAME contract; lending must not be able
            // to disburse against that LP's GAS. With zero lending liquidity the loan
            // reverts even though the contract physically holds the LP's GAS.
            var engine = new TestEngine(true);
            var (defi, admin) = Deploy(engine);

            engine.SetTransactionSigners(admin);
            defi.registerProduct("flash", FlashLoan, admin, null);
            defi.registerProduct("lend", Lending, admin, null);
            defi.setNeoGasPrice("lend", 5 * GAS);

            // LP deposits 50 GAS of flash-loan liquidity.
            var lp = TestEngine.GetNewSigner().Account;
            FundGas(engine, lp, 60 * GAS);
            engine.SetTransactionSigners(lp);
            engine.Native.GAS.Transfer(lp, defi.Hash, 50 * GAS, "flash:credit");
            defi.flashDeposit("flash", lp, 50 * GAS);
            Assert.Equal(new BigInteger(50 * GAS), defi.getFlashTotalLpDeposits("flash"));

            // Borrower posts NEO collateral on the lending app (no lending liquidity).
            var bob = TestEngine.GetNewSigner().Account;
            FundNeo(engine, bob, 100);
            engine.SetTransactionSigners(bob);
            engine.Native.NEO.Transfer(bob, defi.Hash, 10, "lend:credit");

            // Contract holds 50 GAS (the LP's), but lending liquidity is 0 -> revert.
            Assert.Equal(BigInteger.Zero, defi.getLendingLiquidity("lend"));
            Assert.ThrowsAny<Exception>(() => defi.createLoan("lend", bob, 1, 10));

            // The LP's principal is untouched.
            Assert.Equal(new BigInteger(50 * GAS), defi.getFlashTotalLpDeposits("flash"));
        }

        // ---- A9 / A10 : capsule compound yield must be funded ------------------

        [Fact]
        public void Capsule_YieldReserveFundingAndBoundedWithdrawal()
        {
            // A9 / A10: the reserve is a segregated, app-funded GAS pool. Funding
            // increases it; an admin withdrawal is bounded by the tracked counter so
            // it can never pull GAS belonging to other products.
            var engine = new TestEngine(true);
            var (defi, admin) = Deploy(engine);

            engine.SetTransactionSigners(admin);
            defi.registerProduct("vault", Capsule, admin, null);

            FundGas(engine, admin, 30 * GAS);
            engine.SetTransactionSigners(admin);
            engine.Native.GAS.Transfer(admin, defi.Hash, 20 * GAS, "vault:credit");
            defi.fundCapsuleYieldReserve("vault", admin, 20 * GAS);
            Assert.Equal(new BigInteger(20 * GAS), defi.getCapsuleYieldReserve("vault"));

            // Admin can reclaim up to the funded amount.
            defi.withdrawCapsuleYieldReserve("vault", admin, 5 * GAS);
            Assert.Equal(new BigInteger(15 * GAS), defi.getCapsuleYieldReserve("vault"));

            // Withdrawing beyond the tracked reserve reverts (bounded by the counter).
            Assert.ThrowsAny<Exception>(() =>
                defi.withdrawCapsuleYieldReserve("vault", admin, 100 * GAS));
            Assert.Equal(new BigInteger(15 * GAS), defi.getCapsuleYieldReserve("vault"));
        }

        [Fact]
        public void Capsule_ReserveStartsEmptyAndWithdrawRevertsWhenUnfunded()
        {
            // A9: a freshly-registered capsule app has a ZERO yield reserve, so there
            // is no GAS earmarked to pay compound. Any reserve withdrawal reverts,
            // proving the reserve is the only source compound payouts can draw from.
            var engine = new TestEngine(true);
            var (defi, admin) = Deploy(engine);

            engine.SetTransactionSigners(admin);
            defi.registerProduct("vault", Capsule, admin, null);
            Assert.Equal(BigInteger.Zero, defi.getCapsuleYieldReserve("vault"));

            Assert.ThrowsAny<Exception>(() =>
                defi.withdrawCapsuleYieldReserve("vault", admin, 1));
        }

        [Fact]
        public void Lending_WithdrawLiquidityBoundedByCounter()
        {
            var engine = new TestEngine(true);
            var (defi, admin) = Deploy(engine);

            engine.SetTransactionSigners(admin);
            defi.registerProduct("lend", Lending, admin, null);

            FundGas(engine, admin, 30 * GAS);
            engine.SetTransactionSigners(admin);
            engine.Native.GAS.Transfer(admin, defi.Hash, 10 * GAS, "lend:credit");
            defi.lendingDeposit("lend", admin, 10 * GAS);
            Assert.Equal(new BigInteger(10 * GAS), defi.getLendingLiquidity("lend"));

            // Over-withdraw reverts; counter unchanged.
            Assert.ThrowsAny<Exception>(() =>
                defi.withdrawLendingLiquidity("lend", admin, 50 * GAS));
            Assert.Equal(new BigInteger(10 * GAS), defi.getLendingLiquidity("lend"));

            // Exact withdraw succeeds and zeroes the counter.
            defi.withdrawLendingLiquidity("lend", admin, 10 * GAS);
            Assert.Equal(BigInteger.Zero, defi.getLendingLiquidity("lend"));
        }
    }
}
