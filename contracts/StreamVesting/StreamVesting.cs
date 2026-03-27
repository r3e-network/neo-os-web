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
    /// Shared recurring stream / vesting capability module.
    /// It owns stream schedules while delegating actual custody to a FundingVault instance binding.
    /// </summary>
    [DisplayName("StreamVesting")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "0.1.0")]
    [ManifestExtra("Description", "Shared instance-scoped stream vesting module for recurring payment flows")]
    [ContractPermission("*", "*")]
    public class StreamVesting : SmartContract
    {
        private const long MIN_INTERVAL_SECONDS = 86400;
        private const long MAX_INTERVAL_SECONDS = 365 * 86400;
        private const int MAX_TITLE_LENGTH = 60;
        private const int MAX_NOTES_LENGTH = 240;

        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_INSTANCE_REGISTRY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_INSTANCE = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_STREAM_COUNTER = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_STREAM = new byte[] { 0x12 };

        public struct InstanceInfo
        {
            public string InstanceId;
            public UInt160 Owner;
            public UInt160 Operator;
            public UInt160 FundingVault;
            public ByteString Config;
            public bool Active;
            public BigInteger UpdatedAt;
        }

        public struct StreamData
        {
            public UInt160 Creator;
            public UInt160 Beneficiary;
            public UInt160 Asset;
            public BigInteger TotalAmount;
            public BigInteger ReleasedAmount;
            public BigInteger RateAmount;
            public BigInteger IntervalSeconds;
            public BigInteger CreatedTime;
            public BigInteger CancelledAt;
            public BigInteger FinalUnlockedAmount;
            public bool Cancelled;
            public string Title;
            public string Notes;
        }

        [DisplayName("InstanceInitialized")]
        public static event Action<string, UInt160, UInt160, UInt160, bool> OnInstanceInitialized = delegate { };

        [DisplayName("InstanceStatusChanged")]
        public static event Action<string, bool> OnInstanceStatusChanged = delegate { };

        [DisplayName("StreamCreated")]
        public static event Action<string, BigInteger, UInt160, UInt160, UInt160, BigInteger> OnStreamCreated = delegate { };

        [DisplayName("StreamClaimed")]
        public static event Action<string, BigInteger, UInt160, BigInteger, BigInteger> OnStreamClaimed = delegate { };

        [DisplayName("StreamCancelled")]
        public static event Action<string, BigInteger, UInt160, BigInteger, BigInteger> OnStreamCancelled = delegate { };

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

        private static byte[] StreamCounterKey(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            return Helper.Concat(PREFIX_STREAM_COUNTER, (ByteString)(instanceId ?? ""));
        }

        private static byte[] StreamKey(string instanceId, BigInteger streamId)
        {
            ValidateIdentifier(instanceId, "instance id");
            ExecutionEngine.Assert(streamId > 0, "invalid stream id");
            return Helper.Concat(PREFIX_STREAM, (ByteString)((instanceId ?? "") + "|" + streamId));
        }

        private static InstanceInfo EmptyInstance()
        {
            return new InstanceInfo
            {
                InstanceId = "",
                Owner = UInt160.Zero,
                Operator = UInt160.Zero,
                FundingVault = UInt160.Zero,
                Config = (ByteString)"",
                Active = false,
                UpdatedAt = 0
            };
        }

        private static StreamData EmptyStream()
        {
            return new StreamData
            {
                Creator = UInt160.Zero,
                Beneficiary = UInt160.Zero,
                Asset = UInt160.Zero,
                TotalAmount = 0,
                ReleasedAmount = 0,
                RateAmount = 0,
                IntervalSeconds = 0,
                CreatedTime = 0,
                CancelledAt = 0,
                FinalUnlockedAmount = 0,
                Cancelled = false,
                Title = "",
                Notes = ""
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

        private static bool IsInstanceActor(InstanceInfo instance, UInt160 user)
        {
            return IsInstanceController(instance) ||
                   (user != UInt160.Zero && user.IsValid && Runtime.CheckWitness(user));
        }

        private static void RequireActiveInstance(InstanceInfo instance)
        {
            ExecutionEngine.Assert(instance.InstanceId.Length > 0, "instance not found");
            ExecutionEngine.Assert(instance.Active, "instance inactive");
        }

        private static string StreamReference(BigInteger streamId)
        {
            return "stream:" + streamId;
        }

        private static void CallFundingVaultLock(
            UInt160 fundingVault,
            string instanceId,
            UInt160 creator,
            UInt160 asset,
            BigInteger amount,
            string referenceId)
        {
            Contract.Call(fundingVault, "LockFunds", CallFlags.All, instanceId, creator, asset, amount, referenceId);
        }

        private static void CallFundingVaultRelease(
            UInt160 fundingVault,
            string instanceId,
            string referenceId,
            UInt160 asset,
            UInt160 recipient,
            BigInteger amount,
            string method)
        {
            Contract.Call(fundingVault, method, CallFlags.All, instanceId, referenceId, asset, recipient, amount);
        }

        private static void StoreStream(string instanceId, BigInteger streamId, StreamData stream)
        {
            Storage.Put(Storage.CurrentContext, StreamKey(instanceId, streamId), StdLib.Serialize(stream));
        }

        private static StreamData GetStreamInternal(string instanceId, BigInteger streamId)
        {
            ByteString? data = Storage.Get(Storage.CurrentContext, StreamKey(instanceId, streamId));
            return data == null ? EmptyStream() : (StreamData)StdLib.Deserialize(data);
        }

        private static BigInteger GetUnlockedAmount(StreamData stream)
        {
            if (stream.Creator == UInt160.Zero) return 0;
            if (stream.Cancelled) return stream.FinalUnlockedAmount;

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

        private static string GetStatus(StreamData stream)
        {
            if (stream.Creator == UInt160.Zero) return "missing";
            if (stream.Cancelled) return "cancelled";
            if (stream.ReleasedAmount >= stream.TotalAmount) return "completed";
            return "active";
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
        public static BigInteger TotalStreams(string instanceId)
        {
            return ReadInteger(StreamCounterKey(instanceId));
        }

        [Safe]
        public static StreamData GetStream(string instanceId, BigInteger streamId)
        {
            ValidateIdentifier(instanceId, "instance id");
            return GetStreamInternal(instanceId, streamId);
        }

        [Safe]
        public static BigInteger GetClaimable(string instanceId, BigInteger streamId)
        {
            ValidateIdentifier(instanceId, "instance id");
            StreamData stream = GetStreamInternal(instanceId, streamId);
            return GetClaimableAmount(stream);
        }

        [Safe]
        public static Map<string, object> GetStreamDetails(string instanceId, BigInteger streamId)
        {
            StreamData stream = GetStream(instanceId, streamId);
            Map<string, object> details = new Map<string, object>();
            if (stream.Creator == UInt160.Zero) return details;

            BigInteger unlockedAmount = GetUnlockedAmount(stream);
            BigInteger claimable = GetClaimableAmount(stream);
            BigInteger remaining = (stream.Cancelled ? stream.FinalUnlockedAmount : stream.TotalAmount) - stream.ReleasedAmount;
            if (remaining < 0) remaining = 0;

            details["instanceId"] = instanceId;
            details["streamId"] = streamId;
            details["creator"] = stream.Creator;
            details["beneficiary"] = stream.Beneficiary;
            details["asset"] = stream.Asset;
            details["totalAmount"] = stream.TotalAmount;
            details["releasedAmount"] = stream.ReleasedAmount;
            details["unlockedAmount"] = unlockedAmount;
            details["claimable"] = claimable;
            details["remainingAmount"] = remaining;
            details["rateAmount"] = stream.RateAmount;
            details["intervalSeconds"] = stream.IntervalSeconds;
            details["status"] = GetStatus(stream);
            details["title"] = stream.Title;
            details["notes"] = stream.Notes;
            details["createdTime"] = stream.CreatedTime;
            details["cancelledAt"] = stream.CancelledAt;
            return details;
        }

        public static void InitializeInstance(
            string instanceId,
            UInt160 owner,
            UInt160 operatorAddress,
            UInt160 fundingVault,
            ByteString config)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(owner, "owner");
            ValidateAddress(fundingVault, "funding vault");

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
                FundingVault = fundingVault,
                Config = NormalizeBlob(config),
                Active = existing.InstanceId.Length == 0 || existing.Active,
                UpdatedAt = Runtime.Time
            };

            Storage.Put(Storage.CurrentContext, InstanceKey(instanceId), StdLib.Serialize(info));
            OnInstanceInitialized(instanceId, info.Owner, info.Operator, info.FundingVault, info.Active);
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

        public static BigInteger CreateStream(
            string instanceId,
            UInt160 creator,
            UInt160 beneficiary,
            UInt160 asset,
            BigInteger totalAmount,
            BigInteger rateAmount,
            BigInteger intervalSeconds,
            string title,
            string notes)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(creator, "creator");
            ValidateAddress(beneficiary, "beneficiary");
            ValidateAddress(asset, "asset");
            ExecutionEngine.Assert(totalAmount > 0, "invalid total");
            ExecutionEngine.Assert(rateAmount > 0 && rateAmount <= totalAmount, "invalid rate");
            ExecutionEngine.Assert(intervalSeconds >= MIN_INTERVAL_SECONDS && intervalSeconds <= MAX_INTERVAL_SECONDS, "invalid interval");

            InstanceInfo info = GetInstance(instanceId);
            RequireActiveInstance(info);
            ExecutionEngine.Assert(IsInstanceActor(info, creator), "unauthorized");

            string normalizedTitle = title ?? "";
            string normalizedNotes = notes ?? "";
            ExecutionEngine.Assert(normalizedTitle.Length <= MAX_TITLE_LENGTH, "title too long");
            ExecutionEngine.Assert(normalizedNotes.Length <= MAX_NOTES_LENGTH, "notes too long");

            BigInteger streamId = TotalStreams(instanceId) + 1;
            Storage.Put(Storage.CurrentContext, StreamCounterKey(instanceId), streamId);

            CallFundingVaultLock(
                info.FundingVault,
                instanceId,
                creator,
                asset,
                totalAmount,
                StreamReference(streamId));

            StreamData stream = new StreamData
            {
                Creator = creator,
                Beneficiary = beneficiary,
                Asset = asset,
                TotalAmount = totalAmount,
                ReleasedAmount = 0,
                RateAmount = rateAmount,
                IntervalSeconds = intervalSeconds,
                CreatedTime = Runtime.Time,
                CancelledAt = 0,
                FinalUnlockedAmount = 0,
                Cancelled = false,
                Title = normalizedTitle,
                Notes = normalizedNotes
            };

            StoreStream(instanceId, streamId, stream);
            OnStreamCreated(instanceId, streamId, creator, beneficiary, asset, totalAmount);
            return streamId;
        }

        public static void ClaimStream(string instanceId, UInt160 beneficiary, BigInteger streamId)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(beneficiary, "beneficiary");

            InstanceInfo info = GetInstance(instanceId);
            RequireActiveInstance(info);
            ExecutionEngine.Assert(IsInstanceActor(info, beneficiary), "unauthorized");

            StreamData stream = GetStreamInternal(instanceId, streamId);
            ExecutionEngine.Assert(stream.Creator != UInt160.Zero, "stream not found");
            ExecutionEngine.Assert(stream.Beneficiary == beneficiary, "wrong beneficiary");

            BigInteger claimable = GetClaimableAmount(stream);
            ExecutionEngine.Assert(claimable > 0, "nothing claimable");

            stream.ReleasedAmount += claimable;
            StoreStream(instanceId, streamId, stream);

            CallFundingVaultRelease(
                info.FundingVault,
                instanceId,
                StreamReference(streamId),
                stream.Asset,
                beneficiary,
                claimable,
                "ReleaseFunds");

            OnStreamClaimed(instanceId, streamId, beneficiary, claimable, stream.ReleasedAmount);
        }

        public static void CancelStream(string instanceId, UInt160 creator, BigInteger streamId)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(creator, "creator");

            InstanceInfo info = GetInstance(instanceId);
            RequireActiveInstance(info);
            ExecutionEngine.Assert(IsInstanceActor(info, creator), "unauthorized");

            StreamData stream = GetStreamInternal(instanceId, streamId);
            ExecutionEngine.Assert(stream.Creator != UInt160.Zero, "stream not found");
            ExecutionEngine.Assert(stream.Creator == creator, "wrong creator");
            ExecutionEngine.Assert(!stream.Cancelled, "already cancelled");

            BigInteger unlockedAmount = GetUnlockedAmount(stream);
            BigInteger refundAmount = stream.TotalAmount - unlockedAmount;
            if (refundAmount < 0) refundAmount = 0;

            stream.Cancelled = true;
            stream.CancelledAt = Runtime.Time;
            stream.FinalUnlockedAmount = unlockedAmount;
            StoreStream(instanceId, streamId, stream);

            if (refundAmount > 0)
            {
                CallFundingVaultRelease(
                    info.FundingVault,
                    instanceId,
                    StreamReference(streamId),
                    stream.Asset,
                    creator,
                    refundAmount,
                    "RefundFunds");
            }

            OnStreamCancelled(instanceId, streamId, creator, refundAmount, unlockedAmount);
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
