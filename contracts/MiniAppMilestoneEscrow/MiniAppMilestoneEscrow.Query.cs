using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppMilestoneEscrow
    {
        #region Query Methods

        [Safe]
        public static Map<string, object> GetEscrowDetails(BigInteger escrowId)
        {
            EscrowData escrow = GetEscrow(escrowId);
            Map<string, object> details = new Map<string, object>();
            if (escrow.Creator == UInt160.Zero) return details;

            details["id"] = escrowId;
            details["creator"] = escrow.Creator;
            details["beneficiary"] = escrow.Beneficiary;
            details["asset"] = escrow.Asset;
            details["assetSymbol"] = IsNeo(escrow.Asset) ? "NEO" : "GAS";
            details["totalAmount"] = escrow.TotalAmount;
            details["releasedAmount"] = escrow.ReleasedAmount;
            details["remainingAmount"] = escrow.TotalAmount - escrow.ReleasedAmount;
            details["milestoneCount"] = escrow.MilestoneCount;
            details["createdTime"] = escrow.CreatedTime;
            details["active"] = escrow.Active;
            details["cancelled"] = escrow.Cancelled;
            details["status"] = escrow.Active ? "active" : escrow.Cancelled ? "cancelled" : "completed";
            details["title"] = escrow.Title;
            details["notes"] = escrow.Notes;

            int count = (int)escrow.MilestoneCount;
            BigInteger[] amounts = new BigInteger[count];
            bool[] approved = new bool[count];
            bool[] claimed = new bool[count];

            for (int i = 0; i < count; i++)
            {
                BigInteger index = i + 1;
                MilestoneData milestone = GetMilestone(escrowId, index);
                amounts[i] = milestone.Amount;
                approved[i] = milestone.Approved;
                claimed[i] = milestone.Claimed;
            }

            details["milestoneAmounts"] = amounts;
            details["milestoneApproved"] = approved;
            details["milestoneClaimed"] = claimed;

            return details;
        }

        [Safe]
        public static Map<string, object> GetMilestoneDetails(BigInteger escrowId, BigInteger milestoneIndex)
        {
            MilestoneData milestone = GetMilestone(escrowId, milestoneIndex);
            Map<string, object> details = new Map<string, object>();
            details["amount"] = milestone.Amount;
            details["approved"] = milestone.Approved;
            details["claimed"] = milestone.Claimed;
            details["approvedTime"] = milestone.ApprovedTime;
            details["claimedTime"] = milestone.ClaimedTime;
            return details;
        }

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalEscrows"] = TotalEscrows();
            stats["totalLocked"] = TotalLocked();
            stats["totalReleased"] = TotalReleased();
            stats["minNeo"] = MIN_NEO;
            stats["minGas"] = MIN_GAS;
            stats["minMilestones"] = MIN_MILESTONES;
            stats["maxMilestones"] = MAX_MILESTONES;
            return stats;
        }

        [Safe]
        public static BigInteger[] GetCreatorEscrows(UInt160 creator, BigInteger offset, BigInteger limit)
        {
            BigInteger count = GetCreatorEscrowCountInternal(creator);
            if (offset >= count) return new BigInteger[0];

            BigInteger end = offset + limit;
            if (end > count) end = count;
            BigInteger resultCount = end - offset;

            BigInteger[] result = new BigInteger[(int)resultCount];
            for (BigInteger i = 0; i < resultCount; i++)
            {
                byte[] key = Helper.Concat(
                    Helper.Concat(PREFIX_CREATOR_ESCROWS, creator),
                    (ByteString)(offset + i).ToByteArray());
                result[(int)i] = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            }
            return result;
        }

        [Safe]
        public static BigInteger[] GetBeneficiaryEscrows(UInt160 beneficiary, BigInteger offset, BigInteger limit)
        {
            BigInteger count = GetBeneficiaryEscrowCountInternal(beneficiary);
            if (offset >= count) return new BigInteger[0];

            BigInteger end = offset + limit;
            if (end > count) end = count;
            BigInteger resultCount = end - offset;

            BigInteger[] result = new BigInteger[(int)resultCount];
            for (BigInteger i = 0; i < resultCount; i++)
            {
                byte[] key = Helper.Concat(
                    Helper.Concat(PREFIX_BENEFICIARY_ESCROWS, beneficiary),
                    (ByteString)(offset + i).ToByteArray());
                result[(int)i] = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            }
            return result;
        }

        #endregion
    }
}
