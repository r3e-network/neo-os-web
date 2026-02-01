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
    // Event delegates for contract lifecycle
    
    /// <summary>
    /// Event emitted when a new relationship contract is created.
    /// </summary>
    /// <param name="contractId">Unique contract identifier</param>
    /// <param name="party1">First party's address</param>
    /// <param name="party2">Second party's address</param>
    /// <param name="stake">GAS amount staked by each party</param>
    public delegate void ContractCreatedHandler(BigInteger contractId, UInt160 party1, UInt160 party2, BigInteger stake);
    
    /// <summary>
    /// Event emitted when a party signs the contract.
    /// </summary>
    /// <param name="contractId">The contract identifier</param>
    /// <param name="signer">Address of the signing party</param>
    public delegate void ContractSignedHandler(BigInteger contractId, UInt160 signer);
    
    /// <summary>
    /// Event emitted when a contract is renewed with extended duration.
    /// </summary>
    /// <param name="contractId">The contract identifier</param>
    /// <param name="newDuration">New duration in days</param>
    /// <param name="additionalStake">Additional GAS staked</param>
    public delegate void ContractRenewedHandler(BigInteger contractId, BigInteger newDuration, BigInteger additionalStake);
    
    /// <summary>
    /// Event emitted when contract terms are amended.
    /// </summary>
    /// <param name="contractId">The contract identifier</param>
    /// <param name="amendmentType">Type of amendment made</param>
    public delegate void ContractAmendedHandler(BigInteger contractId, string amendmentType);
    
    /// <summary>
    /// Event emitted when a mutual breakup is requested.
    /// </summary>
    /// <param name="contractId">The contract identifier</param>
    /// <param name="requester">Address of the requesting party</param>
    public delegate void MutualBreakupRequestedHandler(BigInteger contractId, UInt160 requester);
    
    /// <summary>
    /// Event emitted when a mutual breakup is confirmed by both parties.
    /// </summary>
    /// <param name="contractId">The contract identifier</param>
    public delegate void MutualBreakupConfirmedHandler(BigInteger contractId);
    
    /// <summary>
    /// Event emitted when a unilateral breakup is triggered.
    /// </summary>
    /// <param name="contractId">The contract identifier</param>
    /// <param name="initiator">Address of the party triggering breakup</param>
    /// <param name="penalty">Penalty amount in GAS paid to loyal party</param>
    public delegate void BreakupTriggeredHandler(BigInteger contractId, UInt160 initiator, BigInteger penalty);
    
    /// <summary>
    /// Event emitted when a contract is completed (duration expired or mutual breakup).
    /// </summary>
    /// <param name="contractId">The contract identifier</param>
    /// <param name="mutual">True if completed via mutual agreement</param>
    public delegate void ContractCompletedHandler(BigInteger contractId, bool mutual);
    
    /// <summary>
    /// Event emitted when funds are distributed to a party.
    /// </summary>
    /// <param name="contractId">The contract identifier</param>
    /// <param name="recipient">Address receiving funds</param>
    /// <param name="amount">Amount distributed in GAS</param>
    public delegate void FundsDistributedHandler(BigInteger contractId, UInt160 recipient, BigInteger amount);
    
    /// <summary>
    /// Event emitted when a contract is cancelled before activation.
    /// </summary>
    /// <param name="contractId">The contract identifier</param>
    /// <param name="canceller">Address of the cancelling party</param>
    public delegate void ContractCancelledHandler(BigInteger contractId, UInt160 canceller);
    
    /// <summary>
    /// Event emitted when a commitment milestone is reached.
    /// </summary>
    /// <param name="contractId">The contract identifier</param>
    /// <param name="milestoneIndex">Milestone index (1-4 for 25%, 50%, 75%, 100%)</param>
    /// <param name="reward">Reward amount in GAS</param>
    public delegate void MilestoneReachedHandler(BigInteger contractId, BigInteger milestoneIndex, BigInteger reward);

    /// <summary>
    /// BreakupContract MiniApp - Complete relationship commitment protocol.
    ///
    /// FEATURES:
    /// - Create binding commitment contracts with GAS stakes
    /// - Mutual consent breakup with full refund
    /// - Unilateral breakup with penalty distribution
    /// - Contract renewal and amendment support
    /// - Milestone rewards for commitment duration
    /// - Comprehensive statistics and history tracking
    /// - Automated expiry processing
    ///
    /// MECHANICS:
    /// - Both parties stake equal GAS amounts
    /// - Early unilateral exit: penalty to loyal party
    /// - Mutual exit: full refund to both parties
    /// - Successful completion: bonus rewards from platform pool
    /// - Milestones: 25%, 50%, 75% duration rewards
    /// </summary>
    [DisplayName("MiniAppBreakupContract")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. BreakupContract is a complete commitment protocol for relationship agreements. Use it to create binding contracts with your partner, featuring mutual consent exits, penalty enforcement, milestone rewards, and comprehensive tracking.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]
    public partial class MiniAppBreakupContract : MiniAppBase
    {
        #region App Constants
        /// <summary>Unique application identifier for the BreakupContract miniapp.</summary>
        private const string APP_ID = "miniapp-breakupcontract";
        
        /// <summary>Minimum stake per party in GAS (1 GAS = 100,000,000). Ensures meaningful commitment.</summary>
        private const long MIN_STAKE = 100000000;
        
        /// <summary>Maximum stake per party in GAS (1000 GAS = 100,000,000,000). Limits risk exposure.</summary>
        private const long MAX_STAKE = 100000000000;
        
        /// <summary>Minimum contract duration in days (30 days). Prevents trivial short-term contracts.</summary>
        private const int MIN_DURATION_DAYS = 30;
        
        /// <summary>Maximum contract duration in days (10 years = 3650 days). Prevents indefinite locks.</summary>
        private const int MAX_DURATION_DAYS = 3650;
        
        /// <summary>Platform fee in basis points (1% = 100 bps). Taken from completion rewards.</summary>
        private const int PLATFORM_FEE_BPS = 100;
        
        /// <summary>Completion bonus in basis points (5% = 500 bps). Reward for successful completion.</summary>
        private const int COMPLETION_BONUS_BPS = 500;
        
        /// <summary>Time limit in seconds for second party to sign (7 days = 604800 seconds).</summary>
        private const int SIGN_DEADLINE_SECONDS = 604800;
        
        /// <summary>Cooldown period in seconds for mutual breakup confirmation (24 hours = 86400 seconds).</summary>
        private const int MUTUAL_BREAKUP_COOLDOWN_SECONDS = 86400;
        #endregion

        #region App Prefixes (0x20+ to avoid collision with MiniAppBase)
        private static readonly byte[] PREFIX_CONTRACT_ID = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_CONTRACTS = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_USER_CONTRACTS = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_USER_CONTRACT_COUNT = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_MUTUAL_BREAKUP = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_MILESTONES = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_AMENDMENTS = new byte[] { 0x26 };
        private static readonly byte[] PREFIX_TOTAL_STAKED = new byte[] { 0x27 };
        private static readonly byte[] PREFIX_TOTAL_COMPLETED = new byte[] { 0x28 };
        private static readonly byte[] PREFIX_TOTAL_BROKEN = new byte[] { 0x29 };
        private static readonly byte[] PREFIX_REWARD_POOL = new byte[] { 0x2A };
        #endregion

        #region Data Structures
        /// <summary>
        /// Represents a relationship commitment contract between two parties.
        /// 
        /// Storage: Serialized and stored with PREFIX_CONTRACTS + contractId
        /// Lifecycle: Created → Signed (both parties) → Active → Completed/Broken
        /// </summary>
        public struct RelationshipContract
        {
            /// <summary>First party's address (creator).</summary>
            public UInt160 Party1;
            /// <summary>Second party's address (must sign to activate).</summary>
            public UInt160 Party2;
            /// <summary>GAS amount staked by each party (total locked = 2 * stake).</summary>
            public BigInteger Stake;
            /// <summary>Whether party1 has signed the contract.</summary>
            public bool Party1Signed;
            /// <summary>Whether party2 has signed the contract.</summary>
            public bool Party2Signed;
            /// <summary>Unix timestamp when contract was created.</summary>
            public BigInteger CreatedTime;
            /// <summary>Unix timestamp when contract became active (both parties signed).</summary>
            public BigInteger StartTime;
            /// <summary>Contract duration in seconds.</summary>
            public BigInteger Duration;
            /// <summary>Deadline for party2 to sign (Unix timestamp).</summary>
            public BigInteger SignDeadline;
            /// <summary>Whether contract is currently active (both signed, not expired).</summary>
            public bool Active;
            /// <summary>Whether contract has been completed successfully.</summary>
            public bool Completed;
            /// <summary>Whether contract was cancelled before activation.</summary>
            public bool Cancelled;
            /// <summary>Contract title/description.</summary>
            public string Title;
            /// <summary>Detailed terms of the agreement.</summary>
            public string Terms;
            /// <summary>Number of milestones reached (0-4).</summary>
            public BigInteger MilestonesReached;
            /// <summary>Total penalties paid due to breakups in GAS.</summary>
            public BigInteger TotalPenaltyPaid;
            /// <summary>Address of party who triggered breakup (zero if no breakup).</summary>
            public UInt160 BreakupInitiator;
        }

        /// <summary>
        /// Represents a mutual breakup request.
        /// Requires confirmation from both parties after cooldown period.
        /// 
        /// Storage: Serialized and stored with PREFIX_MUTUAL_BREAKUP + contractId
        /// </summary>
        public struct MutualBreakupRequest
        {
            /// <summary>Address of party who requested mutual breakup.</summary>
            public UInt160 Requester;
            /// <summary>Unix timestamp when request was made.</summary>
            public BigInteger RequestTime;
            /// <summary>Whether the other party has confirmed the request.</summary>
            public bool Confirmed;
        }
        #endregion

        #region App Events
        [DisplayName("ContractCreated")]
        public static event ContractCreatedHandler OnContractCreated;

        [DisplayName("ContractSigned")]
        public static event ContractSignedHandler OnContractSigned;

        [DisplayName("ContractRenewed")]
        public static event ContractRenewedHandler OnContractRenewed;

        [DisplayName("ContractAmended")]
        public static event ContractAmendedHandler OnContractAmended;

        [DisplayName("MutualBreakupRequested")]
        public static event MutualBreakupRequestedHandler OnMutualBreakupRequested;

        [DisplayName("MutualBreakupConfirmed")]
        public static event MutualBreakupConfirmedHandler OnMutualBreakupConfirmed;

        [DisplayName("BreakupTriggered")]
        public static event BreakupTriggeredHandler OnBreakupTriggered;

        [DisplayName("ContractCompleted")]
        public static event ContractCompletedHandler OnContractCompleted;

        [DisplayName("FundsDistributed")]
        public static event FundsDistributedHandler OnFundsDistributed;

        [DisplayName("ContractCancelled")]
        public static event ContractCancelledHandler OnContractCancelled;

        [DisplayName("MilestoneReached")]
        public static event MilestoneReachedHandler OnMilestoneReached;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_CONTRACT_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_STAKED, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_COMPLETED, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BROKEN, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_REWARD_POOL, 0);
        }
        #endregion

        #region Read Methods
        [Safe]
        public static BigInteger TotalContracts() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_CONTRACT_ID);

        [Safe]
        public static BigInteger TotalStaked() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_STAKED);

        [Safe]
        public static BigInteger TotalCompleted() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_COMPLETED);

        [Safe]
        public static BigInteger TotalBroken() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_BROKEN);

        [Safe]
        public static BigInteger RewardPool() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_REWARD_POOL);

        [Safe]
        public static BigInteger GetUserContractCount(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_CONTRACT_COUNT, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static Map<string, object> GetContractDetails(BigInteger contractId)
        {
            RelationshipContract c = GetContract(contractId);
            Map<string, object> details = new Map<string, object>();
            if (c.Party1 == UInt160.Zero) return details;

            details["id"] = contractId;
            details["party1"] = c.Party1;
            details["party2"] = c.Party2;
            details["stake"] = c.Stake;
            details["party1Signed"] = c.Party1Signed;
            details["party2Signed"] = c.Party2Signed;
            details["createdTime"] = c.CreatedTime;
            details["startTime"] = c.StartTime;
            details["duration"] = c.Duration;
            details["signDeadline"] = c.SignDeadline;
            details["active"] = c.Active;
            details["completed"] = c.Completed;
            details["cancelled"] = c.Cancelled;
            details["title"] = c.Title;
            details["terms"] = c.Terms;
            details["milestonesReached"] = c.MilestonesReached;
            details["totalPenaltyPaid"] = c.TotalPenaltyPaid;
            details["breakupInitiator"] = c.BreakupInitiator;

            if (c.Active && c.StartTime > 0)
            {
                BigInteger elapsed = Runtime.Time - c.StartTime;
                BigInteger progress = elapsed * 100 / c.Duration;
                details["progressPercent"] = progress > 100 ? 100 : progress;
                details["remainingTime"] = c.Duration - elapsed > 0 ? c.Duration - elapsed : 0;
            }

            return details;
        }

        [Safe]
        public static RelationshipContract GetContract(BigInteger contractId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_CONTRACTS, (ByteString)contractId.ToByteArray()));
            if (data == null) return new RelationshipContract();
            return (RelationshipContract)StdLib.Deserialize(data);
        }

        [Safe]
        public static MutualBreakupRequest GetMutualBreakupRequest(BigInteger contractId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_MUTUAL_BREAKUP, (ByteString)contractId.ToByteArray()));
            if (data == null) return new MutualBreakupRequest();
            return (MutualBreakupRequest)StdLib.Deserialize(data);
        }
        #endregion

        // User-Facing Methods moved to MiniAppBreakupContract.Methods.cs
        // Query Methods moved to MiniAppBreakupContract.Query.cs
        // Internal Helpers moved to MiniAppBreakupContract.Internal.cs
    }
}
