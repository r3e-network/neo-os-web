using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        #region Claim Rewards

        public static void ClaimRewards(UInt160 user)
        {
            ValidateUserOrAbstractAccount(user);
            ValidateNotPaused();
            ValidateAddress(user);

            BigInteger unclaimed = GetUserUnclaimed(user);
            ExecutionEngine.Assert(unclaimed > 0, "no rewards");

            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, user, unclaimed),
                "transfer failed");

            BigInteger claimed = GetUserClaimed(user);
            SetUserClaimed(user, claimed + unclaimed);
            SetUserUnclaimed(user, 0);

            IncrementTotalRewarded(unclaimed);

            OnRewardsClaimed(user, unclaimed, claimed + unclaimed);
        }

        #endregion
    }
}
