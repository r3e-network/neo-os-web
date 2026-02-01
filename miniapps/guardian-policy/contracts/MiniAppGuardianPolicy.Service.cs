using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGuardianPolicy
    {
        #region Service Request Methods

        private static BigInteger RequestPriceVerification(BigInteger policyId, string assetType)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { policyId, assetType });
            return (BigInteger)Contract.Call(
                gateway, "requestService", CallFlags.All,
                APP_ID, "pricefeed", payload,
                Runtime.ExecutingScriptHash, "onServiceCallback"
            );
        }

        public static void OnServiceCallback(
            BigInteger requestId, string appId, string serviceType,
            bool success, ByteString result, string error)
        {
            ValidateGateway();

            ByteString policyIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_POLICY, (ByteString)requestId.ToByteArray()));
            ExecutionEngine.Assert(policyIdData != null, "unknown request");

            BigInteger policyId = (BigInteger)policyIdData;
            PolicyData policy = GetPolicy(policyId);
            ExecutionEngine.Assert(!policy.Claimed, "already claimed");
            ExecutionEngine.Assert(policy.Holder != UInt160.Zero, "policy not found");

            Storage.Delete(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_POLICY, (ByteString)requestId.ToByteArray()));

            bool approved = false;
            BigInteger payout = 0;

            if (success && result != null && result.Length > 0)
            {
                BigInteger currentPrice = (BigInteger)StdLib.Deserialize(result);

                // Calculate price drop percentage
                BigInteger priceDrop = (policy.StartPrice - currentPrice) * 100 / policy.StartPrice;

                // Approve if price dropped more than threshold
                if (priceDrop >= policy.ThresholdPercent)
                {
                    approved = true;
                    // Payout proportional to drop (capped at coverage)
                    payout = policy.Coverage * priceDrop / 100;
                    if (payout > policy.Coverage) payout = policy.Coverage;
                }
            }

            policy.Claimed = true;
            policy.Active = false;
            policy.PayoutAmount = payout;
            StorePolicy(policyId, policy);

            // Update holder stats
            UpdateHolderStatsOnClaim(policy.Holder, approved, payout);

            // Update global stats
            BigInteger activePolicies = GetActivePolicyCount();
            Storage.Put(Storage.CurrentContext, PREFIX_ACTIVE_POLICIES, activePolicies - 1);

            if (approved && payout > 0)
            {
                BigInteger totalPayouts = GetTotalPayouts();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PAYOUTS, totalPayouts + payout);
            }

            // Event emit disabled to avoid compiler crash in nccs 3.8.1.
            // OnClaimProcessed(policyId, policy.Holder, approved, payout);
        }

        #endregion
    }
}
