using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class PlatformEscrowContract
    {
        public static void ReclaimApprovedMilestone(
            string appId,
            UInt160 creator,
            BigInteger escrowId,
            BigInteger milestoneIndex)
        {
            RequireRegistered(appId);
            ValidateAddress(creator);
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "creator witness required");
            object[] escrow = ReadEscrow(appId, escrowId);
            ExecutionEngine.Assert((BigInteger)escrow[8] == 1, "escrow inactive");
            ExecutionEngine.Assert((UInt160)escrow[1] == creator, "creator mismatch");
            ValidateMilestoneIndex(escrow, milestoneIndex);
            object[] milestone = ReadMilestone(appId, escrowId, milestoneIndex);
            ExecutionEngine.Assert((bool)milestone[1], "milestone not approved");
            ExecutionEngine.Assert((bool)milestone[2] == false, "milestone claimed");
            ExecutionEngine.Assert(
                (BigInteger)Runtime.Time >= (BigInteger)milestone[3] + ApprovalGracePeriodOf(appId),
                "approval grace not elapsed");
            BigInteger amount = (BigInteger)milestone[0];

            AcquireTenantLock(appId);
            milestone[2] = true;
            milestone[4] = Runtime.Time;
            StoreMilestone(appId, escrowId, milestoneIndex, milestone);
            escrow[5] = (BigInteger)escrow[5] + amount;
            if ((BigInteger)escrow[5] >= (BigInteger)escrow[4]) escrow[8] = 2;
            StoreEscrow(appId, escrowId, escrow);
            AdjustEscrowLiability(appId, (UInt160)escrow[3], -amount);
            TransferAsset((UInt160)escrow[3], creator, amount);
            ReleaseTenantLock(appId);
            OnApprovedMilestoneReclaimed(appId, escrowId, milestoneIndex, creator, amount);
        }
    }
}
