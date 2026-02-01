using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppStreamVault
    {
        #region Internal Helpers

        private static void StoreStream(BigInteger streamId, StreamData stream)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_STREAMS, (ByteString)streamId.ToByteArray()),
                StdLib.Serialize(stream));
        }

        private static void AddUserStream(UInt160 user, BigInteger streamId)
        {
            byte[] countKey = Helper.Concat(PREFIX_USER_STREAM_COUNT, user);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_STREAMS, user),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, streamId);
        }

        private static void AddBeneficiaryStream(UInt160 beneficiary, BigInteger streamId)
        {
            byte[] countKey = Helper.Concat(PREFIX_BENEFICIARY_STREAM_COUNT, beneficiary);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_BENEFICIARY_STREAMS, beneficiary),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, streamId);
        }

        private static bool IsNeo(UInt160 asset) => asset == NEO.Hash;

        private static bool IsGas(UInt160 asset) => asset == GAS.Hash;

        private static void ValidateAsset(UInt160 asset)
        {
            ExecutionEngine.Assert(IsNeo(asset) || IsGas(asset), "unsupported asset");
        }

        private static BigInteger GetStreamCountForUser(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_STREAM_COUNT, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        private static BigInteger GetStreamCountForBeneficiary(UInt160 beneficiary)
        {
            byte[] key = Helper.Concat(PREFIX_BENEFICIARY_STREAM_COUNT, beneficiary);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        private static void UpdateTotalLocked(BigInteger delta)
        {
            BigInteger current = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_LOCKED);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_LOCKED, current + delta);
        }

        private static void UpdateTotalReleased(BigInteger delta)
        {
            BigInteger current = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_RELEASED);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_RELEASED, current + delta);
        }

        private static BigInteger CalculateClaimable(StreamData stream, BigInteger timestamp)
        {
            if (!stream.Active) return 0;
            if (stream.IntervalSeconds <= 0) return 0;
            if (timestamp <= stream.LastClaimTime) return 0;

            BigInteger elapsed = timestamp - stream.LastClaimTime;
            BigInteger periods = elapsed / stream.IntervalSeconds;
            if (periods <= 0) return 0;

            BigInteger amount = periods * stream.RateAmount;
            BigInteger remaining = stream.TotalAmount - stream.ReleasedAmount;
            if (amount > remaining) return remaining;
            return amount;
        }

        private static void ValidateTextLimits(string title, string notes)
        {
            if (title != null)
            {
                ExecutionEngine.Assert(title.Length <= MAX_TITLE_LENGTH, "title too long");
            }
            if (notes != null)
            {
                ExecutionEngine.Assert(notes.Length <= MAX_NOTES_LENGTH, "notes too long");
            }
        }

        #endregion
    }
}
