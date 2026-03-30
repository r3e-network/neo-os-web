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
    public delegate void BadgeDefinedHandler(string appId, string badgeId, string name, string criteria);
    public delegate void BadgeAwardedHandler(string appId, string badgeId, UInt160 recipient, BigInteger timestamp);
    public delegate void BadgeRevokedHandler(string appId, string badgeId, UInt160 recipient, BigInteger timestamp);
    public delegate void StatUpdatedHandler(string appId, UInt160 user, string statKey, BigInteger newValue, BigInteger delta);
    public delegate void BadgeAppConfiguredHandler(string appId);
    public delegate void BadgeAdminChangedHandler(UInt160 oldAdmin, UInt160 newAdmin);

    [DisplayName("BadgeService")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "OS BadgeService — app-scoped achievement badges and stats tracking")]
    [ContractPermission("*", "*")]
    public class BadgeService : SmartContract
    {
        // ── Storage Prefixes ──────────────────────────────────────────────
        private static readonly byte[] PREFIX_ADMIN            = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_SCRIPT_ENGINE    = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_APP_CONFIG       = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_BADGE_DEF        = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_USER_BADGE       = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_USER_BADGE_COUNT = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_USER_STAT        = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_TOTALS           = new byte[] { 0x30 };

        // ── Structs ───────────────────────────────────────────────────────

        public struct AppConfig
        {
            public string AppId;
            public bool Active;
            public BigInteger UpdatedAt;
        }

        public struct BadgeDefinition
        {
            public string BadgeId;
            public string Name;
            public string Criteria;
            public BigInteger CreatedAt;
        }

        // ── Events ────────────────────────────────────────────────────────
        [DisplayName("BadgeDefined")]
        public static event BadgeDefinedHandler OnBadgeDefined = delegate { };

        [DisplayName("BadgeAwarded")]
        public static event BadgeAwardedHandler OnBadgeAwarded = delegate { };

        [DisplayName("BadgeRevoked")]
        public static event BadgeRevokedHandler OnBadgeRevoked = delegate { };

        [DisplayName("StatUpdated")]
        public static event StatUpdatedHandler OnStatUpdated = delegate { };

        [DisplayName("AppConfigured")]
        public static event BadgeAppConfiguredHandler OnAppConfigured = delegate { };

        [DisplayName("AdminChanged")]
        public static event BadgeAdminChangedHandler OnAdminChanged = delegate { };

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
            OnAppConfigured(appId);
        }

        // ── Badge Operations ──────────────────────────────────────────────

        public static void DefineBadge(string appId, string badgeId, string name, string criteria)
        {
            ValidateAppId(appId);
            ValidateIdentifier(badgeId, "badge id");
            ExecutionEngine.Assert(name != null && name.Length > 0, "badge name required");
            ExecutionEngine.Assert(name!.Length <= 256, "badge name too long");
            ValidateAdmin();

            RequireActiveApp(appId);

            BadgeDefinition existing = GetBadgeDefInternal(appId, badgeId);
            bool isNew = existing.BadgeId.Length == 0;

            BadgeDefinition badge = new BadgeDefinition
            {
                BadgeId = badgeId,
                Name = name,
                Criteria = criteria ?? "",
                CreatedAt = isNew ? Runtime.Time : existing.CreatedAt
            };

            Storage.Put(Storage.CurrentContext, BadgeDefKey(appId, badgeId), StdLib.Serialize(badge));

            if (isNew)
            {
                byte[] totalKey = TotalKey(appId, "badges");
                BigInteger total = ReadBigInteger(totalKey);
                Storage.Put(Storage.CurrentContext, totalKey, total + 1);
            }

            OnBadgeDefined(appId, badgeId, name, criteria ?? "");
        }

        public static void AwardBadge(string appId, string badgeId, UInt160 recipient)
        {
            ValidateAppId(appId);
            ValidateIdentifier(badgeId, "badge id");
            ExecutionEngine.Assert(recipient != UInt160.Zero && recipient.IsValid, "invalid recipient");
            ValidateAdmin();

            RequireActiveApp(appId);

            // Verify badge is defined
            BadgeDefinition badge = GetBadgeDefInternal(appId, badgeId);
            ExecutionEngine.Assert(badge.BadgeId.Length > 0, "badge not defined");

            // Check if already awarded
            byte[] userBadgeKey = UserBadgeKey(appId, badgeId, recipient);
            ByteString? existing = Storage.Get(Storage.CurrentContext, userBadgeKey);
            if (existing != null && (BigInteger)existing == 1)
            {
                return; // Already has badge, no-op
            }

            // Award the badge
            Storage.Put(Storage.CurrentContext, userBadgeKey, 1);

            // Increment user badge count
            byte[] countKey = UserBadgeCountKey(appId, recipient);
            BigInteger count = ReadBigInteger(countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            // Increment app-wide awarded count
            byte[] totalKey = TotalKey(appId, "awarded");
            BigInteger total = ReadBigInteger(totalKey);
            Storage.Put(Storage.CurrentContext, totalKey, total + 1);

            OnBadgeAwarded(appId, badgeId, recipient, Runtime.Time);

            // ScriptEngine hook
            TriggerScriptHook(appId, "onBadgeAwarded", recipient, count + 1);
        }

        public static void RevokeBadge(string appId, string badgeId, UInt160 recipient)
        {
            ValidateAppId(appId);
            ValidateIdentifier(badgeId, "badge id");
            ExecutionEngine.Assert(recipient != UInt160.Zero && recipient.IsValid, "invalid recipient");
            ValidateAdmin();

            // Check if badge is awarded
            byte[] userBadgeKey = UserBadgeKey(appId, badgeId, recipient);
            ByteString? existing = Storage.Get(Storage.CurrentContext, userBadgeKey);
            if (existing == null || (BigInteger)existing != 1)
            {
                return; // Does not have badge, no-op
            }

            // Revoke the badge
            Storage.Delete(Storage.CurrentContext, userBadgeKey);

            // Decrement user badge count
            byte[] countKey = UserBadgeCountKey(appId, recipient);
            BigInteger count = ReadBigInteger(countKey);
            if (count > 0)
            {
                Storage.Put(Storage.CurrentContext, countKey, count - 1);
            }

            OnBadgeRevoked(appId, badgeId, recipient, Runtime.Time);
        }

        // ── Stat Operations ───────────────────────────────────────────────

        public static void UpdateStat(string appId, UInt160 user, string statKey, BigInteger value)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(user != UInt160.Zero && user.IsValid, "invalid user");
            ValidateIdentifier(statKey, "stat key");
            ValidateAdmin();

            RequireActiveApp(appId);

            byte[] key = UserStatKey(appId, user, statKey);
            BigInteger previous = ReadBigInteger(key);

            if (value <= 0)
            {
                Storage.Delete(Storage.CurrentContext, key);
            }
            else
            {
                Storage.Put(Storage.CurrentContext, key, value);
            }

            OnStatUpdated(appId, user, statKey, value, value - previous);
        }

        // ── Safe Queries ──────────────────────────────────────────────────

        [Safe]
        public static BadgeDefinition GetBadge(string appId, string badgeId)
        {
            ValidateAppId(appId);
            ValidateIdentifier(badgeId, "badge id");
            return GetBadgeDefInternal(appId, badgeId);
        }

        [Safe]
        public static bool HasBadge(string appId, string badgeId, UInt160 user)
        {
            ValidateAppId(appId);
            ValidateIdentifier(badgeId, "badge id");
            ExecutionEngine.Assert(user != UInt160.Zero && user.IsValid, "invalid user");

            ByteString? raw = Storage.Get(Storage.CurrentContext, UserBadgeKey(appId, badgeId, user));
            return raw != null && (BigInteger)raw == 1;
        }

        [Safe]
        public static BigInteger GetBadges(string appId, UInt160 user)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(user != UInt160.Zero && user.IsValid, "invalid user");
            return ReadBigInteger(UserBadgeCountKey(appId, user));
        }

        [Safe]
        public static BigInteger GetStat(string appId, UInt160 user, string statKey)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(user != UInt160.Zero && user.IsValid, "invalid user");
            ValidateIdentifier(statKey, "stat key");
            return ReadBigInteger(UserStatKey(appId, user, statKey));
        }

        [Safe]
        public static BigInteger GetTotalBadgesDefined(string appId)
        {
            ValidateAppId(appId);
            return ReadBigInteger(TotalKey(appId, "badges"));
        }

        [Safe]
        public static BigInteger GetTotalBadgesAwarded(string appId)
        {
            ValidateAppId(appId);
            return ReadBigInteger(TotalKey(appId, "awarded"));
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

        private static void ValidateIdentifier(string value, string label)
        {
            string normalized = value ?? "";
            ExecutionEngine.Assert(normalized.Length > 0, label + " required");
            ExecutionEngine.Assert(normalized.Length <= 128, label + " too long");
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

        // ── Key Builders ──────────────────────────────────────────────────

        private static byte[] AppConfigKey(string appId)
        {
            return Helper.Concat(PREFIX_APP_CONFIG, (ByteString)(appId ?? ""));
        }

        private static byte[] BadgeDefKey(string appId, string badgeId)
        {
            return Helper.Concat(PREFIX_BADGE_DEF,
                (ByteString)((appId ?? "") + "|" + (badgeId ?? "")));
        }

        private static byte[] UserBadgeKey(string appId, string badgeId, UInt160 user)
        {
            return Helper.Concat(PREFIX_USER_BADGE,
                (ByteString)((appId ?? "") + "|" + (badgeId ?? "") + "|" + (string)(ByteString)(byte[])user));
        }

        private static byte[] UserBadgeCountKey(string appId, UInt160 user)
        {
            return Helper.Concat(PREFIX_USER_BADGE_COUNT,
                (ByteString)((appId ?? "") + "|" + (string)(ByteString)(byte[])user));
        }

        private static byte[] UserStatKey(string appId, UInt160 user, string statKey)
        {
            return Helper.Concat(PREFIX_USER_STAT,
                (ByteString)((appId ?? "") + "|" + (string)(ByteString)(byte[])user + "|" + (statKey ?? "")));
        }

        private static byte[] TotalKey(string appId, string counter)
        {
            return Helper.Concat(PREFIX_TOTALS,
                (ByteString)((appId ?? "") + "|" + counter));
        }

        // ── Config Read ───────────────────────────────────────────────────

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

        private static BadgeDefinition GetBadgeDefInternal(string appId, string badgeId)
        {
            ByteString? raw = Storage.Get(Storage.CurrentContext, BadgeDefKey(appId, badgeId));
            if (raw == null)
            {
                return new BadgeDefinition
                {
                    BadgeId = "",
                    Name = "",
                    Criteria = "",
                    CreatedAt = 0
                };
            }
            return (BadgeDefinition)StdLib.Deserialize(raw);
        }

        // ── ScriptEngine Hook ─────────────────────────────────────────────

        private static void TriggerScriptHook(string appId, string hookName, UInt160 user, BigInteger value)
        {
            UInt160 engine = ReadAddress(PREFIX_SCRIPT_ENGINE);
            if (engine == UInt160.Zero || !engine.IsValid) return;

            try
            {
                Contract.Call(engine, "execute", CallFlags.All, appId, hookName, user, value);
            }
            catch
            {
                // Script failure must not block badge processing
            }
        }
    }
}
