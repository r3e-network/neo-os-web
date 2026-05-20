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
        /// Stage a pending agent account rotation. The change applies after
        /// AGENT_ROTATION_TIMELOCK_MS via <see cref="ExecuteAgentAccountChange"/>.
        /// Re-proposing on the same agentId overwrites the prior pending slot,
        /// resetting the timer — this is intentional so a legitimate operator can
        /// correct a typo without waiting out the original delay.
        /// </summary>
        public static void ProposeAgentAccountChange(
            string appId,
            BigInteger agentId,
            UInt160 agentAccount,
            ByteString verificationScriptHash)
        {
            ValidateAppAuthority(appId);
            ValidateAgent(appId, agentId);
            ValidateAddress(agentAccount);
            ExecutionEngine.Assert(verificationScriptHash != null && verificationScriptHash.Length == 20, "account id hash required");

            BigInteger executeAfter = Runtime.Time + AGENT_ROTATION_TIMELOCK_MS;
            PutAddress(AppKey(appId, PREFIX_PENDING_AGENT_ACCOUNT, agentId), agentAccount);
            Put(AppKey(appId, PREFIX_PENDING_AGENT_SCRIPT, agentId), verificationScriptHash);
            Put(AppKey(appId, PREFIX_PENDING_AGENT_TIME, agentId), executeAfter);

            OnAnchorAgentAccountChangeProposed(appId, agentId, agentAccount, executeAfter);
        }

        /// <summary>
        /// Apply a previously proposed agent rotation. Callable by anyone once the
        /// timelock elapses — this matches the platform-admin change pattern and
        /// stops a griefing app admin from proposing-then-disappearing.
        /// </summary>
        public static void ExecuteAgentAccountChange(string appId, BigInteger agentId)
        {
            ValidateAgent(appId, agentId);

            ByteString pendingAccount = GetRaw(AppKey(appId, PREFIX_PENDING_AGENT_ACCOUNT, agentId));
            ExecutionEngine.Assert(pendingAccount != null, "no pending change");

            BigInteger executeAfter = GetBigInteger(AppKey(appId, PREFIX_PENDING_AGENT_TIME, agentId));
            ExecutionEngine.Assert((BigInteger)Runtime.Time >= executeAfter, "timelock active");

            ByteString pendingScript = GetRaw(AppKey(appId, PREFIX_PENDING_AGENT_SCRIPT, agentId));
            ExecutionEngine.Assert(pendingScript != null, "pending script missing");

            UInt160 newAccount = (UInt160)pendingAccount;
            SetAgentAccountCore(appId, agentId, newAccount, pendingScript);

            Delete(AppKey(appId, PREFIX_PENDING_AGENT_ACCOUNT, agentId));
            Delete(AppKey(appId, PREFIX_PENDING_AGENT_SCRIPT, agentId));
            Delete(AppKey(appId, PREFIX_PENDING_AGENT_TIME, agentId));
        }

        /// <summary>
        /// Abort a pending agent rotation. Same gate as ProposeAgentAccountChange:
        /// platform admin or app admin. The legitimate operator should call this
        /// the moment AgentAccountChangeProposed signals an unexpected change.
        /// </summary>
        public static void CancelAgentAccountChange(string appId, BigInteger agentId)
        {
            ValidateAppAuthority(appId);
            ExecutionEngine.Assert(
                GetRaw(AppKey(appId, PREFIX_PENDING_AGENT_ACCOUNT, agentId)) != null,
                "no pending change");

            Delete(AppKey(appId, PREFIX_PENDING_AGENT_ACCOUNT, agentId));
            Delete(AppKey(appId, PREFIX_PENDING_AGENT_SCRIPT, agentId));
            Delete(AppKey(appId, PREFIX_PENDING_AGENT_TIME, agentId));

            OnAnchorAgentAccountChangeCancelled(appId, agentId);
        }

        /// <summary>
        /// Read the pending rotation for an agent. Returns zero-valued fields when
        /// no proposal is staged.
        /// </summary>
        [Safe]
        public static object[] GetPendingAgentAccountChange(string appId, BigInteger agentId)
        {
            ByteString pendingAccount = GetRaw(AppKey(appId, PREFIX_PENDING_AGENT_ACCOUNT, agentId));
            ByteString pendingScript = GetRaw(AppKey(appId, PREFIX_PENDING_AGENT_SCRIPT, agentId));
            BigInteger executeAfter = GetBigInteger(AppKey(appId, PREFIX_PENDING_AGENT_TIME, agentId));
            return new object[]
            {
                pendingAccount == null ? UInt160.Zero : (UInt160)pendingAccount,
                pendingScript ?? (ByteString)new byte[0],
                executeAfter,
            };
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
