using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public delegate void StreamCreatedHandler(BigInteger streamId, UInt160 creator, UInt160 beneficiary, UInt160 asset, BigInteger totalAmount);
    public delegate void StreamClaimedHandler(BigInteger streamId, UInt160 beneficiary, BigInteger amount, BigInteger totalReleased);
    public delegate void StreamCancelledHandler(BigInteger streamId, UInt160 creator, BigInteger refundedAmount, BigInteger unlockedAmount);

    [DisplayName("MiniAppStreamVault")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Recurring payroll and subscription streams with claimable interval-based releases.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        private const string APP_ID = "miniapp-stream-vault";
        private const long MIN_INTERVAL_SECONDS = 86400;
        private const long MAX_INTERVAL_SECONDS = 365 * 86400;
        private const int MAX_TITLE_LENGTH = 60;
        private const int MAX_NOTES_LENGTH = 240;

        private static readonly byte[] PREFIX_STREAM_ID = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_STREAMS = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_USER_STREAMS = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_USER_STREAM_COUNT = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_BENEFICIARY_STREAMS = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_BENEFICIARY_STREAM_COUNT = new byte[] { 0x25 };

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

        [DisplayName("StreamCreated")]
        public static event StreamCreatedHandler OnStreamCreated;

        [DisplayName("StreamClaimed")]
        public static event StreamClaimedHandler OnStreamClaimed;

        [DisplayName("StreamCancelled")]
        public static event StreamCancelledHandler OnStreamCancelled;

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            bool isSupportedAsset = Runtime.CallingScriptHash == GAS.Hash || Runtime.CallingScriptHash == NEO.Hash;
            ExecutionEngine.Assert(isSupportedAsset, "unsupported asset");
            if (from == Runtime.ExecutingScriptHash) return;
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
        }

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_STREAM_ID, 0);
        }

        [Safe]
        public static BigInteger TotalStreams() =>
            GetStoredIntegerOrZero(PREFIX_STREAM_ID);

        [Safe]
        public static Map<string, object> GetStreamDetails(BigInteger streamId)
        {
            StreamData stream = GetStream(streamId);
            Map<string, object> details = new Map<string, object>();
            if (stream.Creator == UInt160.Zero) return details;

            BigInteger payoutCap = GetPayoutCap(stream);
            BigInteger claimable = GetClaimable(stream);
            BigInteger remaining = payoutCap - stream.ReleasedAmount;
            if (remaining < 0) remaining = 0;

            details["id"] = streamId;
            details["creator"] = stream.Creator;
            details["beneficiary"] = stream.Beneficiary;
            details["asset"] = stream.Asset;
            details["totalAmount"] = stream.TotalAmount;
            details["releasedAmount"] = stream.ReleasedAmount;
            details["remainingAmount"] = remaining;
            details["rateAmount"] = stream.RateAmount;
            details["intervalSeconds"] = stream.IntervalSeconds;
            details["status"] = GetStatus(stream);
            details["claimable"] = claimable;
            details["title"] = stream.Title;
            details["notes"] = stream.Notes;
            details["createdTime"] = stream.CreatedTime;
            details["cancelledAt"] = stream.CancelledAt;

            return details;
        }

        [Safe]
        public static BigInteger[] getUserStreams(UInt160 user, BigInteger offset, BigInteger limit)
        {
            return GetIndexedStreams(PREFIX_USER_STREAM_COUNT, PREFIX_USER_STREAMS, user, offset, limit);
        }

        [Safe]
        public static BigInteger[] getBeneficiaryStreams(UInt160 beneficiary, BigInteger offset, BigInteger limit)
        {
            return GetIndexedStreams(PREFIX_BENEFICIARY_STREAM_COUNT, PREFIX_BENEFICIARY_STREAMS, beneficiary, offset, limit);
        }

        public static BigInteger CreateStream(
            UInt160 creator,
            UInt160 beneficiary,
            UInt160 asset,
            BigInteger totalAmount,
            BigInteger rateAmount,
            BigInteger intervalSeconds,
            string title,
            string notes)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateUserOrAbstractAccount(creator);
            ValidateAddress(beneficiary);
            ValidateAsset(asset);
            ExecutionEngine.Assert(totalAmount > 0, "invalid total");
            ExecutionEngine.Assert(rateAmount > 0 && rateAmount <= totalAmount, "invalid rate");
            ExecutionEngine.Assert(intervalSeconds >= MIN_INTERVAL_SECONDS && intervalSeconds <= MAX_INTERVAL_SECONDS, "invalid interval");

            string normalizedTitle = title ?? "";
            string normalizedNotes = notes ?? "";
            ExecutionEngine.Assert(normalizedTitle.Length <= MAX_TITLE_LENGTH, "title too long");
            ExecutionEngine.Assert(normalizedNotes.Length <= MAX_NOTES_LENGTH, "notes too long");

            bool transferred = TransferAsset(asset, creator, Runtime.ExecutingScriptHash, totalAmount);
            ExecutionEngine.Assert(transferred, "asset transfer failed");

            BigInteger streamId = TotalStreams() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_STREAM_ID, streamId);

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

            StoreStream(streamId, stream);
            AddIndexedStream(PREFIX_USER_STREAM_COUNT, PREFIX_USER_STREAMS, creator, streamId);
            AddIndexedStream(PREFIX_BENEFICIARY_STREAM_COUNT, PREFIX_BENEFICIARY_STREAMS, beneficiary, streamId);

            OnStreamCreated(streamId, creator, beneficiary, asset, totalAmount);
            return streamId;
        }

        public static void ClaimStream(UInt160 beneficiary, BigInteger streamId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateUserOrAbstractAccount(beneficiary);

            StreamData stream = GetStream(streamId);
            ExecutionEngine.Assert(stream.Creator != UInt160.Zero, "stream not found");
            ExecutionEngine.Assert(stream.Beneficiary == beneficiary, "unauthorized");

            BigInteger claimable = GetClaimable(stream);
            ExecutionEngine.Assert(claimable > 0, "nothing claimable");

            stream.ReleasedAmount += claimable;
            StoreStream(streamId, stream);

            bool transferred = TransferAsset(stream.Asset, Runtime.ExecutingScriptHash, beneficiary, claimable);
            ExecutionEngine.Assert(transferred, "claim transfer failed");

            OnStreamClaimed(streamId, beneficiary, claimable, stream.ReleasedAmount);
        }

        public static void CancelStream(UInt160 creator, BigInteger streamId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateUserOrAbstractAccount(creator);

            StreamData stream = GetStream(streamId);
            ExecutionEngine.Assert(stream.Creator != UInt160.Zero, "stream not found");
            ExecutionEngine.Assert(stream.Creator == creator, "unauthorized");
            ExecutionEngine.Assert(!stream.Cancelled, "already cancelled");

            BigInteger unlockedAmount = GetUnlockedAmount(stream);
            BigInteger refundAmount = stream.TotalAmount - unlockedAmount;
            if (refundAmount < 0) refundAmount = 0;

            stream.Cancelled = true;
            stream.CancelledAt = Runtime.Time;
            stream.FinalUnlockedAmount = unlockedAmount;
            StoreStream(streamId, stream);

            if (refundAmount > 0)
            {
                bool transferred = TransferAsset(stream.Asset, Runtime.ExecutingScriptHash, creator, refundAmount);
                ExecutionEngine.Assert(transferred, "refund transfer failed");
            }

            OnStreamCancelled(streamId, creator, refundAmount, unlockedAmount);
        }

        private static void ValidateAsset(UInt160 asset)
        {
            ExecutionEngine.Assert(asset == GAS.Hash || asset == NEO.Hash, "unsupported asset");
        }

        private static bool TransferAsset(UInt160 asset, UInt160 from, UInt160 to, BigInteger amount)
        {
            if (amount <= 0) return true;
            return (bool)Contract.Call(asset, "transfer", CallFlags.All, from, to, amount, null);
        }

        private static void StoreStream(BigInteger streamId, StreamData stream)
        {
            Storage.Put(
                Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_STREAMS, (ByteString)streamId.ToByteArray()),
                StdLib.Serialize(stream));
        }

        private static StreamData GetStream(BigInteger streamId)
        {
            ByteString data = Storage.Get(
                Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_STREAMS, (ByteString)streamId.ToByteArray()));
            if (data == null) return new StreamData();
            return (StreamData)StdLib.Deserialize(data);
        }

        private static void AddIndexedStream(byte[] countPrefix, byte[] listPrefix, UInt160 user, BigInteger streamId)
        {
            byte[] countKey = Helper.Concat(countPrefix, user);
            BigInteger count = GetStoredIntegerOrZero(countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            byte[] entryKey = Helper.Concat(Helper.Concat(listPrefix, user), (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, entryKey, streamId);
        }

        private static BigInteger[] GetIndexedStreams(byte[] countPrefix, byte[] listPrefix, UInt160 user, BigInteger offset, BigInteger limit)
        {
            if (limit <= 0) return new BigInteger[0];

            byte[] countKey = Helper.Concat(countPrefix, user);
            BigInteger count = GetStoredIntegerOrZero(countKey);
            if (offset >= count) return new BigInteger[0];

            BigInteger end = offset + limit;
            if (end > count) end = count;
            BigInteger resultCount = end - offset;

            BigInteger[] result = new BigInteger[(int)resultCount];
            for (BigInteger i = 0; i < resultCount; i++)
            {
                byte[] entryKey = Helper.Concat(Helper.Concat(listPrefix, user), (ByteString)(offset + i).ToByteArray());
                result[(int)i] = GetStoredIntegerOrZero(entryKey);
            }

            return result;
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

        private static BigInteger GetPayoutCap(StreamData stream)
        {
            if (stream.Cancelled) return stream.FinalUnlockedAmount;
            return stream.TotalAmount;
        }

        private static BigInteger GetClaimable(StreamData stream)
        {
            BigInteger unlockedAmount = GetUnlockedAmount(stream);
            BigInteger claimable = unlockedAmount - stream.ReleasedAmount;
            return claimable > 0 ? claimable : 0;
        }

        private static string GetStatus(StreamData stream)
        {
            if (stream.Cancelled) return "cancelled";
            if (stream.ReleasedAmount >= stream.TotalAmount) return "completed";
            return "active";
        }
    }
}
