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
    /// Binding for the PlatformDeFi lending-liquidation hardening (FixV). Method names
    /// mirror the on-chain manifest (camelCase).
    /// </summary>
    public abstract class PlatformDeFiLiqContract : SmartContract
    {
        protected PlatformDeFiLiqContract(SmartContractInitialize initialize) : base(initialize) { }

        public abstract UInt160 admin();
        public abstract void registerProduct(string appId, BigInteger productType, UInt160 appAdmin, byte[]? config);

        // Lending pricing + liquidity
        public abstract void setNeoGasPrice(string appId, BigInteger price);
        public abstract BigInteger? getNeoGasPrice(string appId);
        public abstract BigInteger? getLastPriceDropTime(string appId);
        public abstract void lendingDeposit(string appId, UInt160 funder, BigInteger amount);
        public abstract BigInteger? getLendingLiquidity(string appId);

        // Loans
        public abstract BigInteger? createLoan(string appId, UInt160 borrower, BigInteger ltvTier, BigInteger collateralAmount);
        public abstract void addCollateral(string appId, BigInteger loanId, BigInteger collateralAmount);
        public abstract void liquidateLoan(string appId, BigInteger loanId, UInt160 liquidator);
        public abstract bool? isLiquidatable(string appId, BigInteger loanId);

        // Credit (surplus collateral lands here)
        public abstract BigInteger? withdrawNeoCredit(string appId, UInt160 payer, BigInteger amount);
    }

    /// <summary>
    /// Regression coverage for FixV — PlatformDeFi lending-liquidation manipulation fixes:
    ///   HIGH (a) SetNeoGasPrice bounds: per-update deviation cap + minimum update interval.
    ///   HIGH (b) liquidation grace period after a price decrease.
    ///   MED      partial collateral seizure: surplus returned to the borrower's NEO credit.
    ///   LOW      CreateLoan rejects a zero-value loan up front.
    /// </summary>
    public class FixV_platformdefiliquidation_Tests
    {
        private const long GAS = 100000000;
        private const int Lending = 1;
        private const ulong HOUR_MS = 3_600_000UL;

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

        private static (PlatformDeFiLiqContract defi, UInt160 admin) Deploy(TestEngine engine)
        {
            var (nef, manifest) = Load("PlatformDeFi");
            engine.Fee = 5000L * 100000000;
            var defi = engine.Deploy<PlatformDeFiLiqContract>(nef, manifest);
            UInt160 admin = defi.admin();
            Assert.NotEqual(UInt160.Zero, admin);
            return (defi, admin);
        }

        // Lower the price by the maximum -20% step, respecting the min update interval.
        private static BigInteger DropPriceMax(TestEngine engine, PlatformDeFiLiqContract defi,
            UInt160 admin, string appId)
        {
            engine.PersistingBlock.Advance(TimeSpan.FromMilliseconds((long)HOUR_MS + 1000));
            engine.SetTransactionSigners(admin);
            BigInteger cur = defi.getNeoGasPrice(appId) ?? 0;
            BigInteger next = cur * 8000 / 10000; // -20%
            defi.setNeoGasPrice(appId, next);
            return next;
        }

        // ---- HIGH (a): SetNeoGasPrice deviation cap + min update interval -----------

        [Fact]
        public void SetNeoGasPrice_FirstSetUnbounded_ThenDeviationCapped()
        {
            var engine = new TestEngine(true);
            var (defi, admin) = Deploy(engine);

            engine.SetTransactionSigners(admin);
            defi.registerProduct("lend", Lending, admin, null);

            // First set is unrestricted (no prior price) — establishes the valuation.
            defi.setNeoGasPrice("lend", 5 * GAS);
            Assert.Equal(new BigInteger(5 * GAS), defi.getNeoGasPrice("lend"));

            // A >20% crash in one step is rejected even after the interval elapses.
            engine.PersistingBlock.Advance(TimeSpan.FromMilliseconds((long)HOUR_MS + 1000));
            engine.SetTransactionSigners(admin);
            Assert.ThrowsAny<Exception>(() => defi.setNeoGasPrice("lend", 1 * GAS)); // -80%
            Assert.Equal(new BigInteger(5 * GAS), defi.getNeoGasPrice("lend"));

            // A move within +/-20% is accepted.
            BigInteger ok = 5 * GAS - (5 * GAS * 2000 / 10000); // -20% exactly
            defi.setNeoGasPrice("lend", ok);
            Assert.Equal(ok, defi.getNeoGasPrice("lend"));
        }

        [Fact]
        public void SetNeoGasPrice_RejectsUpdatesFasterThanMinInterval()
        {
            var engine = new TestEngine(true);
            var (defi, admin) = Deploy(engine);

            engine.SetTransactionSigners(admin);
            defi.registerProduct("lend", Lending, admin, null);
            defi.setNeoGasPrice("lend", 5 * GAS);

            // Immediately attempting a second update (no time advanced) reverts.
            engine.SetTransactionSigners(admin);
            BigInteger small = 5 * GAS - (5 * GAS * 1000 / 10000); // -10%, within cap
            Assert.ThrowsAny<Exception>(() => defi.setNeoGasPrice("lend", small));

            // After the interval, the same update succeeds.
            engine.PersistingBlock.Advance(TimeSpan.FromMilliseconds((long)HOUR_MS + 1000));
            engine.SetTransactionSigners(admin);
            defi.setNeoGasPrice("lend", small);
            Assert.Equal(small, defi.getNeoGasPrice("lend"));
        }

        // ---- HIGH (b): liquidation grace period after a price drop ------------------

        [Fact]
        public void Liquidation_BlockedDuringGracePeriod_AllowedAfter()
        {
            var engine = new TestEngine(true);
            var (defi, admin) = Deploy(engine);

            engine.SetTransactionSigners(admin);
            defi.registerProduct("lend", Lending, admin, null);
            defi.setNeoGasPrice("lend", 5 * GAS);

            // Fund lending liquidity.
            FundGas(engine, admin, 300 * GAS);
            engine.SetTransactionSigners(admin);
            engine.Native.GAS.Transfer(admin, defi.Hash, 100 * GAS, "lend:credit");
            defi.lendingDeposit("lend", admin, 100 * GAS);

            // Borrower posts 10 NEO collateral, takes a tier3 (40%) loan = 20 GAS gross.
            var bob = TestEngine.GetNewSigner().Account;
            FundNeo(engine, bob, 50);
            engine.SetTransactionSigners(bob);
            engine.Native.NEO.Transfer(bob, defi.Hash, 10, "lend:credit");
            BigInteger loanId = defi.createLoan("lend", bob, 3, 10) ?? 0;
            Assert.True(loanId > 0);
            Assert.False(defi.isLiquidatable("lend", loanId)); // healthy at 5 GAS/NEO

            // Crash the price step-by-step (each step -20%, 1h apart) until liquidatable.
            // 5 -> 4 -> 3.2 -> 2.56 -> 2.048; at 2.048 value=20.48, *0.8=16.38 < 20 debt.
            for (int i = 0; i < 4; i++) DropPriceMax(engine, defi, admin, "lend");
            Assert.True(defi.isLiquidatable("lend", loanId));
            Assert.True((defi.getLastPriceDropTime("lend") ?? 0) > 0);

            // A liquidator with enough GAS credit still cannot act during the grace window.
            var keeper = TestEngine.GetNewSigner().Account;
            FundGas(engine, keeper, 100 * GAS);
            engine.SetTransactionSigners(keeper);
            engine.Native.GAS.Transfer(keeper, defi.Hash, 50 * GAS, "lend:credit");
            Assert.ThrowsAny<Exception>(() => defi.liquidateLoan("lend", loanId, keeper));

            // After the grace period elapses, liquidation succeeds.
            engine.PersistingBlock.Advance(TimeSpan.FromMilliseconds((long)HOUR_MS + 1000));
            engine.SetTransactionSigners(keeper);
            defi.liquidateLoan("lend", loanId, keeper);
            Assert.False(defi.isLiquidatable("lend", loanId)); // loan closed
        }

        // ---- MED: partial seizure returns surplus collateral to the borrower -------

        [Fact]
        public void Liquidation_ReturnsSurplusCollateralToBorrower()
        {
            var engine = new TestEngine(true);
            var (defi, admin) = Deploy(engine);

            engine.SetTransactionSigners(admin);
            defi.registerProduct("lend", Lending, admin, null);
            defi.setNeoGasPrice("lend", 5 * GAS);

            FundGas(engine, admin, 300 * GAS);
            engine.SetTransactionSigners(admin);
            engine.Native.GAS.Transfer(admin, defi.Hash, 100 * GAS, "lend:credit");
            defi.lendingDeposit("lend", admin, 100 * GAS);

            // Borrower posts 10 NEO, tier3 loan = 20 GAS gross debt.
            var bob = TestEngine.GetNewSigner().Account;
            FundNeo(engine, bob, 50);
            engine.SetTransactionSigners(bob);
            engine.Native.NEO.Transfer(bob, defi.Hash, 10, "lend:credit");
            BigInteger loanId = defi.createLoan("lend", bob, 3, 10) ?? 0;

            // Drive price down to 2.048 GAS/NEO (liquidatable), wait out grace.
            for (int i = 0; i < 4; i++) DropPriceMax(engine, defi, admin, "lend");
            engine.PersistingBlock.Advance(TimeSpan.FromMilliseconds((long)HOUR_MS + 1000));
            BigInteger price = defi.getNeoGasPrice("lend") ?? 0; // 2.048 GAS

            var keeper = TestEngine.GetNewSigner().Account;
            FundGas(engine, keeper, 100 * GAS);
            engine.SetTransactionSigners(keeper);
            engine.Native.GAS.Transfer(keeper, defi.Hash, 50 * GAS, "lend:credit");

            BigInteger keeperNeoBefore = engine.Native.NEO.BalanceOf(keeper) ?? 0;

            engine.SetTransactionSigners(keeper);
            defi.liquidateLoan("lend", loanId, keeper);

            // debt = 20 GAS; cover = 20 * 1.1 = 22 GAS worth of NEO at 2.048 GAS/NEO
            //   => ceil(22e8 / 2.048e8) = ceil(10.74) = 11 NEO, capped at 10 collateral.
            // Collateral (10) < cover target (11) => keeper takes all 10, surplus = 0.
            BigInteger keeperSeized = (engine.Native.NEO.BalanceOf(keeper) ?? 0) - keeperNeoBefore;
            Assert.Equal(new BigInteger(10), keeperSeized);

            // Borrower has no surplus credit to withdraw in this fully-underwater case.
            engine.SetTransactionSigners(bob);
            Assert.ThrowsAny<Exception>(() => defi.withdrawNeoCredit("lend", bob, 1));
        }

        [Fact]
        public void Liquidation_OverCollateralized_SurplusReturned()
        {
            // Construct a loan that is liquidatable yet still over-collateralized relative
            // to debt + bonus, proving the surplus collateral is returned (not confiscated).
            var engine = new TestEngine(true);
            var (defi, admin) = Deploy(engine);

            engine.SetTransactionSigners(admin);
            defi.registerProduct("lend", Lending, admin, null);
            defi.setNeoGasPrice("lend", 5 * GAS);

            FundGas(engine, admin, 600 * GAS);
            engine.SetTransactionSigners(admin);
            engine.Native.GAS.Transfer(admin, defi.Hash, 200 * GAS, "lend:credit");
            defi.lendingDeposit("lend", admin, 200 * GAS);

            // Deposit 110 NEO; create a tier1 (20%) loan against 100 NEO (value 500 GAS ->
            // 100 GAS gross debt), leaving 10 NEO credit for a later top-up.
            var bob = TestEngine.GetNewSigner().Account;
            FundNeo(engine, bob, 200);
            engine.SetTransactionSigners(bob);
            engine.Native.NEO.Transfer(bob, defi.Hash, 110, "lend:credit");
            BigInteger loanId = defi.createLoan("lend", bob, 1, 100) ?? 0;
            Assert.True(loanId > 0);

            // Crash price across 7 -20% steps to ~1.048576 GAS/NEO. At 100 NEO the loan is
            // liquidatable but the collateral barely covers debt+bonus. Top up 10 NEO so the
            // collateral value lands ABOVE debt+bonus, producing a real surplus to return.
            for (int i = 0; i < 7; i++) DropPriceMax(engine, defi, admin, "lend");
            engine.SetTransactionSigners(bob);
            defi.addCollateral("lend", loanId, 10); // total collateral now 110 NEO
            Assert.True(defi.isLiquidatable("lend", loanId));
            engine.PersistingBlock.Advance(TimeSpan.FromMilliseconds((long)HOUR_MS + 1000));

            BigInteger price = defi.getNeoGasPrice("lend") ?? 0; // ~1.048576 GAS
            BigInteger totalCollateral = 110;

            var keeper = TestEngine.GetNewSigner().Account;
            FundGas(engine, keeper, 300 * GAS);
            engine.SetTransactionSigners(keeper);
            engine.Native.GAS.Transfer(keeper, defi.Hash, 150 * GAS, "lend:credit");

            BigInteger keeperNeoBefore = engine.Native.NEO.BalanceOf(keeper) ?? 0;
            engine.SetTransactionSigners(keeper);
            defi.liquidateLoan("lend", loanId, keeper);

            // cover = debt(100 GAS) * 1.1 = 110 GAS; seize = ceil(110e8 / price) NEO.
            BigInteger cover = (100 * GAS) * 11000 / 10000;
            BigInteger expectedSeize = (cover + price - 1) / price;
            Assert.True(expectedSeize < totalCollateral, "expected a real surplus");
            BigInteger expectedSurplus = totalCollateral - expectedSeize;

            BigInteger keeperSeized = (engine.Native.NEO.BalanceOf(keeper) ?? 0) - keeperNeoBefore;
            Assert.Equal(expectedSeize, keeperSeized);

            // Surplus NEO was credited to the borrower; withdrawing exactly it succeeds,
            // one more reverts.
            engine.SetTransactionSigners(bob);
            BigInteger bobNeoBefore = engine.Native.NEO.BalanceOf(bob) ?? 0;
            Assert.Equal(expectedSurplus, defi.withdrawNeoCredit("lend", bob, expectedSurplus));
            Assert.Equal(bobNeoBefore + expectedSurplus, engine.Native.NEO.BalanceOf(bob));
            engine.SetTransactionSigners(bob);
            Assert.ThrowsAny<Exception>(() => defi.withdrawNeoCredit("lend", bob, 1));
        }

        // ---- LOW: CreateLoan rejects a zero-value loan -----------------------------

        [Fact]
        public void CreateLoan_RejectsZeroValueLoan()
        {
            var engine = new TestEngine(true);
            var (defi, admin) = Deploy(engine);

            engine.SetTransactionSigners(admin);
            defi.registerProduct("lend", Lending, admin, null);

            // Price so low that 1 NEO * price * 20% rounds to 0 GAS base units.
            // 1 NEO * 4 base-units * 20% = 0.8 -> floors to 0.
            defi.setNeoGasPrice("lend", 4);

            FundGas(engine, admin, 50 * GAS);
            engine.SetTransactionSigners(admin);
            engine.Native.GAS.Transfer(admin, defi.Hash, 10 * GAS, "lend:credit");
            defi.lendingDeposit("lend", admin, 10 * GAS);

            var bob = TestEngine.GetNewSigner().Account;
            FundNeo(engine, bob, 10);
            engine.SetTransactionSigners(bob);
            engine.Native.NEO.Transfer(bob, defi.Hash, 1, "lend:credit");

            // loanAmount = 1 * 4 * 2000 / 10000 = 0 -> rejected up front.
            Assert.ThrowsAny<Exception>(() => defi.createLoan("lend", bob, 1, 1));
        }
    }
}
