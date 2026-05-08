using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppMilestoneEscrow
    {
        #region Internal Helpers

        private static void StoreEscrow(BigInteger escrowId, EscrowData escrow)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_ESCROWS, (ByteString)escrowId.ToByteArray()),
                StdLib.Serialize(escrow));
        }

        private static byte[] BuildMilestoneKey(BigInteger escrowId, BigInteger milestoneIndex)
        {
            return Helper.Concat(
                Helper.Concat(PREFIX_MILESTONES, (ByteString)escrowId.ToByteArray()),
                (ByteString)milestoneIndex.ToByteArray());
        }

        private static void StoreMilestone(BigInteger escrowId, BigInteger milestoneIndex, MilestoneData milestone)
        {
            Storage.Put(Storage.CurrentContext,
                BuildMilestoneKey(escrowId, milestoneIndex),
                StdLib.Serialize(milestone));
        }

        private static void AddCreatorEscrow(UInt160 creator, BigInteger escrowId)
        {
            byte[] countKey = Helper.Concat(PREFIX_CREATOR_ESCROW_COUNT, creator);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_CREATOR_ESCROWS, creator),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, escrowId);
        }

        private static void AddBeneficiaryEscrow(UInt160 beneficiary, BigInteger escrowId)
        {
            byte[] countKey = Helper.Concat(PREFIX_BENEFICIARY_ESCROW_COUNT, beneficiary);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_BENEFICIARY_ESCROWS, beneficiary),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, escrowId);
        }

        private static BigInteger GetCreatorEscrowCountInternal(UInt160 creator)
        {
            byte[] key = Helper.Concat(PREFIX_CREATOR_ESCROW_COUNT, creator);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        private static BigInteger GetBeneficiaryEscrowCountInternal(UInt160 beneficiary)
        {
            byte[] key = Helper.Concat(PREFIX_BENEFICIARY_ESCROW_COUNT, beneficiary);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        private static bool IsNeo(UInt160 asset) => asset == NEO.Hash;

        private static bool IsGas(UInt160 asset) => asset == GAS.Hash;

        private static void ValidateAsset(UInt160 asset)
        {
            ExecutionEngine.Assert(IsNeo(asset) || IsGas(asset), "unsupported asset");
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
