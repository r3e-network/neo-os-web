using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCoinFlip
    {
        #region Bet Query

        [Safe]
        public static Map<string, object> GetBetDetails(BigInteger betId)
        {
            BetData bet = GetBet(betId);
            Map<string, object> details = new Map<string, object>();
            if (bet.Player == UInt160.Zero) return details;

            details["id"] = betId;
            details["player"] = bet.Player;
            details["amount"] = bet.Amount;
            details["choice"] = bet.Choice ? "heads" : "tails";
            details["timestamp"] = bet.Timestamp;
            details["resolved"] = bet.Resolved;
            details["won"] = bet.Won;
            details["payout"] = bet.Payout;
            details["streakBonus"] = bet.StreakBonus;

            return details;
        }

        #endregion
    }
}
