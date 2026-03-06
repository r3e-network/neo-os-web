using System;
using System.ComponentModel;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public enum AppStatus : byte
    {
        Pending = 0,
        Approved = 1,
        Disabled = 2
    }

    // Custom delegates for events with named parameters
    public delegate void AppRegisteredHandler(string appId, UInt160 developer, string name, string category);
    public delegate void AppUpdatedHandler(string appId, ByteString manifestHash, string entryUrl);
    public delegate void StatusChangedHandler(string appId, AppStatus oldStatus, AppStatus newStatus);
    public delegate void AllowlistUpdatedHandler(string appId, ByteString allowlistHash);
    public delegate void AdminChangedHandler(UInt160 oldAdmin, UInt160 newAdmin);
    public delegate void ContractHashUpdatedHandler(string appId, ByteString contractHash);
    public delegate void TeeScriptRegisteredHandler(string appId, string scriptName, ByteString scriptHash);

    [DisplayName("AppRegistry")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "On-chain miniapp registry (manifest hash + status + allowlist anchors)")]
    public class AppRegistry : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_APP = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_TEE_SCRIPT = new byte[] { 0x03 };

        public struct AppInfo
        {
            public string AppId;
            public UInt160 Developer;
            public ByteString DeveloperPubKey;
            public string EntryUrl;
            public ByteString ManifestHash;
            public AppStatus Status;
            public ByteString AllowlistHash;
            public string Name;
            public string Description;
            public string Icon;
            public string Banner;
            public string Category;
            public ByteString ContractHash;
        }

        [DisplayName("AppRegistered")]
        public static event AppRegisteredHandler OnAppRegistered = delegate { };

        [DisplayName("AppUpdated")]
        public static event AppUpdatedHandler OnAppUpdated = delegate { };

        [DisplayName("StatusChanged")]
        public static event StatusChangedHandler OnStatusChanged = delegate { };

        [DisplayName("AllowlistUpdated")]
        public static event AllowlistUpdatedHandler OnAllowlistUpdated = delegate { };

        [DisplayName("AdminChanged")]
        public static event AdminChangedHandler OnAdminChanged = delegate { };

        [DisplayName("ContractHashUpdated")]
        public static event ContractHashUpdatedHandler OnContractHashUpdated = delegate { };

        [DisplayName("TeeScriptRegistered")]
        public static event TeeScriptRegisteredHandler OnTeeScriptRegistered = delegate { };

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Transaction tx = Runtime.Transaction;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, tx.Sender);
        }

        private static UInt160 ReadAddress(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? UInt160.Zero : (UInt160)value;
        }

        public static UInt160 Admin()
        {
            return ReadAddress(PREFIX_ADMIN);
        }

        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        private static StorageMap AppMap() => new StorageMap(Storage.CurrentContext, PREFIX_APP);

        private static ByteString AppKey(string appId)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "app id required");
            return (ByteString)(appId ?? "");
        }

        private static ByteString NormalizeContractHash(ByteString contractHash)
        {
            if (contractHash == null || contractHash.Length == 0) return (ByteString)"";
            ExecutionEngine.Assert(contractHash.Length == 20, "invalid contract hash");
            return contractHash;
        }

        public static AppInfo GetApp(string appId)
        {
            ByteString? raw = AppMap().Get(AppKey(appId));
            if (raw == null)
            {
                // Avoid returning `default` struct which may be represented as an empty VMArray.
                return new AppInfo
                {
                    AppId = "",
                    Developer = UInt160.Zero,
                    DeveloperPubKey = (ByteString)"",
                    EntryUrl = "",
                    ManifestHash = (ByteString)"",
                    Status = AppStatus.Pending,
                    AllowlistHash = (ByteString)"",
                    Name = "",
                    Description = "",
                    Icon = "",
                    Banner = "",
                    Category = "",
                    ContractHash = (ByteString)""
                };
            }
            return (AppInfo)StdLib.Deserialize(raw);
        }

        private static void RegisterInternal(
            string appId,
            ByteString manifestHash,
            string entryUrl,
            ByteString developerPubKey,
            ByteString contractHash,
            string name,
            string description,
            string icon,
            string banner,
            string category)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "app id required");
            ExecutionEngine.Assert(manifestHash != null && manifestHash.Length > 0, "manifest hash required");
            ExecutionEngine.Assert(entryUrl != null && entryUrl.Length > 0, "entry url required");
            ExecutionEngine.Assert(developerPubKey != null && developerPubKey.Length > 0, "developer pubkey required");

            string normalizedAppId = appId ?? "";
            ByteString normalizedManifestHash = manifestHash ?? (ByteString)"";
            string normalizedEntryUrl = entryUrl ?? "";
            ByteString normalizedDeveloperPubKey = developerPubKey ?? (ByteString)"";
            ByteString normalizedContractHash = NormalizeContractHash(contractHash ?? (ByteString)"");
            string normalizedName = name ?? "";
            string normalizedDescription = description ?? "";
            string normalizedIcon = icon ?? "";
            string normalizedBanner = banner ?? "";
            string normalizedCategory = category ?? "";

            ExecutionEngine.Assert(normalizedAppId.Length <= 64, "appId too long");
            ExecutionEngine.Assert(normalizedEntryUrl.Length <= 512, "entryUrl too long");

            ECPoint pubKey = (ECPoint)(byte[])normalizedDeveloperPubKey;
            ExecutionEngine.Assert(pubKey != null && pubKey.IsValid, "invalid developer pubkey");
            ExecutionEngine.Assert(Runtime.CheckWitness(pubKey!), "unauthorized");

            ByteString key = AppKey(normalizedAppId);
            ByteString? existing = AppMap().Get(key);
            ExecutionEngine.Assert(existing == null, "already registered");

            Transaction tx = Runtime.Transaction;

            AppInfo info = new AppInfo
            {
                AppId = normalizedAppId,
                Developer = tx.Sender,
                DeveloperPubKey = normalizedDeveloperPubKey,
                EntryUrl = normalizedEntryUrl,
                ManifestHash = normalizedManifestHash,
                Status = AppStatus.Pending,
                AllowlistHash = (ByteString)"",
                Name = normalizedName,
                Description = normalizedDescription,
                Icon = normalizedIcon,
                Banner = normalizedBanner,
                Category = normalizedCategory,
                ContractHash = normalizedContractHash
            };

            ExecutionEngine.Assert(normalizedName.Length <= 128, "name too long");
            ExecutionEngine.Assert(normalizedDescription.Length <= 1024, "description too long");
            ExecutionEngine.Assert(normalizedIcon.Length <= 256, "icon too long");
            ExecutionEngine.Assert(normalizedBanner.Length <= 256, "banner too long");
            ExecutionEngine.Assert(normalizedCategory.Length <= 64, "category too long");
            AppMap().Put(key, StdLib.Serialize(info));
            OnAppRegistered(normalizedAppId, info.Developer, normalizedName, normalizedCategory);
            if (normalizedContractHash.Length > 0)
            {
                OnContractHashUpdated(normalizedAppId, info.ContractHash);
            }
        }

        public static void Register(string appId, ByteString manifestHash, string entryUrl, ByteString developerPubKey)
        {
            RegisterInternal(appId, manifestHash, entryUrl, developerPubKey, (ByteString)"", "", "", "", "", "");
        }

        public static void RegisterApp(
            string appId,
            ByteString manifestHash,
            string entryUrl,
            ByteString developerPubKey,
            ByteString contractHash,
            string name,
            string description,
            string icon,
            string banner,
            string category)
        {
            RegisterInternal(appId, manifestHash, entryUrl, developerPubKey, contractHash, name, description, icon, banner, category);
        }

        public static void UpdateManifest(string appId, ByteString manifestHash, string entryUrl)
        {
            AppInfo info = GetApp(appId);
            ExecutionEngine.Assert(info.AppId != null && info.AppId.Length > 0, "app not found");
            ExecutionEngine.Assert(Runtime.CheckWitness(info.Developer), "unauthorized");

            ExecutionEngine.Assert(manifestHash != null && manifestHash.Length > 0, "manifest hash required");
            ExecutionEngine.Assert(entryUrl != null && entryUrl.Length > 0, "entry url required");

            ByteString normalizedManifestHash = manifestHash ?? (ByteString)"";
            string normalizedEntryUrl = entryUrl ?? "";

            AppStatus oldStatus = info.Status;
            info.ManifestHash = normalizedManifestHash;
            info.EntryUrl = normalizedEntryUrl;
            info.Status = AppStatus.Pending; // require re-approval
            AppMap().Put(AppKey(appId), StdLib.Serialize(info));
            OnAppUpdated(appId, normalizedManifestHash, normalizedEntryUrl);
            if (oldStatus != AppStatus.Pending)
            {
                OnStatusChanged(appId, oldStatus, AppStatus.Pending);
            }
        }

        public static void UpdateApp(
            string appId,
            ByteString manifestHash,
            string entryUrl,
            ByteString contractHash,
            string name,
            string description,
            string icon,
            string banner,
            string category)
        {
            AppInfo info = GetApp(appId);
            ExecutionEngine.Assert(info.AppId != null && info.AppId.Length > 0, "app not found");
            ExecutionEngine.Assert(Runtime.CheckWitness(info.Developer), "unauthorized");

            ExecutionEngine.Assert(manifestHash != null && manifestHash.Length > 0, "manifest hash required");
            ExecutionEngine.Assert(entryUrl != null && entryUrl.Length > 0, "entry url required");

            ByteString normalizedManifestHash = manifestHash ?? (ByteString)"";
            string normalizedEntryUrl = entryUrl ?? "";
            ByteString normalizedContractHash = contractHash ?? (ByteString)"";

            AppStatus oldStatus = info.Status;
            ByteString oldContractHash = info.ContractHash;
            info.ManifestHash = normalizedManifestHash;
            info.EntryUrl = normalizedEntryUrl;
            info.Name = name ?? "";
            info.Description = description ?? "";
            info.Icon = icon ?? "";
            info.Banner = banner ?? "";
            info.Category = category ?? "";
            if (normalizedContractHash.Length > 0)
            {
                info.ContractHash = NormalizeContractHash(normalizedContractHash);
            }
            info.Status = AppStatus.Pending; // require re-approval
            AppMap().Put(AppKey(appId), StdLib.Serialize(info));
            OnAppUpdated(appId, normalizedManifestHash, normalizedEntryUrl);
            if (normalizedContractHash.Length > 0 && normalizedContractHash != oldContractHash)
            {
                OnContractHashUpdated(appId, info.ContractHash);
            }
            if (oldStatus != AppStatus.Pending)
            {
                OnStatusChanged(appId, oldStatus, AppStatus.Pending);
            }
        }

        public static void SetAllowlistHash(string appId, ByteString allowlistHash)
        {
            AppInfo info = GetApp(appId);
            ExecutionEngine.Assert(info.AppId != null && info.AppId.Length > 0, "app not found");
            ExecutionEngine.Assert(Runtime.CheckWitness(info.Developer) || Runtime.CheckWitness(Admin()), "unauthorized");
            ExecutionEngine.Assert(allowlistHash != null, "allowlist hash required");

            ByteString normalizedAllowlistHash = allowlistHash ?? (ByteString)"";
            ExecutionEngine.Assert(normalizedAllowlistHash.Length == 0 || normalizedAllowlistHash.Length == 32, "invalid allowlist hash");

            info.AllowlistHash = normalizedAllowlistHash;
            AppMap().Put(AppKey(appId), StdLib.Serialize(info));
            OnAllowlistUpdated(appId, normalizedAllowlistHash);
        }

        public static void SetStatus(string appId, AppStatus status)
        {
            ValidateAdmin();
            AppInfo info = GetApp(appId);
            ExecutionEngine.Assert(info.AppId != null && info.AppId.Length > 0, "app not found");
            AppStatus oldStatus = info.Status;
            info.Status = status;
            AppMap().Put(AppKey(appId), StdLib.Serialize(info));
            OnStatusChanged(appId, oldStatus, status);
        }

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != UInt160.Zero && newAdmin.IsValid, "invalid admin");
            UInt160 oldAdmin = Admin();
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, (ByteString)newAdmin);
            OnAdminChanged(oldAdmin, newAdmin);
        }

        private static StorageMap TeeScriptMap() => new StorageMap(Storage.CurrentContext, PREFIX_TEE_SCRIPT);

        private static ByteString TeeScriptKey(string appId, string scriptName)
        {
            return Helper.Concat((ByteString)appId, (ByteString)(":" + scriptName));
        }

        /// <summary>
        /// Register a TEE script hash for a MiniApp.
        /// Only the app developer can register scripts.
        /// </summary>
        public static void RegisterTeeScript(string appId, string scriptName, ByteString scriptHash)
        {
            AppInfo info = GetApp(appId);
            ExecutionEngine.Assert(info.AppId != null && info.AppId.Length > 0, "app not found");
            ExecutionEngine.Assert(Runtime.CheckWitness(info.Developer), "unauthorized");
            ExecutionEngine.Assert(scriptName != null && scriptName.Length > 0, "script name required");
            ExecutionEngine.Assert(scriptHash != null && scriptHash.Length == 32, "invalid script hash");

            string normalizedScriptName = scriptName ?? "";
            ByteString normalizedScriptHash = scriptHash ?? (ByteString)"";
            ExecutionEngine.Assert(normalizedScriptName.Length <= 64, "script name too long");

            TeeScriptMap().Put(TeeScriptKey(appId, normalizedScriptName), normalizedScriptHash);
            OnTeeScriptRegistered(appId, normalizedScriptName, normalizedScriptHash);
        }

        /// <summary>
        /// Get the registered TEE script hash for a MiniApp.
        /// </summary>
        [Safe]
        public static ByteString GetTeeScriptHash(string appId, string scriptName)
        {
            ByteString? value = TeeScriptMap().Get(TeeScriptKey(appId, scriptName));
            return value == null ? (ByteString)"" : value;
        }

        public static void Update(ByteString nefFile, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nefFile, manifest, new object[0]);
        }
    }
}
