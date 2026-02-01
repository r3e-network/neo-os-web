using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHeritageTrust
    {
        #region Internal Helpers

        private static void StoreTrust(BigInteger trustId, Trust trust)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_TRUSTS, (ByteString)trustId.ToByteArray()),
                StdLib.Serialize(trust));
        }

        private static void AddUserTrust(UInt160 user, BigInteger trustId)
        {
            byte[] countKey = Helper.Concat(PREFIX_USER_TRUST_COUNT, user);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_TRUSTS, user),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, trustId);
        }

        private static void AddHeirTrust(UInt160 heir, BigInteger trustId)
        {
            byte[] countKey = Helper.Concat(PREFIX_HEIR_TRUST_COUNT, heir);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_HEIR_TRUSTS, heir),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, trustId);
        }

        private static void RemoveHeirTrust(UInt160 heir, BigInteger trustId)
        {
            byte[] countKey = Helper.Concat(PREFIX_HEIR_TRUST_COUNT, heir);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            if (count > 0)
            {
                Storage.Put(Storage.CurrentContext, countKey, count - 1);
            }
        }

        private static void UpdateTotalPrincipal(BigInteger delta)
        {
            BigInteger current = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_PRINCIPAL);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PRINCIPAL, current + delta);
        }

        private static void UpdateTotalNeoPrincipal(BigInteger delta)
        {
            BigInteger current = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_NEO_PRINCIPAL);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_NEO_PRINCIPAL, current + delta);
        }

        private static void UpdateTotalYield(BigInteger amount)
        {
            BigInteger current = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_YIELD);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_YIELD, current + amount);
        }

        private static void UpdateTotalExecuted()
        {
            BigInteger current = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_EXECUTED);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_EXECUTED, current + 1);
        }

        private static void UpdateTotalCancelled()
        {
            BigInteger current = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_CANCELLED);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_CANCELLED, current + 1);
        }

        private static void StoreOwnerStats(UInt160 owner, OwnerStats stats)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_OWNER_STATS, owner),
                StdLib.Serialize(stats));
        }

        private static void UpdateOwnerStatsOnCreate(UInt160 owner, BigInteger principal)
        {
            OwnerStats stats = GetOwnerStats(owner);

            bool isNewOwner = stats.JoinTime == 0;
            if (isNewOwner)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalOwners = TotalOwners();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_OWNERS, totalOwners + 1);
            }

            stats.TrustsCreated += 1;
            stats.ActiveTrusts += 1;
            stats.TotalPrincipalDeposited += principal;
            stats.LastActivityTime = Runtime.Time;

            if (principal > stats.HighestPrincipal)
            {
                stats.HighestPrincipal = principal;
            }

            StoreOwnerStats(owner, stats);
            CheckOwnerBadges(owner);
        }

        private static void UpdateOwnerStatsOnHeartbeat(UInt160 owner)
        {
            OwnerStats stats = GetOwnerStats(owner);
            stats.HeartbeatCount += 1;
            stats.LastActivityTime = Runtime.Time;
            StoreOwnerStats(owner, stats);
            CheckOwnerBadges(owner);
        }

        private static void UpdateOwnerStatsOnYieldClaim(UInt160 owner, BigInteger amount)
        {
            OwnerStats stats = GetOwnerStats(owner);
            stats.TotalYieldClaimed += amount;
            stats.LastActivityTime = Runtime.Time;
            StoreOwnerStats(owner, stats);
        }

        private static void UpdateOwnerStatsOnExecute(UInt160 owner)
        {
            OwnerStats stats = GetOwnerStats(owner);
            stats.TrustsExecuted += 1;
            stats.ActiveTrusts -= 1;
            stats.LastActivityTime = Runtime.Time;
            StoreOwnerStats(owner, stats);
        }

        private static void UpdateOwnerStatsOnCancel(UInt160 owner)
        {
            OwnerStats stats = GetOwnerStats(owner);
            stats.TrustsCancelled += 1;
            stats.ActiveTrusts -= 1;
            stats.LastActivityTime = Runtime.Time;
            StoreOwnerStats(owner, stats);
        }

        private static void UpdateOwnerStatsOnPrincipalAdd(UInt160 owner, BigInteger amount)
        {
            OwnerStats stats = GetOwnerStats(owner);
            stats.TotalPrincipalDeposited += amount;
            stats.PrincipalAdditions += 1;
            stats.LastActivityTime = Runtime.Time;
            StoreOwnerStats(owner, stats);
            CheckOwnerBadges(owner);
        }

        private static void UpdateOwnerStatsOnGuardianAdd(UInt160 owner)
        {
            OwnerStats stats = GetOwnerStats(owner);
            stats.GuardiansAdded += 1;
            stats.LastActivityTime = Runtime.Time;
            StoreOwnerStats(owner, stats);
        }

        private static UInt160 BneoContract()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_BNEO_CONTRACT);
            if (raw == null || raw.Length == 0)
            {
                uint network = Runtime.GetNetwork();
                if (network == NETWORK_MAGIC_MAINNET)
                {
                    return DEFAULT_BNEO_SCRIPT_HASH_MAINNET;
                }
                if (network == NETWORK_MAGIC_TESTNET)
                {
                    return DEFAULT_BNEO_SCRIPT_HASH_TESTNET;
                }
                return DEFAULT_BNEO_SCRIPT_HASH_TESTNET;
            }
            return (UInt160)raw;
        }

        private static void SetBneoContractInternal(UInt160 contractHash)
        {
            Storage.Put(Storage.CurrentContext, PREFIX_BNEO_CONTRACT, contractHash);
        }

        private static void ClaimBneoRewards()
        {
            UInt160 bneo = BneoContract();
            if (bneo == null || !bneo.IsValid) return;
            Contract.Call(bneo, "claim", CallFlags.All);
        }

        private static void StakeNeoToBneo(BigInteger neoAmount)
        {
            if (neoAmount <= 0) return;

            UInt160 bneo = BneoContract();
            ExecutionEngine.Assert(bneo != null && bneo.IsValid, "bNEO not set");

            bool ok = NEO.Transfer(Runtime.ExecutingScriptHash, bneo, neoAmount, null);
            ExecutionEngine.Assert(ok, "stake failed");
        }

        private static void RedeemBneoToNeo(BigInteger neoAmount)
        {
            if (neoAmount <= 0) return;

            UInt160 bneo = BneoContract();
            ExecutionEngine.Assert(bneo != null && bneo.IsValid, "bNEO not set");

            BigInteger bneoAmount = neoAmount * 100000000;
            bool ok = (bool)Contract.Call(
                bneo,
                "transfer",
                CallFlags.All,
                Runtime.ExecutingScriptHash,
                bneo,
                bneoAmount,
                new byte[0]);
            ExecutionEngine.Assert(ok, "redeem failed");
        }

        private static Trust RefreshTrustRewards(BigInteger trustId, Trust trust)
        {
            BigInteger rewardPerNeo = GetRewardPerNeo();
            ByteString debtRaw = Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_REWARD_DEBT, trustId.ToByteArray()));
            BigInteger lastRewardPerNeo = debtRaw == null ? 0 : (BigInteger)debtRaw;

            BigInteger remainingNeo = trust.Principal - trust.TotalNeoReleased;
            if (remainingNeo < 0) remainingNeo = 0;

            BigInteger pendingRewards = (remainingNeo * (rewardPerNeo - lastRewardPerNeo)) / 100000000;
            if (pendingRewards > 0) trust.AccruedYield += pendingRewards;

            Storage.Put(Storage.CurrentContext, Helper.Concat(PREFIX_REWARD_DEBT, trustId.ToByteArray()), rewardPerNeo);
            return trust;
        }

        private static string ResolveReleaseMode(Trust trust)
        {
            if (trust.OnlyReleaseRewards) return "rewards_only";
            if (trust.MonthlyGasRelease > 0 && trust.GasPrincipal > 0) return "fixed";
            return "neo_rewards";
        }
        #endregion

        #region Badge Logic

        private static void CheckOwnerBadges(UInt160 owner)
        {
            OwnerStats stats = GetOwnerStats(owner);

            if (stats.TrustsCreated >= 1)
                AwardOwnerBadge(owner, 1, "First Trust");

            if (stats.TrustsCreated >= 5)
                AwardOwnerBadge(owner, 2, "Trust Builder");

            if (stats.HeartbeatCount >= 12)
                AwardOwnerBadge(owner, 3, "Consistent");

            if (stats.TotalPrincipalDeposited >= 10000000000)
                AwardOwnerBadge(owner, 4, "Whale");

            if (stats.GuardiansAdded >= 3)
                AwardOwnerBadge(owner, 5, "Protected");

            if (stats.PrincipalAdditions >= 5)
                AwardOwnerBadge(owner, 6, "Growing Estate");
        }

        private static void AwardOwnerBadge(UInt160 owner, BigInteger badgeType, string badgeName)
        {
            if (HasOwnerBadge(owner, badgeType)) return;

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_OWNER_BADGES, owner),
                (ByteString)badgeType.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);

            OwnerStats stats = GetOwnerStats(owner);
            stats.BadgeCount += 1;
            StoreOwnerStats(owner, stats);

            OnOwnerBadgeEarned(owner, badgeType, badgeName);
        }
        #endregion

        #region Automation
        public static new void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");
        }

        /// <summary>
        /// Accrue yield for a trust (called by automation).
        /// </summary>
        public static void AccrueYield(BigInteger trustId, BigInteger yieldAmount)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            Trust trust = GetTrust(trustId);
            ExecutionEngine.Assert(trust.Active, "trust not active");

            trust.AccruedYield += yieldAmount;
            StoreTrust(trustId, trust);

            OnYieldAccrued(trustId, yieldAmount, trust.AccruedYield);
        }
        #endregion
    }
}
