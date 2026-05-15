using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

#pragma warning disable CS8600, CS8601, CS8602, CS8603, CS8604, CS8618

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public delegate void AnchorAppRegisteredHandler(string appId, BigInteger mode, UInt160 appAdmin);
    public delegate void AnchorAgentRegisteredHandler(string appId, BigInteger agentId, UInt160 account, ECPoint candidate);
    public delegate void AnchorStakeChangedHandler(string appId, UInt160 user, BigInteger stake, BigInteger totalStaked);
    public delegate void AnchorRewardsHarvestedHandler(string appId, BigInteger amount, BigInteger rewardPerNeo);
    public delegate void AnchorRewardsClaimedHandler(string appId, UInt160 user, BigInteger amount);
    public delegate void AnchorVoteChangedHandler(string appId, BigInteger agentId, UInt160 votingAccount, ECPoint candidate);
    public delegate void AnchorAgentTransferHandler(string appId, BigInteger fromAgentId, BigInteger toAgentId, BigInteger amount);
    public delegate void AnchorAgentAccountUpdatedHandler(string appId, BigInteger agentId, UInt160 account, ByteString verificationScriptHash);

    /// <summary>
    /// Shared manual AA-agent routing anchor for TrustAnchor and ProfitAnchor.
    ///
    /// Each anchor registers AA agent accounts for council candidates. Candidate
    /// changes are app-admin controlled, while NEO movement and NEO.vote calls
    /// require the relevant AA agent witness.
    /// </summary>
    [DisplayName("PlatformAnchor")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.1")]
    [ManifestExtra("Description", "Shared TrustAnchor and ProfitAnchor manual AA-agent routing engine.")]
    [ContractPermission("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", "transfer", "vote")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "balanceOf", "transfer")]
    public partial class PlatformAnchorContract : SmartContract
    {
        private const int MODE_TRUST = 1;
        private const int MODE_PROFIT = 2;
        private const long REWARD_SCALE = 100_000_000;

        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_PAUSED = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_TOTAL_REWARD_RESERVE = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_ABSTRACT_ACCOUNT = new byte[] { 0x04 };

        private static readonly byte[] PREFIX_APP_MODE = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_APP_ADMIN = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_APP_PAUSED = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_TOTAL_STAKED = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_TOTAL_STAKERS = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_REWARD_PER_NEO = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_REWARD_RESERVE = new byte[] { 0x16 };
        private static readonly byte[] PREFIX_AGENT_COUNT = new byte[] { 0x17 };
        private static readonly byte[] PREFIX_SELECTED_AGENT = new byte[] { 0x18 };

        private static readonly byte[] PREFIX_USER_STAKE = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_USER_REWARD_DEBT = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_USER_PENDING_REWARD = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_NEO_CREDIT = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_GAS_CREDIT = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_TOTAL_GAS_CREDIT = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_REWARD_REMAINDER = new byte[] { 0x26 };

        private static readonly byte[] PREFIX_AGENT_ACCOUNT = new byte[] { 0x30 };
        private static readonly byte[] PREFIX_AGENT_CANDIDATE = new byte[] { 0x31 };
        private static readonly byte[] PREFIX_AGENT_SCRIPT_HASH = new byte[] { 0x32 };
        private static readonly byte[] PREFIX_AGENT_ACTIVE = new byte[] { 0x35 };

        [DisplayName("AnchorAppRegistered")]
        public static event AnchorAppRegisteredHandler OnAnchorAppRegistered;

        [DisplayName("AnchorAgentRegistered")]
        public static event AnchorAgentRegisteredHandler OnAnchorAgentRegistered;

        [DisplayName("AnchorStakeChanged")]
        public static event AnchorStakeChangedHandler OnAnchorStakeChanged;

        [DisplayName("AnchorRewardsHarvested")]
        public static event AnchorRewardsHarvestedHandler OnAnchorRewardsHarvested;

        [DisplayName("AnchorRewardsClaimed")]
        public static event AnchorRewardsClaimedHandler OnAnchorRewardsClaimed;

        [DisplayName("AnchorVoteChanged")]
        public static event AnchorVoteChangedHandler OnAnchorVoteChanged;

        [DisplayName("AnchorAgentTransfer")]
        public static event AnchorAgentTransferHandler OnAnchorAgentTransfer;

        [DisplayName("AnchorAgentAccountUpdated")]
        public static event AnchorAgentAccountUpdatedHandler OnAnchorAgentAccountUpdated;

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }

        [Safe]
        public static UInt160 Admin() => ReadAddress((ByteString)PREFIX_ADMIN);

        [Safe]
        public static bool IsPaused() => GetBigInteger((ByteString)PREFIX_PAUSED) == 1;

        [Safe]
        public static UInt160 AbstractAccount() => ReadAddress((ByteString)PREFIX_ABSTRACT_ACCOUNT);

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ValidateAddress(newAdmin);
            PutAddress((ByteString)PREFIX_ADMIN, newAdmin);
        }

        public static void SetPaused(bool paused)
        {
            ValidateAdmin();
            Put((ByteString)PREFIX_PAUSED, paused ? 1 : 0);
        }

        public static void SetAbstractAccount(UInt160 abstractAccount)
        {
            ValidateAdmin();
            ValidateAddress(abstractAccount);
            PutAddress((ByteString)PREFIX_ABSTRACT_ACCOUNT, abstractAccount);
        }

        public static void Update(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nef, manifest, new object[0]);
        }

        public static void RegisterAnchorApp(string appId, BigInteger mode, UInt160 appAdmin)
        {
            ValidateAdmin();
            RegisterAnchorAppCore(appId, mode, appAdmin);
        }

        public static void RegisterCustomAnchorApp(string appId, BigInteger mode, UInt160 appAdmin)
        {
            ValidateAddress(appAdmin);
            ExecutionEngine.Assert(Runtime.CheckWitness(appAdmin), "app admin witness required");
            RegisterAnchorAppCore(appId, mode, appAdmin);
        }

        public static void SetAppPaused(string appId, bool paused)
        {
            ValidateAppAuthority(appId);
            Put(AppKey(appId, PREFIX_APP_PAUSED), paused ? 1 : 0);
        }

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

        public static void SetAgentAccount(
            string appId,
            BigInteger agentId,
            UInt160 agentAccount,
            ByteString verificationScriptHash)
        {
            ValidateAppAuthority(appId);
            SetAgentAccountCore(appId, agentId, agentAccount, verificationScriptHash);
        }

        public static void SetAgentAccounts(
            string appId,
            BigInteger[] agentIds,
            UInt160[] agentAccounts,
            ByteString[] verificationScriptHashes)
        {
            ValidateAppAuthority(appId);
            ExecutionEngine.Assert(agentIds != null && agentAccounts != null && verificationScriptHashes != null, "agent arrays required");
            ExecutionEngine.Assert(agentIds.Length > 0 && agentIds.Length <= 21, "invalid agent batch");
            ExecutionEngine.Assert(agentIds.Length == agentAccounts.Length, "agent length mismatch");
            ExecutionEngine.Assert(agentIds.Length == verificationScriptHashes.Length, "script length mismatch");

            for (int i = 0; i < agentIds.Length; i++)
            {
                SetAgentAccountCore(appId, agentIds[i], agentAccounts[i], verificationScriptHashes[i]);
            }
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

        public static void Stake(string appId, UInt160 user, BigInteger amount)
        {
            StakeFromCredit(appId, user, amount);
        }

        public static void Withdraw(string appId, UInt160 user, BigInteger amount)
        {
            ValidateRegistered(appId);
            ExecutionEngine.Assert(Runtime.CheckWitness(user), "unauthorized");
            ValidateAddress(user);
            ExecutionEngine.Assert(amount > 0, "amount must be positive");

            AccrueUserRewards(appId, user);
            BigInteger previousStake = GetUserStake(appId, user);
            ExecutionEngine.Assert(previousStake >= amount, "insufficient stake");

            BigInteger nextStake = previousStake - amount;
            BigInteger nextTotal = GetTotalStaked(appId) - amount;
            Put(AppKey(appId, PREFIX_USER_STAKE, user), nextStake);
            Put(AppKey(appId, PREFIX_TOTAL_STAKED), nextTotal);
            Put(AppKey(appId, PREFIX_USER_REWARD_DEBT, user), nextStake * GetRewardPerNeo(appId));
            if (nextStake == 0)
            {
                Put(AppKey(appId, PREFIX_TOTAL_STAKERS), GetTotalStakers(appId) - 1);
            }

            ExecutionEngine.Assert(
                TransferStakedNeoBackToUser(appId, user, amount),
                "NEO transfer failed");

            OnAnchorStakeChanged(appId, user, nextStake, nextTotal);
        }

        public static void HarvestRewards(string appId, BigInteger amount)
        {
            ValidateAppAuthority(appId);
            ExecutionEngine.Assert(amount > 0, "amount must be positive");
            BigInteger totalStaked = GetTotalStaked(appId);
            ExecutionEngine.Assert(totalStaked > 0, "no stake");
            ExecutionEngine.Assert(
                GAS.BalanceOf(Runtime.ExecutingScriptHash) >= GetTotalRewardReserve() + GetTotalGasCredit() + amount,
                "insufficient available GAS");

            BigInteger rewardPerNeo = DistributeRewards(appId, amount, totalStaked);

            OnAnchorRewardsHarvested(appId, amount, rewardPerNeo);
        }

        public static void FundRewards(string appId, UInt160 funder, BigInteger amount)
        {
            ValidateAppAuthority(appId);
            ValidateAddress(funder);
            ExecutionEngine.Assert(Runtime.CheckWitness(funder), "funder witness required");
            ExecutionEngine.Assert(amount > 0, "amount must be positive");
            ConsumeGasCredit(funder, amount);
            BigInteger totalStaked = GetTotalStaked(appId);
            ExecutionEngine.Assert(totalStaked > 0, "no stake");

            BigInteger rewardPerNeo = DistributeRewards(appId, amount, totalStaked);

            OnAnchorRewardsHarvested(appId, amount, rewardPerNeo);
        }

        public static void ClaimRewards(string appId, UInt160 user)
        {
            ValidateRegistered(appId);
            ExecutionEngine.Assert(Runtime.CheckWitness(user), "unauthorized");
            ValidateAddress(user);

            AccrueUserRewards(appId, user);
            BigInteger scaledPending = GetBigInteger(AppKey(appId, PREFIX_USER_PENDING_REWARD, user));
            BigInteger amount = scaledPending / REWARD_SCALE;
            ExecutionEngine.Assert(amount > 0, "no rewards");
            ExecutionEngine.Assert(GetRewardReserve(appId) >= amount, "reward reserve short");

            BigInteger remainingScaled = scaledPending - amount * REWARD_SCALE;
            if (remainingScaled == 0) Delete(AppKey(appId, PREFIX_USER_PENDING_REWARD, user));
            else Put(AppKey(appId, PREFIX_USER_PENDING_REWARD, user), remainingScaled);
            Put(AppKey(appId, PREFIX_REWARD_RESERVE), GetRewardReserve(appId) - amount);
            PutTotalRewardReserve(GetTotalRewardReserve() - amount);
            ExecutionEngine.Assert(
                TransferRewardGasToUser(appId, user, amount),
                "GAS transfer failed");

            OnAnchorRewardsClaimed(appId, user, amount);
        }

        public static void WithdrawCredit(UInt160 user, string asset, BigInteger amount)
        {
            ValidateAddress(user);
            ExecutionEngine.Assert(Runtime.CheckWitness(user), "unauthorized");
            ExecutionEngine.Assert(amount > 0, "amount must be positive");

            if (asset == "NEO")
            {
                ConsumeCredit(PREFIX_NEO_CREDIT, user, amount);
                ExecutionEngine.Assert(
                    NEO.Transfer(Runtime.ExecutingScriptHash, user, amount),
                    "NEO credit transfer failed");
                return;
            }

            if (asset == "GAS")
            {
                ConsumeGasCredit(user, amount);
                ExecutionEngine.Assert(
                    GAS.Transfer(Runtime.ExecutingScriptHash, user, amount),
                    "GAS credit transfer failed");
                return;
            }

            ExecutionEngine.Assert(false, "invalid asset");
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

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            if (from == null || from == UInt160.Zero) return;
            if (from == Runtime.ExecutingScriptHash) return;
            ValidateAddress(from);
            ExecutionEngine.Assert(amount > 0, "amount must be positive");

            if (Runtime.CallingScriptHash == NEO.Hash)
            {
                AddCredit(PREFIX_NEO_CREDIT, from, amount);
                if (data is string)
                {
                    string appId = (string)data;
                    if (appId.Length > 0)
                    {
                        StakeFromCredit(appId, from, amount);
                    }
                }
                return;
            }

            if (Runtime.CallingScriptHash == GAS.Hash)
            {
                AddGasCredit(from, amount);
                return;
            }

            ExecutionEngine.Assert(false, "unsupported asset");
        }
    }
}
