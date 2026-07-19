using System;
using Neo;
using Xunit;
using static NeoMiniAppPlatform.Contracts.Tests.RewardGameDifferentialWorld;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    /// <summary>
    /// Differential model-based invariant suite for the PlatformGame
    /// RewardGame module (design section 8 layer 3): randomized ~500-step
    /// fund / deposit / start / settle / expire / withdraw sequences over
    /// multiple tenants and players, asserting per-app conservation and the
    /// mandatory liability counter after every single step (the
    /// PlatformRegistryModelInvariantTests idiom).
    /// </summary>
    public class PlatformGameRewardGameModelInvariantTests
    {
        [Fact]
        public void RandomizedSequencesKeepTheNefLedgerConsistentWithTheOracle()
        {
            var world = new RewardGameDifferentialWorld(apps: 2, players: 3);
            var random = new Random(0x5EA10C);

            world.AssertConsistent();

            for (int step = 0; step < 500; step++)
            {
                string app = world.Apps[random.Next(world.Apps.Length)];
                UInt160 player = world.Players[random.Next(world.Players.Length)];

                switch (random.Next(10))
                {
                    case 0:
                        world.FundPool(app, random.Next(1, 20) * GAS_UNIT);
                        break;
                    case 1:
                        world.DepositEntry(app, player, random.Next(1, 30) * 1_000_000L);
                        break;
                    case 2:
                    case 3:
                        world.Start(app, player, random.Next(3));
                        break;
                    case 4:
                        world.SettleWin(app, player, random);
                        break;
                    case 5:
                        world.SettleLoss(app, player);
                        break;
                    case 6:
                        world.SettleFailure(app, player);
                        break;
                    case 7:
                        world.Expire(app, player);
                        break;
                    default:
                        world.Withdraw(app, player);
                        break;
                }

                // Time marches so deadlines pass and expiry lanes open up.
                world.AdvanceMs(30_000 + random.Next(90_000));

                // The heart of the differential check: after every applied
                // step the NEF's on-chain reads must match the oracle and
                // the per-app solvency identity must hold.
                world.AssertConsistent();
            }

            // The run must have exercised every money lane to count as evidence.
            Assert.True(world.Funds > 0, "run never funded a pool");
            Assert.True(world.Deposits > 0, "run never deposited an entry");
            Assert.True(world.Starts > 0, "run never started a game");
            Assert.True(world.SettledWins > 0, "run never settled a win");
            Assert.True(world.SettledLosses > 0, "run never settled a loss");
            Assert.True(world.SettledFailures > 0, "run never refunded a failure");
            Assert.True(world.Expirations > 0, "run never expired a game");
            Assert.True(world.Withdrawals > 0, "run never withdrew credit");
        }

        [Fact]
        public void LiabilityCounterTracksTheFullLifecycleExactly()
        {
            var world = new RewardGameDifferentialWorld(apps: 1, players: 1);
            string app = world.Apps[0];
            UInt160 player = world.Players[0];

            world.FundPool(app, 10 * GAS_UNIT);
            world.AssertConsistent();
            world.DepositEntry(app, player, 4_000_000);
            world.AssertConsistent();
            Assert.True(world.Start(app, player, 0));
            world.AssertConsistent();
            Assert.True(world.SettleWin(app, player, new Random(7)));
            world.AssertConsistent();
            Assert.True(world.Withdraw(app, player));
            world.AssertConsistent();
        }
    }
}
