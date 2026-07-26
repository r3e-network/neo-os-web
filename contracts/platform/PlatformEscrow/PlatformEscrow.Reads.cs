using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class PlatformEscrowContract
    {
        [Safe]
        public static BigInteger TotalEscrows(string appId) => ReadInteger(AppKey(appId, PREFIX_ESCROW_COUNT));

        [Safe]
        public static BigInteger CreditOf(string appId, UInt160 asset, UInt160 payer) =>
            IsSupportedAsset(asset) ? ReadCredit(appId, asset, payer) : 0;

        [Safe]
        public static BigInteger CreditLiabilityOf(string appId, UInt160 asset) =>
            IsSupportedAsset(asset) ? ReadInteger(CreditLiabilityKey(appId, asset)) : 0;

        [Safe]
        public static BigInteger EscrowLiabilityOf(string appId, UInt160 asset) =>
            IsSupportedAsset(asset) ? ReadInteger(EscrowLiabilityKey(appId, asset)) : 0;

        [Safe]
        public static BigInteger TotalCreditLiability(UInt160 asset) =>
            IsSupportedAsset(asset) ? ReadInteger(TotalCreditLiabilityKey(asset)) : 0;

        [Safe]
        public static BigInteger TotalEscrowLiability(UInt160 asset) =>
            IsSupportedAsset(asset) ? ReadInteger(TotalEscrowLiabilityKey(asset)) : 0;

        [Safe]
        public static object GetEscrowDetails(string appId, BigInteger escrowId)
        {
            object[] escrow = ReadEscrow(appId, escrowId);
            Map<string, object> details = new Map<string, object>();
            details["id"] = escrow[0];
            details["creator"] = escrow[1];
            details["beneficiary"] = escrow[2];
            details["asset"] = escrow[3];
            details["totalAmount"] = escrow[4];
            details["releasedAmount"] = escrow[5];
            details["remainingAmount"] = (BigInteger)escrow[4] - (BigInteger)escrow[5];
            details["milestoneCount"] = escrow[6];
            details["createdTime"] = escrow[7];
            details["status"] = StatusName((BigInteger)escrow[8]);
            details["title"] = escrow[9];
            details["notes"] = escrow[10];
            details["approvers"] = escrow.Length > 11 ? escrow[11] : new object[] { escrow[1] };
            details["approvalThreshold"] = ApprovalThreshold(escrow);

            int count = (int)(BigInteger)escrow[6];
            BigInteger[] amounts = new BigInteger[count];
            bool[] approved = new bool[count];
            bool[] claimed = new bool[count];
            BigInteger[] approvalCounts = new BigInteger[count];
            for (int i = 0; i < count; i++)
            {
                object[] milestone = ReadMilestone(appId, escrowId, i + 1);
                amounts[i] = (BigInteger)milestone[0];
                approved[i] = (bool)milestone[1];
                claimed[i] = (bool)milestone[2];
                approvalCounts[i] = ApprovalCount(milestone);
            }
            details["milestoneAmounts"] = amounts;
            details["milestoneApproved"] = approved;
            details["milestoneClaimed"] = claimed;
            details["milestoneApprovalCounts"] = approvalCounts;
            return details;
        }

        [Safe]
        public static object GetMilestoneDetails(string appId, BigInteger escrowId, BigInteger milestoneIndex)
        {
            object[] escrow = ReadEscrow(appId, escrowId);
            ValidateMilestoneIndex(escrow, milestoneIndex);
            object[] milestone = ReadMilestone(appId, escrowId, milestoneIndex);
            Map<string, object> details = new Map<string, object>();
            details["amount"] = milestone[0];
            details["approved"] = milestone[1];
            details["claimed"] = milestone[2];
            details["approvedTime"] = milestone[3];
            details["claimedTime"] = milestone[4];
            details["approvalCount"] = ApprovalCount(milestone);
            details["approvalThreshold"] = ApprovalThreshold(escrow);
            return details;
        }

        [Safe]
        public static Map<string, object> GetPlatformStats(string appId)
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalEscrows"] = TotalEscrows(appId);
            stats["gasCreditLiability"] = CreditLiabilityOf(appId, GAS.Hash);
            stats["neoCreditLiability"] = CreditLiabilityOf(appId, NEO.Hash);
            stats["gasEscrowLiability"] = EscrowLiabilityOf(appId, GAS.Hash);
            stats["neoEscrowLiability"] = EscrowLiabilityOf(appId, NEO.Hash);
            stats["maxMilestones"] = MaxMilestonesOf(appId);
            stats["approvalGraceMs"] = ApprovalGracePeriodOf(appId);
            return stats;
        }

        [Safe]
        public static BigInteger[] GetCreatorEscrows(string appId, UInt160 creator, BigInteger offset, BigInteger limit) =>
            ReadIndex(appId, PREFIX_CREATOR_COUNT, PREFIX_CREATOR_INDEX, creator, offset, limit);

        [Safe]
        public static BigInteger[] GetBeneficiaryEscrows(string appId, UInt160 beneficiary, BigInteger offset, BigInteger limit) =>
            ReadIndex(appId, PREFIX_BENEFICIARY_COUNT, PREFIX_BENEFICIARY_INDEX, beneficiary, offset, limit);

        private static BigInteger[] ReadIndex(string appId, byte[] countPrefix, byte[] indexPrefix, UInt160 account, BigInteger offset, BigInteger limit)
        {
            ValidateAddress(account);
            ExecutionEngine.Assert(offset >= 0 && limit > 0 && limit <= MAX_PAGE_SIZE, "invalid page");
            BigInteger count = ReadAccountCount(appId, countPrefix, account);
            if (offset >= count) return new BigInteger[0];
            BigInteger remaining = count - offset;
            BigInteger take = remaining < limit ? remaining : limit;
            BigInteger[] result = new BigInteger[(int)take];
            for (int i = 0; i < result.Length; i++)
            {
                result[i] = ReadInteger(IndexKey(appId, indexPrefix, account, offset + i));
            }
            return result;
        }

        private static string StatusName(BigInteger status)
        {
            if (status == 1) return "active";
            if (status == 2) return "completed";
            return "cancelled";
        }
    }
}
