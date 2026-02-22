using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// Generic MiniApp Template Base - Enhanced Version
    /// 
    /// All template contracts should inherit from this partial class.
    /// Provides comprehensive configuration and operation management.
    /// 
    /// CONFIG STRUCTURE:
    /// {
    ///   "name": "App Name",
    ///   "description": "Description",
    ///   "version": "1.0.0",
    ///   "operations": [
    ///     { "name": "op1", "method": "method1", "fee": 1000000, "params": [...] }
    ///   ],
    ///   "params": {
    ///     "minAmount": 10000000,
    ///     "maxAmount": 1000000000,
    ///     "customParam1": "value1"
    ///   },
    ///   "permissions": {
    ///     "payments": true,
    ///     "datafeed": false
    ///   }
    /// }
    /// </summary>
    public partial class MiniAppTemplate : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };

        public static UInt160 Admin()
        {
            return (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
        }

        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != null && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        #region Storage Prefixes (0x30-0x3F)
        protected static readonly byte[] PREFIX_CONFIG = new byte[] { 0x30 };
        protected static readonly byte[] PREFIX_STATE = new byte[] { 0x31 };
        protected static readonly byte[] PREFIX_PLAYER = new byte[] { 0x32 };
        protected static readonly byte[] PREFIX_OPERATION = new byte[] { 0x33 };
        protected static readonly byte[] PREFIX_COUNTER = new byte[] { 0x34 };
        protected static readonly byte[] PREFIX_METADATA = new byte[] { 0x35 };
        #endregion

        #region Template Configuration Structures
        public struct TemplateConfig
        {
            public string Name;
            public string Description;
            public string Version;
            public ByteString Operations;
            public ByteString CustomParams;
            public ByteString Permissions;
            public ulong CreatedAt;
            public UInt160 CreatedBy;
        }

        public struct OperationDef
        {
            public string Name;
            public string Method;
            public BigInteger GasCost;
            public bool RequiresWitness;
            public ByteString ParamSchema;
            public string Description;
        }

        public struct ParamSchema
        {
            public string Name;
            public string Type;
            public string Label;
            public bool Required;
            public string DefaultValue;
            public string Placeholder;
            public ByteString Options;
            public BigInteger MinValue;
            public BigInteger MaxValue;
        }

        public struct Permission
        {
            public string Key;
            public bool Enabled;
        }
        #endregion

        #region Template Getters
        [Safe]
        public static TemplateConfig GetConfig()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_CONFIG);
            if (data == null) return new TemplateConfig();
            return (TemplateConfig)StdLib.Deserialize(data);
        }

        [Safe]
        public static ByteString GetRawConfig()
        {
            return Storage.Get(Storage.CurrentContext, PREFIX_CONFIG) ?? (ByteString)"";
        }

        [Safe]
        public static OperationDef[] GetOperations()
        {
            TemplateConfig config = GetConfig();
            if (config.Operations == null || config.Operations.Length == 0)
                return new OperationDef[0];
            
            return (OperationDef[])StdLib.Deserialize(config.Operations);
        }

        [Safe]
        public static OperationDef GetOperation(string method)
        {
            OperationDef[] ops = GetOperations();
            for (int i = 0; i < ops.Length; i++)
            {
                if (ops[i].Method == method)
                    return ops[i];
            }
            return new OperationDef();
        }

        [Safe]
        public static bool HasPermission(string permissionKey)
        {
            TemplateConfig config = GetConfig();
            if (config.Permissions == null || config.Permissions.Length == 0)
                return false;
            
            Permission[] perms = (Permission[])StdLib.Deserialize(config.Permissions);
            for (int i = 0; i < perms.Length; i++)
            {
                if (perms[i].Key == permissionKey)
                    return perms[i].Enabled;
            }
            return false;
        }
        #endregion

        #region Template Initialization
        protected static void InitializeTemplate(object data)
        {
            if (data == null) return;
            
            object[] initData = data as object[];
            if (initData == null || initData.Length == 0) return;

            ExecutionEngine.Assert(Runtime.Transaction.Sender == Admin(), "unauthorized");
            
            ByteString configData = initData[0] as ByteString;
            if (configData != null && configData.Length > 0)
            {
                TemplateConfig config = (TemplateConfig)StdLib.Deserialize(configData);
                config.CreatedAt = Runtime.Time;
                config.CreatedBy = Runtime.Transaction.Sender;
                
                Storage.Put(Storage.CurrentContext, PREFIX_CONFIG, StdLib.Serialize(config));
            }
        }

        protected static void UpdateConfig(TemplateConfig newConfig)
        {
            ValidateAdmin();
            TemplateConfig existing = GetConfig();
            newConfig.CreatedAt = existing.CreatedAt;
            newConfig.CreatedBy = existing.CreatedBy;
            Storage.Put(Storage.CurrentContext, PREFIX_CONFIG, StdLib.Serialize(newConfig));
        }
        #endregion

        #region Generic Operation Helpers
        protected static BigInteger GetNextId(byte[] prefix)
        {
            ByteString current = Storage.Get(Storage.CurrentContext, PREFIX_COUNTER);
            BigInteger next = current != null ? (BigInteger)current + 1 : 1;
            Storage.Put(Storage.CurrentContext, PREFIX_COUNTER, next);
            return next;
        }

        protected static void ValidateOperation(string method, UInt160 caller)
        {
            OperationDef op = GetOperation(method);
            ExecutionEngine.Assert(op.Method != null && op.Method.Length > 0, "operation not found");
            
            if (op.RequiresWitness)
            {
                ExecutionEngine.Assert(Runtime.CheckWitness(caller), "unauthorized");
            }
        }

        protected static BigInteger ValidateAndGetAmount(BigInteger amount, BigInteger minAmount, BigInteger maxAmount)
        {
            ExecutionEngine.Assert(amount >= minAmount, "amount too small");
            ExecutionEngine.Assert(amount <= maxAmount, "amount too large");
            return amount;
        }
        #endregion

        #region Player Data Management
        protected static ByteString GetPlayerData(UInt160 player, byte[] prefix)
        {
            StorageMap map = new StorageMap(Storage.CurrentContext, prefix);
            return map.Get((ByteString)player);
        }

        protected static void SetPlayerData(UInt160 player, byte[] prefix, ByteString data)
        {
            StorageMap map = new StorageMap(Storage.CurrentContext, prefix);
            map.Put((ByteString)player, data);
        }

        protected static void DeletePlayerData(UInt160 player, byte[] prefix)
        {
            StorageMap map = new StorageMap(Storage.CurrentContext, prefix);
            map.Delete((ByteString)player);
        }
        #endregion

        #region Metadata Management
        protected static void SetMetadata(string key, ByteString value)
        {
            StorageMap map = new StorageMap(Storage.CurrentContext, PREFIX_METADATA);
            map.Put((ByteString)key, value);
        }

        [Safe]
        protected static ByteString GetMetadata(string key)
        {
            StorageMap map = new StorageMap(Storage.CurrentContext, PREFIX_METADATA);
            return map.Get((ByteString)key) ?? (ByteString)"";
        }
        #endregion
    }
}
