using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppMilestoneEscrow
    {
        // Audit fix C-3 makes CancelEscrow refuse while any approved-but-unclaimed milestone
        // exists. That correctly stops a creator from approving then cancelling to claw back
        // an accepted payment — but it also means a beneficiary who loses their key (or is
        // malicious) permanently freezes the ENTIRE escrow, including never-approved funds,
        // with no escape. This grace-period reclaim is that escape: after a long window past
        // approval with the milestone still unclaimed, the creator may reclaim that specific
        // milestone (marking it Claimed), which both returns those funds and unblocks
        // CancelEscrow for the remaining balance. The normal beneficiary claim path is
        // unaffected within the window.
        private const long APPROVAL_GRACE_PERIOD = 2592000000; // 30 days in ms (Runtime.Time is ms)

        public delegate void ApprovedMilestoneReclaimedHandler(BigInteger escrowId, BigInteger milestoneIndex, UInt160 creator, BigInteger amount);

        [DisplayName("ApprovedMilestoneReclaimed")]
        public static event ApprovedMilestoneReclaimedHandler OnApprovedMilestoneReclaimed;

        public static void ReclaimApprovedMilestone(UInt160 creator, BigInteger escrowId, BigInteger milestoneIndex)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(creator);
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "unauthorized");

            EscrowData escrow = GetEscrow(escrowId);
            ExecutionEngine.Assert(escrow.Creator != UInt160.Zero, "escrow not found");
            ExecutionEngine.Assert(escrow.Active, "escrow inactive");
            ExecutionEngine.Assert(escrow.Creator == creator, "not creator");
            ExecutionEngine.Assert(milestoneIndex >= 1 && milestoneIndex <= escrow.MilestoneCount, "invalid milestone index");

            MilestoneData milestone = GetMilestone(escrowId, milestoneIndex);
            ExecutionEngine.Assert(milestone.Approved, "not approved");
            ExecutionEngine.Assert(!milestone.Claimed, "already claimed");
            ExecutionEngine.Assert((BigInteger)Runtime.Time >= milestone.ApprovedTime + APPROVAL_GRACE_PERIOD, "grace period not elapsed");

            BigInteger amount = milestone.Amount;
            ExecutionEngine.Assert(amount > 0, "invalid amount");

            // Effects before interaction: mark Claimed so it can't be reclaimed/claimed twice
            // and no longer trips the C-3 cancel guard.
            milestone.Claimed = true;
            milestone.ClaimedTime = Runtime.Time;
            StoreMilestone(escrowId, milestoneIndex, milestone);

            escrow.ReleasedAmount += amount;
            if (escrow.ReleasedAmount >= escrow.TotalAmount)
            {
                escrow.Active = false;
            }
            StoreEscrow(escrowId, escrow);

            UpdateTotalLocked(0 - amount);
            UpdateTotalReleased(amount);

            bool transferred = IsNeo(escrow.Asset)
                ? NEO.Transfer(Runtime.ExecutingScriptHash, creator, amount)
                : GAS.Transfer(Runtime.ExecutingScriptHash, creator, amount);
            ExecutionEngine.Assert(transferred, "transfer failed");

            OnApprovedMilestoneReclaimed(escrowId, milestoneIndex, creator, amount);
        }
    }
}
