using System;
using System.Collections.Generic;
using System.Numerics;
using Neo;
using Neo.SmartContract.Testing;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    // ===================================================================
    //  Differential-model driver for the PlatformGame RewardGame money
    //  flows (design section 8 layer 3, the PlatformRegistryModelHarness
    //  idiom). A pure C# oracle mirrors every randomized fund / deposit /
    //  start / settle / expire / withdraw action applied to a REAL
    //  TestEngine-deployed PlatformGame. After each applied action the
    //  driver asserts the contract's on-chain reads agree with the oracle
    //  AND that the section 3.3 solvency identity holds per tenant:
    //
    //    heldForApp == poolBalance + sum(credits)   (pool carries reserved)
    //    reservedPool <= poolBalance
    //    GAS.BalanceOf(contract) == sum of per-app held counters
    //    creditOf / activeGameOf / statsOf == model
    //
    //  Perturbing any single accounting write in the NEF (drop a held bump,
    //  skip a reservation release, misroute an entry) trips the very next
    //  AssertConsistent.
    // ===================================================================
    internal sealed class RewardGameDifferentialWorld
    {
        public const long GAS_UNIT = 100_000_000;
        private const long MS_PER_DAY = 86_400_000;
        private const long SETTLE_GRACE_MS = 600_000;
        private const int DAILY_CAP = 8;
        private const int UNDO_PENALTY_BPS = 3000;

        // The clone fleet's default economics (descriptor unset).
        private static readonly long[] ENTRY = { 2_000_000, 10_000_000, 20_000_000 };
        private static readonly long[] REWARD = { 10_000_000, 50_000_000, 100_000_000 };
        private static readonly long[] LIMIT_MS = { 60_000, 90_000, 120_000 };
        private static readonly long[] MIN_SOLVE_MS = { 10_000, 20_000, 30_000 };
        private static readonly long[] TARGET_SCORE = { 3, 5, 7 };

        private readonly TestEngine _engine;
        private readonly PlatformGameRewardGameContract _game;
        private readonly GameOracleMockFixtureContract _oracle;
        private readonly UInt160 _admin;
        private readonly UInt160 _funder;
        private readonly Model _model = new Model();

        public readonly string[] Apps;
        public readonly UInt160[] Players;

        public int Funds => _model.Funds;
        public int Deposits => _model.Deposits;
        public int Starts => _model.Starts;
        public int SettledWins => _model.SettledWins;
        public int SettledLosses => _model.SettledLosses;
        public int SettledFailures => _model.SettledFailures;
        public int Expirations => _model.Expirations;
        public int Withdrawals => _model.Withdrawals;

        public RewardGameDifferentialWorld(int apps, int players)
        {
            _engine = new TestEngine(true);
            _engine.Fee = 1_000L * GAS_UNIT;
            var (nef, manifest) = RegistryHarness.Load("PlatformGame");
            _engine.SetTransactionSigners(_engine.ValidatorsAddress);
            _game = _engine.Deploy<PlatformGameRewardGameContract>(nef, manifest);
            _oracle = GameOracleMockFixture.Deploy(_engine, _engine.ValidatorsAddress);
            _game.setOracle(_oracle.Hash);
            _admin = _engine.ValidatorsAddress;
            _funder = TestEngine.GetNewSigner().Account;
            FundGas(_funder, 1_000_000L * GAS_UNIT);

            Apps = new string[apps];
            for (int i = 0; i < apps; i++)
            {
                Apps[i] = "model-app-" + (char)('a' + i);
                _engine.SetTransactionSigners(_admin);
                _game.registerGame(Apps[i], 5, _admin, null!);
            }
            Players = new UInt160[players];
            for (int i = 0; i < players; i++)
            {
                Players[i] = TestEngine.GetNewSigner().Account;
                FundGas(Players[i], 10_000L * GAS_UNIT);
            }
        }

        private void FundGas(UInt160 to, BigInteger gas)
        {
            _engine.SetTransactionSigners(_engine.ValidatorsAddress);
            _engine.Native.GAS.Transfer(_engine.ValidatorsAddress, to, gas, null);
        }

        private long NowMs() => (long)_engine.PersistingBlock.Timestamp.TotalMilliseconds;

        public void AdvanceMs(long ms) =>
            _engine.PersistingBlock.Advance(TimeSpan.FromMilliseconds(ms));

        // ---- randomized actions: gate on chain reads, apply, mirror to model ----

        public bool FundPool(string app, long amount)
        {
            _engine.SetTransactionSigners(_funder);
            bool? ok = _engine.Native.GAS.Transfer(_funder, _game.Hash, amount, app + ":fund");
            Assert.True(ok == true, "pool funding transfer should land");
            _model.FundPool(app, amount);
            return true;
        }

        public bool DepositEntry(string app, UInt160 player, long amount)
        {
            _engine.SetTransactionSigners(player);
            bool? ok = _engine.Native.GAS.Transfer(player, _game.Hash, amount, app + ":entry");
            Assert.True(ok == true, "entry deposit transfer should land");
            _model.DepositEntry(app, player, amount);
            return true;
        }

        public bool Start(string app, UInt160 player, int difficulty)
        {
            // Gate on the contract's own reads so the call is deterministic
            // (the RegistryDifferentialWorld spentInWindow idiom).
            if ((_game.activeGameOf(app, player) ?? 0) != 0) return false;
            if ((_game.dailyStartsOf(app, player) ?? 0) >= DAILY_CAP) return false;
            if ((_game.creditOf(app, player) ?? 0) < ENTRY[difficulty]) return false;
            if ((_game.freePool(app) ?? 0) < REWARD[difficulty]) return false;

            _engine.SetTransactionSigners(player);
            BigInteger gameId = _game.startGame(app, player, difficulty)!.Value;
            _model.Start(app, player, difficulty, (long)gameId, NowMs());
            return true;
        }

        public bool SettleWin(string app, UInt160 player, Random random)
        {
            BigInteger active = _game.activeGameOf(app, player) ?? 0;
            if (active == 0) return false;
            int difficulty = _model.DifficultyOf(app, (long)active);
            int undos = random.Next(4);
            long elapsed = MIN_SOLVE_MS[difficulty] + random.Next((int)(LIMIT_MS[difficulty] - MIN_SOLVE_MS[difficulty]));
            return Settle(app, player, (long)active, true,
                GameResultCodec.Build(new byte[32], new byte[32],
                    (ulong)elapsed, (byte)undos, (uint)TARGET_SCORE[difficulty], (byte)difficulty),
                win: true, undos: undos);
        }

        public bool SettleLoss(string app, UInt160 player)
        {
            BigInteger active = _game.activeGameOf(app, player) ?? 0;
            if (active == 0) return false;
            int difficulty = _model.DifficultyOf(app, (long)active);
            return Settle(app, player, (long)active, true,
                GameResultCodec.Build(new byte[32], new byte[32],
                    (ulong)(MIN_SOLVE_MS[difficulty] + 1), 0, 0, (byte)difficulty),
                win: false, undos: 0);
        }

        public bool SettleFailure(string app, UInt160 player)
        {
            BigInteger active = _game.activeGameOf(app, player) ?? 0;
            if (active == 0) return false;
            return Settle(app, player, (long)active, false, new byte[0], win: false, undos: 0);
        }

        private bool Settle(string app, UInt160 player, long gameId, bool success, byte[] result, bool win, int undos)
        {
            _engine.SetTransactionSigners(player);
            BigInteger requestId = _game.finalizeGame(app, player, "00")!.Value;
            _engine.SetTransactionSigners(_admin);
            _oracle.Deliver(_game.Hash, requestId, app, "game.session", "session.finalize",
                player, success, result, "");
            _model.Settle(app, player, gameId, success, win, undos);
            return true;
        }

        public bool Expire(string app, UInt160 player)
        {
            BigInteger active = _game.activeGameOf(app, player) ?? 0;
            if (active == 0) return false;
            if (NowMs() <= _model.DeadlineOf(app, (long)active) + SETTLE_GRACE_MS) return false;

            _engine.SetTransactionSigners(_funder); // permissionless
            BigInteger status = _game.expireGame(app, active)!.Value;
            Assert.Equal(new BigInteger(3), status);
            _model.Expire(app, player, (long)active);
            return true;
        }

        public bool Withdraw(string app, UInt160 player)
        {
            BigInteger credit = _game.creditOf(app, player) ?? 0;
            if (credit == 0) return false;
            _engine.SetTransactionSigners(player);
            BigInteger amount = _game.withdraw(app, player)!.Value;
            Assert.Equal(credit, amount);
            _model.Withdraw(app, player);
            return true;
        }

        // ---- the differential assertion, run after every applied action ----

        public void AssertConsistent()
        {
            BigInteger totalHeld = 0;
            foreach (string app in Apps)
            {
                BigInteger pool = _game.poolBalance(app) ?? 0;
                BigInteger reserved = _game.reservedPool(app) ?? 0;
                BigInteger held = _game.heldForApp(app) ?? 0;
                BigInteger credits = 0;
                foreach (UInt160 player in Players)
                {
                    BigInteger credit = _game.creditOf(app, player) ?? 0;
                    Assert.Equal(_model.CreditOf(app, player), credit);
                    credits += credit;
                    Assert.Equal(_model.ActiveOf(app, player), _game.activeGameOf(app, player) ?? 0);
                    var stats = _game.statsOf(app, player)!;
                    Assert.Equal(_model.PlayedOf(app, player), stats[(Neo.VM.Types.PrimitiveType)"played"].GetInteger());
                    Assert.Equal(_model.SolvedOf(app, player), stats[(Neo.VM.Types.PrimitiveType)"solved"].GetInteger());
                    Assert.Equal(_model.TotalWonOf(app, player), stats[(Neo.VM.Types.PrimitiveType)"totalWon"].GetInteger());
                }
                Assert.Equal(_model.PoolOf(app), pool);
                Assert.Equal(_model.ReservedOf(app), reserved);
                Assert.Equal(pool - reserved, _game.freePool(app) ?? 0);
                Assert.Equal(_model.HeldOf(app), held);
                // The section 3.3 identity, on chain, for every tenant.
                Assert.True(reserved <= pool, $"reserved must be <= pool for {app}");
                Assert.Equal(pool + credits, held);
                totalHeld += held;
            }
            Assert.Equal(totalHeld, _engine.Native.GAS.BalanceOf(_game.Hash) ?? 0);
        }

        // Pure reference model (the oracle). Re-derives every quantity from
        // first principles so it cannot share a bug with the NEF.
        private sealed class Model
        {
            private sealed class GameRow
            {
                public int Difficulty;
                public long Entry;
                public long Reward;
                public long Deadline;
            }

            private readonly Dictionary<string, BigInteger> _pool = new();
            private readonly Dictionary<string, BigInteger> _reserved = new();
            private readonly Dictionary<string, BigInteger> _held = new();
            private readonly Dictionary<string, BigInteger> _credit = new();
            private readonly Dictionary<string, BigInteger> _active = new();
            private readonly Dictionary<string, GameRow> _games = new();
            private readonly Dictionary<string, BigInteger> _played = new();
            private readonly Dictionary<string, BigInteger> _solved = new();
            private readonly Dictionary<string, BigInteger> _totalWon = new();

            public int Funds { get; private set; }
            public int Deposits { get; private set; }
            public int Starts { get; private set; }
            public int SettledWins { get; private set; }
            public int SettledLosses { get; private set; }
            public int SettledFailures { get; private set; }
            public int Expirations { get; private set; }
            public int Withdrawals { get; private set; }

            public BigInteger PoolOf(string app) => Get(_pool, app);
            public BigInteger ReservedOf(string app) => Get(_reserved, app);
            public BigInteger HeldOf(string app) => Get(_held, app);
            public BigInteger CreditOf(string app, UInt160 player) => Get(_credit, Key(app, player));
            public BigInteger ActiveOf(string app, UInt160 player) => Get(_active, Key(app, player));
            public BigInteger PlayedOf(string app, UInt160 player) => Get(_played, Key(app, player));
            public BigInteger SolvedOf(string app, UInt160 player) => Get(_solved, Key(app, player));
            public BigInteger TotalWonOf(string app, UInt160 player) => Get(_totalWon, Key(app, player));
            public int DifficultyOf(string app, long gameId) => _games[Key(app, gameId)].Difficulty;
            public long DeadlineOf(string app, long gameId) => _games[Key(app, gameId)].Deadline;

            public void FundPool(string app, long amount)
            {
                _pool[app] = PoolOf(app) + amount;
                _held[app] = HeldOf(app) + amount;
                Funds++;
            }

            public void DepositEntry(string app, UInt160 player, long amount)
            {
                _credit[Key(app, player)] = CreditOf(app, player) + amount;
                _held[app] = HeldOf(app) + amount;
                Deposits++;
            }

            public void Start(string app, UInt160 player, int difficulty, long gameId, long nowMs)
            {
                _credit[Key(app, player)] = CreditOf(app, player) - ENTRY[difficulty];
                _pool[app] = PoolOf(app) + ENTRY[difficulty];
                _reserved[app] = ReservedOf(app) + REWARD[difficulty];
                _active[Key(app, player)] = gameId;
                _games[Key(app, gameId)] = new GameRow
                {
                    Difficulty = difficulty,
                    Entry = ENTRY[difficulty],
                    Reward = REWARD[difficulty],
                    Deadline = nowMs + LIMIT_MS[difficulty],
                };
                _played[Key(app, player)] = PlayedOf(app, player) + 1;
                Starts++;
            }

            public void Settle(string app, UInt160 player, long gameId, bool success, bool win, int undos)
            {
                GameRow g = _games[Key(app, gameId)];
                _reserved[app] = ReservedOf(app) - g.Reward;
                _active[Key(app, player)] = 0;
                if (!success)
                {
                    // Refund-on-failure: the entry moves back out of the pool.
                    _pool[app] = PoolOf(app) - g.Entry;
                    _credit[Key(app, player)] = CreditOf(app, player) + g.Entry;
                    SettledFailures++;
                    return;
                }
                if (win)
                {
                    long payout = g.Reward * (10000L - UNDO_PENALTY_BPS * undos) / 10000L;
                    _pool[app] = PoolOf(app) - payout;
                    _credit[Key(app, player)] = CreditOf(app, player) + payout;
                    _solved[Key(app, player)] = SolvedOf(app, player) + 1;
                    _totalWon[Key(app, player)] = TotalWonOf(app, player) + payout;
                    SettledWins++;
                }
                else
                {
                    SettledLosses++;
                }
            }

            public void Expire(string app, UInt160 player, long gameId)
            {
                GameRow g = _games[Key(app, gameId)];
                _reserved[app] = ReservedOf(app) - g.Reward;
                _active[Key(app, player)] = 0;
                Expirations++;
            }

            public void Withdraw(string app, UInt160 player)
            {
                BigInteger credit = CreditOf(app, player);
                _credit[Key(app, player)] = 0;
                _held[app] = HeldOf(app) - credit;
                Withdrawals++;
            }

            private static string Key(string app, UInt160 player) => app + "|" + player;
            private static string Key(string app, long gameId) => app + "|" + gameId;

            private static BigInteger Get(Dictionary<string, BigInteger> d, string k) =>
                d.TryGetValue(k, out BigInteger v) ? v : 0;
        }
    }
}
