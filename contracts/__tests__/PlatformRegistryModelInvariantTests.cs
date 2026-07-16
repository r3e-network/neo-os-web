using System;
using Neo;
using Xunit;
using static NeoMiniAppPlatform.Contracts.Tests.RegistryHarness;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    /// <summary>
    /// Differential model-based invariant suite for the PlatformRegistry
    /// money flows. Unlike a self-referential pure-C# model check (which can
    /// never expose a NEF accounting bug), this drives a REAL TestEngine-
    /// deployed PlatformRegistry: every randomized register/credit/mint/
    /// receive/fund/spend/withdraw action is applied on chain AND mirrored
    /// into an independent C# oracle, and after every step the driver asserts
    /// the contract's on-chain reads agree with the oracle and the §8-DoD
    /// solvency identity holds:
    ///   - GAS.BalanceOf(registry) == totalCreditLiability() + accruedFees()
    ///   - creditOf(app,payer) == oracle per-(app,payer) credit
    ///   - GAS.BalanceOf(account) == received - pool-funded - paid-out
    ///   - engine poolCreditOf(app) == sum of that app's fundEnginePool
    ///   - the transit lock is never stuck set between transactions.
    /// The oracle re-derives every quantity from first principles, so any
    /// single perturbed contract accounting write is caught on the next step
    /// (perturbation evidence recorded in the stage report).
    /// </summary>
    public class PlatformRegistryModelInvariantTests
    {
        [Fact]
        public void RandomizedSequencesKeepTheNefLedgerConsistentWithTheOracle()
        {
            var world = new RegistryDifferentialWorld(apps: 3, payers: 3);
            var random = new Random(0x1E9157);

            world.AssertConsistent();

            for (int step = 0; step < 220; step++)
            {
                string app = world.Apps[random.Next(world.Apps.Length)];
                UInt160 payer = world.Payers[random.Next(world.Payers.Length)];

                switch (random.Next(7))
                {
                    case 0:
                        world.Deposit(app, payer, random.Next(1, 30) * GAS_UNIT);
                        break;
                    case 1:
                        world.Register(app, payer);
                        break;
                    case 2:
                        world.Mint(app);
                        break;
                    case 3:
                        if (world.IsMinted(app)) world.AccountReceive(app, random.Next(1, 50) * GAS_UNIT);
                        break;
                    case 4:
                        if (world.IsMinted(app))
                            world.FundEnginePool(app, NextAmount(random, world.AccountBalance(app)));
                        break;
                    case 5:
                        if (world.IsMinted(app))
                            world.SpendToPayout(app, NextAmount(random, world.AccountBalance(app)));
                        break;
                    default:
                        if (world.CreditOf(app, payer) > 0)
                            world.WithdrawCredit(app, payer, NextAmount(random, world.CreditOf(app, payer)));
                        break;
                }

                // The heart of the differential check: after every applied
                // step the NEF's on-chain reads must match the oracle and the
                // solvency identity must hold.
                world.AssertConsistent();
            }

            // The run must have exercised every money lane to count as evidence.
            Assert.True(world.Registrations > 0, "run never registered an app");
            Assert.True(world.Mints > 0, "run never minted an account");
            Assert.True(world.PoolFundings > 0, "run never funded an engine pool");
            Assert.True(world.Spends > 0, "run never spent to payout");
            Assert.True(world.Withdrawals > 0, "run never withdrew credit");
        }

        [Fact]
        public void FeeConsumptionConvertsLiabilityIntoRevenueOnChain()
        {
            var world = new RegistryDifferentialWorld(apps: 1, payers: 1);
            string app = world.Apps[0];
            UInt160 payer = world.Payers[0];

            world.Deposit(app, payer, 20 * GAS_UNIT);
            world.AssertConsistent();
            world.Register(app, payer);
            world.AssertConsistent();
            world.Mint(app);
            world.AssertConsistent();

            // 1 GAS registration + 10 GAS mint became platform revenue on
            // chain; the remaining 9 GAS is still the payer's withdrawable
            // liability, and the solvency identity held at every step above.
            Assert.Equal(new System.Numerics.BigInteger(9 * GAS_UNIT), world.CreditOf(app, payer));
            world.WithdrawCredit(app, payer, 9 * GAS_UNIT);
            world.AssertConsistent();
            Assert.Equal(System.Numerics.BigInteger.Zero, world.CreditOf(app, payer));
        }

        // Bounded random amount in [1, min(max, 40 GAS)].
        private static long NextAmount(Random random, System.Numerics.BigInteger max)
        {
            long cap = 40 * GAS_UNIT;
            long bounded = max < cap ? (long)max : cap;
            if (bounded <= 1) return 1;
            return 1 + (long)(random.NextDouble() * (bounded - 1));
        }
    }
}
