using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppBurnLeague
    {
        #region User Methods

        /// <summary>
        /// Burn GAS to earn points in current season.
        /// </summary>
        public static void BurnGas(UInt160 burner, BigInteger amount, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(amount >= MIN_BURN, "min 0.1 GAS");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(burner), "unauthorized");

            ValidatePaymentReceipt(APP_ID, burner, amount, receiptId);

            BigInteger seasonId = CurrentSeasonId();
            ExecutionEngine.Assert(seasonId > 0, "no active season");

            Season season = GetSeason(seasonId);
            ExecutionEngine.Assert(season.Active, "season not active");

            // Check if new burner
            BurnerStats stats = GetBurnerStats(burner);
            bool isNewBurner = stats.JoinTime == 0;

            // Calculate points with tier multiplier
            BigInteger points = CalculatePoints(amount);
            bool isTier3 = amount >= TIER3_THRESHOLD;

            // Apply streak bonus
            points = ApplyStreakBonus(burner, points);

            // Update user season data
            UpdateUserSeasonData(burner, seasonId, amount, points);

            // Update global stats
            BigInteger totalBurned = TotalBurned();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BURNED, totalBurned + amount);

            // Update season stats
            season.TotalBurned += amount;
            StoreSeason(seasonId, season);

            // Update burner stats
            UpdateBurnerStats(burner, amount, points, isNewBurner, isTier3);

            OnGasBurned(burner, amount, seasonId);
        }

        #endregion
    }
}
