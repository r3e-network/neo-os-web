using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppMilestoneEscrow
    {
        #region User Methods

        /// <summary>
        /// Create a new milestone escrow vault.
        /// </summary>
        public static BigInteger CreateEscrow(
            UInt160 creator,
            UInt160 beneficiary,
            UInt160 asset,
            BigInteger totalAmount,
            BigInteger[] milestoneAmounts,
            string title,
            string notes)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(creator);
            ValidateAddress(beneficiary);
            ValidateAsset(asset);
            ValidateTextLimits(title, notes);

            ExecutionEngine.Assert(totalAmount > 0, "invalid total amount");
            ExecutionEngine.Assert(milestoneAmounts != null, "milestones required");
            ExecutionEngine.Assert(milestoneAmounts.Length >= MIN_MILESTONES && milestoneAmounts.Length <= MAX_MILESTONES, "invalid milestone count");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            if (IsNeo(asset))
            {
                ExecutionEngine.Assert(totalAmount >= MIN_NEO, "min 1 NEO");
            }
            else
            {
                ExecutionEngine.Assert(totalAmount >= MIN_GAS, "min 0.1 GAS");
            }

            BigInteger sum = 0;
            for (int i = 0; i < milestoneAmounts.Length; i++)
            {
                BigInteger amount = milestoneAmounts[i];
                ExecutionEngine.Assert(amount > 0, "invalid milestone amount");
                sum += amount;
            }
            ExecutionEngine.Assert(sum == totalAmount, "milestone sum mismatch");

            bool transferred = IsNeo(asset)
                ? NEO.Transfer(creator, Runtime.ExecutingScriptHash, totalAmount)
                : GAS.Transfer(creator, Runtime.ExecutingScriptHash, totalAmount);
            ExecutionEngine.Assert(transferred, "transfer failed");

            BigInteger escrowId = TotalEscrows() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_ESCROW_ID, escrowId);

            EscrowData escrow = new EscrowData
            {
                Creator = creator,
                Beneficiary = beneficiary,
                Asset = asset,
                TotalAmount = totalAmount,
                ReleasedAmount = 0,
                MilestoneCount = milestoneAmounts.Length,
                CreatedTime = Runtime.Time,
                Active = true,
                Cancelled = false,
                Title = title,
                Notes = notes
            };

            StoreEscrow(escrowId, escrow);
            AddCreatorEscrow(creator, escrowId);
            AddBeneficiaryEscrow(beneficiary, escrowId);

            for (int i = 0; i < milestoneAmounts.Length; i++)
            {
                MilestoneData milestone = new MilestoneData
                {
                    Amount = milestoneAmounts[i],
                    Approved = false,
                    Claimed = false,
                    ApprovedTime = 0,
                    ClaimedTime = 0
                };
                StoreMilestone(escrowId, i + 1, milestone);
            }

            UpdateTotalLocked(totalAmount);
            OnEscrowCreated(escrowId, creator, beneficiary, asset, totalAmount, milestoneAmounts.Length);
            return escrowId;
        }

        /// <summary>
        /// Approve a milestone for release (creator only).
        /// </summary>
        public static void ApproveMilestone(UInt160 creator, BigInteger escrowId, BigInteger milestoneIndex)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(creator);

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            EscrowData escrow = GetEscrow(escrowId);
            ExecutionEngine.Assert(escrow.Creator != UInt160.Zero, "escrow not found");
            ExecutionEngine.Assert(escrow.Active, "escrow inactive");
            ExecutionEngine.Assert(escrow.Creator == creator, "not creator");

            ExecutionEngine.Assert(milestoneIndex >= 1 && milestoneIndex <= escrow.MilestoneCount, "invalid milestone index");

            MilestoneData milestone = GetMilestone(escrowId, milestoneIndex);
            ExecutionEngine.Assert(!milestone.Claimed, "already claimed");
            ExecutionEngine.Assert(!milestone.Approved, "already approved");

            milestone.Approved = true;
            milestone.ApprovedTime = Runtime.Time;
            StoreMilestone(escrowId, milestoneIndex, milestone);

            OnMilestoneApproved(escrowId, milestoneIndex, creator);
        }

        /// <summary>
        /// Claim a released milestone (beneficiary only).
        /// </summary>
        public static void ClaimMilestone(UInt160 beneficiary, BigInteger escrowId, BigInteger milestoneIndex)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(beneficiary);
            ExecutionEngine.Assert(Runtime.CheckWitness(beneficiary), "unauthorized");

            EscrowData escrow = GetEscrow(escrowId);
            ExecutionEngine.Assert(escrow.Creator != UInt160.Zero, "escrow not found");
            ExecutionEngine.Assert(escrow.Active, "escrow inactive");
            ExecutionEngine.Assert(escrow.Beneficiary == beneficiary, "not beneficiary");

            ExecutionEngine.Assert(milestoneIndex >= 1 && milestoneIndex <= escrow.MilestoneCount, "invalid milestone index");

            MilestoneData milestone = GetMilestone(escrowId, milestoneIndex);
            ExecutionEngine.Assert(milestone.Approved, "not approved");
            ExecutionEngine.Assert(!milestone.Claimed, "already claimed");

            BigInteger amount = milestone.Amount;
            ExecutionEngine.Assert(amount > 0, "invalid amount");

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
                ? NEO.Transfer(Runtime.ExecutingScriptHash, beneficiary, amount)
                : GAS.Transfer(Runtime.ExecutingScriptHash, beneficiary, amount);
            ExecutionEngine.Assert(transferred, "transfer failed");

            OnMilestoneClaimed(escrowId, milestoneIndex, beneficiary, amount);
            if (!escrow.Active)
            {
                OnEscrowCompleted(escrowId, beneficiary);
            }
        }

        /// <summary>
        /// Cancel an active escrow and refund remaining funds to creator.
        /// </summary>
        public static void CancelEscrow(UInt160 creator, BigInteger escrowId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(creator);
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "unauthorized");

            EscrowData escrow = GetEscrow(escrowId);
            ExecutionEngine.Assert(escrow.Creator != UInt160.Zero, "escrow not found");
            ExecutionEngine.Assert(escrow.Active, "escrow inactive");
            ExecutionEngine.Assert(escrow.Creator == creator, "not creator");

            BigInteger remaining = escrow.TotalAmount - escrow.ReleasedAmount;

            escrow.Active = false;
            escrow.Cancelled = true;
            StoreEscrow(escrowId, escrow);

            if (remaining > 0)
            {
                UpdateTotalLocked(0 - remaining);
                bool transferred = IsNeo(escrow.Asset)
                    ? NEO.Transfer(Runtime.ExecutingScriptHash, creator, remaining)
                    : GAS.Transfer(Runtime.ExecutingScriptHash, creator, remaining);
                ExecutionEngine.Assert(transferred, "transfer failed");
            }

            OnEscrowCancelled(escrowId, creator, remaining);
        }

        #endregion
    }
}
