using System;
using System.Collections.Generic;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    /// <summary>
    /// Model-based invariant suite for the PlatformRegistry money flows
    /// (AnchorRewardAccountingInvariantTest style): a pure C# reference
    /// model runs randomized register/credit/fee/mint/fund/spend/withdraw
    /// sequences and asserts, after every step, the conservation laws the
    /// contract enforces structurally:
    ///   - registry GAS balance == total credit liability + accrued fees
    ///   - total credit liability == sum of every (appId, payer) balance
    ///   - per-app account balance == received - pool-funded - paid-out
    ///   - engine pool per app == sum of that app's fundEnginePool amounts
    ///   - no balance ever goes negative.
    /// </summary>
    public class PlatformRegistryModelInvariantTests
    {
        private const long GasUnit = 100_000_000;
        private const long FeeLite = 1 * GasUnit;
        private const long FeeMint = 10 * GasUnit;

        [Fact]
        public void RandomizedRegisterFundCreditSpendWithdrawSequencesConserveEveryLedger()
        {
            var model = new RegistryModel();
            var random = new Random(0x1E9157);
            string[] apps = { "app-a", "app-b", "app-c", "app-d" };
            string[] payers = { "alice", "bob", "carol" };

            for (int step = 0; step < 500; step++)
            {
                string app = apps[random.Next(apps.Length)];
                string payer = payers[random.Next(payers.Length)];
                int action = random.Next(7);

                switch (action)
                {
                    case 0:
                        model.DepositCredit(app, payer, random.Next(1, 30) * GasUnit);
                        break;
                    case 1:
                        if (!model.IsRegistered(app) && model.CreditOf(app, payer) >= FeeLite)
                        {
                            model.RegisterApp(app, payer);
                        }
                        break;
                    case 2:
                        if (model.IsRegistered(app) && !model.IsMinted(app)
                            && model.CreditOf(app, model.AdminOf(app)) >= FeeMint)
                        {
                            model.MintAccount(app);
                        }
                        break;
                    case 3:
                        if (model.IsMinted(app)) model.AccountReceive(app, random.Next(1, 50) * GasUnit);
                        break;
                    case 4:
                        if (model.IsMinted(app) && model.AccountBalance(app) > 0)
                        {
                            model.FundEnginePool(app, NextAmount(random, model.AccountBalance(app)));
                        }
                        break;
                    case 5:
                        if (model.IsMinted(app) && model.AccountBalance(app) > 0)
                        {
                            model.SpendToPayout(app, NextAmount(random, model.AccountBalance(app)));
                        }
                        break;
                    default:
                        if (model.CreditOf(app, payer) > 0)
                        {
                            model.WithdrawCredit(app, payer, NextAmount(random, model.CreditOf(app, payer)));
                        }
                        break;
                }

                model.AssertInvariants();
            }

            // The run must have exercised every lane to count as evidence.
            Assert.True(model.Registrations > 0, "model run never registered an app");
            Assert.True(model.Mints > 0, "model run never minted an account");
            Assert.True(model.PoolFundings > 0, "model run never funded an engine pool");
            Assert.True(model.Spends > 0, "model run never spent to payout");
            Assert.True(model.Withdrawals > 0, "model run never withdrew credit");
        }

        [Fact]
        public void FeeConsumptionConvertsLiabilityIntoRevenueExactly()
        {
            var model = new RegistryModel();
            model.DepositCredit("solo-app", "alice", 20 * GasUnit);
            model.RegisterApp("solo-app", "alice");
            model.MintAccount("solo-app");
            model.AssertInvariants();

            // 11 GAS of the deposit became platform revenue; the rest is
            // still the payer's liability, all of it withdrawable.
            Assert.Equal(FeeLite + FeeMint, model.AccruedFees);
            Assert.Equal(9 * GasUnit, model.CreditOf("solo-app", "alice"));
            model.WithdrawCredit("solo-app", "alice", 9 * GasUnit);
            model.AssertInvariants();
            Assert.Equal(0, model.TotalLiability);
            Assert.Equal(model.AccruedFees, model.RegistryBalance);
        }

        private static long NextAmount(Random random, long max)
        {
            long bounded = Math.Min(max, 40 * GasUnit);
            return 1 + (long)(random.NextDouble() * (bounded - 1));
        }

        // Pure reference model of the registry + account + engine flows.
        private sealed class RegistryModel
        {
            private readonly Dictionary<(string App, string Payer), long> credit = new();
            private readonly Dictionary<string, string> adminByApp = new();
            private readonly HashSet<string> minted = new();
            private readonly Dictionary<string, long> accountReceived = new();
            private readonly Dictionary<string, long> accountFunded = new();
            private readonly Dictionary<string, long> accountPaidOut = new();
            private readonly Dictionary<string, long> enginePool = new();

            public long RegistryBalance { get; private set; }
            public long TotalLiability { get; private set; }
            public long AccruedFees { get; private set; }
            public int Registrations { get; private set; }
            public int Mints { get; private set; }
            public int PoolFundings { get; private set; }
            public int Spends { get; private set; }
            public int Withdrawals { get; private set; }

            public bool IsRegistered(string app) => adminByApp.ContainsKey(app);
            public bool IsMinted(string app) => minted.Contains(app);
            public string AdminOf(string app) => adminByApp[app];
            public long CreditOf(string app, string payer) => Get(credit, (app, payer));
            public long AccountBalance(string app) =>
                Get(accountReceived, app) - Get(accountFunded, app) - Get(accountPaidOut, app);

            public void DepositCredit(string app, string payer, long amount)
            {
                credit[(app, payer)] = CreditOf(app, payer) + amount;
                TotalLiability += amount;
                RegistryBalance += amount;
            }

            public void RegisterApp(string app, string appAdmin)
            {
                ConsumeCredit(app, appAdmin, FeeLite);
                adminByApp[app] = appAdmin;
                Registrations++;
            }

            public void MintAccount(string app)
            {
                ConsumeCredit(app, AdminOf(app), FeeMint);
                minted.Add(app);
                Mints++;
            }

            public void AccountReceive(string app, long amount) =>
                accountReceived[app] = Get(accountReceived, app) + amount;

            public void FundEnginePool(string app, long amount)
            {
                if (AccountBalance(app) < amount) throw new InvalidOperationException("account underfunded");
                accountFunded[app] = Get(accountFunded, app) + amount;
                enginePool[app] = Get(enginePool, app) + amount;
                PoolFundings++;
            }

            public void SpendToPayout(string app, long amount)
            {
                if (AccountBalance(app) < amount) throw new InvalidOperationException("account underfunded");
                accountPaidOut[app] = Get(accountPaidOut, app) + amount;
                Spends++;
            }

            public void WithdrawCredit(string app, string payer, long amount)
            {
                long balance = CreditOf(app, payer);
                if (balance < amount) throw new InvalidOperationException("insufficient credit");
                credit[(app, payer)] = balance - amount;
                TotalLiability -= amount;
                RegistryBalance -= amount;
                Withdrawals++;
            }

            public void AssertInvariants()
            {
                // Registry solvency: everything it holds is either user
                // liability or accrued platform revenue — nothing else.
                Assert.Equal(TotalLiability + AccruedFees, RegistryBalance);

                // The mandatory liability counter equals the ledger sum.
                long sum = 0;
                foreach (long balance in credit.Values)
                {
                    Assert.True(balance >= 0, "negative credit balance");
                    sum += balance;
                }
                Assert.Equal(sum, TotalLiability);

                // Per-app conservation across account + engine pool.
                foreach (string app in adminByApp.Keys)
                {
                    Assert.True(AccountBalance(app) >= 0, "negative account balance");
                    Assert.Equal(Get(accountFunded, app), Get(enginePool, app));
                }
                Assert.True(AccruedFees >= 0 && TotalLiability >= 0 && RegistryBalance >= 0);
            }

            private void ConsumeCredit(string app, string payer, long fee)
            {
                long balance = CreditOf(app, payer);
                if (balance < fee) throw new InvalidOperationException("insufficient credit");
                credit[(app, payer)] = balance - fee;
                TotalLiability -= fee;
                AccruedFees += fee;
            }

            private static long Get<TKey>(Dictionary<TKey, long> values, TKey key) where TKey : notnull =>
                values.TryGetValue(key, out long value) ? value : 0;
        }
    }
}
