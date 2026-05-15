using System.Numerics;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppMilestoneEscrow
    {
        [Safe]
        public static BigInteger TotalEscrows() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ESCROW_ID);

        [Safe]
        public static BigInteger TotalLocked() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_LOCKED);

        [Safe]
        public static BigInteger TotalReleased() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_RELEASED);

        [Safe]
        public static EscrowData GetEscrow(BigInteger escrowId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_ESCROWS, (ByteString)escrowId.ToByteArray()));
            if (data == null) return new EscrowData();
            return (EscrowData)StdLib.Deserialize(data);
        }

        [Safe]
        public static MilestoneData GetMilestone(BigInteger escrowId, BigInteger milestoneIndex)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, BuildMilestoneKey(escrowId, milestoneIndex));
            if (data == null) return new MilestoneData();
            return (MilestoneData)StdLib.Deserialize(data);
        }
    }
}
