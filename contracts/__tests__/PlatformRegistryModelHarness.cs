using System;
using System.Collections.Generic;
using System.Numerics;
using Neo;
using Neo.SmartContract.Testing;
using Xunit;
using static NeoMiniAppPlatform.Contracts.Tests.RegistryHarness;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    // ===================================================================
    //  Differential-model driver for the PlatformRegistry money flows.
    //
    //  A pure C# reference model (the oracle) mirrors every randomized
    //  register/credit/mint/receive/fund/spend/withdraw action that is
    //  applied to a REAL TestEngine-deployed PlatformRegistry. After each
    //  applied action the driver asserts the CONTRACT's on-chain reads
    //  agree with the model AND that the on-chain solvency identity holds:
    //
    //    GAS.BalanceOf(registry) == totalCreditLiability + accruedFees
    //    (transit is zero between transactions)
    //    creditOf(app,payer)     == model per-(app,payer) credit
    //    GAS.BalanceOf(account)  == received - pool-funded - paid-out
    //    engine poolCreditOf(app)== sum of that app's fundEnginePool
    //
    //  Because these on-chain reads are compared against an INDEPENDENT
    //  arithmetic oracle, perturbing any single contract accounting write
    //  (drop a liability bump, skip a fee accrual, mis-forward the pool
    //  hop) makes the very next AssertConsistent trip — see the invariant
    //  test's perturbation evidence.
    // ===================================================================
    internal sealed class RegistryDifferentialWorld
    {
        private readonly Ctx _ctx;
        private readonly PlatformRegistryContract _reg;
        private readonly EngineMockContract _engine;
        private readonly Model _model = new Model();

        public readonly string[] Apps;
        public readonly UInt160[] Payers;

        private readonly Dictionary<string, UInt160> _account = new();

        public int Registrations => _model.Registrations;
        public int Mints => _model.Mints;
        public int PoolFundings => _model.PoolFundings;
        public int Spends => _model.Spends;
        public int Withdrawals => _model.Withdrawals;

        public RegistryDifferentialWorld(int apps, int payers)
        {
            _ctx = Deploy();
            _reg = _ctx.Registry;
            _engine = _ctx.EngineMock;
            SetArtifact(_ctx);
            RegisterEngine(_ctx, EngineId, _engine.Hash);

            Apps = new string[apps];
            for (int i = 0; i < apps; i++) Apps[i] = "diff-app-" + (char)('a' + i);
            Payers = new UInt160[payers];
            for (int i = 0; i < payers; i++)
            {
                Payers[i] = TestEngine.GetNewSigner().Account;
                FundGas(_ctx, Payers[i], 100_000 * GAS_UNIT);
            }
        }

        private BigInteger BalanceOf(UInt160 h) => _ctx.Engine.Native.GAS.BalanceOf(h) ?? 0;

        public bool IsRegistered(string app) => _model.IsRegistered(app);
        public bool IsMinted(string app) => _model.IsMinted(app);
        public UInt160 AdminOf(string app) => _model.AdminOf(app);
        public BigInteger CreditOf(string app, UInt160 payer) => _model.CreditOf(app, payer);
        public BigInteger AccountBalance(string app) => _model.AccountBalance(app);

        // ---- randomized actions: perform on chain, then mirror to model ----

        public bool Deposit(string app, UInt160 payer, long amount)
        {
            As(_ctx, payer);
            bool? ok = _ctx.Engine.Native.GAS.Transfer(payer, _reg.Hash, amount, app + ":credit");
            Assert.True(ok == true, "credit deposit should land");
            _model.Deposit(app, payer, amount);
            return true;
        }

        public bool Register(string app, UInt160 payer)
        {
            if (_model.IsRegistered(app) || _model.CreditOf(app, payer) < FEE_LITE) return false;
            As(_ctx, payer);
            _reg.registerApp(app, EngineId, payer, null);
            _model.Register(app, payer);
            return true;
        }

        public bool Mint(string app)
        {
            if (!_model.IsRegistered(app) || _model.IsMinted(app)) return false;
            UInt160 admin = _model.AdminOf(app);
            if (_model.CreditOf(app, admin) < FEE_MINT) return false;
            As(_ctx, admin);
            UInt160 account = _reg.mintAccount(app)!;
            _model.Mint(app);
            _account[app] = account;

            // Install a distinct, timelocked payout address so the spend lane
            // becomes usable (finding-1 default hardening: no auto-seed).
            UInt160 payout = TestEngine.GetNewSigner().Account;
            _reg.proposePayoutAddress(app, payout);
            AdvanceMs(_ctx, TIMELOCK_MS + 1_000);
            _reg.executePayoutAddress(app);
            return true;
        }

        public bool AccountReceive(string app, long amount)
        {
            if (!_model.IsMinted(app)) return false;
            FundGas(_ctx, _account[app], amount);
            _model.AccountReceive(app, amount);
            return true;
        }

        public bool FundEnginePool(string app, long amount)
        {
            if (!_model.IsMinted(app) || _model.AccountBalance(app) < amount) return false;
            As(_ctx, _model.AdminOf(app));
            _reg.fundEnginePool(app, amount);
            _model.FundEnginePool(app, amount);
            return true;
        }

        public bool SpendToPayout(string app, long amount)
        {
            if (!_model.IsMinted(app) || _model.AccountBalance(app) < amount) return false;
            // Gate on the contract's own rolling-window budget so the call is
            // deterministic; the accounting we verify is the GAS movement.
            BigInteger spent = _reg.spentInWindow(app) ?? 0;
            BigInteger threshold = _reg.spendThresholdOf(app) ?? 0;
            if (spent + amount > threshold) return false;
            As(_ctx, _model.AdminOf(app));
            _reg.spendToPayout(app, _ctx.Engine.Native.GAS.Hash, amount);
            _model.SpendToPayout(app, amount);
            return true;
        }

        public bool WithdrawCredit(string app, UInt160 payer, long amount)
        {
            if (_model.CreditOf(app, payer) < amount || amount <= 0) return false;
            As(_ctx, payer);
            _reg.withdrawCredit(app, amount);
            _model.WithdrawCredit(app, payer, amount);
            return true;
        }

        // ---- the differential assertion, run after every applied action ----

        public void AssertConsistent()
        {
            // Independent oracle arithmetic vs the contract's stored counters.
            foreach (string app in Apps)
            {
                foreach (UInt160 payer in Payers)
                {
                    Assert.Equal(_model.CreditOf(app, payer), _reg.creditOf(app, payer) ?? 0);
                }
            }
            BigInteger liability = _reg.totalCreditLiability() ?? 0;
            BigInteger fees = _reg.accruedFees() ?? 0;
            Assert.Equal(_model.TotalLiability, liability);
            Assert.Equal(_model.AccruedFees, fees);

            // Solvency identity: everything the registry custodies is either
            // user liability or accrued revenue. Transit is zero between txns.
            Assert.False(_reg.transitHopInProgress() == true, "transit lock stuck between txns");
            Assert.Equal(liability + fees, BalanceOf(_reg.Hash));

            // Per-account + engine-pool conservation over the real contracts.
            foreach (string app in Apps)
            {
                if (!_model.IsMinted(app)) continue;
                Assert.Equal(_model.AccountBalance(app), BalanceOf(_account[app]));
                Assert.Equal(_model.EnginePool(app), _engine.poolCreditOf(app) ?? 0);
            }
        }

        // Pure reference model (the oracle). Deliberately re-derives every
        // quantity from first principles so it cannot share a bug with the NEF.
        private sealed class Model
        {
            private readonly Dictionary<string, BigInteger> _credit = new();
            private readonly Dictionary<string, UInt160> _admin = new();
            private readonly HashSet<string> _minted = new();
            private readonly Dictionary<string, BigInteger> _received = new();
            private readonly Dictionary<string, BigInteger> _funded = new();
            private readonly Dictionary<string, BigInteger> _paidOut = new();
            private readonly Dictionary<string, BigInteger> _pool = new();

            public BigInteger TotalLiability { get; private set; }
            public BigInteger AccruedFees { get; private set; }
            public int Registrations { get; private set; }
            public int Mints { get; private set; }
            public int PoolFundings { get; private set; }
            public int Spends { get; private set; }
            public int Withdrawals { get; private set; }

            public bool IsRegistered(string app) => _admin.ContainsKey(app);
            public bool IsMinted(string app) => _minted.Contains(app);
            public UInt160 AdminOf(string app) => _admin[app];
            public BigInteger CreditOf(string app, UInt160 payer) => Get(_credit, Key(app, payer));
            public BigInteger EnginePool(string app) => Get(_pool, app);
            public BigInteger AccountBalance(string app) =>
                Get(_received, app) - Get(_funded, app) - Get(_paidOut, app);

            public void Deposit(string app, UInt160 payer, BigInteger amount)
            {
                _credit[Key(app, payer)] = CreditOf(app, payer) + amount;
                TotalLiability += amount;
            }

            public void Register(string app, UInt160 payer)
            {
                Consume(app, payer, FEE_LITE);
                _admin[app] = payer;
                Registrations++;
            }

            public void Mint(string app)
            {
                Consume(app, AdminOf(app), FEE_MINT);
                _minted.Add(app);
                Mints++;
            }

            public void AccountReceive(string app, BigInteger amount) =>
                _received[app] = Get(_received, app) + amount;

            public void FundEnginePool(string app, BigInteger amount)
            {
                _funded[app] = Get(_funded, app) + amount;
                _pool[app] = Get(_pool, app) + amount;
                PoolFundings++;
            }

            public void SpendToPayout(string app, BigInteger amount)
            {
                _paidOut[app] = Get(_paidOut, app) + amount;
                Spends++;
            }

            public void WithdrawCredit(string app, UInt160 payer, BigInteger amount)
            {
                _credit[Key(app, payer)] = CreditOf(app, payer) - amount;
                TotalLiability -= amount;
                Withdrawals++;
            }

            private void Consume(string app, UInt160 payer, BigInteger fee)
            {
                _credit[Key(app, payer)] = CreditOf(app, payer) - fee;
                TotalLiability -= fee;
                AccruedFees += fee;
            }

            private static string Key(string app, UInt160 payer) => app + "|" + payer;

            private static BigInteger Get(Dictionary<string, BigInteger> d, string k) =>
                d.TryGetValue(k, out BigInteger v) ? v : 0;
        }
    }
}
