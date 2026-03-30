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
    public delegate void StreamCreatedHandler(string appId, BigInteger streamId, UInt160 creator, UInt160 beneficiary, BigInteger totalAmount);
    public delegate void StreamClaimedHandler(string appId, BigInteger streamId, UInt160 beneficiary, BigInteger claimed, BigInteger totalReleased);
    public delegate void StreamCancelledHandler(string appId, BigInteger streamId, UInt160 creator, BigInteger refunded, BigInteger unlocked);
    public delegate void VestingConfiguredHandler(string appId);
    public delegate void VestingAdminChangedHandler(UInt160 oldAdmin, UInt160 newAdmin);

    [DisplayName("VestingService")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "OS VestingService — app-scoped stream vesting with pro-rata release")]
    [ContractPermission("*", "*")]
    public class VestingService : SmartContract
    {
        // ── Storage Prefixes ──────────────────────────────────────────────
        private static readonly byte[] PREFIX_ADMIN          = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_SCRIPT_ENGINE  = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_APP_CONFIG     = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_STREAM_COUNTER = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_STREAM         = new byte[] { 0x21 };

        // ── Constants ─────────────────────────────────────────────────────
        private const long MIN_INTERVAL_SECONDS = 86400;
        private const long MAX_INTERVAL_SECONDS = 365 * 86400;
        private const int  MAX_TITLE_LENGTH     = 60;
        private const int  MAX_NOTES_LENGTH     = 240;

        // ── Structs ───────────────────────────────────────────────────────

        public struct AppConfig
        {
            public string AppId;
            public bool Active;
            public BigInteger UpdatedAt;
        }

        public struct StreamData
        {
            public UInt160 Creator;
            public UInt160 Beneficiary;
            public BigInteger TotalAmount;
            public BigInteger ReleasedAmount;
            public BigInteger RateAmount;
            public BigInteger IntervalSeconds;
            public BigInteger CreatedTime;
            public bool Cancelled;
            public string Title;
            public string Notes;
        }

        // ── Events ────────────────────────────────────────────────────────
        [DisplayName("StreamCreated")]
        public static event StreamCreatedHandler OnStreamCreated = delegate { };

        [DisplayName("StreamClaimed")]
        public static event StreamClaimedHandler OnStreamClaimed = delegate { };

        [DisplayName("StreamCancelled")]
        public static event StreamCancelledHandler OnStreamCancelled = delegate { };

        [DisplayName("VestingConfigured")]
        public static event VestingConfiguredHandler OnVestingConfigured = delegate { };

        [DisplayName("AdminChanged")]
        public static event VestingAdminChangedHandler OnAdminChanged = delegate { };

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
            OnVestingConfigured(appId);
        }

        // ── Stream Operations ─────────────────────────────────────────────

        public static BigInteger CreateStream(
            string appId,
            UInt160 creator,
            UInt160 beneficiary,
            BigInteger totalAmount,
            BigInteger rateAmount,
            BigInteger intervalSeconds,
            string title,
            string notes)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(creator != UInt160.Zero && creator.IsValid, "invalid creator");
            ExecutionEngine.Assert(beneficiary != UInt160.Zero && beneficiary.IsValid, "invalid beneficiary");
            ExecutionEngine.Assert(totalAmount > 0, "invalid total");
            ExecutionEngine.Assert(rateAmount > 0 && rateAmount <= totalAmount, "invalid rate");
            ExecutionEngine.Assert(intervalSeconds >= MIN_INTERVAL_SECONDS && intervalSeconds <= MAX_INTERVAL_SECONDS, "invalid interval");
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "unauthorized");

            RequireActiveApp(appId);

            string normalizedTitle = title ?? "";
            string normalizedNotes = notes ?? "";
            ExecutionEngine.Assert(normalizedTitle.Length <= MAX_TITLE_LENGTH, "title too long");
            ExecutionEngine.Assert(normalizedNotes.Length <= MAX_NOTES_LENGTH, "notes too long");

            // Transfer GAS from creator to this contract for custody
            bool transferred = (bool)Contract.Call(
                GAS.Hash, "transfer", CallFlags.All,
                creator, Runtime.ExecutingScriptHash, totalAmount, appId);
            ExecutionEngine.Assert(transferred, "fund transfer failed");

            BigInteger streamId = ReadBigInteger(StreamCounterKey(appId)) + 1;
            Storage.Put(Storage.CurrentContext, StreamCounterKey(appId), streamId);

            StreamData stream = new StreamData
            {
                Creator = creator,
                Beneficiary = beneficiary,
                TotalAmount = totalAmount,
                ReleasedAmount = 0,
                RateAmount = rateAmount,
                IntervalSeconds = intervalSeconds,
                CreatedTime = Runtime.Time,
                Cancelled = false,
                Title = normalizedTitle,
                Notes = normalizedNotes
            };

            StoreStream(appId, streamId, stream);
            OnStreamCreated(appId, streamId, creator, beneficiary, totalAmount);

            // ScriptEngine hook
            TriggerScriptHook(appId, "onStreamCreated", streamId, totalAmount);

            return streamId;
        }

        public static void Claim(string appId, UInt160 beneficiary, BigInteger streamId)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(beneficiary != UInt160.Zero && beneficiary.IsValid, "invalid beneficiary");
            ExecutionEngine.Assert(Runtime.CheckWitness(beneficiary), "unauthorized");

            RequireActiveApp(appId);

            StreamData stream = GetStreamInternal(appId, streamId);
            ExecutionEngine.Assert(stream.Creator != UInt160.Zero, "stream not found");
            ExecutionEngine.Assert(stream.Beneficiary == beneficiary, "wrong beneficiary");
            ExecutionEngine.Assert(!stream.Cancelled, "stream cancelled");

            BigInteger claimable = GetClaimableAmount(stream);
            ExecutionEngine.Assert(claimable > 0, "nothing claimable");

            stream.ReleasedAmount += claimable;
            StoreStream(appId, streamId, stream);

            // Transfer GAS to beneficiary
            bool transferred = (bool)Contract.Call(
                GAS.Hash, "transfer", CallFlags.All,
                Runtime.ExecutingScriptHash, beneficiary, claimable, null);
            ExecutionEngine.Assert(transferred, "claim transfer failed");

            OnStreamClaimed(appId, streamId, beneficiary, claimable, stream.ReleasedAmount);

            // ScriptEngine hook
            TriggerScriptHook(appId, "onStreamClaimed", streamId, claimable);
        }

        public static void Cancel(string appId, UInt160 creator, BigInteger streamId)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(creator != UInt160.Zero && creator.IsValid, "invalid creator");
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "unauthorized");

            StreamData stream = GetStreamInternal(appId, streamId);
            ExecutionEngine.Assert(stream.Creator != UInt160.Zero, "stream not found");
            ExecutionEngine.Assert(stream.Creator == creator, "wrong creator");
            ExecutionEngine.Assert(!stream.Cancelled, "already cancelled");

            BigInteger unlockedAmount = GetUnlockedAmount(stream);
            BigInteger refundAmount = stream.TotalAmount - unlockedAmount;
            if (refundAmount < 0) refundAmount = 0;

            // Release unclaimed vested amount to beneficiary
            BigInteger unclaimedVested = unlockedAmount - stream.ReleasedAmount;
            if (unclaimedVested < 0) unclaimedVested = 0;

            stream.Cancelled = true;
            stream.ReleasedAmount += unclaimedVested;
            StoreStream(appId, streamId, stream);

            // Transfer unclaimed vested to beneficiary
            if (unclaimedVested > 0)
            {
                bool t1 = (bool)Contract.Call(
                    GAS.Hash, "transfer", CallFlags.All,
                    Runtime.ExecutingScriptHash, stream.Beneficiary, unclaimedVested, null);
                ExecutionEngine.Assert(t1, "beneficiary transfer failed");
            }

            // Refund unvested to creator
            if (refundAmount > 0)
            {
                bool t2 = (bool)Contract.Call(
                    GAS.Hash, "transfer", CallFlags.All,
                    Runtime.ExecutingScriptHash, creator, refundAmount, null);
                ExecutionEngine.Assert(t2, "refund transfer failed");
            }

            OnStreamCancelled(appId, streamId, creator, refundAmount, unlockedAmount);

            // ScriptEngine hook
            TriggerScriptHook(appId, "onStreamCancelled", streamId, refundAmount);
        }

        // ── Safe Queries ──────────────────────────────────────────────────

        [Safe]
        public static StreamData GetStream(string appId, BigInteger streamId)
        {
            ValidateAppId(appId);
            return GetStreamInternal(appId, streamId);
        }

        [Safe]
        public static BigInteger ListStreams(string appId)
        {
            ValidateAppId(appId);
            return ReadBigInteger(StreamCounterKey(appId));
        }

        [Safe]
        public static BigInteger GetClaimable(string appId, BigInteger streamId)
        {
            ValidateAppId(appId);
            StreamData stream = GetStreamInternal(appId, streamId);
            return GetClaimableAmount(stream);
        }

        [Safe]
        public static AppConfig GetConfig(string appId)
        {
            ValidateAppId(appId);
            return GetAppConfigInternal(appId);
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

        private static byte[] StreamCounterKey(string appId)
        {
            return Helper.Concat(PREFIX_STREAM_COUNTER, (ByteString)(appId ?? ""));
        }

        private static byte[] StreamKey(string appId, BigInteger streamId)
        {
            return Helper.Concat(PREFIX_STREAM,
                (ByteString)((appId ?? "") + "|" + streamId));
        }

        // ── Stream Read/Write ─────────────────────────────────────────────

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

        private static StreamData GetStreamInternal(string appId, BigInteger streamId)
        {
            ExecutionEngine.Assert(streamId > 0, "invalid stream id");
            ByteString? data = Storage.Get(Storage.CurrentContext, StreamKey(appId, streamId));
            if (data == null)
            {
                return new StreamData
                {
                    Creator = UInt160.Zero,
                    Beneficiary = UInt160.Zero,
                    TotalAmount = 0,
                    ReleasedAmount = 0,
                    RateAmount = 0,
                    IntervalSeconds = 0,
                    CreatedTime = 0,
                    Cancelled = false,
                    Title = "",
                    Notes = ""
                };
            }
            return (StreamData)StdLib.Deserialize(data);
        }

        private static void StoreStream(string appId, BigInteger streamId, StreamData stream)
        {
            Storage.Put(Storage.CurrentContext, StreamKey(appId, streamId), StdLib.Serialize(stream));
        }

        private static BigInteger GetUnlockedAmount(StreamData stream)
        {
            if (stream.Creator == UInt160.Zero) return 0;
            if (stream.Cancelled) return stream.ReleasedAmount;

            BigInteger elapsed = Runtime.Time - stream.CreatedTime;
            if (elapsed <= 0) return 0;

            BigInteger intervalsElapsed = elapsed / stream.IntervalSeconds;
            BigInteger unlockedAmount = intervalsElapsed * stream.RateAmount;
            if (unlockedAmount > stream.TotalAmount) unlockedAmount = stream.TotalAmount;
            return unlockedAmount;
        }

        private static BigInteger GetClaimableAmount(StreamData stream)
        {
            BigInteger unlockedAmount = GetUnlockedAmount(stream);
            BigInteger claimable = unlockedAmount - stream.ReleasedAmount;
            return claimable > 0 ? claimable : 0;
        }

        // ── ScriptEngine Hook ─────────────────────────────────────────────

        private static void TriggerScriptHook(string appId, string hookName, BigInteger streamId, BigInteger amount)
        {
            UInt160 engine = ReadAddress(PREFIX_SCRIPT_ENGINE);
            if (engine == UInt160.Zero || !engine.IsValid) return;

            try
            {
                Contract.Call(engine, "execute", CallFlags.All, appId, hookName, streamId, amount);
            }
            catch
            {
                // Script failure must not block vesting operations
            }
        }
    }
}
