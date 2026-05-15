using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

#pragma warning disable CS8600, CS8601, CS8602, CS8603, CS8604, CS8618

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public partial class PlatformAnchorContract
    {
        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        private static void RegisterAnchorAppCore(string appId, BigInteger mode, UInt160 appAdmin)
        {
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

        private static BigInteger GetPendingRewardScaled(string appId, UInt160 user)
        {
            BigInteger stake = GetUserStake(appId, user);
            BigInteger rewardDebt = GetBigInteger(AppKey(appId, PREFIX_USER_REWARD_DEBT, user));
            BigInteger accrued = stake * GetRewardPerNeo(appId) - rewardDebt;
            if (accrued < 0) accrued = 0;
            return GetBigInteger(AppKey(appId, PREFIX_USER_PENDING_REWARD, user)) + accrued;
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
            ExecutionEngine.Assert(HasAgentExecutionWitness(fromAgent), "from agent AA witness required");
            ExecutionEngine.Assert(
                NEO.Transfer(fromAgent, toAgent, amount),
                "agent NEO transfer failed");
        }

        private static bool HasAgentExecutionWitness(UInt160 agentAccount)
        {
            if (Runtime.CheckWitness(agentAccount)) return true;
            UInt160 abstractAccount = AbstractAccount();
            return abstractAccount != UInt160.Zero && Runtime.CallingScriptHash == abstractAccount;
        }

        private static void SetAgentAccountCore(
            string appId,
            BigInteger agentId,
            UInt160 agentAccount,
            ByteString verificationScriptHash)
        {
            ValidateAgent(appId, agentId);
            ValidateAddress(agentAccount);
            ExecutionEngine.Assert(verificationScriptHash != null && verificationScriptHash.Length == 20, "account id hash required");
            PutAddress(AppKey(appId, PREFIX_AGENT_ACCOUNT, agentId), agentAccount);
            Put(AppKey(appId, PREFIX_AGENT_SCRIPT_HASH, agentId), verificationScriptHash);
            OnAnchorAgentAccountUpdated(appId, agentId, agentAccount, verificationScriptHash);
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
