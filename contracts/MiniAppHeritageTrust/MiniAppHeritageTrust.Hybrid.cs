using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHeritageTrust
    {
        #region Hybrid Mode - Frontend Calculation Support

        /// <summary>
        /// Get trust constants for frontend status derivation.
        /// </summary>
        [Safe]
        public static Map<string, object> GetTrustConstants()
        {
            Map<string, object> constants = new Map<string, object>();
            constants["gracePeriodSeconds"] = GRACE_PERIOD_SECONDS;
            constants["minPrincipal"] = MIN_PRINCIPAL;
            constants["currentTime"] = Runtime.Time;
            return constants;
        }

        /// <summary>
        /// Get raw trust data without status derivation.
        /// Frontend calculates: status, remainingTime, isInGracePeriod
        /// </summary>
        [Safe]
        public static Map<string, object> GetTrustRaw(BigInteger trustId)
        {
            Trust trust = GetTrust(trustId);
            Map<string, object> data = new Map<string, object>();
            if (trust.Owner == UInt160.Zero) return data;

            data["id"] = trustId;
            data["owner"] = trust.Owner;
            data["primaryHeir"] = trust.PrimaryHeir;
            data["principal"] = trust.Principal;
            data["accruedYield"] = trust.AccruedYield;
            data["claimedYield"] = trust.ClaimedYield;
            data["createdTime"] = trust.CreatedTime;
            data["lastHeartbeat"] = trust.LastHeartbeat;
            data["heartbeatInterval"] = trust.HeartbeatInterval;
            data["deadline"] = trust.Deadline;
            data["active"] = trust.Active;
            data["executed"] = trust.Executed;
            data["cancelled"] = trust.Cancelled;
            data["trustName"] = trust.TrustName;
            data["notes"] = trust.Notes;

            return data;
        }

        #endregion
    }
}
