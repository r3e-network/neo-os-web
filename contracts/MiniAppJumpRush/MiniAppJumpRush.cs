using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// MiniAppJumpRush — timed platform-jumping skill game with private TEE settlement.
    /// Player charges a jump by holding, releases to leap to next platform.
    /// Perfect center landings score bonus time. Missing the platform ends the game.
    /// TEE generates platform gap sequence from sealed seed; client only gets positions.
    /// </summary>
    [DisplayName("MiniAppJumpRush")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Timed platform-jumping skill game with private TEE settlement: jump sequence sealed in TEE, commitment hash bound on-chain, secp256r1-verified win settlement.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")] // GAS
    public partial class MiniAppJumpRush : SmartContract
    {
        #region Constants
        private const string FUND_MEMO = "miniapp-jump-rush:fund";
        private const string ENTRY_MEMO = "miniapp-jump-rush:entry";
        private const int MAX_UNDOS = 3;
        private const int UNDO_PENALTY_PCT = 30;
        private const long DEAL_TTL_MS = 3_600_000;
        private const long SETTLE_GRACE_MS = 600_000;
        private const int DEFAULT_DAILY_CAP = 8;
        private const long MS_PER_DAY = 86_400_000;

        [InitialValue("NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32", ContractParameterType.Hash160)]
        private static readonly UInt160 Owner = default;
        #endregion

        #region Per-difficulty lookups (0 easy, 1 medium, 2 hard)
        private static BigInteger EntryOf(BigInteger d)
        {
            if (d == 0) return 2_000_000;
            if (d == 1) return 10_000_000;
            return 20_000_000;
        }

        private static BigInteger RewardOf(BigInteger d)
        {
            if (d == 0) return 10_000_000;
            if (d == 1) return 50_000_000;
            return 100_000_000;
        }

        private static BigInteger LimitMsOf(BigInteger d)
        {
            if (d == 0) return 60_000;     // 60s
            if (d == 1) return 90_000;     // 90s
            return 120_000;                // 120s
        }

        private static BigInteger MinSolveMsOf(BigInteger d)
        {
            if (d == 0) return 15_000;     // 15s floor
            if (d == 1) return 30_000;     // 30s
            return 45_000;                 // 45s
        }

        private static BigInteger TargetJumpsOf(BigInteger d)
        {
            if (d == 0) return 10;         // Easy: 10 platforms
            if (d == 1) return 20;         // Medium: 20
            return 30;                     // Hard: 30
        }
        #endregion

        #region Storage prefixes
        private static readonly byte[] PREFIX_POOL = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_RESERVED = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_CREDIT = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_GAME_ID = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_GAME = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_ACTIVE = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_STATS = new byte[] { 0x16 };
        private static readonly byte[] PREFIX_TOP_ADDR = new byte[] { 0x17 };
        private static readonly byte[] PREFIX_TOP_WON = new byte[] { 0x18 };
        private static readonly byte[] PREFIX_DAY = new byte[] { 0x19 };
        private static readonly byte[] PREFIX_PAUSED = new byte[] { 0x1A };
        private static readonly byte[] PREFIX_DAILY_CAP = new byte[] { 0x1B };
        private static readonly byte[] PREFIX_TEE_PUB = new byte[] { 0x1C };
        private static readonly byte[] PREFIX_UPGRADE_TIME = new byte[] { 0x1D };
        private static readonly byte[] PREFIX_UPGRADE_HASH = new byte[] { 0x1E };
        #endregion

        #region Upgrade timelock
        private const long UPGRADE_TIMELOCK_MS = 86_400_000;
        #endregion

        #region Types
        public struct Game
        {
            public UInt160 Player;
            public BigInteger Difficulty;
            public BigInteger Entry;
            public BigInteger Reward;
            public BigInteger StartTime;
            public ByteString Commitment;
            public BigInteger DealtAt;
            public BigInteger Deadline;
            public BigInteger Undos;
            public BigInteger Status;
            public BigInteger Payout;
            public BigInteger SolveMs;
            public ByteString AnswerHash;
        }

        public struct Stats
        {
            public BigInteger Played;
            public BigInteger Solved;
            public BigInteger TotalWon;
        }
        #endregion

        #region Events
        [DisplayName("Credited")]
        public static event Action<UInt160, BigInteger, BigInteger> OnCredited;
        [DisplayName("PoolFunded")]
        public static event Action<UInt160, BigInteger, BigInteger> OnPoolFunded;
        [DisplayName("GameStarted")]
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger, BigInteger> OnGameStarted;
        [DisplayName("PuzzleBound")]
        public static event Action<BigInteger, UInt160, string, BigInteger, BigInteger> OnPuzzleBound;
        [DisplayName("Solved")]
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger, BigInteger, BigInteger, BigInteger> OnSolved;
        [DisplayName("GameExpired")]
        public static event Action<BigInteger, UInt160, BigInteger> OnGameExpired;
        [DisplayName("GameRefunded")]
        public static event Action<BigInteger, UInt160, BigInteger> OnGameRefunded;
        [DisplayName("CreditWithdrawn")]
        public static event Action<UInt160, BigInteger> OnCreditWithdrawn;
        [DisplayName("PoolWithdrawn")]
        public static event Action<UInt160, BigInteger> OnPoolWithdrawn;
        [DisplayName("PausedChanged")]
        public static event Action<bool> OnPausedChanged;
        [DisplayName("DailyCapChanged")]
        public static event Action<BigInteger> OnDailyCapChanged;
        [DisplayName("TeeSignerChanged")]
        public static event Action<ECPoint> OnTeeSignerChanged;
        [DisplayName("UpgradeScheduled")]
        public static event Action<BigInteger> OnUpgradeScheduled;
        #endregion

        #region Deposit
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "only GAS accepted");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(data is not null, "memo required");
            string memo = (string)data;
            StorageContext ctx = Storage.CurrentContext;

            if (memo == FUND_MEMO)
            {
                BigInteger pool = (BigInteger)Storage.Get(ctx, PREFIX_POOL) + amount;
                Storage.Put(ctx, PREFIX_POOL, pool);
                OnPoolFunded(from, amount, pool);
                return;
            }
            if (memo == ENTRY_MEMO)
            {
                byte[] key = CreditKey(from);
                BigInteger bal = (BigInteger)Storage.Get(ctx, key) + amount;
                Storage.Put(ctx, key, bal);
                OnCredited(from, amount, bal);
                return;
            }
            ExecutionEngine.Assert(false, "invalid memo");
        }
        #endregion

        #region Admin
        public static void SetPaused(bool paused)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            Storage.Put(Storage.CurrentContext, PREFIX_PAUSED, paused ? 1 : 0);
            OnPausedChanged(paused);
        }

        public static void SetDailyCap(BigInteger cap)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            ExecutionEngine.Assert(cap >= 1 && cap <= 100, "cap must be 1..100");
            Storage.Put(Storage.CurrentContext, PREFIX_DAILY_CAP, cap);
            OnDailyCapChanged(cap);
        }

        public static void SetTeeSigner(ECPoint signer)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            ExecutionEngine.Assert(signer is not null && signer.IsValid, "invalid signer key");
            Storage.Put(Storage.CurrentContext, PREFIX_TEE_PUB, (byte[])signer);
            OnTeeSignerChanged(signer);
        }

        public static void WithdrawPool(UInt160 to, BigInteger amount)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            ExecutionEngine.Assert(to is not null && to.IsValid && !to.IsZero, "invalid recipient");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            StorageContext ctx = Storage.CurrentContext;
            BigInteger pool = (BigInteger)Storage.Get(ctx, PREFIX_POOL);
            BigInteger reserved = (BigInteger)Storage.Get(ctx, PREFIX_RESERVED);
            ExecutionEngine.Assert(pool - reserved >= amount, "insufficient free pool");
            Storage.Put(ctx, PREFIX_POOL, pool - amount);
            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, to, amount, "" });
            ExecutionEngine.Assert(ok, "pool transfer failed");
            OnPoolWithdrawn(to, amount);
        }

        public static void ScheduleUpgrade(ByteString nef, string manifest)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            BigInteger executeAt = Runtime.Time + UPGRADE_TIMELOCK_MS;
            Storage.Put(Storage.CurrentContext, PREFIX_UPGRADE_TIME, executeAt);
            Storage.Put(Storage.CurrentContext, PREFIX_UPGRADE_HASH,
                CryptoLib.Sha256(Helper.Concat((ByteString)nef, (ByteString)manifest)));
            OnUpgradeScheduled(executeAt);
        }

        public static void Update(ByteString nef, string manifest)
        {
            BigInteger executeAt = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_UPGRADE_TIME);
            ExecutionEngine.Assert(executeAt > 0, "no upgrade scheduled");
            ExecutionEngine.Assert(Runtime.Time >= executeAt, "timelock active");
            ByteString expectedHash = Storage.Get(Storage.CurrentContext, PREFIX_UPGRADE_HASH);
            ByteString actualHash = CryptoLib.Sha256(Helper.Concat((ByteString)nef, (ByteString)manifest));
            ExecutionEngine.Assert(expectedHash == actualHash, "upgrade data mismatch");
            Storage.Delete(Storage.CurrentContext, PREFIX_UPGRADE_TIME);
            Storage.Delete(Storage.CurrentContext, PREFIX_UPGRADE_HASH);
            ContractManagement.Update(nef, manifest, new object[0]);
        }
        #endregion
    }
}
