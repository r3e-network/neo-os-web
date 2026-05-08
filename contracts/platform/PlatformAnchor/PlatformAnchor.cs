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

    /// <summary>
    /// Shared manual AA-agent routing anchor for TrustAnchor and ProfitAnchor.
    ///
    /// Each anchor registers AA agent accounts for council candidates. Candidate
    /// changes are app-admin controlled, while NEO movement and NEO.vote calls
    /// require the relevant AA agent witness.
    /// </summary>
    [DisplayName("PlatformAnchor")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Shared TrustAnchor and ProfitAnchor manual AA-agent routing engine.")]
    [ContractPermission("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", "transfer", "vote")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "balanceOf", "transfer")]
    public class PlatformAnchorContract : SmartContract
    {
        private const int MODE_TRUST = 1;
        private const int MODE_PROFIT = 2;
        private const long REWARD_SCALE = 100_000_000;

        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_PAUSED = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_TOTAL_REWARD_RESERVE = new byte[] { 0x03 };

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
        private static readonly byte[] PREFIX_AGENT_WEIGHT = new byte[] { 0x33 };
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

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }

        [Safe]
        public static UInt160 Admin() => ReadAddress((ByteString)PREFIX_ADMIN);

        [Safe]
        public static bool IsPaused() => GetBigInteger((ByteString)PREFIX_PAUSED) == 1;

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

        public static void Update(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nef, manifest, new object[0]);
        }

        public static void RegisterAnchorApp(string appId, BigInteger mode, UInt160 appAdmin)
        {
            ValidateAdmin();
            ValidateAddress(appAdmin);
            ValidateAppId(appId);
            ExecutionEngine.Assert(mode == MODE_TRUST || mode == MODE_PROFIT, "invalid anchor mode");
            ExecutionEngine.Assert(GetRaw(AppKey(appId, PREFIX_APP_MODE)) == null, "app already registered");

            Put(AppKey(appId, PREFIX_APP_MODE), mode);
            PutAddress(AppKey(appId, PREFIX_APP_ADMIN), appAdmin);
            Put(AppKey(appId, PREFIX_TOTAL_STAKED), 0);
            Put(AppKey(appId, PREFIX_TOTAL_STAKERS), 0);
            Put(AppKey(appId, PREFIX_REWARD_PER_NEO), 0);
            Put(AppKey(appId, PREFIX_REWARD_RESERVE), 0);
            Put(AppKey(appId, PREFIX_REWARD_REMAINDER), 0);
            Put(AppKey(appId, PREFIX_AGENT_COUNT), 0);
            Put(AppKey(appId, PREFIX_SELECTED_AGENT), 0);

            OnAnchorAppRegistered(appId, mode, appAdmin);
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
            Put(AppKey(appId, PREFIX_AGENT_WEIGHT, agentId), 0);
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

        public static void SetAgentWeight(string appId, BigInteger agentId, BigInteger weight)
        {
            ValidateAppAuthority(appId);
            ValidateAgent(appId, agentId);
            ExecutionEngine.Assert(weight >= 0, "invalid weight");
            Put(AppKey(appId, PREFIX_AGENT_WEIGHT, agentId), weight);
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
            ExecutionEngine.Assert(Runtime.CheckWitness(agentAccount), "agent AA witness required");
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

        [Safe]
        public static BigInteger GetAppMode(string appId) => GetBigInteger(AppKey(appId, PREFIX_APP_MODE));

        [Safe]
        public static UInt160 GetAppAdmin(string appId) => ReadAddress(AppKey(appId, PREFIX_APP_ADMIN));

        [Safe]
        public static bool IsAppPaused(string appId) => GetBigInteger(AppKey(appId, PREFIX_APP_PAUSED)) == 1;

        [Safe]
        public static BigInteger GetTotalStaked(string appId) => GetBigInteger(AppKey(appId, PREFIX_TOTAL_STAKED));

        [Safe]
        public static BigInteger GetTotalStakers(string appId) => GetBigInteger(AppKey(appId, PREFIX_TOTAL_STAKERS));

        [Safe]
        public static BigInteger GetRewardPerNeo(string appId) => GetBigInteger(AppKey(appId, PREFIX_REWARD_PER_NEO));

        [Safe]
        public static BigInteger GetRewardReserve(string appId) => GetBigInteger(AppKey(appId, PREFIX_REWARD_RESERVE));

        [Safe]
        public static BigInteger GetTotalRewardReserve() => GetBigInteger((ByteString)PREFIX_TOTAL_REWARD_RESERVE);

        [Safe]
        public static BigInteger GetRewardRemainder(string appId) => GetBigInteger(AppKey(appId, PREFIX_REWARD_REMAINDER));

        [Safe]
        public static BigInteger GetAgentCount(string appId) => GetBigInteger(AppKey(appId, PREFIX_AGENT_COUNT));

        [Safe]
        public static BigInteger GetUserStake(string appId, UInt160 user) => GetBigInteger(AppKey(appId, PREFIX_USER_STAKE, user));

        [Safe]
        public static BigInteger GetPendingRewards(string appId, UInt160 user)
        {
            return GetPendingRewardScaled(appId, user) / REWARD_SCALE;
        }

        private static BigInteger GetPendingRewardScaled(string appId, UInt160 user)
        {
            BigInteger stake = GetUserStake(appId, user);
            BigInteger rewardDebt = GetBigInteger(AppKey(appId, PREFIX_USER_REWARD_DEBT, user));
            BigInteger accrued = stake * GetRewardPerNeo(appId) - rewardDebt;
            if (accrued < 0) accrued = 0;
            return GetBigInteger(AppKey(appId, PREFIX_USER_PENDING_REWARD, user)) + accrued;
        }

        [Safe]
        public static BigInteger GetCredit(UInt160 user, string asset)
        {
            if (asset == "NEO") return GetCredit(PREFIX_NEO_CREDIT, user);
            if (asset == "GAS") return GetCredit(PREFIX_GAS_CREDIT, user);
            return 0;
        }

        [Safe]
        public static BigInteger GetTotalGasCredit() => GetBigInteger((ByteString)PREFIX_TOTAL_GAS_CREDIT);

        [Safe]
        public static Map<string, object> GetAgent(string appId, BigInteger agentId)
        {
            Map<string, object> result = new Map<string, object>();
            result["agentId"] = agentId;
            result["account"] = GetAgentAccount(appId, agentId);
            result["candidate"] = GetAgentCandidate(appId, agentId);
            result["verificationScriptHash"] = GetRaw(AppKey(appId, PREFIX_AGENT_SCRIPT_HASH, agentId));
            result["weight"] = GetBigInteger(AppKey(appId, PREFIX_AGENT_WEIGHT, agentId));
            result["active"] = GetBigInteger(AppKey(appId, PREFIX_AGENT_ACTIVE, agentId)) == 1;
            return result;
        }

        [Safe]
        public static ByteString GetAgentCandidate(string appId, BigInteger agentId) =>
            GetRaw(AppKey(appId, PREFIX_AGENT_CANDIDATE, agentId)) ?? (ByteString)"";

        [Safe]
        public static UInt160 GetAgentAccount(string appId, BigInteger agentId) =>
            ReadAddress(AppKey(appId, PREFIX_AGENT_ACCOUNT, agentId));

        [Safe]
        public static BigInteger GetSelectedAgentId(string appId) => GetBigInteger(AppKey(appId, PREFIX_SELECTED_AGENT));

        [Safe]
        public static ByteString GetSelectedCandidate(string appId)
        {
            BigInteger selectedAgentId = GetBigInteger(AppKey(appId, PREFIX_SELECTED_AGENT));
            if (selectedAgentId == 0) return (ByteString)"";
            return GetAgentCandidate(appId, selectedAgentId);
        }

        [Safe]
        public static Map<string, object> GetAnchorStats(string appId)
        {
            Map<string, object> result = new Map<string, object>();
            result["mode"] = GetAppMode(appId);
            result["totalStaked"] = GetTotalStaked(appId);
            result["totalStakers"] = GetTotalStakers(appId);
            result["rewardPerNeo"] = GetRewardPerNeo(appId);
            result["rewardReserve"] = GetRewardReserve(appId);
            result["totalRewardReserve"] = GetTotalRewardReserve();
            result["rewardRemainder"] = GetRewardRemainder(appId);
            result["agentCount"] = GetAgentCount(appId);
            result["selectedAgentId"] = GetSelectedAgentId(appId);
            result["paused"] = IsPaused() || IsAppPaused(appId);
            return result;
        }

        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        private static void ValidateAppAuthority(string appId)
        {
            ValidateRegistered(appId);
            UInt160 admin = Admin();
            UInt160 appAdmin = GetAppAdmin(appId);
            bool platformAdmin = admin != UInt160.Zero && Runtime.CheckWitness(admin);
            bool localAdmin = appAdmin != UInt160.Zero && Runtime.CheckWitness(appAdmin);
            ExecutionEngine.Assert(platformAdmin || localAdmin, "unauthorized");
        }

        private static void ValidateAnchorOpen(string appId)
        {
            ValidateRegistered(appId);
            ExecutionEngine.Assert(!IsPaused(), "platform paused");
            ExecutionEngine.Assert(!IsAppPaused(appId), "app paused");
        }

        private static void ValidateRegistered(string appId)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(GetAppMode(appId) == MODE_TRUST || GetAppMode(appId) == MODE_PROFIT, "app not registered");
        }

        private static void ValidateMode(string appId, BigInteger expectedMode)
        {
            ValidateRegistered(appId);
            ExecutionEngine.Assert(GetAppMode(appId) == expectedMode, "wrong anchor mode");
        }

        private static void ValidateAgent(string appId, BigInteger agentId)
        {
            ExecutionEngine.Assert(agentId > 0 && agentId <= GetAgentCount(appId), "invalid agent");
            ExecutionEngine.Assert(GetBigInteger(AppKey(appId, PREFIX_AGENT_ACTIVE, agentId)) == 1, "agent inactive");
            ValidateAddress(GetAgentAccount(appId, agentId));
            ExecutionEngine.Assert(GetAgentCandidate(appId, agentId).Length == 33, "candidate missing");
        }

        private static void ValidateAddress(UInt160 value)
        {
            ExecutionEngine.Assert(value != UInt160.Zero && value.IsValid, "invalid address");
        }

        private static void ValidateAppId(string appId)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0 && appId.Length <= 64, "invalid appId");
        }

        private static void AccrueUserRewards(string appId, UInt160 user)
        {
            BigInteger pending = GetPendingRewardScaled(appId, user);
            Put(AppKey(appId, PREFIX_USER_PENDING_REWARD, user), pending);
            Put(AppKey(appId, PREFIX_USER_REWARD_DEBT, user), GetUserStake(appId, user) * GetRewardPerNeo(appId));
        }

        private static BigInteger DistributeRewards(string appId, BigInteger amount, BigInteger totalStaked)
        {
            BigInteger scaledReward = amount * REWARD_SCALE + GetRewardRemainder(appId);
            BigInteger rewardPerNeo = GetRewardPerNeo(appId) + (scaledReward / totalStaked);
            Put(AppKey(appId, PREFIX_REWARD_PER_NEO), rewardPerNeo);
            Put(AppKey(appId, PREFIX_REWARD_REMAINDER), scaledReward % totalStaked);
            Put(AppKey(appId, PREFIX_REWARD_RESERVE), GetRewardReserve(appId) + amount);
            PutTotalRewardReserve(GetTotalRewardReserve() + amount);
            return rewardPerNeo;
        }

        private static void StakeFromCredit(string appId, UInt160 user, BigInteger amount)
        {
            ValidateAnchorOpen(appId);
            ValidateAddress(user);
            ExecutionEngine.Assert(Runtime.CheckWitness(user), "unauthorized");
            ExecutionEngine.Assert(amount > 0, "amount must be positive");

            ConsumeCredit(PREFIX_NEO_CREDIT, user, amount);
            AccrueUserRewards(appId, user);

            BigInteger previousStake = GetUserStake(appId, user);
            if (previousStake == 0)
            {
                Put(AppKey(appId, PREFIX_TOTAL_STAKERS), GetBigInteger(AppKey(appId, PREFIX_TOTAL_STAKERS)) + 1);
            }

            BigInteger nextStake = previousStake + amount;
            BigInteger nextTotal = GetTotalStaked(appId) + amount;
            Put(AppKey(appId, PREFIX_USER_STAKE, user), nextStake);
            Put(AppKey(appId, PREFIX_TOTAL_STAKED), nextTotal);
            Put(AppKey(appId, PREFIX_USER_REWARD_DEBT, user), nextStake * GetRewardPerNeo(appId));

            OnAnchorStakeChanged(appId, user, nextStake, nextTotal);
        }

        private static ECPoint GetAgentCandidateAsPoint(string appId, BigInteger agentId)
        {
            ByteString candidate = GetAgentCandidate(appId, agentId);
            ExecutionEngine.Assert(candidate != null && candidate.Length == 33, "invalid candidate");
            return (ECPoint)candidate;
        }

        private static void TransferNeoBetweenSameAppAgents(
            string appId,
            BigInteger fromAgentId,
            BigInteger toAgentId,
            BigInteger amount)
        {
            ValidateRegistered(appId);
            ValidateAgent(appId, fromAgentId);
            ValidateAgent(appId, toAgentId);
            ExecutionEngine.Assert(fromAgentId != toAgentId, "same agent");
            ExecutionEngine.Assert(amount > 0, "amount must be positive");

            UInt160 fromAgent = GetAgentAccount(appId, fromAgentId);
            UInt160 toAgent = GetAgentAccount(appId, toAgentId);
            ValidateAddress(fromAgent);
            ValidateAddress(toAgent);
            ExecutionEngine.Assert(Runtime.CheckWitness(fromAgent), "from agent AA witness required");
            ExecutionEngine.Assert(
                NEO.Transfer(fromAgent, toAgent, amount),
                "agent NEO transfer failed");
        }

        private static bool TransferStakedNeoBackToUser(string appId, UInt160 user, BigInteger amount)
        {
            ValidateRegistered(appId);
            ValidateAddress(user);
            ExecutionEngine.Assert(Runtime.CheckWitness(user), "unauthorized");
            ExecutionEngine.Assert(amount > 0, "amount must be positive");
            return NEO.Transfer(Runtime.ExecutingScriptHash, user, amount);
        }

        private static bool TransferRewardGasToUser(string appId, UInt160 user, BigInteger amount)
        {
            ValidateRegistered(appId);
            ValidateAddress(user);
            ExecutionEngine.Assert(Runtime.CheckWitness(user), "unauthorized");
            ExecutionEngine.Assert(amount > 0, "amount must be positive");
            return GAS.Transfer(Runtime.ExecutingScriptHash, user, amount);
        }

        private static ByteString CandidateBytes(ECPoint candidate) =>
            (ByteString)(byte[])candidate!;

        private static void AddCredit(byte[] prefix, UInt160 user, BigInteger amount)
        {
            BigInteger existing = GetCredit(prefix, user);
            Put(CreditKey(prefix, user), existing + amount);
        }

        private static void AddGasCredit(UInt160 user, BigInteger amount)
        {
            AddCredit(PREFIX_GAS_CREDIT, user, amount);
            Put((ByteString)PREFIX_TOTAL_GAS_CREDIT, GetTotalGasCredit() + amount);
        }

        private static void ConsumeCredit(byte[] prefix, UInt160 user, BigInteger amount)
        {
            BigInteger existing = GetCredit(prefix, user);
            ExecutionEngine.Assert(existing >= amount, "insufficient credit");
            BigInteger next = existing - amount;
            if (next == 0) Delete(CreditKey(prefix, user));
            else Put(CreditKey(prefix, user), next);
        }

        private static void ConsumeGasCredit(UInt160 user, BigInteger amount)
        {
            ConsumeCredit(PREFIX_GAS_CREDIT, user, amount);
            BigInteger total = GetTotalGasCredit();
            ExecutionEngine.Assert(total >= amount, "gas credit reserve short");
            BigInteger next = total - amount;
            if (next == 0) Delete((ByteString)PREFIX_TOTAL_GAS_CREDIT);
            else Put((ByteString)PREFIX_TOTAL_GAS_CREDIT, next);
        }

        private static BigInteger GetCredit(byte[] prefix, UInt160 user) => GetBigInteger(CreditKey(prefix, user));

        private static ByteString CreditKey(byte[] prefix, UInt160 user) =>
            Helper.Concat((ByteString)prefix, (ByteString)(byte[])user);

        private static ByteString AppKey(string appId, byte[] prefix) =>
            Helper.Concat((ByteString)appId, (ByteString)prefix);

        private static ByteString AppKey(string appId, byte[] prefix, BigInteger id) =>
            Helper.Concat(AppKey(appId, prefix), (ByteString)id.ToByteArray());

        private static ByteString AppKey(string appId, byte[] prefix, UInt160 account) =>
            Helper.Concat(AppKey(appId, prefix), (ByteString)(byte[])account);

        private static void Put(ByteString key, BigInteger value) =>
            Storage.Put(Storage.CurrentContext, key, value);

        private static void Put(ByteString key, ByteString value) =>
            Storage.Put(Storage.CurrentContext, key, value);

        private static void PutAddress(ByteString key, UInt160 value) =>
            Storage.Put(Storage.CurrentContext, key, value);

        private static void PutTotalRewardReserve(BigInteger value)
        {
            if (value == 0) Delete((ByteString)PREFIX_TOTAL_REWARD_RESERVE);
            else Put((ByteString)PREFIX_TOTAL_REWARD_RESERVE, value);
        }

        private static BigInteger GetBigInteger(ByteString key)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }

        private static ByteString? GetRaw(ByteString key) =>
            Storage.Get(Storage.CurrentContext, key);

        private static void Delete(ByteString key) =>
            Storage.Delete(Storage.CurrentContext, key);

        private static UInt160 ReadAddress(ByteString key)
        {
            ByteString value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? UInt160.Zero : (UInt160)value;
        }
    }
}
