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
    /// Shared funding/escrow capability module.
    /// Balances are fully namespaced by instanceId so multiple miniapps can reuse one contract safely.
    /// </summary>
    [DisplayName("FundingVault")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "0.1.0")]
    [ManifestExtra("Description", "Shared instance-scoped funding vault module for deposits, locks, and releases")]
    [ContractPermission("*", "*")]
    public class FundingVault : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_INSTANCE_REGISTRY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_INSTANCE = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_PENDING_BALANCE = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_LOCKED_BALANCE = new byte[] { 0x12 };

        public struct InstanceInfo
        {
            public string InstanceId;
            public UInt160 Owner;
            public UInt160 Operator;
            public ByteString Config;
            public bool Active;
            public BigInteger UpdatedAt;
        }

        [DisplayName("InstanceInitialized")]
        public static event Action<string, UInt160, UInt160, bool> OnInstanceInitialized = delegate { };

        [DisplayName("InstanceStatusChanged")]
        public static event Action<string, bool> OnInstanceStatusChanged = delegate { };

        [DisplayName("PendingCredited")]
        public static event Action<string, UInt160, UInt160, BigInteger, BigInteger> OnPendingCredited = delegate { };

        [DisplayName("FundsLocked")]
        public static event Action<string, string, UInt160, BigInteger, BigInteger> OnFundsLocked = delegate { };

        [DisplayName("FundsReleased")]
        public static event Action<string, string, UInt160, UInt160, BigInteger, BigInteger> OnFundsReleased = delegate { };

        [DisplayName("FundsRefunded")]
        public static event Action<string, string, UInt160, UInt160, BigInteger, BigInteger> OnFundsRefunded = delegate { };

        [DisplayName("PendingWithdrawn")]
        public static event Action<string, UInt160, UInt160, UInt160, BigInteger, BigInteger> OnPendingWithdrawn = delegate { };

        [DisplayName("InstanceRegistryChanged")]
        public static event Action<UInt160, UInt160> OnInstanceRegistryChanged = delegate { };

        [DisplayName("AdminChanged")]
        public static event Action<UInt160, UInt160> OnAdminChanged = delegate { };

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }

        private static UInt160 ReadAddress(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? UInt160.Zero : (UInt160)value;
        }

        private static BigInteger ReadInteger(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? 0 : (BigInteger)value;
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

        private static ByteString NormalizeBlob(ByteString value)
        {
            return value ?? (ByteString)"";
        }

        private static byte[] InstanceKey(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            return Helper.Concat(PREFIX_INSTANCE, (ByteString)(instanceId ?? ""));
        }

        private static byte[] PendingBalanceKey(string instanceId, UInt160 account, UInt160 asset)
        {
            return Helper.Concat(
                PREFIX_PENDING_BALANCE,
                (ByteString)((instanceId ?? "") + "|" + (string)account + "|" + (string)asset));
        }

        private static byte[] LockedBalanceKey(string instanceId, string referenceId, UInt160 asset)
        {
            ValidateIdentifier(referenceId, "reference id");
            return Helper.Concat(
                PREFIX_LOCKED_BALANCE,
                (ByteString)((instanceId ?? "") + "|" + (referenceId ?? "") + "|" + (string)asset));
        }

        private static InstanceInfo EmptyInstance()
        {
            return new InstanceInfo
            {
                InstanceId = "",
                Owner = UInt160.Zero,
                Operator = UInt160.Zero,
                Config = (ByteString)"",
                Active = false,
                UpdatedAt = 0
            };
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
            UInt160 operatorAddress = instance.Operator;
            return operatorAddress != UInt160.Zero && operatorAddress.IsValid && Runtime.CallingScriptHash == operatorAddress;
        }

        private static bool IsInstanceController(InstanceInfo instance)
        {
            return IsAdminWitness() ||
                   IsRegistryCaller() ||
                   (instance.Owner != UInt160.Zero && Runtime.CheckWitness(instance.Owner)) ||
                   IsOperatorCaller(instance);
        }

        private static bool IsInstanceActor(InstanceInfo instance, UInt160 account)
        {
            return IsInstanceController(instance) ||
                   (account != UInt160.Zero && account.IsValid && Runtime.CheckWitness(account));
        }

        private static void RequireActiveInstance(InstanceInfo instance)
        {
            ExecutionEngine.Assert(instance.InstanceId.Length > 0, "instance not found");
            ExecutionEngine.Assert(instance.Active, "instance inactive");
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

        private static object[] RequireMemoArray(object data)
        {
            ExecutionEngine.Assert(data != null, "invalid vault memo");
            object[] args = (object[])data;
            ExecutionEngine.Assert(args.Length >= 2, "invalid vault memo");
            return args;
        }

        private static (string instanceId, UInt160 account) ParseFundingMemo(object data)
        {
            object[] args = RequireMemoArray(data);
            string instanceId = ReadTextArg(args[0]);
            UInt160 account = ReadAddressArg(args[1]);

            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(account, "account");
            return (instanceId, account);
        }

        private static BigInteger GetPendingBalanceInternal(string instanceId, UInt160 account, UInt160 asset)
        {
            return ReadInteger(PendingBalanceKey(instanceId, account, asset));
        }

        private static void SetPendingBalance(string instanceId, UInt160 account, UInt160 asset, BigInteger amount)
        {
            byte[] key = PendingBalanceKey(instanceId, account, asset);
            if (amount <= 0)
            {
                Storage.Delete(Storage.CurrentContext, key);
            }
            else
            {
                Storage.Put(Storage.CurrentContext, key, amount);
            }
        }

        private static BigInteger GetLockedBalanceInternal(string instanceId, string referenceId, UInt160 asset)
        {
            return ReadInteger(LockedBalanceKey(instanceId, referenceId, asset));
        }

        private static void SetLockedBalance(string instanceId, string referenceId, UInt160 asset, BigInteger amount)
        {
            byte[] key = LockedBalanceKey(instanceId, referenceId, asset);
            if (amount <= 0)
            {
                Storage.Delete(Storage.CurrentContext, key);
            }
            else
            {
                Storage.Put(Storage.CurrentContext, key, amount);
            }
        }

        private static bool TransferAsset(UInt160 asset, UInt160 to, BigInteger amount)
        {
            if (amount <= 0) return true;
            return (bool)Contract.Call(asset, "transfer", CallFlags.All, Runtime.ExecutingScriptHash, to, amount, null);
        }

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

        [Safe]
        public static BigInteger GetPendingBalance(string instanceId, UInt160 account, UInt160 asset)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(account, "account");
            ValidateAddress(asset, "asset");
            return GetPendingBalanceInternal(instanceId, account, asset);
        }

        [Safe]
        public static BigInteger GetLockedBalance(string instanceId, string referenceId, UInt160 asset)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateIdentifier(referenceId, "reference id");
            ValidateAddress(asset, "asset");
            return GetLockedBalanceInternal(instanceId, referenceId, asset);
        }

        public static void InitializeInstance(
            string instanceId,
            UInt160 owner,
            UInt160 operatorAddress,
            ByteString config)
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
                Config = NormalizeBlob(config),
                Active = existing.InstanceId.Length == 0 || existing.Active,
                UpdatedAt = Runtime.Time
            };

            Storage.Put(Storage.CurrentContext, InstanceKey(instanceId), StdLib.Serialize(info));
            OnInstanceInitialized(instanceId, info.Owner, info.Operator, info.Active);
        }

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

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            if (from == Runtime.ExecutingScriptHash) return;
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            UInt160 asset = Runtime.CallingScriptHash;
            ValidateAddress(asset, "asset");

            (string instanceId, UInt160 account) = ParseFundingMemo(data);
            InstanceInfo info = GetInstance(instanceId);
            RequireActiveInstance(info);

            ExecutionEngine.Assert(account == from || Runtime.CheckWitness(account), "unauthorized funding target");

            BigInteger next = GetPendingBalanceInternal(instanceId, account, asset) + amount;
            SetPendingBalance(instanceId, account, asset, next);

            OnPendingCredited(instanceId, account, asset, amount, next);
        }

        public static void LockFunds(
            string instanceId,
            UInt160 account,
            UInt160 asset,
            BigInteger amount,
            string referenceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateIdentifier(referenceId, "reference id");
            ValidateAddress(account, "account");
            ValidateAddress(asset, "asset");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            InstanceInfo info = GetInstance(instanceId);
            RequireActiveInstance(info);
            ExecutionEngine.Assert(IsInstanceActor(info, account), "unauthorized");

            BigInteger pending = GetPendingBalanceInternal(instanceId, account, asset);
            ExecutionEngine.Assert(pending >= amount, "insufficient pending balance");

            BigInteger nextPending = pending - amount;
            SetPendingBalance(instanceId, account, asset, nextPending);

            BigInteger nextLocked = GetLockedBalanceInternal(instanceId, referenceId, asset) + amount;
            SetLockedBalance(instanceId, referenceId, asset, nextLocked);

            OnFundsLocked(instanceId, referenceId, asset, amount, nextLocked);
        }

        public static void ReleaseFunds(
            string instanceId,
            string referenceId,
            UInt160 asset,
            UInt160 recipient,
            BigInteger amount)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateIdentifier(referenceId, "reference id");
            ValidateAddress(asset, "asset");
            ValidateAddress(recipient, "recipient");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            InstanceInfo info = GetInstance(instanceId);
            ExecutionEngine.Assert(info.InstanceId.Length > 0, "instance not found");
            ExecutionEngine.Assert(IsInstanceController(info), "unauthorized");

            BigInteger locked = GetLockedBalanceInternal(instanceId, referenceId, asset);
            ExecutionEngine.Assert(locked >= amount, "insufficient locked balance");

            BigInteger remaining = locked - amount;
            SetLockedBalance(instanceId, referenceId, asset, remaining);

            bool transferred = TransferAsset(asset, recipient, amount);
            ExecutionEngine.Assert(transferred, "release transfer failed");

            OnFundsReleased(instanceId, referenceId, asset, recipient, amount, remaining);
        }

        public static void RefundFunds(
            string instanceId,
            string referenceId,
            UInt160 asset,
            UInt160 recipient,
            BigInteger amount)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateIdentifier(referenceId, "reference id");
            ValidateAddress(asset, "asset");
            ValidateAddress(recipient, "recipient");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            InstanceInfo info = GetInstance(instanceId);
            ExecutionEngine.Assert(info.InstanceId.Length > 0, "instance not found");
            ExecutionEngine.Assert(IsInstanceController(info), "unauthorized");

            BigInteger locked = GetLockedBalanceInternal(instanceId, referenceId, asset);
            ExecutionEngine.Assert(locked >= amount, "insufficient locked balance");

            BigInteger remaining = locked - amount;
            SetLockedBalance(instanceId, referenceId, asset, remaining);

            bool transferred = TransferAsset(asset, recipient, amount);
            ExecutionEngine.Assert(transferred, "refund transfer failed");

            OnFundsRefunded(instanceId, referenceId, asset, recipient, amount, remaining);
        }

        public static void WithdrawPendingFunds(
            string instanceId,
            UInt160 account,
            UInt160 asset,
            BigInteger amount,
            UInt160 recipient)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(account, "account");
            ValidateAddress(asset, "asset");
            ValidateAddress(recipient, "recipient");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            InstanceInfo info = GetInstance(instanceId);
            ExecutionEngine.Assert(info.InstanceId.Length > 0, "instance not found");
            ExecutionEngine.Assert(IsInstanceActor(info, account), "unauthorized");

            BigInteger pending = GetPendingBalanceInternal(instanceId, account, asset);
            ExecutionEngine.Assert(pending >= amount, "insufficient pending balance");

            BigInteger remaining = pending - amount;
            SetPendingBalance(instanceId, account, asset, remaining);

            bool transferred = TransferAsset(asset, recipient, amount);
            ExecutionEngine.Assert(transferred, "withdraw transfer failed");

            OnPendingWithdrawn(instanceId, account, asset, recipient, amount, remaining);
        }

        public static void SetInstanceRegistry(UInt160 registry)
        {
            ExecutionEngine.Assert(IsAdminWitness(), "unauthorized");

            UInt160 normalized = NormalizeOptionalAddress(registry);
            UInt160 oldRegistry = InstanceRegistry();
            Storage.Put(Storage.CurrentContext, PREFIX_INSTANCE_REGISTRY, normalized);
            OnInstanceRegistryChanged(oldRegistry, normalized);
        }

        public static void SetAdmin(UInt160 newAdmin)
        {
            ExecutionEngine.Assert(IsAdminWitness(), "unauthorized");
            ValidateAddress(newAdmin, "admin");

            UInt160 oldAdmin = Admin();
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
            OnAdminChanged(oldAdmin, newAdmin);
        }
    }
}
