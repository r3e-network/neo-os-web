using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHallOfFame
    {
        #region Season Query

        [Safe]
        public static Map<string, object> GetSeasonDetails(BigInteger seasonId)
        {
            Season season = GetSeason(seasonId);
            Map<string, object> details = new Map<string, object>();

            details["id"] = season.Id;
            details["startTime"] = season.StartTime;
            details["endTime"] = season.EndTime;
            details["totalVotes"] = season.TotalVotes;
            details["voterCount"] = season.VoterCount;
            details["active"] = season.Active;
            details["settled"] = season.Settled;

            if (season.Active && season.EndTime > 0)
            {
                BigInteger remaining = season.EndTime - Runtime.Time;
                details["remainingTime"] = remaining > 0 ? remaining : 0;
            }

            return details;
        }

        #endregion
    }
}
