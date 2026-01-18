using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGardenOfNeo
    {
        #region Admin Methods

        public static void StartNewSeason(BigInteger seasonType)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(seasonType >= 1 && seasonType <= 4, "invalid season");

            SeasonData current = GetCurrentSeason();
            BigInteger newSeasonId = current.Id + 1;

            BigInteger bonusSeed = SEED_EARTH;
            if (seasonType == 1) bonusSeed = SEED_EARTH;
            else if (seasonType == 2) bonusSeed = SEED_FIRE;
            else if (seasonType == 3) bonusSeed = SEED_WIND;
            else if (seasonType == 4) bonusSeed = SEED_ICE;

            SeasonData season = new SeasonData
            {
                Id = newSeasonId,
                SeasonType = seasonType,
                StartTime = Runtime.Time,
                EndTime = Runtime.Time + SEASON_DURATION_SECONDS,
                BonusSeedType = bonusSeed
            };
            Storage.Put(Storage.CurrentContext, PREFIX_SEASON, StdLib.Serialize(season));

            OnSeasonChanged(newSeasonId, seasonType, Runtime.Time);
        }

        #endregion

        #region Automation

        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            SeasonData season = GetCurrentSeason();
            if (Runtime.Time >= season.EndTime)
            {
                BigInteger nextSeasonType = (season.SeasonType % 4) + 1;
                StartNewSeason(nextSeasonType);
            }
        }

        #endregion
    }
}
