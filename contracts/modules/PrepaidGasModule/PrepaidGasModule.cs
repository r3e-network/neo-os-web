using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Modules
{
    /// <summary>
    /// Universal prepaid GAS credit module that any miniapp instance can use.
    ///
    /// MULTI-TENANCY:
    /// All balances are namespaced by instance ID so a single deployed contract
    /// serves every miniapp instance on the platform.
    ///
    /// AUTHORIZATION MODEL:
    /// - Platform admin: full control, can initialize/deactivate instances
    /// - Instance controller (owner, operator, or instance registry caller): can consume credits
    /// - End users: can deposit GAS and query their own balance
    ///
    /// STORAGE LAYOUT:
    /// - 0x01       admin address
    /// - 0x02       instance registry address
    /// - 0x10       instance info (per instance)
    /// - 0x20       credit balance (per instance + user)
    /// - 0x21       total deposited (per instance)
    /// - 0x22       total consumed (per instance)
    /// </summary>
    [DisplayName("PrepaidGasModule")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Universal instance-scoped prepaid GAS credit module for miniapps")]
    [ContractPermission("*", "*")]
    public class PrepaidGasModule : SmartContract
    {
        #region Storage Prefixes

        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_INSTANCE_REGISTRY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_INSTANCE = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_CREDIT_BALANCE = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_TOTAL_DEPOSITED = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_TOTAL_CONSUMED = new byte[] { 0x22 };

        #endregion

        #region Data Structures

        public struct InstanceInfo
        {
            public string InstanceId;
            public UInt160 Owner;
            public UInt160 Operator;
            public bool Active;
            public BigInteger UpdatedAt;
        }

        #endregion

        #region Events

        [DisplayName("CreditReceived")]
        public static event Action<string, UInt160, BigInteger, BigInteger> OnCreditReceived = delegate { };

        [DisplayName("CreditConsumed")]
        public static event Action<string, UInt160, BigInteger, BigInteger> OnCreditConsumed = delegate { };

        [DisplayName("CreditRefunded")]
        public static event Action<string, UInt160, UInt160, BigInteger, BigInteger> OnCreditRefunded = delegate { };

        [DisplayName("InstanceInitialized")]
        public static event Action<string, UInt160, UInt160, bool> OnInstanceInitialized = delegate { };

        [DisplayName("InstanceStatusChanged")]
        public static event Action<string, bool> OnInstanceStatusChanged = delegate { };

        [DisplayName("InstanceRegistryChanged")]
        public static event Action<UInt160, UInt160> OnInstanceRegistryChanged = delegate { };

        [DisplayName("AdminChanged")]
        public static event Action<UInt160, UInt160> OnAdminChanged = delegate { };

        #endregion

        #region Lifecycle

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }

        public static void Update(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nef, manifest, new object[0]);
        }

        #endregion

        #region Internal Helpers

        private static UInt160 ReadAddress(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? UInt160.Zero : (UInt160)value;
        }

        private static void ValidateIdentifier(string value, string label)
        {
            string normalized = value ?? "";
            ExecutionEngine.Assert(normalized.Length > 0, label + " required");
            ExecutionEngine.Assert(normalized.Length <= 128, label + " too long");
        }

        private static void ValidateAddress(UInt160 value, string label)
        {
            ExecutionEngine.Assert(value != UInt160.Zero && value.IsValid, "invalid " + label);
        }

        private static UInt160 NormalizeOptionalAddress(UInt160 value)
        {
            if (value == UInt160.Zero) return UInt160.Zero;
            ExecutionEngine.Assert(value.IsValid, "invalid address");
            return value;
        }

        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        private static bool IsAdminWitness()
        {
            UInt160 admin = Admin();
            return admin != UInt160.Zero && admin.IsValid && Runtime.CheckWitness(admin);
        }

        private static bool IsRegistryCaller()
        {
            UInt160 registry = InstanceRegistry();
            return registry != UInt160.Zero && registry.IsValid && Runtime.CallingScriptHash == registry;
        }

        private static bool IsOperatorCaller(InstanceInfo instance)
        {
            UInt160 op = instance.Operator;
            return op != UInt160.Zero && op.IsValid && Runtime.CallingScriptHash == op;
        }

        private static bool IsInstanceController(InstanceInfo instance)
        {
            return IsAdminWitness() ||
                   IsRegistryCaller() ||
                   (instance.Owner != UInt160.Zero && Runtime.CheckWitness(instance.Owner)) ||
                   IsOperatorCaller(instance);
        }

        private static void RequireActiveInstance(InstanceInfo instance)
        {
            ExecutionEngine.Assert(instance.InstanceId.Length > 0, "instance not found");
            ExecutionEngine.Assert(instance.Active, "instance inactive");
        }

        private static InstanceInfo EmptyInstance()
        {
            return new InstanceInfo
            {
                InstanceId = "",
                Owner = UInt160.Zero,
                Operator = UInt160.Zero,
                Active = false,
                UpdatedAt = 0
            };
        }

        /// <summary>
        /// Storage key for per-user credit balance scoped by instance.
        /// Layout: PREFIX_CREDIT_BALANCE + instanceId + "|" + user
        /// </summary>
        private static byte[] CreditKey(string instanceId, UInt160 user)
        {
            return Helper.Concat(
                PREFIX_CREDIT_BALANCE,
                (ByteString)((instanceId ?? "") + "|" + (string)(ByteString)(byte[])user));
        }

        private static byte[] InstanceKey(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            return Helper.Concat(PREFIX_INSTANCE, (ByteString)(instanceId ?? ""));
        }

        private static byte[] TotalDepositedKey(string instanceId)
        {
            return Helper.Concat(PREFIX_TOTAL_DEPOSITED, (ByteString)(instanceId ?? ""));
        }

        private static byte[] TotalConsumedKey(string instanceId)
        {
            return Helper.Concat(PREFIX_TOTAL_CONSUMED, (ByteString)(instanceId ?? ""));
        }

        private static BigInteger ReadBigInteger(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? 0 : (BigInteger)value;
        }

        private static void WriteBigInteger(byte[] key, BigInteger value)
        {
            if (value <= 0)
            {
                Storage.Delete(Storage.CurrentContext, key);
            }
            else
            {
                Storage.Put(Storage.CurrentContext, key, value);
            }
        }

        private static string ReadTextArg(object value)
        {
            if (value is string text) return text ?? "";
            if (value is ByteString byteString) return (string)byteString;
            return "";
        }

        private static UInt160 ReadAddressArg(object value)
        {
            if (value is ByteString byteString) return (UInt160)byteString;
            if (value is byte[] bytes) return (UInt160)(ByteString)bytes;
            return UInt160.Zero;
        }

        #endregion

        #region Safe Queries

        [Safe]
        public static UInt160 Admin()
        {
            return ReadAddress(PREFIX_ADMIN);
        }

        [Safe]
        public static UInt160 InstanceRegistry()
        {
            return ReadAddress(PREFIX_INSTANCE_REGISTRY);
        }

        [Safe]
        public static InstanceInfo GetInstance(string instanceId)
        {
            ByteString? raw = Storage.Get(Storage.CurrentContext, InstanceKey(instanceId));
            return raw == null ? EmptyInstance() : (InstanceInfo)StdLib.Deserialize(raw);
        }

        /// <summary>
        /// Query prepaid GAS credit balance for a specific user within an instance.
        /// </summary>
        [Safe]
        public static BigInteger GetBalance(string instanceId, UInt160 user)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(user, "user");
            return ReadBigInteger(CreditKey(instanceId, user));
        }

        /// <summary>
        /// Query total GAS deposited across all users for an instance.
        /// </summary>
        [Safe]
        public static BigInteger GetTotalDeposited(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            return ReadBigInteger(TotalDepositedKey(instanceId));
        }

        /// <summary>
        /// Query total GAS consumed across all users for an instance.
        /// </summary>
        [Safe]
        public static BigInteger GetTotalConsumed(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            return ReadBigInteger(TotalConsumedKey(instanceId));
        }

        #endregion

        #region Instance Management

        /// <summary>
        /// Initialize or reconfigure an instance within this module.
        /// Can be called by admin, instance registry, or existing instance owner.
        /// </summary>
        public static void InitializeInstance(
            string instanceId,
            UInt160 owner,
            UInt160 operatorAddress)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(owner, "owner");

            InstanceInfo existing = GetInstance(instanceId);
            bool canInitialize = IsAdminWitness() || IsRegistryCaller();
            if (!canInitialize && existing.InstanceId.Length > 0)
            {
                canInitialize = IsInstanceController(existing);
            }
            ExecutionEngine.Assert(canInitialize, "unauthorized");

            InstanceInfo info = new InstanceInfo
            {
                InstanceId = instanceId,
                Owner = owner,
                Operator = NormalizeOptionalAddress(operatorAddress),
                Active = existing.InstanceId.Length == 0 || existing.Active,
                UpdatedAt = Runtime.Time
            };

            Storage.Put(Storage.CurrentContext, InstanceKey(instanceId), StdLib.Serialize(info));
            OnInstanceInitialized(instanceId, info.Owner, info.Operator, info.Active);
        }

        /// <summary>
        /// Activate or deactivate an instance. Only instance controller may call.
        /// </summary>
        public static void SetInstanceActive(string instanceId, bool active)
        {
            InstanceInfo info = GetInstance(instanceId);
            ExecutionEngine.Assert(info.InstanceId.Length > 0, "instance not found");
            ExecutionEngine.Assert(IsInstanceController(info), "unauthorized");

            info.Active = active;
            info.UpdatedAt = Runtime.Time;
            Storage.Put(Storage.CurrentContext, InstanceKey(instanceId), StdLib.Serialize(info));
            OnInstanceStatusChanged(instanceId, active);
        }

        #endregion

        #region NEP-17 Payment Handler

        /// <summary>
        /// Receives GAS transfers. The data field must be an object array:
        ///   [0] = instanceId (string)
        ///   [1] = user (UInt160, optional -- defaults to sender)
        ///
        /// Only GAS is accepted. Credits are added to the user's balance for the
        /// specified instance.
        /// </summary>
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            // Ignore outbound transfer callbacks from this contract
            if (from == Runtime.ExecutingScriptHash) return;

            // Only accept GAS
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "only GAS accepted");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            // Parse memo: expect [instanceId] or [instanceId, user]
            ExecutionEngine.Assert(data != null, "memo required: [instanceId] or [instanceId, user]");
            object[] args = (object[])data;
            ExecutionEngine.Assert(args.Length >= 1, "memo requires at least instanceId");

            string instanceId = ReadTextArg(args[0]);
            ValidateIdentifier(instanceId, "instance id");

            // Default credit target is the sender
            UInt160 creditUser = from;
            if (args.Length >= 2)
            {
                UInt160 specifiedUser = ReadAddressArg(args[1]);
                if (specifiedUser != UInt160.Zero && specifiedUser.IsValid)
                {
                    creditUser = specifiedUser;
                }
            }

            // Ensure instance is active
            InstanceInfo info = GetInstance(instanceId);
            RequireActiveInstance(info);

            // Credit balance
            byte[] key = CreditKey(instanceId, creditUser);
            BigInteger current = ReadBigInteger(key);
            BigInteger next = current + amount;
            WriteBigInteger(key, next);

            // Update instance-wide totals
            byte[] totalKey = TotalDepositedKey(instanceId);
            BigInteger totalDep = ReadBigInteger(totalKey);
            Storage.Put(Storage.CurrentContext, totalKey, totalDep + amount);

            OnCreditReceived(instanceId, creditUser, amount, next);
        }

        #endregion

        #region Credit Operations

        /// <summary>
        /// Consume prepaid GAS credits on behalf of a user.
        /// Only the instance controller (owner, operator, registry, or admin) may call this.
        /// This is the primary entry point for miniapp contracts to deduct usage fees.
        /// </summary>
        public static void ConsumeCredit(string instanceId, UInt160 user, BigInteger amount)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(user, "user");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            InstanceInfo info = GetInstance(instanceId);
            RequireActiveInstance(info);
            ExecutionEngine.Assert(IsInstanceController(info), "unauthorized: not instance controller");

            byte[] key = CreditKey(instanceId, user);
            BigInteger current = ReadBigInteger(key);
            ExecutionEngine.Assert(current >= amount, "insufficient prepaid credit");

            BigInteger next = current - amount;
            WriteBigInteger(key, next);

            // Update instance-wide consumed totals
            byte[] totalKey = TotalConsumedKey(instanceId);
            BigInteger totalCon = ReadBigInteger(totalKey);
            Storage.Put(Storage.CurrentContext, totalKey, totalCon + amount);

            OnCreditConsumed(instanceId, user, amount, next);
        }

        /// <summary>
        /// Refund prepaid GAS credits back to the user as actual GAS.
        /// Only the instance controller may initiate refunds.
        /// </summary>
        public static void RefundCredit(string instanceId, UInt160 user, BigInteger amount, UInt160 recipient)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(user, "user");
            ValidateAddress(recipient, "recipient");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            InstanceInfo info = GetInstance(instanceId);
            ExecutionEngine.Assert(info.InstanceId.Length > 0, "instance not found");
            ExecutionEngine.Assert(IsInstanceController(info), "unauthorized: not instance controller");

            byte[] key = CreditKey(instanceId, user);
            BigInteger current = ReadBigInteger(key);
            ExecutionEngine.Assert(current >= amount, "insufficient prepaid credit");

            BigInteger next = current - amount;
            WriteBigInteger(key, next);

            // Transfer actual GAS to recipient
            bool transferred = (bool)Contract.Call(
                GAS.Hash, "transfer", CallFlags.All,
                Runtime.ExecutingScriptHash, recipient, amount, null);
            ExecutionEngine.Assert(transferred, "refund transfer failed");

            OnCreditRefunded(instanceId, user, recipient, amount, next);
        }

        #endregion

        #region Admin Management

        public static void SetInstanceRegistry(UInt160 registry)
        {
            ValidateAdmin();
            UInt160 normalized = NormalizeOptionalAddress(registry);
            UInt160 oldRegistry = InstanceRegistry();
            Storage.Put(Storage.CurrentContext, PREFIX_INSTANCE_REGISTRY, normalized);
            OnInstanceRegistryChanged(oldRegistry, normalized);
        }

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ValidateAddress(newAdmin, "admin");
            UInt160 oldAdmin = Admin();
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
            OnAdminChanged(oldAdmin, newAdmin);
        }

        #endregion
    }
}
