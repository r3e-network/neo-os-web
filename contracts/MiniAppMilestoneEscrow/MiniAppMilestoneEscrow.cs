using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// MilestoneEscrow MiniApp - Staged payment releases with approval workflow.
    ///
    /// KEY FEATURES:
    /// - Create escrow with multiple milestones
    /// - NEO and GAS token support
    /// - Creator approval required for each milestone
    /// - Beneficiary claims after approval
    /// - Refund unclaimed amounts
    /// - Transparent milestone tracking
    ///
    /// SECURITY:
    /// - Minimum/maximum milestone limits
    /// - Creator-only approval
    /// - Beneficiary-only claims
    /// - Amount validation
    ///
    /// PERMISSIONS:
    /// - NEO token transfers
    /// - GAS token transfers
    /// </summary>
    [DisplayName("MiniAppMilestoneEscrow")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "MilestoneEscrow locks NEO or GAS and releases per approved milestones.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]  // GAS token
    [ContractPermission("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", "*")]  // NEO token
    public partial class MiniAppMilestoneEscrow : MiniAppBase
    {
        #region App Constants
        /// <summary>Unique application identifier for the MilestoneEscrow miniapp.</summary>
        /// <summary>Unique application identifier for the milestone-escrow miniapp.</summary>
        private const string APP_ID = "miniapp-milestone-escrow";
        
        /// <summary>Minimum NEO amount (1 NEO).</summary>
        /// <summary>Minimum value for operation.</summary>
        private const long MIN_NEO = 1;
        
        /// <summary>Minimum GAS amount (0.1 GAS).</summary>
        /// <summary>Minimum value for operation.</summary>
        private const long MIN_GAS = 10000000;
        
        /// <summary>Minimum milestones per escrow.</summary>
        private const int MIN_MILESTONES = 1;
        
        /// <summary>Maximum milestones per escrow.</summary>
        private const int MAX_MILESTONES = 12;
        
        /// <summary>Maximum title length.</summary>
        private const int MAX_TITLE_LENGTH = 60;
        
        /// <summary>Maximum notes length.</summary>
        private const int MAX_NOTES_LENGTH = 240;
        #endregion

        #region App Prefixes (0x20+)
        /// <summary>Prefix 0x20: Current escrow ID counter.</summary>
        /// <summary>Storage prefix for escrow id.</summary>
        private static readonly byte[] PREFIX_ESCROW_ID = new byte[] { 0x20 };
        
        /// <summary>Prefix 0x21: Escrow data storage.</summary>
        /// <summary>Storage prefix for escrows.</summary>
        private static readonly byte[] PREFIX_ESCROWS = new byte[] { 0x21 };
        
        /// <summary>Prefix 0x22: Creator escrow list.</summary>
        /// <summary>Storage prefix for creator escrows.</summary>
        private static readonly byte[] PREFIX_CREATOR_ESCROWS = new byte[] { 0x22 };
        
        /// <summary>Prefix 0x23: Creator escrow count.</summary>
        /// <summary>Storage prefix for creator escrow count.</summary>
        private static readonly byte[] PREFIX_CREATOR_ESCROW_COUNT = new byte[] { 0x23 };
        
        /// <summary>Prefix 0x24: Beneficiary escrow list.</summary>
        /// <summary>Storage prefix for beneficiary escrows.</summary>
        private static readonly byte[] PREFIX_BENEFICIARY_ESCROWS = new byte[] { 0x24 };
        
        /// <summary>Prefix 0x25: Beneficiary escrow count.</summary>
        /// <summary>Storage prefix for beneficiary escrow count.</summary>
        private static readonly byte[] PREFIX_BENEFICIARY_ESCROW_COUNT = new byte[] { 0x25 };
        
        /// <summary>Prefix 0x26: Milestone data storage.</summary>
        /// <summary>Storage prefix for milestones.</summary>
        private static readonly byte[] PREFIX_MILESTONES = new byte[] { 0x26 };
        
        /// <summary>Prefix 0x27: Total value locked.</summary>
        /// <summary>Storage prefix for total locked.</summary>
        private static readonly byte[] PREFIX_TOTAL_LOCKED = new byte[] { 0x27 };
        
        /// <summary>Prefix 0x28: Total value released.</summary>
        /// <summary>Storage prefix for total released.</summary>
        private static readonly byte[] PREFIX_TOTAL_RELEASED = new byte[] { 0x28 };
        #endregion

        #region Data Structures
        /// <summary>
        /// Escrow data structure.
        /// FIELDS:
        /// - Creator: Escrow creator address
        /// - Beneficiary: Payment recipient
        /// - Asset: Token contract hash (NEO or GAS)
        /// - TotalAmount: Total escrowed amount
        /// - ReleasedAmount: Amount already released
        /// - MilestoneCount: Number of milestones
        /// - CreatedTime: Creation timestamp
        /// - Active: Whether escrow is active
        /// - Cancelled: Whether cancelled by creator
        /// - Title: Escrow title
        /// - Notes: Additional notes
        /// </summary>
        public struct EscrowData
        {
            public UInt160 Creator;
            public UInt160 Beneficiary;
            public UInt160 Asset;
            public BigInteger TotalAmount;
            public BigInteger ReleasedAmount;
            public BigInteger MilestoneCount;
            public BigInteger CreatedTime;
            public bool Active;
            public bool Cancelled;
            public string Title;
            public string Notes;
        }

        /// <summary>
        /// Milestone data structure.
        /// FIELDS:
        /// - Amount: Payment amount for milestone
        /// - Approved: Whether approved by creator
        /// - Claimed: Whether claimed by beneficiary
        /// - ApprovedTime: Approval timestamp
        /// - ClaimedTime: Claim timestamp
        /// </summary>
        public struct MilestoneData
        {
            public BigInteger Amount;
            public bool Approved;
            public bool Claimed;
            public BigInteger ApprovedTime;
            public BigInteger ClaimedTime;
        }
        #endregion

        #region Event Delegates
        /// <summary>Event emitted when escrow is created.</summary>
        /// <param name="escrowId">New escrow identifier.</param>
        /// <param name="creator">Creator address.</param>
        /// <param name="beneficiary">Beneficiary address.</param>
        /// <param name="asset">Asset contract hash.</param>
        /// <param name="totalAmount">Total escrow amount.</param>
        /// <param name="milestoneCount">Number of milestones.</param>
        /// <summary>Event emitted when escrow created.</summary>
    public delegate void EscrowCreatedHandler(BigInteger escrowId, UInt160 creator, UInt160 beneficiary, UInt160 asset, BigInteger totalAmount, BigInteger milestoneCount);
        
        /// <summary>Event emitted when milestone is approved.</summary>
        /// <param name="escrowId">Escrow identifier.</param>
        /// <param name="milestoneIndex">Milestone index.</param>
        /// <param name="approver">Approving address.</param>
        /// <summary>Event emitted when milestone approved.</summary>
    public delegate void MilestoneApprovedHandler(BigInteger escrowId, BigInteger milestoneIndex, UInt160 approver);
        
        /// <summary>Event emitted when milestone is claimed.</summary>
        /// <param name="escrowId">Escrow identifier.</param>
        /// <param name="milestoneIndex">Milestone index.</param>
        /// <param name="beneficiary">Claimant address.</param>
        /// <param name="amount">Claimed amount.</param>
        /// <summary>Event emitted when milestone claimed.</summary>
    public delegate void MilestoneClaimedHandler(BigInteger escrowId, BigInteger milestoneIndex, UInt160 beneficiary, BigInteger amount);
        
        /// <summary>Event emitted when escrow is cancelled.</summary>
        /// <param name="escrowId">Escrow identifier.</param>
        /// <param name="creator">Creator address.</param>
        /// <param name="refundAmount">Refund amount.</param>
        /// <summary>Event emitted when escrow cancelled.</summary>
    public delegate void EscrowCancelledHandler(BigInteger escrowId, UInt160 creator, BigInteger refundAmount);
        
        /// <summary>Event emitted when escrow is completed.</summary>
        /// <param name="escrowId">Escrow identifier.</param>
        /// <param name="beneficiary">Beneficiary address.</param>
        /// <summary>Event emitted when escrow completed.</summary>
    public delegate void EscrowCompletedHandler(BigInteger escrowId, UInt160 beneficiary);
        #endregion

        #region Events
        [DisplayName("EscrowCreated")]
        public static event EscrowCreatedHandler OnEscrowCreated;

        [DisplayName("MilestoneApproved")]
        public static event MilestoneApprovedHandler OnMilestoneApproved;

        [DisplayName("MilestoneClaimed")]
        public static event MilestoneClaimedHandler OnMilestoneClaimed;

        [DisplayName("EscrowCancelled")]
        public static event EscrowCancelledHandler OnEscrowCancelled;

        [DisplayName("EscrowCompleted")]
        public static event EscrowCompletedHandler OnEscrowCompleted;
        #endregion

        #region Lifecycle
        /// <summary>
        /// Contract deployment initialization.
        /// </summary>
        /// <param name="data">Deployment data (unused).</param>
        /// <param name="update">True if this is a contract update.</param>
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_ESCROW_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_LOCKED, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_RELEASED, 0);
        }
        #endregion

        #region Read Methods
        /// <summary>
        /// Gets total escrows created.
        /// </summary>
        /// <returns>Total escrow count.</returns>
        [Safe]
        public static BigInteger TotalEscrows() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ESCROW_ID);

        /// <summary>
        /// Gets total value locked across all escrows.
        /// </summary>
        /// <returns>Total locked amount.</returns>
        [Safe]
        public static BigInteger TotalLocked() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_LOCKED);

        /// <summary>
        /// Gets total value released to beneficiaries.
        /// </summary>
        /// <returns>Total released amount.</returns>
        [Safe]
        public static BigInteger TotalReleased() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_RELEASED);

        /// <summary>
        /// Gets escrow data by ID.
        /// </summary>
        /// <param name="escrowId">Escrow identifier.</param>
        /// <returns>Escrow data struct.</returns>
        [Safe]
        public static EscrowData GetEscrow(BigInteger escrowId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_ESCROWS, (ByteString)escrowId.ToByteArray()));
            if (data == null) return new EscrowData();
            return (EscrowData)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Gets milestone data.
        /// </summary>
        /// <param name="escrowId">Escrow identifier.</param>
        /// <param name="milestoneIndex">Milestone index.</param>
        /// <returns>Milestone data struct.</returns>
        [Safe]
        public static MilestoneData GetMilestone(BigInteger escrowId, BigInteger milestoneIndex)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, BuildMilestoneKey(escrowId, milestoneIndex));
            if (data == null) return new MilestoneData();
            return (MilestoneData)StdLib.Deserialize(data);
        }
        #endregion
    }
}
