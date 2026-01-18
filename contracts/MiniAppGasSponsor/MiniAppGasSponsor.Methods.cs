using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGasSponsor
    {
        #region Sponsorship Methods

        /// <summary>
        /// Create a new sponsorship pool with pool type and expiry.
        /// </summary>
        public static BigInteger CreatePool(UInt160 sponsor, BigInteger amount, BigInteger maxClaimPerUser, BigInteger poolType, string description)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(sponsor), "unauthorized");
            ExecutionEngine.Assert(amount >= MIN_SPONSORSHIP, "amount too low");
            ExecutionEngine.Assert(maxClaimPerUser > 0 && maxClaimPerUser <= MAX_CLAIM_PER_TX, "invalid max claim");
            ExecutionEngine.Assert(poolType >= 1 && poolType <= 3, "invalid pool type");
            ExecutionEngine.Assert(description.Length <= 200, "description too long");

            bool transferred = GAS.Transfer(sponsor, Runtime.ExecutingScriptHash, amount);
            ExecutionEngine.Assert(transferred, "GAS transfer failed");

            BigInteger poolId = GetPoolCount() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_POOL_COUNT, poolId);

            PoolData pool = new PoolData
            {
                Sponsor = sponsor,
                PoolType = poolType,
                InitialAmount = amount,
                RemainingAmount = amount,
                MaxClaimPerUser = maxClaimPerUser,
                TotalClaimed = 0,
                ClaimCount = 0,
                CreateTime = Runtime.Time,
                ExpiryTime = Runtime.Time + DEFAULT_EXPIRY_SECONDS,
                Active = true,
                Description = description
            };
            StorePool(poolId, pool);

            UpdateSponsorStatsOnCreate(sponsor, amount);

            BigInteger totalSponsored = GetTotalSponsored();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_SPONSORED, totalSponsored + amount);

            BigInteger activePools = GetActivePoolCount();
            Storage.Put(Storage.CurrentContext, PREFIX_ACTIVE_POOLS, activePools + 1);

            CheckSponsorBadges(sponsor);

            OnSponsorshipCreated(sponsor, amount, poolId, poolType);
            return poolId;
        }

        /// <summary>
        /// Claim GAS from a sponsorship pool.
        /// </summary>
        public static void ClaimSponsorship(UInt160 beneficiary, BigInteger poolId, BigInteger amount)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(beneficiary), "unauthorized");
            ExecutionEngine.Assert(amount > 0, "invalid amount");

            PoolData pool = GetPoolData(poolId);
            ExecutionEngine.Assert(pool.Sponsor != UInt160.Zero, "pool not found");
            ExecutionEngine.Assert(pool.Active, "pool not active");
            ExecutionEngine.Assert(Runtime.Time < pool.ExpiryTime, "pool expired");
            ExecutionEngine.Assert(pool.RemainingAmount >= amount, "insufficient pool balance");

            if (pool.PoolType == 2)
            {
                ExecutionEngine.Assert(IsWhitelisted(poolId, beneficiary), "not whitelisted");
            }

            BigInteger userClaimed = GetUserClaimedFromPool(beneficiary, poolId);
            ExecutionEngine.Assert(userClaimed + amount <= pool.MaxClaimPerUser, "exceeds max claim");

            byte[] userClaimKey = Helper.Concat(
                Helper.Concat(PREFIX_USER_CLAIMED, beneficiary),
                (ByteString)poolId.ToByteArray());
            Storage.Put(Storage.CurrentContext, userClaimKey, userClaimed + amount);

            pool.RemainingAmount -= amount;
            pool.TotalClaimed += amount;
            pool.ClaimCount += 1;

            if (pool.RemainingAmount == 0)
            {
                pool.Active = false;
                BigInteger activePools = GetActivePoolCount();
                Storage.Put(Storage.CurrentContext, PREFIX_ACTIVE_POOLS, activePools - 1);
                OnPoolDepleted(poolId, pool.TotalClaimed);
            }
            StorePool(poolId, pool);

            bool transferred = GAS.Transfer(Runtime.ExecutingScriptHash, beneficiary, amount);
            ExecutionEngine.Assert(transferred, "GAS transfer failed");

            UpdateBeneficiaryStatsOnClaim(beneficiary, amount, poolId);
            UpdateSponsorStatsOnClaim(pool.Sponsor);

            BigInteger totalClaimed = GetTotalClaimed();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_CLAIMED, totalClaimed + amount);

            OnSponsorshipClaimed(beneficiary, amount, poolId);
        }

        /// <summary>
        /// Withdraw remaining funds from a pool (sponsor only).
        /// </summary>
        public static void WithdrawPool(UInt160 sponsor, BigInteger poolId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(sponsor), "unauthorized");

            PoolData pool = GetPoolData(poolId);
            ExecutionEngine.Assert(pool.Sponsor == sponsor, "not pool sponsor");
            ExecutionEngine.Assert(pool.RemainingAmount > 0, "no funds to withdraw");

            BigInteger refundAmount = pool.RemainingAmount;

            if (pool.Active)
            {
                BigInteger activePools = GetActivePoolCount();
                Storage.Put(Storage.CurrentContext, PREFIX_ACTIVE_POOLS, activePools - 1);
            }
            pool.Active = false;
            pool.RemainingAmount = 0;
            StorePool(poolId, pool);

            bool transferred = GAS.Transfer(Runtime.ExecutingScriptHash, sponsor, refundAmount);
            ExecutionEngine.Assert(transferred, "GAS transfer failed");

            OnPoolRefunded(poolId, sponsor, refundAmount);
        }

        /// <summary>
        /// Add user to pool whitelist (sponsor only).
        /// </summary>
        public static void AddToWhitelist(BigInteger poolId, UInt160 user)
        {
            ValidateNotGloballyPaused(APP_ID);

            PoolData pool = GetPoolData(poolId);
            ExecutionEngine.Assert(pool.Sponsor != UInt160.Zero, "pool not found");
            ExecutionEngine.Assert(pool.PoolType == 2, "not whitelist pool");
            ExecutionEngine.Assert(Runtime.CheckWitness(pool.Sponsor), "not sponsor");
            ValidateAddress(user);

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_WHITELIST, (ByteString)poolId.ToByteArray()),
                user);
            Storage.Put(Storage.CurrentContext, key, 1);

            OnWhitelistUpdated(poolId, user, true);
        }

        /// <summary>
        /// Remove user from pool whitelist (sponsor only).
        /// </summary>
        public static void RemoveFromWhitelist(BigInteger poolId, UInt160 user)
        {
            ValidateNotGloballyPaused(APP_ID);

            PoolData pool = GetPoolData(poolId);
            ExecutionEngine.Assert(pool.Sponsor != UInt160.Zero, "pool not found");
            ExecutionEngine.Assert(pool.PoolType == 2, "not whitelist pool");
            ExecutionEngine.Assert(Runtime.CheckWitness(pool.Sponsor), "not sponsor");

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_WHITELIST, (ByteString)poolId.ToByteArray()),
                user);
            Storage.Delete(Storage.CurrentContext, key);

            OnWhitelistUpdated(poolId, user, false);
        }

        /// <summary>
        /// Top up an existing pool.
        /// </summary>
        public static void TopUpPool(UInt160 sponsor, BigInteger poolId, BigInteger amount)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(sponsor), "unauthorized");
            ExecutionEngine.Assert(amount >= TOP_UP_MIN, "amount too low");

            PoolData pool = GetPoolData(poolId);
            ExecutionEngine.Assert(pool.Sponsor == sponsor, "not pool sponsor");
            ExecutionEngine.Assert(pool.Active, "pool not active");

            bool transferred = GAS.Transfer(sponsor, Runtime.ExecutingScriptHash, amount);
            ExecutionEngine.Assert(transferred, "GAS transfer failed");

            pool.RemainingAmount += amount;
            pool.InitialAmount += amount;
            StorePool(poolId, pool);

            UpdateSponsorStatsOnTopUp(sponsor, amount);

            BigInteger totalSponsored = GetTotalSponsored();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_SPONSORED, totalSponsored + amount);
        }

        /// <summary>
        /// Extend pool expiry time.
        /// </summary>
        public static void ExtendPoolExpiry(BigInteger poolId, BigInteger newExpiry)
        {
            ValidateNotGloballyPaused(APP_ID);

            PoolData pool = GetPoolData(poolId);
            ExecutionEngine.Assert(pool.Sponsor != UInt160.Zero, "pool not found");
            ExecutionEngine.Assert(Runtime.CheckWitness(pool.Sponsor), "not sponsor");
            ExecutionEngine.Assert(newExpiry > pool.ExpiryTime, "must extend");

            pool.ExpiryTime = newExpiry;
            StorePool(poolId, pool);

            OnPoolExtended(poolId, newExpiry);
        }

        #endregion

        #region NEP-17 Receiver

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            // Accept GAS deposits for sponsorship pools
        }

        #endregion

        #region Automation

        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            if (payload != null && payload.Length > 0)
            {
                BigInteger[] poolIds = (BigInteger[])StdLib.Deserialize(payload);
                foreach (BigInteger poolId in poolIds)
                {
                    try
                    {
                        ProcessExpiredPool(poolId);
                    }
                    catch { }
                }
            }
        }

        private static void ProcessExpiredPool(BigInteger poolId)
        {
            PoolData pool = GetPoolData(poolId);
            if (pool.Active && Runtime.Time >= pool.ExpiryTime && pool.RemainingAmount > 0)
            {
                BigInteger refundAmount = pool.RemainingAmount;

                BigInteger activePools = GetActivePoolCount();
                Storage.Put(Storage.CurrentContext, PREFIX_ACTIVE_POOLS, activePools - 1);

                pool.Active = false;
                pool.RemainingAmount = 0;
                StorePool(poolId, pool);

                SponsorStats stats = GetSponsorStats(pool.Sponsor);
                stats.ActivePools -= 1;
                StoreSponsorStats(pool.Sponsor, stats);

                GAS.Transfer(Runtime.ExecutingScriptHash, pool.Sponsor, refundAmount);

                OnPoolRefunded(poolId, pool.Sponsor, refundAmount);
            }
        }

        #endregion
    }
}
