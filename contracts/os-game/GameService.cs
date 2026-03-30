using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.OS
{
    public delegate void PoolCreatedHandler(string appId, BigInteger poolId, byte poolType, BigInteger entryFee);
    public delegate void PoolClosedHandler(string appId, BigInteger poolId);
    public delegate void PlayerJoinedHandler(string appId, BigInteger poolId, UInt160 player);
    public delegate void BetPlacedHandler(string appId, BigInteger poolId, UInt160 player, BigInteger amount);
    public delegate void PoolSettledHandler(string appId, BigInteger poolId, int recipientCount, BigInteger totalPrize);
    public delegate void GameConfiguredHandler(string appId);
    public delegate void GameAdminChangedHandler(UInt160 oldAdmin, UInt160 newAdmin);

    [DisplayName("GameService")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "OS GameService — app-scoped game pools with betting, settlement, and PaymentService integration")]
    [ContractPermission("*", "*")]
    public class GameService : SmartContract
    {
        // ── Storage Prefixes ──────────────────────────────────────────────
        private static readonly byte[] PREFIX_ADMIN           = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_PAYMENT_SERVICE = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_SCRIPT_ENGINE   = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_POOLS           = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_PLAYER_STATE    = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_COUNTERS        = new byte[] { 0x30 };
        private static readonly byte[] PREFIX_APP_CONFIG      = new byte[] { 0x40 };

        // ── Pool Types ────────────────────────────────────────────────────
        public const byte POOL_COUNTDOWN = 0;
        public const byte POOL_PVP       = 1;
        public const byte POOL_LOTTERY   = 2;

        // ── Pool Status ───────────────────────────────────────────────────
        public const byte STATUS_OPEN      = 0;
        public const byte STATUS_ACTIVE    = 1;
        public const byte STATUS_SETTLED   = 2;
        public const byte STATUS_CANCELLED = 3;

        // ── Limits ────────────────────────────────────────────────────────
        private const int MAX_PLAYERS           = 1000;
        private const int MAX_SETTLE_RECIPIENTS = 50;

        // ── Structs ───────────────────────────────────────────────────────

        public struct AppConfig
        {
            public string AppId;
            public bool Active;
            public BigInteger UpdatedAt;
        }

        public struct PoolConfig
        {
            public byte PoolType;
            public int MaxPlayers;
            public BigInteger EntryFee;
            public BigInteger Duration;
        }

        public struct PoolState
        {
            public BigInteger PoolId;
            public string AppId;
            public PoolConfig Config;
            public byte Status;
            public int PlayerCount;
            public BigInteger TotalBets;
            public BigInteger CreatedAt;
            public BigInteger ExpiresAt;
        }

        public struct PlayerState
        {
            public UInt160 Player;
            public BigInteger TotalBet;
            public bool Joined;
        }

        // ── Events ────────────────────────────────────────────────────────
        [DisplayName("PoolCreated")]
        public static event PoolCreatedHandler OnPoolCreated = delegate { };

        [DisplayName("PoolClosed")]
        public static event PoolClosedHandler OnPoolClosed = delegate { };

        [DisplayName("PlayerJoined")]
        public static event PlayerJoinedHandler OnPlayerJoined = delegate { };

        [DisplayName("BetPlaced")]
        public static event BetPlacedHandler OnBetPlaced = delegate { };

        [DisplayName("PoolSettled")]
        public static event PoolSettledHandler OnPoolSettled = delegate { };

        [DisplayName("GameConfigured")]
        public static event GameConfiguredHandler OnGameConfigured = delegate { };

        [DisplayName("AdminChanged")]
        public static event GameAdminChangedHandler OnAdminChanged = delegate { };

        // ── Lifecycle ─────────────────────────────────────────────────────

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Transaction tx = Runtime.Transaction;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, tx.Sender);
        }

        public static void Update(ByteString nefFile, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nefFile, manifest, new object[0]);
        }

        // ── Admin Management ──────────────────────────────────────────────

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != UInt160.Zero && newAdmin.IsValid, "invalid admin");
            UInt160 oldAdmin = GetAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, (ByteString)newAdmin);
            OnAdminChanged(oldAdmin, newAdmin);
        }

        [Safe]
        public static UInt160 GetAdmin()
        {
            return ReadAddress(PREFIX_ADMIN);
        }

        public static void SetPaymentService(UInt160 paymentService)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(paymentService != UInt160.Zero && paymentService.IsValid, "invalid payment service");
            Storage.Put(Storage.CurrentContext, PREFIX_PAYMENT_SERVICE, (ByteString)paymentService);
        }

        public static void SetScriptEngine(UInt160 engine)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(engine != UInt160.Zero && engine.IsValid, "invalid engine");
            Storage.Put(Storage.CurrentContext, PREFIX_SCRIPT_ENGINE, (ByteString)engine);
        }

        // ── Configuration ─────────────────────────────────────────────────

        public static void Configure(string appId)
        {
            ValidateAppId(appId);
            ValidateAdmin();

            AppConfig config = new AppConfig
            {
                AppId = appId,
                Active = true,
                UpdatedAt = Runtime.Time
            };

            Storage.Put(Storage.CurrentContext, AppConfigKey(appId), StdLib.Serialize(config));
            OnGameConfigured(appId);
        }

        // ── Pool Operations ───────────────────────────────────────────────

        public static BigInteger CreatePool(string appId, byte poolType, int maxPlayers, BigInteger entryFee, BigInteger duration)
        {
            ValidateAppId(appId);
            ValidateAdmin();
            RequireActiveApp(appId);

            ExecutionEngine.Assert(poolType <= POOL_LOTTERY, "invalid pool type");
            ExecutionEngine.Assert(maxPlayers > 0 && maxPlayers <= MAX_PLAYERS, "invalid max players");
            ExecutionEngine.Assert(entryFee >= 0, "entry fee cannot be negative");
            ExecutionEngine.Assert(duration > 0, "duration must be > 0");

            BigInteger poolId = ReadBigInteger(PoolCounterKey(appId)) + 1;
            Storage.Put(Storage.CurrentContext, PoolCounterKey(appId), poolId);

            PoolConfig poolConfig = new PoolConfig
            {
                PoolType = poolType,
                MaxPlayers = maxPlayers,
                EntryFee = entryFee,
                Duration = duration
            };

            PoolState pool = new PoolState
            {
                PoolId = poolId,
                AppId = appId,
                Config = poolConfig,
                Status = STATUS_OPEN,
                PlayerCount = 0,
                TotalBets = 0,
                CreatedAt = Runtime.Time,
                ExpiresAt = Runtime.Time + duration
            };

            StorePool(appId, poolId, pool);
            OnPoolCreated(appId, poolId, poolType, entryFee);
            return poolId;
        }

        public static void ClosePool(string appId, BigInteger poolId)
        {
            ValidateAppId(appId);
            ValidateAdmin();

            PoolState pool = GetPoolInternal(appId, poolId);
            ExecutionEngine.Assert(pool.PoolId > 0, "pool not found");
            ExecutionEngine.Assert(pool.Status == STATUS_OPEN || pool.Status == STATUS_ACTIVE, "pool not active");

            pool.Status = STATUS_CANCELLED;
            StorePool(appId, poolId, pool);
            OnPoolClosed(appId, poolId);
        }

        public static void JoinPool(string appId, BigInteger poolId, UInt160 player)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(player != UInt160.Zero && player.IsValid, "invalid player");
            ExecutionEngine.Assert(Runtime.CheckWitness(player), "unauthorized");

            PoolState pool = GetPoolInternal(appId, poolId);
            ExecutionEngine.Assert(pool.PoolId > 0, "pool not found");
            ExecutionEngine.Assert(pool.Status == STATUS_OPEN, "pool not open");
            ExecutionEngine.Assert(pool.PlayerCount < pool.Config.MaxPlayers, "pool full");
            ExecutionEngine.Assert(Runtime.Time < pool.ExpiresAt, "pool expired");

            // Check if player already joined
            PlayerState playerState = GetPlayerStateInternal(appId, poolId, player);
            ExecutionEngine.Assert(!playerState.Joined, "already joined");

            // If there's an entry fee, deduct from PaymentService balance
            if (pool.Config.EntryFee > 0)
            {
                UInt160 paymentService = ReadAddress(PREFIX_PAYMENT_SERVICE);
                ExecutionEngine.Assert(paymentService != UInt160.Zero && paymentService.IsValid, "payment service not set");

                Contract.Call(paymentService, "transfer", CallFlags.All,
                    appId, player, Runtime.ExecutingScriptHash, pool.Config.EntryFee);

                pool.TotalBets += pool.Config.EntryFee;
            }

            pool.PlayerCount += 1;
            if (pool.PlayerCount >= pool.Config.MaxPlayers)
            {
                pool.Status = STATUS_ACTIVE;
            }
            StorePool(appId, poolId, pool);

            playerState.Player = player;
            playerState.Joined = true;
            playerState.TotalBet = pool.Config.EntryFee;
            StorePlayerState(appId, poolId, player, playerState);

            OnPlayerJoined(appId, poolId, player);
        }

        public static void PlaceBet(string appId, BigInteger poolId, UInt160 player, BigInteger amount)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(player != UInt160.Zero && player.IsValid, "invalid player");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(Runtime.CheckWitness(player), "unauthorized");

            PoolState pool = GetPoolInternal(appId, poolId);
            ExecutionEngine.Assert(pool.PoolId > 0, "pool not found");
            ExecutionEngine.Assert(pool.Status == STATUS_OPEN || pool.Status == STATUS_ACTIVE, "pool not active");
            ExecutionEngine.Assert(Runtime.Time < pool.ExpiresAt, "pool expired");

            PlayerState playerState = GetPlayerStateInternal(appId, poolId, player);
            ExecutionEngine.Assert(playerState.Joined, "not joined");

            // Deduct from PaymentService balance
            UInt160 paymentService = ReadAddress(PREFIX_PAYMENT_SERVICE);
            ExecutionEngine.Assert(paymentService != UInt160.Zero && paymentService.IsValid, "payment service not set");

            Contract.Call(paymentService, "transfer", CallFlags.All,
                appId, player, Runtime.ExecutingScriptHash, amount);

            playerState.TotalBet += amount;
            pool.TotalBets += amount;

            StorePlayerState(appId, poolId, player, playerState);
            StorePool(appId, poolId, pool);

            OnBetPlaced(appId, poolId, player, amount);
        }

        public static void Settle(string appId, BigInteger poolId, UInt160[] recipients, BigInteger[] amounts)
        {
            ValidateAppId(appId);
            ValidateAdmin();

            ExecutionEngine.Assert(recipients != null && recipients!.Length > 0, "recipients required");
            ExecutionEngine.Assert(amounts != null && amounts!.Length > 0, "amounts required");
            ExecutionEngine.Assert(recipients!.Length == amounts!.Length, "recipients/amounts mismatch");
            ExecutionEngine.Assert(recipients.Length <= MAX_SETTLE_RECIPIENTS, "too many recipients");

            PoolState pool = GetPoolInternal(appId, poolId);
            ExecutionEngine.Assert(pool.PoolId > 0, "pool not found");
            ExecutionEngine.Assert(pool.Status == STATUS_OPEN || pool.Status == STATUS_ACTIVE, "pool not active");

            // Verify total distribution does not exceed pool
            BigInteger totalPrize = 0;
            for (int i = 0; i < recipients.Length; i++)
            {
                ExecutionEngine.Assert(recipients[i] != UInt160.Zero && recipients[i].IsValid, "invalid recipient");
                ExecutionEngine.Assert(amounts[i] > 0, "amount must be > 0");
                totalPrize += amounts[i];
            }
            ExecutionEngine.Assert(totalPrize <= pool.TotalBets, "distribution exceeds pool");

            // Distribute prizes via PaymentService
            UInt160 paymentService = ReadAddress(PREFIX_PAYMENT_SERVICE);
            ExecutionEngine.Assert(paymentService != UInt160.Zero && paymentService.IsValid, "payment service not set");

            Contract.Call(paymentService, "distributePrize", CallFlags.All,
                appId, recipients, amounts);

            pool.Status = STATUS_SETTLED;
            StorePool(appId, poolId, pool);

            OnPoolSettled(appId, poolId, recipients.Length, totalPrize);

            // ScriptEngine hook
            TriggerScriptHook(appId, "onSettlement", poolId, totalPrize);
        }

        // ── Safe Queries ──────────────────────────────────────────────────

        [Safe]
        public static PoolState GetPoolState(string appId, BigInteger poolId)
        {
            ValidateAppId(appId);
            return GetPoolInternal(appId, poolId);
        }

        [Safe]
        public static PlayerState GetPlayerState(string appId, BigInteger poolId, UInt160 player)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(player != UInt160.Zero && player.IsValid, "invalid player");
            return GetPlayerStateInternal(appId, poolId, player);
        }

        [Safe]
        public static BigInteger GetPoolCount(string appId)
        {
            ValidateAppId(appId);
            return ReadBigInteger(PoolCounterKey(appId));
        }

        // ── Internal Helpers ──────────────────────────────────────────────

        private static void ValidateAdmin()
        {
            UInt160 admin = GetAdmin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        private static void ValidateAppId(string appId)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "appId required");
        }

        private static void RequireActiveApp(string appId)
        {
            AppConfig config = GetAppConfigInternal(appId);
            ExecutionEngine.Assert(config.AppId.Length > 0, "app not configured");
            ExecutionEngine.Assert(config.Active, "app inactive");
        }

        private static UInt160 ReadAddress(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? UInt160.Zero : (UInt160)value;
        }

        private static BigInteger ReadBigInteger(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? 0 : (BigInteger)value;
        }

        private static void WriteBigInteger(byte[] key, BigInteger value)
        {
            if (value == 0)
                Storage.Delete(Storage.CurrentContext, key);
            else
                Storage.Put(Storage.CurrentContext, key, value);
        }

        // ── Key Builders ──────────────────────────────────────────────────

        private static byte[] AppConfigKey(string appId)
        {
            return Helper.Concat(PREFIX_APP_CONFIG, (ByteString)(appId ?? ""));
        }

        private static byte[] PoolKey(string appId, BigInteger poolId)
        {
            return Helper.Concat(PREFIX_POOLS,
                (ByteString)((appId ?? "") + "|" + poolId));
        }

        private static byte[] PlayerStateKey(string appId, BigInteger poolId, UInt160 player)
        {
            return Helper.Concat(PREFIX_PLAYER_STATE,
                (ByteString)((appId ?? "") + "|" + poolId + "|" + (string)(ByteString)(byte[])player));
        }

        private static byte[] PoolCounterKey(string appId)
        {
            return Helper.Concat(PREFIX_COUNTERS, (ByteString)(appId ?? ""));
        }

        // ── Pool/Player Read/Write ────────────────────────────────────────

        private static AppConfig GetAppConfigInternal(string appId)
        {
            ByteString? raw = Storage.Get(Storage.CurrentContext, AppConfigKey(appId));
            if (raw == null)
            {
                return new AppConfig
                {
                    AppId = "",
                    Active = false,
                    UpdatedAt = 0
                };
            }
            return (AppConfig)StdLib.Deserialize(raw);
        }

        private static PoolState GetPoolInternal(string appId, BigInteger poolId)
        {
            ExecutionEngine.Assert(poolId > 0, "invalid pool id");
            ByteString? data = Storage.Get(Storage.CurrentContext, PoolKey(appId, poolId));
            if (data == null)
            {
                return new PoolState
                {
                    PoolId = 0,
                    AppId = "",
                    Config = new PoolConfig
                    {
                        PoolType = 0,
                        MaxPlayers = 0,
                        EntryFee = 0,
                        Duration = 0
                    },
                    Status = 0,
                    PlayerCount = 0,
                    TotalBets = 0,
                    CreatedAt = 0,
                    ExpiresAt = 0
                };
            }
            return (PoolState)StdLib.Deserialize(data);
        }

        private static void StorePool(string appId, BigInteger poolId, PoolState pool)
        {
            Storage.Put(Storage.CurrentContext, PoolKey(appId, poolId), StdLib.Serialize(pool));
        }

        private static PlayerState GetPlayerStateInternal(string appId, BigInteger poolId, UInt160 player)
        {
            ByteString? data = Storage.Get(Storage.CurrentContext, PlayerStateKey(appId, poolId, player));
            if (data == null)
            {
                return new PlayerState
                {
                    Player = UInt160.Zero,
                    TotalBet = 0,
                    Joined = false
                };
            }
            return (PlayerState)StdLib.Deserialize(data);
        }

        private static void StorePlayerState(string appId, BigInteger poolId, UInt160 player, PlayerState state)
        {
            Storage.Put(Storage.CurrentContext, PlayerStateKey(appId, poolId, player), StdLib.Serialize(state));
        }

        // ── ScriptEngine Hook ─────────────────────────────────────────────

        private static void TriggerScriptHook(string appId, string hookName, BigInteger poolId, BigInteger totalPrize)
        {
            UInt160 engine = ReadAddress(PREFIX_SCRIPT_ENGINE);
            if (engine == UInt160.Zero || !engine.IsValid) return;

            try
            {
                Contract.Call(engine, "execute", CallFlags.All, appId, hookName, poolId, totalPrize);
            }
            catch
            {
                // Script failure must not block settlement
            }
        }
    }
}
