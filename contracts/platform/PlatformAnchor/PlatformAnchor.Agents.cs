using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

#pragma warning disable CS8600, CS8601, CS8602, CS8603, CS8604, CS8618

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public partial class PlatformAnchorContract
    {
        public static BigInteger RegisterAgent(
            string appId,
            UInt160 agentAccount,
            ECPoint candidate,
            ByteString verificationScriptHash)
        {
            ValidateAppAuthority(appId);
            ValidateAddress(agentAccount);
            ExecutionEngine.Assert(candidate != null && candidate.IsValid, "invalid candidate");
            ExecutionEngine.Assert(verificationScriptHash != null && verificationScriptHash.Length > 0, "script hash required");

            BigInteger agentId = GetBigInteger(AppKey(appId, PREFIX_AGENT_COUNT)) + 1;
            Put(AppKey(appId, PREFIX_AGENT_COUNT), agentId);
            PutAddress(AppKey(appId, PREFIX_AGENT_ACCOUNT, agentId), agentAccount);
            Put(AppKey(appId, PREFIX_AGENT_CANDIDATE, agentId), CandidateBytes(candidate));
            Put(AppKey(appId, PREFIX_AGENT_SCRIPT_HASH, agentId), verificationScriptHash);
            Put(AppKey(appId, PREFIX_AGENT_ACTIVE, agentId), 1);

            OnAnchorAgentRegistered(appId, agentId, agentAccount, candidate);
            return agentId;
        }

        public static BigInteger RegisterAgents(
            string appId,
            UInt160[] agentAccounts,
            ECPoint[] candidates,
            ByteString[] verificationScriptHashes)
        {
            ValidateAppAuthority(appId);
            ExecutionEngine.Assert(agentAccounts != null && candidates != null && verificationScriptHashes != null, "agent arrays required");
            ExecutionEngine.Assert(agentAccounts.Length > 0 && agentAccounts.Length <= 21, "invalid agent batch");
            ExecutionEngine.Assert(agentAccounts.Length == candidates.Length, "candidate length mismatch");
            ExecutionEngine.Assert(agentAccounts.Length == verificationScriptHashes.Length, "script length mismatch");

            BigInteger lastAgentId = 0;
            for (int i = 0; i < agentAccounts.Length; i++)
            {
                lastAgentId = RegisterAgent(appId, agentAccounts[i], candidates[i], verificationScriptHashes[i]);
            }
            return lastAgentId;
        }

        public static void SetAgentCandidate(string appId, BigInteger agentId, ECPoint candidate)
        {
            ValidateAppAuthority(appId);
            ValidateAgent(appId, agentId);
            ExecutionEngine.Assert(candidate != null && candidate.IsValid, "invalid candidate");
            Put(AppKey(appId, PREFIX_AGENT_CANDIDATE, agentId), CandidateBytes(candidate));
        }

        /// <summary>
        /// Rotate a single agent's account. App admin only. The batch form
        /// (SetAgentAccounts) was intentionally removed so a compromised
        /// admin cannot redirect all 21 votes in one transaction — they must
        /// call this 21 separate times, each emitting AnchorAgentAccountUpdated,
        /// which off-chain monitors will catch on the first abnormal rotation.
        /// </summary>
        public static void SetAgentAccount(
            string appId,
            BigInteger agentId,
            UInt160 agentAccount,
            ByteString verificationScriptHash)
        {
            ValidateAppAuthority(appId);
            SetAgentAccountCore(appId, agentId, agentAccount, verificationScriptHash);
        }

        public static void TransferAgentNeo(
            string appId,
            BigInteger fromAgentId,
            BigInteger toAgentId,
            BigInteger amount)
        {
            TransferNeoBetweenSameAppAgents(appId, fromAgentId, toAgentId, amount);
            OnAnchorAgentTransfer(appId, fromAgentId, toAgentId, amount);
        }

        public static void VoteAgent(string appId, BigInteger agentId)
        {
            ValidateRegistered(appId);
            ValidateAgent(appId, agentId);
            UInt160 agentAccount = GetAgentAccount(appId, agentId);
            ExecutionEngine.Assert(HasAgentExecutionWitness(agentAccount), "agent AA witness required");
            ECPoint candidate = GetAgentCandidateAsPoint(appId, agentId);
            ExecutionEngine.Assert(NEO.Vote(agentAccount, candidate), "agent vote failed");
            Put(AppKey(appId, PREFIX_SELECTED_AGENT), agentId);
            OnAnchorVoteChanged(appId, agentId, agentAccount, candidate);
        }
    }
}
