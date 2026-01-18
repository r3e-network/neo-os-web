using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppBurnLeague
    {
        #region Claim Methods

        /// <summary>
        /// Claim rewards from a completed season.
        /// </summary>
        public static void ClaimReward(UInt160 claimer, BigInteger seasonId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(claimer), "unauthorized");

            Season season = GetSeason(seasonId);
            ExecutionEngine.Assert(season.Finalized, "season not finalized");

            BigInteger userPoints = GetUserSeasonPoints(claimer, seasonId);
            ExecutionEngine.Assert(userPoints > 0, "no points");

            // Check if already claimed
            byte[] claimedKey = Helper.Concat(
                Helper.Concat(PREFIX_USER_REWARDS_CLAIMED, claimer),
                (ByteString)seasonId.ToByteArray());
            ExecutionEngine.Assert((BigInteger)Storage.Get(Storage.CurrentContext, claimedKey) == 0, "already claimed");

            // Calculate reward share
            BigInteger totalSeasonPoints = GetSeasonTotalPoints(seasonId);
            BigInteger reward = season.RewardPool * userPoints / totalSeasonPoints;

            if (reward > 0)
            {
                bool success = GAS.Transfer(Runtime.ExecutingScriptHash, claimer, reward);
                ExecutionEngine.Assert(success, "transfer failed");
            }

            // Mark as claimed
            Storage.Put(Storage.CurrentContext, claimedKey, 1);

            OnRewardClaimed(claimer, reward, seasonId);
        }

        #endregion
    }
}
