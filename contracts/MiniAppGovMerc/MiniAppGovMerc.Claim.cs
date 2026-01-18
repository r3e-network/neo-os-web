using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGovMerc
    {
        #region Claim and Settle Methods

        /// <summary>
        /// Claim accumulated rewards from settled epochs.
        /// </summary>
        public static void ClaimRewards(UInt160 depositor)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(depositor), "unauthorized");

            BigInteger rewards = GetPendingRewards(depositor);
            ExecutionEngine.Assert(rewards > 0, "no rewards");

            byte[] rewardKey = Helper.Concat(PREFIX_USER_REWARDS, depositor);
            Storage.Put(Storage.CurrentContext, rewardKey, 0);

            Deposit deposit = GetDeposit(depositor);
            deposit.LastClaimEpoch = GetCurrentEpochId();
            StoreDeposit(depositor, deposit);

            GAS.Transfer(Runtime.ExecutingScriptHash, depositor, rewards);

            OnRewardClaimed(depositor, deposit.LastClaimEpoch, rewards);
        }

        #endregion
    }
}
