using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class PlatformEscrowContract
    {
        public static BigInteger CreateEscrow(
            string appId,
            UInt160 creator,
            UInt160 beneficiary,
            UInt160 asset,
            BigInteger totalAmount,
            BigInteger[] milestoneAmounts,
            string title,
            string notes)
        {
            return CreateEscrowCore(
                appId, creator, beneficiary, asset, totalAmount, milestoneAmounts,
                new UInt160[] { creator }, 1, title, notes);
        }

        public static BigInteger CreateEscrowWithApprovers(
            string appId,
            UInt160 creator,
            UInt160 beneficiary,
            UInt160 asset,
            BigInteger totalAmount,
            BigInteger[] milestoneAmounts,
            UInt160[] approvers,
            BigInteger approvalThreshold,
            string title,
            string notes)
        {
            return CreateEscrowCore(
                appId, creator, beneficiary, asset, totalAmount, milestoneAmounts,
                approvers, approvalThreshold, title, notes);
        }

        private static BigInteger CreateEscrowCore(
            string appId,
            UInt160 creator,
            UInt160 beneficiary,
            UInt160 asset,
            BigInteger totalAmount,
            BigInteger[] milestoneAmounts,
            UInt160[] approvers,
            BigInteger approvalThreshold,
            string title,
            string notes)
        {
            RequireCreateLane(appId);
            ValidateAddress(creator);
            ValidateAddress(beneficiary);
            ValidateAddress(asset);
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "creator witness required");
            ExecutionEngine.Assert(IsSupportedAsset(asset), "unsupported asset");
            ExecutionEngine.Assert(totalAmount > 0, "invalid total amount");
            ExecutionEngine.Assert(milestoneAmounts != null, "milestones required");
            ExecutionEngine.Assert(milestoneAmounts.Length > 0 && milestoneAmounts.Length <= MaxMilestonesOf(appId), "invalid milestone count");
            ValidateText(title, notes);

            BigInteger sum = 0;
            for (int i = 0; i < milestoneAmounts.Length; i++)
            {
                ExecutionEngine.Assert(milestoneAmounts[i] > 0, "invalid milestone amount");
                sum += milestoneAmounts[i];
            }
            ExecutionEngine.Assert(sum == totalAmount, "milestone sum mismatch");
            ExecutionEngine.Assert(ReadCredit(appId, asset, creator) >= totalAmount, "insufficient funded credit");
            ValidateApprovers(approvers, approvalThreshold);

            AcquireTenantLock(appId);
            ConsumeCredit(appId, asset, creator, totalAmount);
            BigInteger escrowId = ReadInteger(AppKey(appId, PREFIX_ESCROW_COUNT)) + 1;
            Storage.Put(Storage.CurrentContext, AppKey(appId, PREFIX_ESCROW_COUNT), escrowId);
            AddIndex(appId, PREFIX_CREATOR_COUNT, PREFIX_CREATOR_INDEX, creator, escrowId, "creator escrow limit");
            AddIndex(appId, PREFIX_BENEFICIARY_COUNT, PREFIX_BENEFICIARY_INDEX, beneficiary, escrowId, "beneficiary escrow limit");

            object[] escrow = new object[]
            {
                escrowId, creator, beneficiary, asset, totalAmount, BigInteger.Zero,
                milestoneAmounts.Length, Runtime.Time, 1, title, notes,
                ToObjectArray(approvers), approvalThreshold
            };
            StoreEscrow(appId, escrowId, escrow);
            for (int i = 0; i < milestoneAmounts.Length; i++)
            {
                StoreMilestone(appId, escrowId, i + 1, new object[]
                {
                    milestoneAmounts[i], false, false, BigInteger.Zero, BigInteger.Zero, BigInteger.Zero
                });
            }
            AdjustEscrowLiability(appId, asset, totalAmount);
            ReleaseTenantLock(appId);
            OnEscrowCreated(appId, escrowId, creator, beneficiary, asset, totalAmount, milestoneAmounts.Length);
            return escrowId;
        }

        public static void ApproveMilestone(string appId, UInt160 approver, BigInteger escrowId, BigInteger milestoneIndex)
        {
            RequireCreateLane(appId);
            ValidateAddress(approver);
            ExecutionEngine.Assert(Runtime.CheckWitness(approver), "approver witness required");
            object[] escrow = ReadEscrow(appId, escrowId);
            ExecutionEngine.Assert((BigInteger)escrow[8] == 1, "escrow inactive");
            ExecutionEngine.Assert(IsApprover(escrow, approver), "approver not authorized");
            ValidateMilestoneIndex(escrow, milestoneIndex);
            object[] milestone = ReadMilestone(appId, escrowId, milestoneIndex);
            ExecutionEngine.Assert((bool)milestone[1] == false && (bool)milestone[2] == false, "milestone finalized");
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, ApprovalKey(appId, escrowId, milestoneIndex, approver)) == null,
                "approver already approved");
            BigInteger approvalCount = ApprovalCount(milestone) + 1;
            milestone[5] = approvalCount;
            if (approvalCount >= ApprovalThreshold(escrow))
            {
                milestone[1] = true;
                milestone[3] = Runtime.Time;
            }
            Storage.Put(Storage.CurrentContext, ApprovalKey(appId, escrowId, milestoneIndex, approver), 1);
            StoreMilestone(appId, escrowId, milestoneIndex, milestone);
            OnMilestoneApproved(appId, escrowId, milestoneIndex, approver);
        }

        public static void ClaimMilestone(string appId, UInt160 beneficiary, BigInteger escrowId, BigInteger milestoneIndex)
        {
            RequireRegistered(appId);
            ValidateAddress(beneficiary);
            ExecutionEngine.Assert(Runtime.CheckWitness(beneficiary), "beneficiary witness required");
            object[] escrow = ReadEscrow(appId, escrowId);
            ExecutionEngine.Assert((BigInteger)escrow[8] == 1, "escrow inactive");
            ExecutionEngine.Assert((UInt160)escrow[2] == beneficiary, "beneficiary mismatch");
            ValidateMilestoneIndex(escrow, milestoneIndex);
            object[] milestone = ReadMilestone(appId, escrowId, milestoneIndex);
            ExecutionEngine.Assert((bool)milestone[1], "milestone not approved");
            ExecutionEngine.Assert((bool)milestone[2] == false, "milestone claimed");
            BigInteger amount = (BigInteger)milestone[0];

            AcquireTenantLock(appId);
            milestone[2] = true;
            milestone[4] = Runtime.Time;
            StoreMilestone(appId, escrowId, milestoneIndex, milestone);
            escrow[5] = (BigInteger)escrow[5] + amount;
            if ((BigInteger)escrow[5] >= (BigInteger)escrow[4]) escrow[8] = 2;
            StoreEscrow(appId, escrowId, escrow);
            AdjustEscrowLiability(appId, (UInt160)escrow[3], -amount);
            TransferAsset((UInt160)escrow[3], beneficiary, amount);
            ReleaseTenantLock(appId);
            OnMilestoneClaimed(appId, escrowId, milestoneIndex, beneficiary, amount);
        }

        public static void CancelEscrow(string appId, UInt160 creator, BigInteger escrowId)
        {
            RequireRegistered(appId);
            ValidateAddress(creator);
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "creator witness required");
            object[] escrow = ReadEscrow(appId, escrowId);
            ExecutionEngine.Assert((BigInteger)escrow[8] == 1, "escrow inactive");
            ExecutionEngine.Assert((UInt160)escrow[1] == creator, "creator mismatch");
            for (BigInteger index = 1; index <= (BigInteger)escrow[6]; index++)
            {
                object[] milestone = ReadMilestone(appId, escrowId, index);
                ExecutionEngine.Assert(!((bool)milestone[1] && !(bool)milestone[2]),
                    "approved milestone awaiting beneficiary claim");
            }
            BigInteger refundAmount = (BigInteger)escrow[4] - (BigInteger)escrow[5];

            AcquireTenantLock(appId);
            escrow[8] = 3;
            StoreEscrow(appId, escrowId, escrow);
            AdjustEscrowLiability(appId, (UInt160)escrow[3], -refundAmount);
            TransferAsset((UInt160)escrow[3], creator, refundAmount);
            ReleaseTenantLock(appId);
            OnEscrowCancelled(appId, escrowId, creator, refundAmount);
        }

        private static void ValidateMilestoneIndex(object[] escrow, BigInteger milestoneIndex) =>
            ExecutionEngine.Assert(milestoneIndex >= 1 && milestoneIndex <= (BigInteger)escrow[6], "invalid milestone index");
    }
}
