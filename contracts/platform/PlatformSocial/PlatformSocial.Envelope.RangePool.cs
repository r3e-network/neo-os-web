using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public partial class PlatformSocialContract
    {
        /// <summary>
        /// Create a GAS reward pool where each claimer receives a random amount
        /// inside [minClaimAmount, maxClaimAmount].
        /// </summary>
        public static BigInteger CreateRangeGasPool(
            string appId,
            UInt160 creator,
            BigInteger totalAmount,
            BigInteger minClaimAmount,
            BigInteger maxClaimAmount,
            BigInteger maxClaims,
            BigInteger expiryMs)
        {
            ValidateAppNotPaused(appId);
            ValidateAppRegistered(appId, APP_TYPE_ENVELOPE);
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "unauthorized");
            ExecutionEngine.Assert(creator != UInt160.Zero && creator.IsValid, "invalid creator");
            ExecutionEngine.Assert(totalAmount >= MIN_RANGE_POOL_AMOUNT, "min 0.1 GAS");
            ExecutionEngine.Assert(minClaimAmount > 0, "min claim required");
            ExecutionEngine.Assert(minClaimAmount <= maxClaimAmount, "invalid claim range");
            ExecutionEngine.Assert(maxClaims > 0 && maxClaims <= MAX_PACKETS, "1-100 claims");
            // expiryMs is the lifetime in milliseconds (Runtime.Time is ms on Neo N3).
            ExecutionEngine.Assert(expiryMs > 0, "expiry required");
            ExecutionEngine.Assert(totalAmount >= minClaimAmount * maxClaims, "pool below minimum claims");
            ExecutionEngine.Assert(totalAmount <= maxClaimAmount * maxClaims, "pool exceeds maximum claims");

            ConsumeGasCredit(appId, creator, totalAmount);

            ByteString idKey = AppKey(appId, PREFIX_RANGE_POOL_ID);
            BigInteger poolId = GetBigInteger(idKey) + 1;
            Put(idKey, poolId);

            RangeGasPoolData pool = new RangeGasPoolData
            {
                Creator = creator,
                TotalAmount = totalAmount,
                MinClaimAmount = minClaimAmount,
                MaxClaimAmount = maxClaimAmount,
                MaxClaims = maxClaims,
                ClaimedCount = 0,
                RemainingAmount = totalAmount,
                BestLuckAddress = UInt160.Zero,
                BestLuckAmount = 0,
                ExpiryTime = Runtime.Time + (ulong)expiryMs,
                Active = true
            };
            StoreRangeGasPool(appId, poolId, pool);

            OnRangeGasPoolCreated(appId, poolId, creator, totalAmount, minClaimAmount, maxClaimAmount, maxClaims);
            return poolId;
        }

        /// <summary>
        /// Claim once from a bounded GAS reward pool.
        /// </summary>
        public static BigInteger ClaimRangeGasPool(string appId, BigInteger poolId, UInt160 claimer)
        {
            ValidateAppNotPaused(appId);
            ValidateAppRegistered(appId, APP_TYPE_ENVELOPE);
            ExecutionEngine.Assert(Runtime.CheckWitness(claimer), "unauthorized");
            ExecutionEngine.Assert(claimer != UInt160.Zero && claimer.IsValid, "invalid claimer");

            RangeGasPoolData pool = GetRangeGasPool(appId, poolId);
            ExecutionEngine.Assert(pool.Creator != UInt160.Zero, "pool not found");
            ExecutionEngine.Assert(pool.Active, "pool inactive");
            ExecutionEngine.Assert(Runtime.Time <= (ulong)pool.ExpiryTime, "pool expired");
            ExecutionEngine.Assert(pool.ClaimedCount < pool.MaxClaims, "pool empty");

            ByteString claimerKey = AppKey(appId, PREFIX_RANGE_CLAIMER, poolId, claimer);
            ExecutionEngine.Assert(GetRaw(claimerKey) == null, "already claimed");

            BigInteger amount = NextRangeGasPoolAmount(pool, poolId, claimer);
            ExecutionEngine.Assert(amount >= pool.MinClaimAmount, "claim below minimum");
            ExecutionEngine.Assert(amount <= pool.MaxClaimAmount, "claim above maximum");
            ExecutionEngine.Assert(amount <= pool.RemainingAmount, "insufficient pool");

            Put(claimerKey, amount);

            pool.ClaimedCount += 1;
            pool.RemainingAmount -= amount;
            if (amount > pool.BestLuckAmount)
            {
                pool.BestLuckAddress = claimer;
                pool.BestLuckAmount = amount;
            }

            BigInteger remainingClaims = pool.MaxClaims - pool.ClaimedCount;
            if (remainingClaims == 0)
            {
                ExecutionEngine.Assert(pool.RemainingAmount == 0, "pool remainder invalid");
                pool.Active = false;
            }

            StoreRangeGasPool(appId, poolId, pool);

            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, claimer, amount),
                "claim payout failed");
            EnsureGasCreditSolvent();

            OnRangeGasPoolClaimed(appId, poolId, claimer, amount, pool.RemainingAmount, remainingClaims);
            if (remainingClaims == 0)
            {
                OnRangeGasPoolCompleted(appId, poolId, pool.BestLuckAddress, pool.BestLuckAmount);
            }

            return amount;
        }

        /// <summary>
        /// Add more GAS to an active range reward pool.
        /// </summary>
        public static BigInteger FundRangeGasPool(string appId, BigInteger poolId, UInt160 creator, BigInteger amount)
        {
            ValidateAppNotPaused(appId);
            ValidateAppRegistered(appId, APP_TYPE_ENVELOPE);
            ExecutionEngine.Assert(creator != UInt160.Zero && creator.IsValid, "invalid creator");
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "unauthorized");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            RangeGasPoolData pool = GetRangeGasPool(appId, poolId);
            ExecutionEngine.Assert(pool.Creator != UInt160.Zero, "pool not found");
            ExecutionEngine.Assert(pool.Creator == creator, "creator mismatch");
            ExecutionEngine.Assert(pool.Active, "pool inactive");
            ExecutionEngine.Assert(Runtime.Time <= (ulong)pool.ExpiryTime, "pool expired");
            ExecutionEngine.Assert(pool.ClaimedCount < pool.MaxClaims, "pool empty");

            BigInteger remainingClaims = pool.MaxClaims - pool.ClaimedCount;
            BigInteger maxRemainingCapacity = remainingClaims * pool.MaxClaimAmount;
            ExecutionEngine.Assert(pool.RemainingAmount + amount <= maxRemainingCapacity, "pool exceeds maximum claims");

            ConsumeGasCredit(appId, creator, amount);

            pool.TotalAmount += amount;
            pool.RemainingAmount += amount;
            StoreRangeGasPool(appId, poolId, pool);

            OnRangeGasPoolFunded(appId, poolId, creator, amount, pool.TotalAmount, pool.RemainingAmount);
            return pool.RemainingAmount;
        }

        /// <summary>
        /// Refund remaining GAS after a pool expires or completes.
        /// </summary>
        public static BigInteger RefundRangeGasPool(string appId, BigInteger poolId)
        {
            ValidateAppNotPaused(appId);
            ValidateAppRegistered(appId, APP_TYPE_ENVELOPE);

            RangeGasPoolData pool = GetRangeGasPool(appId, poolId);
            ExecutionEngine.Assert(pool.Creator != UInt160.Zero, "pool not found");
            ExecutionEngine.Assert(Runtime.CheckWitness(pool.Creator), "unauthorized");
            ExecutionEngine.Assert(pool.RemainingAmount > 0, "nothing to refund");
            ExecutionEngine.Assert(Runtime.Time > (ulong)pool.ExpiryTime || !pool.Active, "pool still active");

            BigInteger refund = pool.RemainingAmount;
            pool.RemainingAmount = 0;
            pool.Active = false;
            StoreRangeGasPool(appId, poolId, pool);

            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, pool.Creator, refund),
                "refund failed");
            EnsureGasCreditSolvent();

            OnRangeGasPoolRefunded(appId, poolId, pool.Creator, refund);
            return refund;
        }
    }
}
