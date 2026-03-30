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
    public delegate void TokenMintedHandler(string appId, BigInteger tokenId, UInt160 owner, bool soulbound);
    public delegate void TokenTransferredHandler(string appId, BigInteger tokenId, UInt160 from, UInt160 to);
    public delegate void TokenBurnedHandler(string appId, BigInteger tokenId, UInt160 owner);
    public delegate void TokenValidatedHandler(string appId, BigInteger tokenId, UInt160 owner);
    public delegate void NFTConfiguredHandler(string appId);
    public delegate void NFTAdminChangedHandler(UInt160 oldAdmin, UInt160 newAdmin);

    [DisplayName("NFTService")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "OS NFTService — app-scoped NFT management with soulbound, expiry, and ticket validation")]
    [ContractPermission("*", "*")]
    public class NFTService : SmartContract
    {
        // ── Storage Prefixes ──────────────────────────────────────────────
        private static readonly byte[] PREFIX_ADMIN          = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_SCRIPT_ENGINE  = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_TOKENS         = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_OWNER_INDEX    = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_SUPPLY         = new byte[] { 0x30 };
        private static readonly byte[] PREFIX_APP_CONFIG     = new byte[] { 0x40 };

        // ── Limits ────────────────────────────────────────────────────────
        private const int MAX_BATCH_MINT     = 20;
        private const int MAX_METADATA_SIZE  = 4096;

        // ── Structs ───────────────────────────────────────────────────────

        public struct AppConfig
        {
            public string AppId;
            public bool Active;
            public BigInteger UpdatedAt;
        }

        public struct TokenData
        {
            public BigInteger TokenId;
            public string AppId;
            public UInt160 Owner;
            public ByteString Metadata;
            public bool Soulbound;
            public BigInteger Expiry;
            public bool Validated;
            public BigInteger CreatedAt;
        }

        // ── Events ────────────────────────────────────────────────────────
        [DisplayName("TokenMinted")]
        public static event TokenMintedHandler OnTokenMinted = delegate { };

        [DisplayName("TokenTransferred")]
        public static event TokenTransferredHandler OnTokenTransferred = delegate { };

        [DisplayName("TokenBurned")]
        public static event TokenBurnedHandler OnTokenBurned = delegate { };

        [DisplayName("TokenValidated")]
        public static event TokenValidatedHandler OnTokenValidated = delegate { };

        [DisplayName("NFTConfigured")]
        public static event NFTConfiguredHandler OnNFTConfigured = delegate { };

        [DisplayName("AdminChanged")]
        public static event NFTAdminChangedHandler OnAdminChanged = delegate { };

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
            OnNFTConfigured(appId);
        }

        // ── ScriptEngine Reference ────────────────────────────────────────

        public static void SetScriptEngine(UInt160 engine)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(engine != UInt160.Zero && engine.IsValid, "invalid engine");
            Storage.Put(Storage.CurrentContext, PREFIX_SCRIPT_ENGINE, (ByteString)engine);
        }

        // ── Mint Operations ───────────────────────────────────────────────

        public static BigInteger Mint(string appId, UInt160 owner, ByteString metadata, bool soulbound, BigInteger expiry)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(owner != UInt160.Zero && owner.IsValid, "invalid owner");
            ValidateAppOperator(appId);
            RequireActiveApp(appId);

            if (metadata != null)
            {
                ExecutionEngine.Assert(metadata.Length <= MAX_METADATA_SIZE, "metadata too large");
            }
            ExecutionEngine.Assert(expiry >= 0, "expiry cannot be negative");

            BigInteger tokenId = ReadBigInteger(SupplyCounterKey(appId)) + 1;
            Storage.Put(Storage.CurrentContext, SupplyCounterKey(appId), tokenId);

            TokenData token = new TokenData
            {
                TokenId = tokenId,
                AppId = appId,
                Owner = owner,
                Metadata = metadata ?? (ByteString)"",
                Soulbound = soulbound,
                Expiry = expiry,
                Validated = false,
                CreatedAt = Runtime.Time
            };

            StoreToken(appId, tokenId, token);

            // Add to owner index
            AddToOwnerIndex(appId, owner, tokenId);

            OnTokenMinted(appId, tokenId, owner, soulbound);
            TriggerScriptHook(appId, "onNFTMinted", tokenId, owner);
            return tokenId;
        }

        public static BigInteger[] BatchMint(string appId, UInt160[] owners, ByteString[] metadatas, bool[] soulbounds, BigInteger[] expiries)
        {
            ValidateAppId(appId);
            ValidateAppOperator(appId);
            RequireActiveApp(appId);

            ExecutionEngine.Assert(owners != null && owners!.Length > 0, "owners required");
            ExecutionEngine.Assert(owners!.Length <= MAX_BATCH_MINT, "batch too large (max 20)");
            ExecutionEngine.Assert(metadatas != null && metadatas!.Length == owners.Length, "metadatas length mismatch");
            ExecutionEngine.Assert(soulbounds != null && soulbounds!.Length == owners.Length, "soulbounds length mismatch");
            ExecutionEngine.Assert(expiries != null && expiries!.Length == owners.Length, "expiries length mismatch");

            BigInteger[] tokenIds = new BigInteger[owners.Length];
            BigInteger currentSupply = ReadBigInteger(SupplyCounterKey(appId));

            for (int i = 0; i < owners.Length; i++)
            {
                ExecutionEngine.Assert(owners[i] != UInt160.Zero && owners[i].IsValid, "invalid owner");
                if (metadatas![i] != null)
                {
                    ExecutionEngine.Assert(metadatas[i].Length <= MAX_METADATA_SIZE, "metadata too large");
                }
                ExecutionEngine.Assert(expiries![i] >= 0, "expiry cannot be negative");

                currentSupply += 1;
                BigInteger tokenId = currentSupply;

                TokenData token = new TokenData
                {
                    TokenId = tokenId,
                    AppId = appId,
                    Owner = owners[i],
                    Metadata = metadatas[i] ?? (ByteString)"",
                    Soulbound = soulbounds![i],
                    Expiry = expiries[i],
                    Validated = false,
                    CreatedAt = Runtime.Time
                };

                StoreToken(appId, tokenId, token);
                AddToOwnerIndex(appId, owners[i], tokenId);
                tokenIds[i] = tokenId;

                OnTokenMinted(appId, tokenId, owners[i], soulbounds[i]);
            }

            Storage.Put(Storage.CurrentContext, SupplyCounterKey(appId), currentSupply);
            return tokenIds;
        }

        // ── Transfer ──────────────────────────────────────────────────────

        public static void Transfer(string appId, BigInteger tokenId, UInt160 from, UInt160 to)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(from != UInt160.Zero && from.IsValid, "invalid from");
            ExecutionEngine.Assert(to != UInt160.Zero && to.IsValid, "invalid to");
            ExecutionEngine.Assert(Runtime.CheckWitness(from), "unauthorized");

            TokenData token = GetTokenInternal(appId, tokenId);
            ExecutionEngine.Assert(token.TokenId > 0, "token not found");
            ExecutionEngine.Assert(token.Owner == from, "not token owner");
            ExecutionEngine.Assert(!token.Soulbound, "token is soulbound");

            // Check expiry
            if (token.Expiry > 0)
            {
                ExecutionEngine.Assert(Runtime.Time < token.Expiry, "token expired");
            }

            token.Owner = to;
            StoreToken(appId, tokenId, token);

            // Update owner index
            RemoveFromOwnerIndex(appId, from, tokenId);
            AddToOwnerIndex(appId, to, tokenId);

            OnTokenTransferred(appId, tokenId, from, to);
            TriggerScriptHook(appId, "onNFTTransferred", tokenId, to);
        }

        // ── Burn ──────────────────────────────────────────────────────────

        public static void Burn(string appId, BigInteger tokenId)
        {
            ValidateAppId(appId);
            ValidateAppOperator(appId);

            TokenData token = GetTokenInternal(appId, tokenId);
            ExecutionEngine.Assert(token.TokenId > 0, "token not found");

            // Remove token
            Storage.Delete(Storage.CurrentContext, TokenKey(appId, tokenId));

            // Remove from owner index
            RemoveFromOwnerIndex(appId, token.Owner, tokenId);

            OnTokenBurned(appId, tokenId, token.Owner);
        }

        // ── Validate (Ticket Mode) ───────────────────────────────────────

        public static void Validate(string appId, BigInteger tokenId, UInt160 owner)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(owner != UInt160.Zero && owner.IsValid, "invalid owner");
            ValidateAppOperator(appId);

            TokenData token = GetTokenInternal(appId, tokenId);
            ExecutionEngine.Assert(token.TokenId > 0, "token not found");
            ExecutionEngine.Assert(token.Owner == owner, "not token owner");
            ExecutionEngine.Assert(!token.Validated, "already validated");

            // Check expiry
            if (token.Expiry > 0)
            {
                ExecutionEngine.Assert(Runtime.Time < token.Expiry, "token expired");
            }

            token.Validated = true;
            StoreToken(appId, tokenId, token);

            OnTokenValidated(appId, tokenId, owner);
        }

        // ── Safe Queries ──────────────────────────────────────────────────

        [Safe]
        public static TokenData GetToken(string appId, BigInteger tokenId)
        {
            ValidateAppId(appId);
            TokenData token = GetTokenInternal(appId, tokenId);

            // Check if expired
            if (token.TokenId > 0 && token.Expiry > 0 && Runtime.Time >= token.Expiry)
            {
                // Return with a signal that it's expired (TokenId still set but Validated = false conceptually)
                return token;
            }
            return token;
        }

        [Safe]
        public static ByteString GetTokensByOwner(string appId, UInt160 owner, int limit)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(owner != UInt160.Zero && owner.IsValid, "invalid owner");
            ExecutionEngine.Assert(limit >= 1 && limit <= 100, "limit must be 1-100");

            ByteString searchPrefix = (ByteString)Helper.Concat(PREFIX_OWNER_INDEX,
                (ByteString)((appId ?? "") + "|" + (string)(ByteString)(byte[])owner + "|t:"));

            Iterator iterator = Storage.Find(Storage.CurrentContext, searchPrefix, FindOptions.ValuesOnly | FindOptions.RemovePrefix);
            BigInteger[] tokenIds = new BigInteger[limit];
            int count = 0;

            while (iterator.Next() && count < limit)
            {
                tokenIds[count] = (BigInteger)(ByteString)iterator.Value;
                count++;
            }

            if (count == 0) return (ByteString)"";

            BigInteger[] result = new BigInteger[count];
            for (int i = 0; i < count; i++)
            {
                result[i] = tokenIds[i];
            }
            return StdLib.Serialize(result);
        }

        [Safe]
        public static BigInteger GetTokenCount(string appId, UInt160 owner)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(owner != UInt160.Zero && owner.IsValid, "invalid owner");
            return ReadBigInteger(OwnerCountKey(appId, owner));
        }

        [Safe]
        public static BigInteger GetTotalSupply(string appId)
        {
            ValidateAppId(appId);
            return ReadBigInteger(SupplyCounterKey(appId));
        }

        [Safe]
        public static bool IsTokenValid(string appId, BigInteger tokenId)
        {
            ValidateAppId(appId);
            TokenData token = GetTokenInternal(appId, tokenId);
            if (token.TokenId == 0) return false;
            if (token.Expiry > 0 && Runtime.Time >= token.Expiry) return false;
            return true;
        }

        // ── Internal Helpers ──────────────────────────────────────────────

        private static void ValidateAdmin()
        {
            UInt160 admin = GetAdmin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        private static void ValidateAppOperator(string appId)
        {
            // Admin always has operator rights
            UInt160 admin = GetAdmin();
            if (admin != UInt160.Zero && admin.IsValid && Runtime.CheckWitness(admin)) return;

            // Accept calls from ScriptEngine (contract-to-contract)
            UInt160 engine = ReadAddress(PREFIX_SCRIPT_ENGINE);
            if (engine != UInt160.Zero && engine.IsValid && Runtime.CallingScriptHash == engine) return;

            ExecutionEngine.Assert(false, "unauthorized: not app operator");
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

        private static byte[] TokenKey(string appId, BigInteger tokenId)
        {
            return Helper.Concat(PREFIX_TOKENS,
                (ByteString)((appId ?? "") + "|" + tokenId));
        }

        private static byte[] OwnerCountKey(string appId, UInt160 owner)
        {
            return Helper.Concat(PREFIX_OWNER_INDEX,
                (ByteString)((appId ?? "") + "|" + (string)(ByteString)(byte[])owner + "|count"));
        }

        private static byte[] OwnerTokenKey(string appId, UInt160 owner, BigInteger tokenId)
        {
            return Helper.Concat(PREFIX_OWNER_INDEX,
                (ByteString)((appId ?? "") + "|" + (string)(ByteString)(byte[])owner + "|t:" + tokenId));
        }

        private static byte[] SupplyCounterKey(string appId)
        {
            return Helper.Concat(PREFIX_SUPPLY, (ByteString)(appId ?? ""));
        }

        // ── Token Read/Write ──────────────────────────────────────────────

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

        private static TokenData GetTokenInternal(string appId, BigInteger tokenId)
        {
            ExecutionEngine.Assert(tokenId > 0, "invalid token id");
            ByteString? data = Storage.Get(Storage.CurrentContext, TokenKey(appId, tokenId));
            if (data == null)
            {
                return new TokenData
                {
                    TokenId = 0,
                    AppId = "",
                    Owner = UInt160.Zero,
                    Metadata = (ByteString)"",
                    Soulbound = false,
                    Expiry = 0,
                    Validated = false,
                    CreatedAt = 0
                };
            }
            return (TokenData)StdLib.Deserialize(data);
        }

        private static void StoreToken(string appId, BigInteger tokenId, TokenData token)
        {
            Storage.Put(Storage.CurrentContext, TokenKey(appId, tokenId), StdLib.Serialize(token));
        }

        // ── Owner Index ───────────────────────────────────────────────────

        private static void AddToOwnerIndex(string appId, UInt160 owner, BigInteger tokenId)
        {
            byte[] countKey = OwnerCountKey(appId, owner);
            BigInteger count = ReadBigInteger(countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            // Store per-token entry for enumeration
            Storage.Put(Storage.CurrentContext, OwnerTokenKey(appId, owner, tokenId), tokenId);
        }

        private static void RemoveFromOwnerIndex(string appId, UInt160 owner, BigInteger tokenId)
        {
            byte[] countKey = OwnerCountKey(appId, owner);
            BigInteger count = ReadBigInteger(countKey);
            if (count > 0)
            {
                Storage.Put(Storage.CurrentContext, countKey, count - 1);
            }

            // Remove per-token entry
            Storage.Delete(Storage.CurrentContext, OwnerTokenKey(appId, owner, tokenId));
        }

        // ── ScriptEngine Hook ─────────────────────────────────────────────

        private static void TriggerScriptHook(string appId, string hookName, BigInteger tokenId, UInt160 target)
        {
            UInt160 engine = ReadAddress(PREFIX_SCRIPT_ENGINE);
            if (engine == UInt160.Zero || !engine.IsValid) return;

            try
            {
                Contract.Call(engine, "execute", CallFlags.All, appId, hookName, tokenId, target);
            }
            catch
            {
                // Script failure must not block NFT operations
            }
        }
    }
}
