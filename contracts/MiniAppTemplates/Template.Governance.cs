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
    /// <summary>
    /// Highly abstract and customizable Governance/Voting Contract Template.
    /// Supports candidate-based, binary, or weighted voting driven by parameters.
    /// </summary>
    [DisplayName("MiniAppTemplate.Governance")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Parameter-driven governance and voting template")]
    [ContractPermission("*", "*")]
    public class TemplateGovernance : MiniAppTemplate
    {
        private static readonly byte[] PREFIX_GOV_STATE = new byte[] { 0x40 };
        private static readonly byte[] PREFIX_PROPOSALS = new byte[] { 0x41 };
        private static readonly byte[] PREFIX_VOTES = new byte[] { 0x42 };

        public struct GovParams
        {
            public UInt160 VotingToken;      // Token used for voting power
            public ulong ProposalDuration;   // Duration proposals last
            public BigInteger QuorumAmount;  // Minimum total votes required
            public bool AllowDelegation;
            public bool AllowMultipleVotes;
        }

        public struct Proposal
        {
            public BigInteger Id;
            public string Title;
            public string Description;
            public UInt160 Creator;
            public ulong StartTime;
            public ulong EndTime;
            public bool Executed;
            public Map<string, BigInteger> Options; // e.g. "Yes" -> 1000, "No" -> 500
        }

#pragma warning disable CS8618
        [DisplayName("ProposalCreated")]
        public static event Action<BigInteger, string, UInt160> OnProposalCreated;

        [DisplayName("Voted")]
        public static event Action<BigInteger, UInt160, string, BigInteger> OnVoted;

        [DisplayName("ProposalExecuted")]
        public static event Action<BigInteger, string> OnProposalExecuted;
#pragma warning restore CS8618

        public static void _deploy(object data, bool update)
        {
            if (update) return;

            InitializeTemplate(data);

            if (data == null) return;

            object[] initArgs = (object[])data;
            if (initArgs.Length > 1 && initArgs[1] != null)
            {
                ByteString paramsRaw = (ByteString)initArgs[1];
                if (paramsRaw != null && paramsRaw.Length > 0)
                {
                    GovParams config = (GovParams)StdLib.Deserialize(paramsRaw);
                    SetMetadata("govParams", paramsRaw);
                }
            }
        }

        [Safe]
        public static GovParams GetGovParams()
        {
            ByteString raw = GetMetadata("govParams");
            if (raw == null || raw.Length == 0) return new GovParams();
            return (GovParams)StdLib.Deserialize(raw);
        }

        [Safe]
        public static Proposal GetProposal(BigInteger id)
        {
            StorageMap map = new StorageMap(Storage.CurrentContext, PREFIX_PROPOSALS);
            ByteString raw = map.Get((ByteString)id) ?? (ByteString)"";
            if (raw.Length == 0) return new Proposal();
            return (Proposal)StdLib.Deserialize(raw);
        }

        public static BigInteger CreateProposal(string title, string description, string[] options)
        {
            UInt160 caller = Runtime.Transaction.Sender;
            ExecutionEngine.Assert(Runtime.CheckWitness(caller), "Unauthorized");

            GovParams config = GetGovParams();
            BigInteger nextId = GetNextId(PREFIX_PROPOSALS);

            Proposal prop = new Proposal
            {
                Id = nextId,
                Title = title,
                Description = description,
                Creator = caller,
                StartTime = Runtime.Time,
                EndTime = Runtime.Time + config.ProposalDuration,
                Executed = false,
                Options = new Map<string, BigInteger>()
            };

            for (int i = 0; i < options.Length; i++)
            {
                prop.Options[options[i]] = 0;
            }

            StorageMap map = new StorageMap(Storage.CurrentContext, PREFIX_PROPOSALS);
            map.Put((ByteString)nextId, StdLib.Serialize(prop));

            OnProposalCreated(nextId, title, caller);
            return nextId;
        }

        public static void Vote(BigInteger proposalId, string option, BigInteger amount)
        {
            UInt160 caller = Runtime.Transaction.Sender;
            ExecutionEngine.Assert(Runtime.CheckWitness(caller), "Unauthorized");
            ExecutionEngine.Assert(amount > 0, "Vote amount must be positive");

            Proposal prop = GetProposal(proposalId);
            ExecutionEngine.Assert(prop.Id > 0, "Proposal not found");
            ExecutionEngine.Assert(Runtime.Time <= prop.EndTime, "Voting ended");
            ExecutionEngine.Assert(prop.Options.HasKey(option), "Invalid option");

            GovParams config = GetGovParams();

            // Check if already voted
            byte[] voteKey = Helper.Concat((byte[])(ByteString)proposalId, (byte[])caller);
            StorageMap voteMap = new StorageMap(Storage.CurrentContext, PREFIX_VOTES);
            ByteString existingVote = voteMap.Get(voteKey) ?? (ByteString)"";
            
            if (!config.AllowMultipleVotes)
            {
                ExecutionEngine.Assert(existingVote == null || existingVote.Length == 0, "Already voted");
            }

            // Simple integration: we assume user has tokens in their wallet and we just verify balance.
            // A more robust implementation might transfer tokens to escrow or take a snapshot.
            if (config.VotingToken != UInt160.Zero)
            {
                BigInteger balance = (BigInteger)Contract.Call(config.VotingToken, "balanceOf", CallFlags.ReadOnly, new object[] { caller });
                ExecutionEngine.Assert(balance >= amount, "Insufficient voting power");
                // Transfer tokens to lock them (simplified)
                bool success = (bool)Contract.Call(config.VotingToken, "transfer", CallFlags.All, new object[] { caller, Runtime.ExecutingScriptHash, amount, null! });
                ExecutionEngine.Assert(success, "Token transfer failed");
            }

            // Record vote
            prop.Options[option] += amount;
            StorageMap propMap = new StorageMap(Storage.CurrentContext, PREFIX_PROPOSALS);
            propMap.Put((ByteString)proposalId, StdLib.Serialize(prop));

            voteMap.Put(voteKey, (ByteString)(existingVote != null && existingVote.Length > 0 ? (BigInteger)existingVote + amount : amount));

            OnVoted(proposalId, caller, option, amount);
        }

        public static void ExecuteProposal(BigInteger proposalId)
        {
            Proposal prop = GetProposal(proposalId);
            ExecutionEngine.Assert(prop.Id > 0, "Proposal not found");
            ExecutionEngine.Assert(Runtime.Time > prop.EndTime, "Voting not ended yet");
            ExecutionEngine.Assert(!prop.Executed, "Already executed");

            GovParams config = GetGovParams();

            // Find winning option and total votes
            BigInteger totalVotes = 0;
            BigInteger maxVotes = 0;
            string winningOption = "";

            var optionsKeys = prop.Options.Keys;
            foreach (var key in optionsKeys)
            {
                BigInteger votes = prop.Options[key];
                totalVotes += votes;
                if (votes > maxVotes)
                {
                    maxVotes = votes;
                    winningOption = key;
                }
            }

            ExecutionEngine.Assert(totalVotes >= config.QuorumAmount, "Quorum not reached");

            prop.Executed = true;
            StorageMap propMap = new StorageMap(Storage.CurrentContext, PREFIX_PROPOSALS);
            propMap.Put((ByteString)proposalId, StdLib.Serialize(prop));

            OnProposalExecuted(proposalId, winningOption);
        }
    }
}