using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDevTipping
    {
        #region Query Methods

        /// <summary>
        /// Gets detailed information about a developer.
        /// </summary>
        /// <param name="devId">Developer ID.</param>
        /// <returns>Map containing developer details (id, wallet, name, role, bio, link, balance, totalReceived, tipCount, active).</returns>
        [Safe]
        public static Map<string, object> GetDeveloperDetails(BigInteger devId)
        {
            DeveloperData dev = GetDeveloper(devId);
            Map<string, object> details = new Map<string, object>();
            if (dev.Wallet == UInt160.Zero) return details;

            details["id"] = devId;
            details["wallet"] = dev.Wallet;
            details["name"] = dev.Name;
            details["role"] = dev.Role;
            details["bio"] = dev.Bio;
            details["link"] = dev.Link;
            details["balance"] = dev.Balance;
            details["totalReceived"] = dev.TotalReceived;
            details["tipCount"] = dev.TipCount;
            details["active"] = dev.Active;

            return details;
        }

        /// <summary>
        /// Gets detailed information about a tip.
        /// </summary>
        /// <param name="tipId">Tip ID.</param>
        /// <returns>Map containing tip details (id, devId, amount, message, tipperName, timestamp, tipTier, anonymous, tipper).</returns>
        [Safe]
        public static Map<string, object> GetTipDetails(BigInteger tipId)
        {
            TipData tip = GetTip(tipId);
            Map<string, object> details = new Map<string, object>();
            if (tip.DevId == 0) return details;

            details["id"] = tipId;
            details["devId"] = tip.DevId;
            details["amount"] = tip.Amount;
            details["message"] = tip.Message;
            details["tipperName"] = tip.TipperName;
            details["timestamp"] = tip.Timestamp;
            details["tipTier"] = tip.TipTier;
            details["anonymous"] = tip.Anonymous;

            if (!tip.Anonymous)
                details["tipper"] = tip.Tipper;

            return details;
        }

        #endregion
    }
}
