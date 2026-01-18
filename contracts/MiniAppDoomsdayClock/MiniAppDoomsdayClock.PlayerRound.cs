using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDoomsdayClock
    {
        #region Player Round Query

        [Safe]
        public static Map<string, object> GetPlayerRoundDetails(UInt160 player, BigInteger roundId)
        {
            Map<string, object> details = new Map<string, object>();

            BigInteger playerKeys = GetPlayerKeys(player, roundId);
            Round round = GetRound(roundId);

            details["roundId"] = roundId;
            details["playerKeys"] = playerKeys;
            details["roundTotalKeys"] = round.TotalKeys;
            details["roundPot"] = round.Pot;
            details["roundActive"] = round.Active;
            details["roundSettled"] = round.Settled;

            if (round.TotalKeys > 0 && playerKeys > 0)
            {
                details["keyShare"] = playerKeys * 10000 / round.TotalKeys;
            }

            details["isLastBuyer"] = round.LastBuyer == player;
            details["isWinner"] = round.Winner == player;

            if (round.Winner == player)
            {
                details["prizeWon"] = round.WinnerPrize;
            }

            return details;
        }

        #endregion
    }
}
