using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // Custom delegates for events with named parameters
    public delegate void StakedHandler(UInt160 account, BigInteger amount, BigInteger newTotalStake);
    public delegate void UnstakedHandler(UInt160 account, BigInteger amount, BigInteger remainingStake);
    public delegate void VotedHandler(UInt160 voter, string proposalId, bool support, BigInteger weight);
    public delegate void ProposalCreatedHandler(string proposalId, string description, ulong startTime, ulong endTime);
    public delegate void ProposalFinalizedHandler(string proposalId, BigInteger yesVotes, BigInteger noVotes, bool passed);
    public delegate void AdminChangedHandler(UInt160 oldAdmin, UInt160 newAdmin);

    [DisplayName("Governance")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "NEO-only staking and voting for platform governance")]
    [ContractPermission("{0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5}", "onNEP17Payment")]
    public class Governance : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_STAKE = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_PROPOSAL = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_VOTE = new byte[] { 0x04 };
        // SECURITY FIX [M-08]: Track stake timestamps for time-weighted voting
        private static readonly byte[] PREFIX_STAKE_TIME = new byte[] { 0x05 };

        // Maximum votes per proposal (10 billion NEO - total supply cap)
        private static readonly BigInteger MAX_VOTES_PER_PROPOSAL = 10_000_000_000_00000000;
        
        // SECURITY FIX [M-08]: Time-weighted voting constants
        // Minimum stake duration for full voting weight (30 days in milliseconds)
        private static readonly ulong MIN_STAKE_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
        // Minimum voting weight multiplier (50% for new stakes)
        private static readonly BigInteger MIN_WEIGHT_PERCENT = 50;
        // Maximum voting weight multiplier (100% for mature stakes)
        private static readonly BigInteger MAX_WEIGHT_PERCENT = 100;

        public struct Proposal
        {
            public string ProposalId;
            public string Description;
            public ulong StartTime;
            public ulong EndTime;
            public BigInteger Yes;
            public BigInteger No;
            public bool Finalized;
        }

        [DisplayName("Staked")]
        public static event StakedHandler OnStaked;

        [DisplayName("Unstaked")]
        public static event UnstakedHandler OnUnstaked;

        [DisplayName("Voted")]
        public static event VotedHandler OnVoted;

        [DisplayName("ProposalCreated")]
        public static event ProposalCreatedHandler OnProposalCreated;

        [DisplayName("ProposalFinalized")]
        public static event ProposalFinalizedHandler OnProposalFinalized;

        [DisplayName("AdminChanged")]
        public static event AdminChangedHandler OnAdminChanged;

        public static void _deploy(object data, bool update)
        {
            if (update) return;

            Transaction tx = Runtime.Transaction;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, tx.Sender);
        }

        public static UInt160 Admin()
        {
            return (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
        }

        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != null, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        private static StorageMap StakeMap() => new StorageMap(Storage.CurrentContext, PREFIX_STAKE);
        private static StorageMap ProposalMap() => new StorageMap(Storage.CurrentContext, PREFIX_PROPOSAL);
        private static StorageMap VoteMap() => new StorageMap(Storage.CurrentContext, PREFIX_VOTE);
        // SECURITY FIX [M-08]: Storage map for stake timestamps
        private static StorageMap StakeTimeMap() => new StorageMap(Storage.CurrentContext, PREFIX_STAKE_TIME);

        private static ByteString ProposalKey(string proposalId)
        {
            ExecutionEngine.Assert(proposalId != null && proposalId.Length > 0, "proposal id required");
            return (ByteString)proposalId;
        }

        public static BigInteger GetStake(UInt160 account)
        {
            ByteString raw = StakeMap().Get(account);
            if (raw == null) return 0;
            return (BigInteger)raw;
        }

        // SECURITY FIX [M-08]: Get stake timestamp for time-weighted voting
        public static ulong GetStakeTime(UInt160 account)
        {
            ByteString raw = StakeTimeMap().Get(account);
            if (raw == null) return 0;
            return (ulong)(BigInteger)raw;
        }

        // SECURITY FIX [M-08]: Calculate time-weighted voting power
        // New stakes get 50% weight, increasing linearly to 100% over 30 days
        // This prevents flash-loan style voting manipulation
        private static BigInteger CalculateVotingWeight(UInt160 account, BigInteger amount)
        {
            ulong stakeTime = GetStakeTime(account);
            if (stakeTime == 0) return amount * MIN_WEIGHT_PERCENT / 100;
            
            ulong currentTime = Runtime.Time;
            if (currentTime <= stakeTime) return amount * MIN_WEIGHT_PERCENT / 100;
            
            ulong stakeDuration = currentTime - stakeTime;
            if (stakeDuration >= MIN_STAKE_DURATION_MS)
            {
                return amount; // Full weight for mature stakes
            }
            
            // Linear interpolation between MIN_WEIGHT_PERCENT and MAX_WEIGHT_PERCENT
            BigInteger weightPercent = MIN_WEIGHT_PERCENT + 
                (MAX_WEIGHT_PERCENT - MIN_WEIGHT_PERCENT) * (BigInteger)stakeDuration / (BigInteger)MIN_STAKE_DURATION_MS;
            return amount * weightPercent / 100;
        }

        public static void Stake(BigInteger amount)
        {
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            Transaction tx = Runtime.Transaction;
            UInt160 from = tx.Sender;

            // NEO-only: deposit into this contract.
            bool ok = NEO.Transfer(from, Runtime.ExecutingScriptHash, amount, (ByteString)"stake");
            ExecutionEngine.Assert(ok, "NEO transfer failed");
        }

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            // Enforce governance staking in NEO only.
            // NOTE: NEO transfers may trigger internal GAS bonus distribution. Some
            // GAS transfers can therefore touch this contract even though governance
            // stake accounting must remain NEO-only. We ignore non-NEO callbacks and
            // only process explicit NEO stake deposits.
            if (Runtime.CallingScriptHash != NEO.Hash) return;
            if (amount <= 0) throw new Exception("Invalid amount");

            // Ignore sender-side hooks during outbound transfers.
            if (from == Runtime.ExecutingScriptHash) return;

            // Only accept deposits coming from the explicit `Stake()` flow.
            if (data == null) throw new Exception("Stake data required");
            if ((ByteString)data != (ByteString)"stake") throw new Exception("Invalid stake data");

            BigInteger current = GetStake(from);
            BigInteger newTotal = current + amount;
            StakeMap().Put(from, newTotal);
            // SECURITY FIX [M-08]: Record stake timestamp for time-weighted voting
            // Only set timestamp for new stakes, don't reset for additional stakes
            if (current == 0)
            {
                StakeTimeMap().Put(from, Runtime.Time);
            }
            OnStaked(from, amount, newTotal);
        }

        public static void Unstake(BigInteger amount)
        {
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            Transaction tx = Runtime.Transaction;
            UInt160 from = tx.Sender;
            ExecutionEngine.Assert(Runtime.CheckWitness(from), "unauthorized");

            BigInteger current = GetStake(from);
            ExecutionEngine.Assert(current >= amount, "insufficient stake");

            BigInteger remaining = current - amount;
            StakeMap().Put(from, remaining);

            bool ok = NEO.Transfer(Runtime.ExecutingScriptHash, from, amount, null);
            ExecutionEngine.Assert(ok, "NEO transfer failed");

            OnUnstaked(from, amount, remaining);
        }

        // ============================================================================
        // Proposals (minimal skeleton)
        // ============================================================================

        [DisplayName("createProposal")]
        public static void CreateProposal(string proposalId, string description, ulong startTime, ulong endTime)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(proposalId != null && proposalId.Length > 0, "proposal id required");
            ExecutionEngine.Assert(endTime > startTime, "invalid window");

            Proposal p = new Proposal
            {
                ProposalId = proposalId,
                Description = description ?? "",
                StartTime = startTime,
                EndTime = endTime,
                Yes = 0,
                No = 0,
                Finalized = false
            };
            ProposalMap().Put(ProposalKey(proposalId), StdLib.Serialize(p));
            OnProposalCreated(proposalId, description ?? "", startTime, endTime);
        }

        public static Proposal GetProposal(string proposalId)
        {
            ByteString raw = ProposalMap().Get(ProposalKey(proposalId));
            if (raw == null)
            {
                // Avoid returning `default` struct which may be represented as an empty VMArray.
                return new Proposal
                {
                    ProposalId = "",
                    Description = "",
                    StartTime = 0,
                    EndTime = 0,
                    Yes = 0,
                    No = 0,
                    Finalized = false
                };
            }
            return (Proposal)StdLib.Deserialize(raw);
        }

        [DisplayName("vote")]
        public static void Vote(string proposalId, bool support, BigInteger amount)
        {
            ExecutionEngine.Assert(proposalId != null && proposalId.Length > 0, "proposal id required");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            Transaction tx = Runtime.Transaction;
            UInt160 voter = tx.Sender;
            ExecutionEngine.Assert(Runtime.CheckWitness(voter), "unauthorized");

            Proposal p = GetProposal(proposalId);
            ExecutionEngine.Assert(p.ProposalId != null && p.ProposalId.Length > 0, "proposal not found");
            ExecutionEngine.Assert(!p.Finalized, "finalized");
            ExecutionEngine.Assert(Runtime.Time >= p.StartTime && Runtime.Time <= p.EndTime, "voting closed");

            BigInteger stake = GetStake(voter);
            ExecutionEngine.Assert(stake >= amount, "insufficient stake");

            // One vote record per voter+proposal (simple model).
            byte[] voteKey = Helper.Concat((byte[])ProposalKey(proposalId), (byte[])voter);
            ByteString prev = VoteMap().Get(voteKey);
            ExecutionEngine.Assert(prev == null, "already voted");
            VoteMap().Put(voteKey, amount.ToByteArray());

            // SECURITY FIX [M-08]: Use time-weighted voting to prevent flash-loan attacks
            BigInteger votingWeight = CalculateVotingWeight(voter, amount);
            if (support) p.Yes += votingWeight;
            else p.No += votingWeight;

            // Overflow protection: ensure total votes don't exceed maximum
            ExecutionEngine.Assert(p.Yes <= MAX_VOTES_PER_PROPOSAL, "yes votes overflow");
            ExecutionEngine.Assert(p.No <= MAX_VOTES_PER_PROPOSAL, "no votes overflow");

            ProposalMap().Put(ProposalKey(proposalId), StdLib.Serialize(p));
            // SECURITY FIX [M-08]: Emit actual voting weight in event
            OnVoted(voter, proposalId, support, votingWeight);
        }

        public static void Finalize(string proposalId)
        {
            ValidateAdmin();
            Proposal p = GetProposal(proposalId);
            ExecutionEngine.Assert(p.ProposalId != null && p.ProposalId.Length > 0, "proposal not found");
            ExecutionEngine.Assert(!p.Finalized, "already finalized");
            ExecutionEngine.Assert(Runtime.Time > p.EndTime, "voting not ended");

            p.Finalized = true;
            ProposalMap().Put(ProposalKey(proposalId), StdLib.Serialize(p));
            OnProposalFinalized(proposalId, p.Yes, p.No, p.Yes > p.No);
        }

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != null && newAdmin.IsValid, "invalid admin");
            UInt160 oldAdmin = Admin();
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
            OnAdminChanged(oldAdmin, newAdmin);
        }

        public static void Update(ByteString nefFile, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nefFile, manifest, null);
        }
    }
}
