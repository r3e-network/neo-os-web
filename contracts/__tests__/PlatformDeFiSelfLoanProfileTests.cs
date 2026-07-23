using System;
using System.IO;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Manifest;
using Neo.SmartContract.Testing;
using Neo.VM.Types;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public abstract class PlatformDeFiSelfLoanContract : SmartContract
    {
        protected PlatformDeFiSelfLoanContract(SmartContractInitialize initialize) : base(initialize) { }

        public abstract UInt160 admin();
        public abstract void registerProduct(string appId, BigInteger productType, UInt160 appAdmin, byte[]? config);
        public abstract BigInteger? getLendingProfile(string appId);
        public abstract BigInteger? getActiveLoanId(string appId, UInt160 borrower);
        public abstract Map? getSingleLoanPosition(string appId, UInt160 borrower);
        public abstract void setNeoGasPrice(string appId, BigInteger price);
        public abstract void lendingDeposit(string appId, UInt160 funder, BigInteger amount);
        public abstract BigInteger? createLoan(string appId, UInt160 borrower, BigInteger ltvTier, BigInteger collateralAmount);
        public abstract void repayLoan(string appId, BigInteger loanId);
        public abstract void abandonLoan(string appId, BigInteger loanId);
        public abstract void liquidateLoan(string appId, BigInteger loanId, UInt160 liquidator);
        public abstract bool? isLiquidatable(string appId, BigInteger loanId);
    }

    public class PlatformDeFiSelfLoanProfileTests
    {
        private const long GAS = 100_000_000;
        private const string AppId = "miniapp-self-loan";

        private static readonly string BuildDir = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "build"));

        private static (NefFile nef, ContractManifest manifest) Load()
        {
            string nefPath = Path.Combine(BuildDir, "PlatformDeFi.nef");
            string manifestPath = Path.Combine(BuildDir, "PlatformDeFi.manifest.json");
            Assert.True(File.Exists(nefPath), $"NEF missing: {nefPath}");
            return (
                NefFile.Parse(File.ReadAllBytes(nefPath)),
                ContractManifest.Parse(File.ReadAllText(manifestPath)));
        }

        private static void FundNeo(TestEngine engine, UInt160 account, BigInteger amount)
        {
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            engine.Native.NEO.Transfer(engine.ValidatorsAddress, account, amount, null);
        }

        private static void FundGas(TestEngine engine, UInt160 account, BigInteger amount)
        {
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            engine.Native.GAS.Transfer(engine.ValidatorsAddress, account, amount, null);
        }

        [Fact]
        public void SelfLoanProfileEnforcesSinglePositionAndDisablesForcedExit()
        {
            var engine = new TestEngine(true);
            engine.Fee = 5_000L * GAS;
            var (nef, manifest) = Load();
            var defi = engine.Deploy<PlatformDeFiSelfLoanContract>(nef, manifest);
            UInt160 admin = defi.admin();
            var borrower = TestEngine.GetNewSigner().Account;
            var liquidator = TestEngine.GetNewSigner().Account;

            engine.SetTransactionSigners(admin);
            defi.registerProduct(AppId, 1, admin, new byte[] { 1 });
            defi.setNeoGasPrice(AppId, 5 * GAS);
            Assert.Equal(BigInteger.One, defi.getLendingProfile(AppId));

            FundGas(engine, admin, 200 * GAS);
            engine.SetTransactionSigners(admin);
            engine.Native.GAS.Transfer(admin, defi.Hash, 100 * GAS, AppId + ":credit");
            defi.lendingDeposit(AppId, admin, 100 * GAS);

            FundNeo(engine, borrower, 30);
            engine.SetTransactionSigners(borrower);
            engine.Native.NEO.Transfer(borrower, defi.Hash, 20, AppId + ":credit");
            BigInteger loanId = defi.createLoan(AppId, borrower, 1, 10) ?? 0;
            Assert.Equal(BigInteger.One, loanId);
            Assert.Equal(loanId, defi.getActiveLoanId(AppId, borrower));

            Map position = defi.getSingleLoanPosition(AppId, borrower)!;
            Assert.Equal(
                loanId,
                position[(PrimitiveType)"loanId"].GetInteger());
            Assert.Equal(
                new BigInteger(10),
                position[(PrimitiveType)"collateral"].GetInteger());
            Assert.Equal(
                new BigInteger(10 * GAS),
                position[(PrimitiveType)"borrowed"].GetInteger());
            Assert.True(position[(PrimitiveType)"active"].GetBoolean());

            Assert.ThrowsAny<Exception>(() =>
                defi.createLoan(AppId, borrower, 1, 10));
            Assert.False(defi.isLiquidatable(AppId, loanId));
            Assert.ThrowsAny<Exception>(() => defi.abandonLoan(AppId, loanId));

            FundGas(engine, liquidator, 20 * GAS);
            engine.SetTransactionSigners(liquidator);
            engine.Native.GAS.Transfer(liquidator, defi.Hash, 10 * GAS, AppId + ":credit");
            Assert.ThrowsAny<Exception>(() =>
                defi.liquidateLoan(AppId, loanId, liquidator));

            FundGas(engine, borrower, 20 * GAS);
            engine.SetTransactionSigners(borrower);
            engine.Native.GAS.Transfer(borrower, defi.Hash, 10 * GAS, AppId + ":credit");
            defi.repayLoan(AppId, loanId);
            Assert.Equal(BigInteger.Zero, defi.getActiveLoanId(AppId, borrower));

            engine.Native.NEO.Transfer(borrower, defi.Hash, 10, AppId + ":credit");
            Assert.Equal(new BigInteger(2), defi.createLoan(AppId, borrower, 1, 10));
        }
    }
}
