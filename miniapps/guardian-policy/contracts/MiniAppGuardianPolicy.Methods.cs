using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGuardianPolicy
    {
        #region User-Facing Methods

        /// <summary>
        /// Create a new insurance policy with policy type.
        /// </summary>
        public static BigInteger CreatePolicy(UInt160 holder, string assetType, BigInteger policyType, BigInteger coverage, BigInteger startPrice, BigInteger thresholdPercent, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(holder), "unauthorized");
            ExecutionEngine.Assert(assetType != null && assetType.Length > 0, "asset type required");
            ExecutionEngine.Assert(policyType >= 1 && policyType <= 3, "invalid policy type");
            ExecutionEngine.Assert(coverage >= MIN_COVERAGE && coverage <= MAX_COVERAGE, "coverage out of range");
            ExecutionEngine.Assert(startPrice > 0, "start price required");
            ExecutionEngine.Assert(thresholdPercent > 0 && thresholdPercent <= MAX_THRESHOLD_PERCENT, "threshold 1-50%");

            BigInteger premium = coverage * PREMIUM_RATE_PERCENT / 100;
            ValidatePaymentReceipt(APP_ID, holder, premium, receiptId);

            // Check if new holder
            HolderStats stats = GetHolderStats(holder);
            bool isNewHolder = stats.JoinTime == 0;

            BigInteger policyId = GetPolicyCount() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_POLICY_ID, policyId);

            PolicyData policy = new PolicyData
            {
                Holder = holder,
                AssetType = assetType,
                PolicyType = policyType,
                Coverage = coverage,
                Premium = premium,
                StartPrice = startPrice,
                ThresholdPercent = thresholdPercent,
                StartTime = (BigInteger)Runtime.Time,
                EndTime = (BigInteger)Runtime.Time + (BigInteger)POLICY_DURATION_SECONDS,
                RenewalCount = 0,
                Active = true,
                Claimed = false,
                PayoutAmount = 0
            };
            StorePolicy(policyId, policy);

            // Update holder stats
            UpdateHolderStatsOnCreate(holder, coverage, premium, isNewHolder);

            // Update global stats
            BigInteger totalCoverage = GetTotalCoverage();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_COVERAGE, totalCoverage + coverage);

            BigInteger totalPremiums = GetTotalPremiums();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PREMIUMS, totalPremiums + premium);

            BigInteger activePolicies = GetActivePolicyCount();
            Storage.Put(Storage.CurrentContext, PREFIX_ACTIVE_POLICIES, activePolicies + 1);

            // Check badges
            CheckHolderBadges(holder);

            // Event emit disabled to avoid compiler crash in nccs 3.8.1.
            // OnPolicyCreated(policyId, holder, assetType, coverage);
            // OnPremiumPaid(holder, policyId, premium);
            return policyId;
        }

        /// <summary>
        /// Renew an existing policy.
        /// </summary>
        public static void RenewPolicy(BigInteger policyId, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            PolicyData policy = GetPolicy(policyId);
            ExecutionEngine.Assert(policy.Holder != UInt160.Zero, "policy not found");
            ExecutionEngine.Assert(Runtime.CheckWitness(policy.Holder), "unauthorized");
            ExecutionEngine.Assert(!policy.Claimed, "policy claimed");

            // Allow renewal within grace period after expiry
            ulong currentTime = Runtime.Time;
            ExecutionEngine.Assert(currentTime <= (ulong)policy.EndTime + RENEWAL_GRACE_PERIOD_SECONDS, "renewal period expired");

            BigInteger premium = policy.Coverage * PREMIUM_RATE_PERCENT / 100;
            ValidatePaymentReceipt(APP_ID, policy.Holder, premium, receiptId);

            // Extend policy
            policy.EndTime = (BigInteger)currentTime + (BigInteger)POLICY_DURATION_SECONDS;
            policy.RenewalCount += 1;
            policy.Active = true;
            StorePolicy(policyId, policy);

            // Update stats
            HolderStats stats = GetHolderStats(policy.Holder);
            stats.TotalPremiumsPaid += premium;
            StoreHolderStats(policy.Holder, stats);

            BigInteger totalPremiums = GetTotalPremiums();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PREMIUMS, totalPremiums + premium);

            // Event emit disabled to avoid compiler crash in nccs 3.8.1.
            // OnPolicyRenewed(policyId, policy.Holder, policy.EndTime);
            // OnPremiumPaid(policy.Holder, policyId, premium);
        }

        /// <summary>
        /// Cancel a policy early (with fee).
        /// </summary>
        public static void CancelPolicy(BigInteger policyId)
        {
            ValidateNotGloballyPaused(APP_ID);

            PolicyData policy = GetPolicy(policyId);
            ExecutionEngine.Assert(policy.Holder != UInt160.Zero, "policy not found");
            ExecutionEngine.Assert(Runtime.CheckWitness(policy.Holder), "unauthorized");
            ExecutionEngine.Assert(policy.Active, "policy not active");
            ExecutionEngine.Assert(!policy.Claimed, "policy claimed");

            // Calculate refund (minus early cancellation fee)
            BigInteger remainingTime = policy.EndTime - (BigInteger)Runtime.Time;
            BigInteger totalDuration = (BigInteger)POLICY_DURATION_SECONDS;
            BigInteger refundBase = policy.Premium * remainingTime / totalDuration;
            BigInteger fee = refundBase * EARLY_CANCEL_FEE_PERCENT / 100;
            BigInteger refundAmount = refundBase - fee;

            // Deactivate policy
            policy.Active = false;
            StorePolicy(policyId, policy);

            // Update stats
            HolderStats stats = GetHolderStats(policy.Holder);
            stats.ActivePolicies -= 1;
            StoreHolderStats(policy.Holder, stats);

            BigInteger activePolicies = GetActivePolicyCount();
            Storage.Put(Storage.CurrentContext, PREFIX_ACTIVE_POLICIES, activePolicies - 1);

            // Event emit disabled to avoid compiler crash in nccs 3.8.1.
            // OnPolicyCancelled(policyId, policy.Holder, refundAmount);
        }

        /// <summary>
        /// [DEPRECATED] Uses service callback - use InitiateClaim/SettleClaim instead.
        /// InitiateClaim returns policy info, frontend fetches price, SettleClaim verifies.
        /// </summary>
        public static void RequestClaim(BigInteger policyId)
        {
            ValidateNotGloballyPaused(APP_ID);

            PolicyData policy = GetPolicy(policyId);
            ExecutionEngine.Assert(policy.Holder != UInt160.Zero, "policy not found");
            ExecutionEngine.Assert(policy.Active, "policy inactive");
            ExecutionEngine.Assert(!policy.Claimed, "already claimed");
            ExecutionEngine.Assert(Runtime.Time <= (ulong)policy.EndTime, "policy expired");
            ExecutionEngine.Assert(Runtime.CheckWitness(policy.Holder), "unauthorized");

            // Update holder claim count
            HolderStats stats = GetHolderStats(policy.Holder);
            stats.TotalClaims += 1;
            StoreHolderStats(policy.Holder, stats);

            // Request current price from oracle
            BigInteger requestId = RequestPriceVerification(policyId, policy.AssetType);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_POLICY, (ByteString)requestId.ToByteArray()),
                policyId);

            // Event emit disabled to avoid compiler crash in nccs 3.8.1.
            // OnClaimRequested(policyId, requestId);
        }

        #endregion
    }
}
