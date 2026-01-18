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
    public delegate void ContractCreatedHandler(BigInteger contractId, UInt160 party1, UInt160 party2, BigInteger stake);
    public delegate void ContractSignedHandler(BigInteger contractId, UInt160 signer);
    public delegate void ContractRenewedHandler(BigInteger contractId, BigInteger newDuration, BigInteger additionalStake);
    public delegate void ContractAmendedHandler(BigInteger contractId, string amendmentType);
    public delegate void MutualBreakupRequestedHandler(BigInteger contractId, UInt160 requester);
    public delegate void MutualBreakupConfirmedHandler(BigInteger contractId);
    public delegate void BreakupTriggeredHandler(BigInteger contractId, UInt160 initiator, BigInteger penalty);
    public delegate void ContractCompletedHandler(BigInteger contractId, bool mutual);
    public delegate void FundsDistributedHandler(BigInteger contractId, UInt160 recipient, BigInteger amount);
    public delegate void ContractCancelledHandler(BigInteger contractId, UInt160 canceller);
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
    [ContractPermission("*", "*")]
    public partial class MiniAppBreakupContract : MiniAppBase
    {
        #region App Constants
        private const string APP_ID = "miniapp-breakupcontract";
        private const long MIN_STAKE = 100000000;      // 1 GAS minimum
        private const long MAX_STAKE = 100000000000;   // 1000 GAS maximum
        private const int MIN_DURATION_DAYS = 30;      // 30 days minimum
        private const int MAX_DURATION_DAYS = 3650;    // 10 years maximum
        private const int PLATFORM_FEE_BPS = 100;      // 1% platform fee
        private const int COMPLETION_BONUS_BPS = 500;  // 5% completion bonus
        private const int SIGN_DEADLINE_SECONDS = 604800; // 7 days to sign
        private const int MUTUAL_BREAKUP_COOLDOWN_SECONDS = 86400; // 24h cooldown
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
        public struct RelationshipContract
        {
            public UInt160 Party1;
            public UInt160 Party2;
            public BigInteger Stake;
            public bool Party1Signed;
            public bool Party2Signed;
            public BigInteger CreatedTime;
            public BigInteger StartTime;
            public BigInteger Duration;
            public BigInteger SignDeadline;
            public bool Active;
            public bool Completed;
            public bool Cancelled;
            public string Title;
            public string Terms;
            public BigInteger MilestonesReached;
            public BigInteger TotalPenaltyPaid;
            public UInt160 BreakupInitiator;
        }

        public struct MutualBreakupRequest
        {
            public UInt160 Requester;
            public BigInteger RequestTime;
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
