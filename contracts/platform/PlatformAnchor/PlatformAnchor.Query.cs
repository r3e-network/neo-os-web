using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;

#pragma warning disable CS8600, CS8601, CS8602, CS8603, CS8604, CS8618

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public partial class PlatformAnchorContract
    {
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
    }
}
