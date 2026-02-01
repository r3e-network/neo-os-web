using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDailyCheckin
    {
        #region Claim Rewards

        public static void ClaimRewards(UInt160 user)
        {
            ValidateGateway();
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(user);

            BigInteger unclaimed = GetUserUnclaimed(user);
            ExecutionEngine.Assert(unclaimed > 0, "no rewards");

            UInt160 hub = PaymentHub();
            ExecutionEngine.Assert(hub != null && hub.IsValid, "hub not set");

            bool success = (bool)Contract.Call(hub, "TransferReward", CallFlags.All,
                new object[] { user, unclaimed, APP_ID });
            ExecutionEngine.Assert(success, "transfer failed");

            BigInteger claimed = GetUserClaimed(user);
            SetUserClaimed(user, claimed + unclaimed);
            SetUserUnclaimed(user, 0);

            IncrementTotalRewarded(unclaimed);

            OnRewardsClaimed(user, unclaimed, claimed + unclaimed);
        }

        #endregion
    }
}
