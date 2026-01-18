using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppBurnLeague
    {
        #region Admin Methods

        /// <summary>
        /// Start a new season.
        /// </summary>
        public static BigInteger StartSeason()
        {
            ValidateAdmin();

            BigInteger currentId = CurrentSeasonId();
            if (currentId > 0)
            {
                Season current = GetSeason(currentId);
                ExecutionEngine.Assert(!current.Active, "season still active");
            }

            BigInteger newSeasonId = currentId + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_SEASON_ID, newSeasonId);

            Season season = new Season
            {
                Id = newSeasonId,
                StartTime = Runtime.Time,
                EndTime = Runtime.Time + SEASON_DURATION_SECONDS,
                TotalBurned = 0,
                TotalParticipants = 0,
                RewardPool = RewardPool(),
                Active = true,
                Finalized = false,
                Winner = UInt160.Zero
            };
            StoreSeason(newSeasonId, season);

            OnSeasonStarted(newSeasonId, season.StartTime, season.EndTime);
            return newSeasonId;
        }

        /// <summary>
        /// End current season and finalize rewards.
        /// </summary>
        public static void EndSeason()
        {
            BigInteger seasonId = CurrentSeasonId();
            ExecutionEngine.Assert(seasonId > 0, "no season");

            Season season = GetSeason(seasonId);
            ExecutionEngine.Assert(season.Active, "not active");
            ExecutionEngine.Assert(Runtime.Time >= season.EndTime, "not ended");

            season.Active = false;
            season.Finalized = true;
            StoreSeason(seasonId, season);

            OnSeasonEnded(seasonId, season.Winner, season.TotalBurned);
        }

        /// <summary>
        /// Fund the reward pool.
        /// </summary>
        public static void FundRewardPool(UInt160 funder, BigInteger amount, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(amount > 0, "invalid amount");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(funder), "unauthorized");

            ValidatePaymentReceipt(APP_ID, funder, amount, receiptId);

            BigInteger pool = RewardPool();
            Storage.Put(Storage.CurrentContext, PREFIX_REWARD_POOL, pool + amount);
        }

        #endregion
    }
}
