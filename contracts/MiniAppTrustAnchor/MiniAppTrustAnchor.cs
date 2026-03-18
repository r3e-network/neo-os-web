using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
#pragma warning disable CS8618
    [DisplayName("MiniAppTrustAnchor")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "3.0.0")]
    [ManifestExtra("Description", "Single-contract TrustAnchor staking pool with verification-script agent accounts 1-21.")]
    [ContractPermission("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", "*")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]
    public class MiniAppTrustAnchor : MiniAppBase
    {
        private const string APP_ID = "miniapp-trustanchor";
        private static readonly BigInteger RPS_SCALE = 100000000;
        private const int MIN_AGENT_ID = 1;
        private const int MAX_AGENT_ID = 21;
        private const int DEFAULT_AGENT_ID = 21;
        private const int MAX_LABEL_LENGTH = 64;
        private const int MAX_PUBKEY_LENGTH = 80;
        private const int MAX_SCRIPT_LENGTH = 2048;

        private static readonly byte[] PREFIX_TOTAL_STAKE = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_RPS = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_PENDING_REWARD = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_DEFAULT_AGENT = new byte[] { 0x23 };

        private static readonly byte[] PREFIX_STAKE = new byte[] { 0x30 };
        private static readonly byte[] PREFIX_REWARD = new byte[] { 0x31 };
        private static readonly byte[] PREFIX_PAID = new byte[] { 0x32 };
        private static readonly byte[] PREFIX_PENDING_WITHDRAW = new byte[] { 0x33 };

        private static readonly byte[] PREFIX_AGENT_ACCOUNT = new byte[] { 0x40 };
        private static readonly byte[] PREFIX_AGENT_TARGET = new byte[] { 0x41 };
        private static readonly byte[] PREFIX_AGENT_SCRIPT = new byte[] { 0x42 };
        private static readonly byte[] PREFIX_AGENT_LABEL = new byte[] { 0x43 };
        private static readonly byte[] PREFIX_AGENT_ACTIVE = new byte[] { 0x44 };

        public delegate void AgentConfiguredHandler(BigInteger agentId, UInt160 account, string candidateTarget);
        public delegate void StakeDepositedHandler(UInt160 user, BigInteger amount, BigInteger agentId, UInt160 agentAccount);
        public delegate void AgentLiquidityReturnedHandler(BigInteger agentId, UInt160 agentAccount, BigInteger amount);
        public delegate void WithdrawalRequestedHandler(UInt160 user, BigInteger amount);
        public delegate void WithdrawalClaimedHandler(UInt160 user, BigInteger amount);
        public delegate void RewardClaimedHandler(UInt160 user, BigInteger amount);
        public delegate void RewardDepositedHandler(UInt160 from, BigInteger amount);
        public delegate void DefaultAgentChangedHandler(BigInteger agentId);

        [DisplayName("AgentConfigured")]
        public static event AgentConfiguredHandler OnAgentConfigured;

        [DisplayName("StakeDeposited")]
        public static event StakeDepositedHandler OnStakeDeposited;

        [DisplayName("AgentLiquidityReturned")]
        public static event AgentLiquidityReturnedHandler OnAgentLiquidityReturned;

        [DisplayName("WithdrawalRequested")]
        public static event WithdrawalRequestedHandler OnWithdrawalRequested;

        [DisplayName("WithdrawalClaimed")]
        public static event WithdrawalClaimedHandler OnWithdrawalClaimed;

        [DisplayName("RewardClaimed")]
        public static event RewardClaimedHandler OnRewardClaimed;

        [DisplayName("RewardDeposited")]
        public static event RewardDepositedHandler OnRewardDeposited;

        [DisplayName("DefaultAgentChanged")]
        public static event DefaultAgentChangedHandler OnDefaultAgentChanged;

        public static void _deploy(object data, bool update)
        {
            if (update) return;

            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_STAKE, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_RPS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_PENDING_REWARD, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_DEFAULT_AGENT, DEFAULT_AGENT_ID);
        }

        [Safe]
        public static BigInteger TotalStake()
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_STAKE);
            return value is null ? 0 : (BigInteger)value;
        }

        [Safe]
        public static BigInteger Rps()
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, PREFIX_RPS);
            return value is null ? 0 : (BigInteger)value;
        }

        [Safe]
        public static BigInteger PendingReward()
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, PREFIX_PENDING_REWARD);
            return value is null ? 0 : (BigInteger)value;
        }

        [Safe]
        public static BigInteger DefaultIngressAgent()
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, PREFIX_DEFAULT_AGENT);
            return value is null ? DEFAULT_AGENT_ID : (BigInteger)value;
        }

        [Safe]
        public static BigInteger StakeOf(UInt160 account)
        {
            return GetStake(account);
        }

        [Safe]
        public static BigInteger RewardOf(UInt160 account)
        {
            return GetReward(account);
        }

        [Safe]
        public static BigInteger PendingWithdrawOf(UInt160 account)
        {
            return GetPendingWithdraw(account);
        }

        [Safe]
        public static BigInteger AgentCount()
        {
            return MAX_AGENT_ID;
        }

        [Safe]
        public static BigInteger GetAgentIdByAccount(UInt160 account)
        {
            return FindAgentIdByAccount(account);
        }

        [Safe]
        public static Map<string, object> GetAgentDetails(BigInteger agentId)
        {
            ValidateAgentId(agentId);

            Map<string, object> details = new Map<string, object>();
            details["agentId"] = agentId;
            details["account"] = GetAgentAccount(agentId);
            details["candidateTarget"] = GetAgentTarget(agentId);
            details["verificationScript"] = GetAgentVerificationScript(agentId);
            details["label"] = GetAgentLabel(agentId);
            details["active"] = IsAgentActive(agentId);
            details["defaultIngress"] = agentId == DefaultIngressAgent();
            return details;
        }

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalStaked"] = TotalStake();
            stats["rps"] = Rps();
            stats["pendingReward"] = PendingReward();
            stats["defaultIngressAgent"] = DefaultIngressAgent();
            stats["agentCount"] = AgentCount();
            stats["contractNeoBalance"] = NEO.BalanceOf(Runtime.ExecutingScriptHash);
            stats["contractGasBalance"] = GAS.BalanceOf(Runtime.ExecutingScriptHash);
            return stats;
        }

        [Safe]
        public static Map<string, object> GetUserOverview(UInt160 account)
        {
            Map<string, object> overview = new Map<string, object>();
            overview["stake"] = StakeOf(account);
            overview["reward"] = RewardOf(account);
            overview["pendingWithdraw"] = PendingWithdrawOf(account);
            return overview;
        }

        public static void SetAgentDefinition(
            BigInteger agentId,
            UInt160 agentAccount,
            string candidateTarget,
            string verificationScript,
            string label,
            bool active)
        {
            ValidateAdmin();
            ValidateAgentId(agentId);
            ValidateAddress(agentAccount);
            ValidateAgentMetadata(candidateTarget, verificationScript, label);

            AgentAccountMap().Put((ByteString)agentId, agentAccount);
            AgentTargetMap().Put((ByteString)agentId, candidateTarget);
            AgentScriptMap().Put((ByteString)agentId, verificationScript);
            AgentLabelMap().Put((ByteString)agentId, label);
            AgentActiveMap().Put((ByteString)agentId, active ? 1 : 0);

            OnAgentConfigured(agentId, agentAccount, candidateTarget);
        }

        public static void SetDefaultIngressAgent(BigInteger agentId)
        {
            ValidateAdmin();
            ValidateAgentId(agentId);
            ExecutionEngine.Assert(IsAgentConfigured(agentId), "agent not configured");
            ExecutionEngine.Assert(IsAgentActive(agentId), "agent not active");

            Storage.Put(Storage.CurrentContext, PREFIX_DEFAULT_AGENT, agentId);
            OnDefaultAgentChanged(agentId);
        }

        public static bool SyncAccount(UInt160 account)
        {
            ValidateAddress(account);

            BigInteger currentStake = GetStake(account);
            BigInteger currentRps = Rps();
            BigInteger paid = GetPaid(account);

            if (currentStake > 0)
            {
                BigInteger earned = currentStake * (currentRps - paid) / RPS_SCALE + GetReward(account);
                RewardMap().Put(account, earned);
            }

            PaidMap().Put(account, currentRps);
            return true;
        }

        public static void Withdraw(UInt160 account, BigInteger amount)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(account);
            ExecutionEngine.Assert(Runtime.CheckWitness(account), "unauthorized");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            SyncAccount(account);

            BigInteger stake = GetStake(account);
            ExecutionEngine.Assert(stake >= amount, "insufficient stake");

            StakeMap().Put(account, stake - amount);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_STAKE, TotalStake() - amount);

            BigInteger liquidity = NEO.BalanceOf(Runtime.ExecutingScriptHash);
            if (liquidity >= amount)
            {
                ExecutionEngine.Assert(NEO.Transfer(Runtime.ExecutingScriptHash, account, amount, "withdraw"));
                OnWithdrawalClaimed(account, amount);
                return;
            }

            BigInteger pending = GetPendingWithdraw(account);
            PendingWithdrawMap().Put(account, pending + amount);
            OnWithdrawalRequested(account, amount);
        }

        public static void ClaimWithdraw(UInt160 account)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(account);
            ExecutionEngine.Assert(Runtime.CheckWitness(account), "unauthorized");

            BigInteger pending = GetPendingWithdraw(account);
            ExecutionEngine.Assert(pending > 0, "no pending withdraw");
            ExecutionEngine.Assert(NEO.BalanceOf(Runtime.ExecutingScriptHash) >= pending, "liquidity unavailable");

            PendingWithdrawMap().Put(account, 0);
            ExecutionEngine.Assert(NEO.Transfer(Runtime.ExecutingScriptHash, account, pending, "claim-withdraw"));
            OnWithdrawalClaimed(account, pending);
        }

        public static void ClaimReward(UInt160 account)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(account);
            ExecutionEngine.Assert(Runtime.CheckWitness(account), "unauthorized");

            SyncAccount(account);

            BigInteger reward = GetReward(account);
            ExecutionEngine.Assert(reward > 0, "no reward");
            ExecutionEngine.Assert(GAS.BalanceOf(Runtime.ExecutingScriptHash) >= reward, "reward liquidity unavailable");

            RewardMap().Put(account, 0);
            ExecutionEngine.Assert(GAS.Transfer(Runtime.ExecutingScriptHash, account, reward, "claim-reward"));
            OnRewardClaimed(account, reward);
        }

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            if (from == Runtime.ExecutingScriptHash || amount <= 0) return;

            if (Runtime.CallingScriptHash == GAS.Hash)
            {
                OnRewardDeposited(from, amount);
                BigInteger totalStake = TotalStake();
                if (totalStake > 0)
                {
                    DistributeReward(amount, totalStake);
                }
                else
                {
                    Storage.Put(Storage.CurrentContext, PREFIX_PENDING_REWARD, PendingReward() + amount);
                }
                return;
            }

            if (Runtime.CallingScriptHash != NEO.Hash)
            {
                ExecutionEngine.Assert(false, "unsupported asset");
                return;
            }

            BigInteger agentId = FindAgentIdByAccount(from);
            if (agentId > 0)
            {
                OnAgentLiquidityReturned(agentId, from, amount);
                return;
            }

            ExecutionEngine.Assert(!IsPaused(), "paused");
            ValidateAddress(from);

            BigInteger previousTotalStake = TotalStake();
            SyncAccount(from);

            BigInteger currentStake = GetStake(from);
            StakeMap().Put(from, currentStake + amount);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_STAKE, previousTotalStake + amount);

            if (previousTotalStake == 0 && PendingReward() > 0)
            {
                BigInteger pendingReward = PendingReward();
                Storage.Put(Storage.CurrentContext, PREFIX_PENDING_REWARD, 0);
                DistributeReward(pendingReward, TotalStake());
            }

            BigInteger defaultAgentId = DefaultIngressAgent();
            ExecutionEngine.Assert(IsAgentConfigured(defaultAgentId), "default agent not configured");
            ExecutionEngine.Assert(IsAgentActive(defaultAgentId), "default agent not active");

            UInt160 agentAccount = GetAgentAccount(defaultAgentId);
            ExecutionEngine.Assert(NEO.Transfer(Runtime.ExecutingScriptHash, agentAccount, amount, "ingress-agent"));
            OnStakeDeposited(from, amount, defaultAgentId, agentAccount);
        }

        private static void DistributeReward(BigInteger amount, BigInteger totalStake)
        {
            ExecutionEngine.Assert(totalStake > 0, "total stake required");

            BigInteger rewardShare = amount * RPS_SCALE / totalStake;
            Storage.Put(Storage.CurrentContext, PREFIX_RPS, Rps() + rewardShare);
        }

        private static void ValidateAgentId(BigInteger agentId)
        {
            ExecutionEngine.Assert(agentId >= MIN_AGENT_ID && agentId <= MAX_AGENT_ID, "invalid agent id");
        }

        private static void ValidateAgentMetadata(string candidateTarget, string verificationScript, string label)
        {
            ExecutionEngine.Assert(candidateTarget is not null && candidateTarget.Length > 0 && candidateTarget.Length <= MAX_PUBKEY_LENGTH, "invalid candidate target");
            ExecutionEngine.Assert(verificationScript is not null && verificationScript.Length > 0 && verificationScript.Length <= MAX_SCRIPT_LENGTH, "invalid verification script");
            ExecutionEngine.Assert(label is not null && label.Length > 0 && label.Length <= MAX_LABEL_LENGTH, "invalid label");
        }

        private static bool IsAgentConfigured(BigInteger agentId)
        {
            return GetAgentAccount(agentId) != UInt160.Zero;
        }

        private static bool IsAgentActive(BigInteger agentId)
        {
            ByteString? value = AgentActiveMap().Get((ByteString)agentId);
            return value is not null && (BigInteger)value == 1;
        }

        private static BigInteger FindAgentIdByAccount(UInt160 account)
        {
            for (int i = MIN_AGENT_ID; i <= MAX_AGENT_ID; i++)
            {
                if (GetAgentAccount(i) == account)
                {
                    return i;
                }
            }
            return 0;
        }

        private static UInt160 GetAgentAccount(BigInteger agentId)
        {
            ByteString? value = AgentAccountMap().Get((ByteString)agentId);
            return value is null ? UInt160.Zero : (UInt160)value;
        }

        private static string GetAgentTarget(BigInteger agentId)
        {
            ByteString? value = AgentTargetMap().Get((ByteString)agentId);
            return value is null ? string.Empty : (string)value;
        }

        private static string GetAgentVerificationScript(BigInteger agentId)
        {
            ByteString? value = AgentScriptMap().Get((ByteString)agentId);
            return value is null ? string.Empty : (string)value;
        }

        private static string GetAgentLabel(BigInteger agentId)
        {
            ByteString? value = AgentLabelMap().Get((ByteString)agentId);
            return value is null ? string.Empty : (string)value;
        }

        private static BigInteger GetStake(UInt160 account)
        {
            ByteString? value = StakeMap().Get(account);
            return value is null ? 0 : (BigInteger)value;
        }

        private static BigInteger GetReward(UInt160 account)
        {
            ByteString? value = RewardMap().Get(account);
            return value is null ? 0 : (BigInteger)value;
        }

        private static BigInteger GetPaid(UInt160 account)
        {
            ByteString? value = PaidMap().Get(account);
            return value is null ? 0 : (BigInteger)value;
        }

        private static BigInteger GetPendingWithdraw(UInt160 account)
        {
            ByteString? value = PendingWithdrawMap().Get(account);
            return value is null ? 0 : (BigInteger)value;
        }

        private static StorageMap StakeMap() => new StorageMap(Storage.CurrentContext, PREFIX_STAKE);

        private static StorageMap RewardMap() => new StorageMap(Storage.CurrentContext, PREFIX_REWARD);

        private static StorageMap PaidMap() => new StorageMap(Storage.CurrentContext, PREFIX_PAID);

        private static StorageMap PendingWithdrawMap() => new StorageMap(Storage.CurrentContext, PREFIX_PENDING_WITHDRAW);

        private static StorageMap AgentAccountMap() => new StorageMap(Storage.CurrentContext, PREFIX_AGENT_ACCOUNT);

        private static StorageMap AgentTargetMap() => new StorageMap(Storage.CurrentContext, PREFIX_AGENT_TARGET);

        private static StorageMap AgentScriptMap() => new StorageMap(Storage.CurrentContext, PREFIX_AGENT_SCRIPT);

        private static StorageMap AgentLabelMap() => new StorageMap(Storage.CurrentContext, PREFIX_AGENT_LABEL);

        private static StorageMap AgentActiveMap() => new StorageMap(Storage.CurrentContext, PREFIX_AGENT_ACTIVE);
    }
}
