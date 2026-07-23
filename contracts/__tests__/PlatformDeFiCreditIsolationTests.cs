using System.Numerics;
using Neo;
using Neo.SmartContract.Testing;
using Xunit;
using static NeoMiniAppPlatform.Contracts.Tests.RegistryHarness;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public abstract class PlatformDeFiCreditContract : SmartContract
    {
        protected PlatformDeFiCreditContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract void registerProduct(string appId, BigInteger productType, UInt160 appAdmin, byte[]? config);
        public abstract void setAppPaused(string appId, bool paused);
        public abstract void onNEP17Payment(UInt160 from, BigInteger amount, object data);
        public abstract BigInteger? getDirectNeoCredit(string appId, UInt160 payer);
        public abstract BigInteger? neoCreditLiabilityOf(string appId);
        public abstract BigInteger? totalNeoCreditLiability();
        public abstract BigInteger? getDirectGasCredit(string appId, UInt160 payer);
        public abstract BigInteger? gasCreditLiabilityOf(string appId);
        public abstract BigInteger? totalGasCreditLiability();
        public abstract BigInteger? withdrawNeoCredit(string appId, UInt160 payer, BigInteger amount);
        public abstract BigInteger? withdrawGasCredit(string appId, UInt160 payer, BigInteger amount);
        public abstract void lendingDeposit(string appId, UInt160 funder, BigInteger amount);
        public abstract BigInteger? createLoan(string appId, UInt160 borrower, BigInteger ltvTier, BigInteger collateralAmount);
        public abstract BigInteger? createCapsule(string appId, UInt160 owner, BigInteger lockDays, BigInteger principalAmount);
        public abstract void earlyWithdraw(string appId, BigInteger capsuleId);
    }

    public class PlatformDeFiCreditIsolationTests
    {
        private const string LendingA = "lending-a";
        private const string LendingB = "lending-b";
        private const string CapsuleA = "capsule-a";
        private const string CapsuleB = "capsule-b";

        private sealed class World
        {
            public TestEngine Engine = null!;
            public PlatformDeFiCreditContract DeFi = null!;
            public UInt160 Alice = null!;
        }

        private static World Setup()
        {
            var engine = new TestEngine(true);
            engine.Fee = 2_000L * GAS_UNIT;
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            var (nef, manifest) = Load("PlatformDeFi");
            var defi = engine.Deploy<PlatformDeFiCreditContract>(nef, manifest);
            var alice = TestEngine.GetNewSigner().Account;
            defi.registerProduct(LendingA, 1, alice, null);
            defi.registerProduct(LendingB, 1, alice, null);
            defi.registerProduct(CapsuleA, 3, alice, null);
            defi.registerProduct(CapsuleB, 3, alice, null);
            engine.Native.GAS.Transfer(engine.ValidatorsAddress, alice, 50 * GAS_UNIT, null);
            engine.Native.NEO.Transfer(engine.ValidatorsAddress, alice, 100, null);
            return new World { Engine = engine, DeFi = defi, Alice = alice };
        }

        private static void DepositGas(World world, string appId, BigInteger amount)
        {
            world.Engine.SetTransactionSigners(world.Alice);
            Assert.True(world.Engine.Native.GAS.Transfer(
                world.Alice,
                world.DeFi.Hash,
                amount,
                appId + ":credit") == true);
        }

        private static void DepositNeo(World world, string appId, BigInteger amount)
        {
            world.Engine.SetTransactionSigners(world.Alice);
            Assert.True(world.Engine.Native.NEO.Transfer(
                world.Alice,
                world.DeFi.Hash,
                amount,
                appId + ":credit") == true);
        }

        [Fact]
        public void GasCredit_IsolatedByTenantAndPauseDoesNotTrapWithdrawals()
        {
            World world = Setup();
            DepositGas(world, LendingA, 2 * GAS_UNIT);
            DepositGas(world, LendingB, 3 * GAS_UNIT);

            Assert.Equal(new BigInteger(2 * GAS_UNIT), world.DeFi.getDirectGasCredit(LendingA, world.Alice));
            Assert.Equal(new BigInteger(3 * GAS_UNIT), world.DeFi.getDirectGasCredit(LendingB, world.Alice));
            Assert.Equal(new BigInteger(2 * GAS_UNIT), world.DeFi.gasCreditLiabilityOf(LendingA));
            Assert.Equal(new BigInteger(3 * GAS_UNIT), world.DeFi.gasCreditLiabilityOf(LendingB));
            Assert.Equal(new BigInteger(5 * GAS_UNIT), world.DeFi.totalGasCreditLiability());

            world.Engine.SetTransactionSigners(world.Alice);
            world.DeFi.setAppPaused(LendingA, true);
            Assert.Equal(new BigInteger(GAS_UNIT), world.DeFi.withdrawGasCredit(
                LendingA,
                world.Alice,
                GAS_UNIT));
            Assert.Equal(new BigInteger(GAS_UNIT), world.DeFi.getDirectGasCredit(LendingA, world.Alice));
            Assert.Equal(new BigInteger(3 * GAS_UNIT), world.DeFi.getDirectGasCredit(LendingB, world.Alice));
            Assert.Equal(new BigInteger(4 * GAS_UNIT), world.DeFi.totalGasCreditLiability());
        }

        [Fact]
        public void LendingPayout_PreservesAnotherTenantGasLiability()
        {
            World world = Setup();
            DepositGas(world, LendingA, 10 * GAS_UNIT);
            world.Engine.SetTransactionSigners(world.Alice);
            world.DeFi.lendingDeposit(LendingA, world.Alice, 10 * GAS_UNIT);
            DepositGas(world, LendingB, 3 * GAS_UNIT);
            DepositNeo(world, LendingA, 10);

            world.Engine.SetTransactionSigners(world.Alice);
            Assert.Equal(BigInteger.One, world.DeFi.createLoan(LendingA, world.Alice, 1, 10));

            Assert.Equal(BigInteger.Zero, world.DeFi.getDirectGasCredit(LendingA, world.Alice));
            Assert.Equal(new BigInteger(3 * GAS_UNIT), world.DeFi.getDirectGasCredit(LendingB, world.Alice));
            Assert.Equal(new BigInteger(3 * GAS_UNIT), world.DeFi.totalGasCreditLiability());
            Assert.True(
                world.Engine.Native.GAS.BalanceOf(world.DeFi.Hash) >=
                world.DeFi.totalGasCreditLiability());
        }

        [Fact]
        public void CapsulePayout_PreservesAnotherTenantNeoLiability()
        {
            World world = Setup();
            DepositNeo(world, CapsuleA, 20);
            DepositNeo(world, CapsuleB, 2);

            world.Engine.SetTransactionSigners(world.Alice);
            Assert.Equal(BigInteger.One, world.DeFi.createCapsule(CapsuleA, world.Alice, 7, 20));
            world.DeFi.earlyWithdraw(CapsuleA, BigInteger.One);

            Assert.Equal(BigInteger.Zero, world.DeFi.getDirectNeoCredit(CapsuleA, world.Alice));
            Assert.Equal(new BigInteger(2), world.DeFi.getDirectNeoCredit(CapsuleB, world.Alice));
            Assert.Equal(new BigInteger(2), world.DeFi.neoCreditLiabilityOf(CapsuleB));
            Assert.Equal(new BigInteger(2), world.DeFi.totalNeoCreditLiability());
            Assert.Equal(new BigInteger(3), world.Engine.Native.NEO.BalanceOf(world.DeFi.Hash));
        }

        [Fact]
        public void DirectCallsCannotForgeTokenCredit()
        {
            World world = Setup();
            world.Engine.SetTransactionSigners(world.Alice);
            AssertRevert(
                "unsupported asset",
                () => world.DeFi.onNEP17Payment(world.Alice, GAS_UNIT, LendingA + ":credit"));
            Assert.Equal(BigInteger.Zero, world.DeFi.totalGasCreditLiability());
            Assert.Equal(BigInteger.Zero, world.DeFi.totalNeoCreditLiability());
        }
    }
}
