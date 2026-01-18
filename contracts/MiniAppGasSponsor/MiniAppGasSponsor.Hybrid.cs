using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGasSponsor
    {
        #region Hybrid Mode - Frontend Calculation Support

        /// <summary>
        /// Get sponsor constants for frontend status derivation.
        /// </summary>
        [Safe]
        public static Map<string, object> GetSponsorConstants()
        {
            Map<string, object> constants = new Map<string, object>();
            constants["minSponsorship"] = MIN_SPONSORSHIP;
            constants["maxClaimPerTx"] = MAX_CLAIM_PER_TX;
            constants["currentTime"] = Runtime.Time;
            return constants;
        }

        /// <summary>
        /// Get raw pool data without status derivation.
        /// Frontend calculates: status, remainingTime
        /// </summary>
        [Safe]
        public static Map<string, object> GetPoolRaw(BigInteger poolId)
        {
            PoolData pool = GetPoolData(poolId);
            Map<string, object> data = new Map<string, object>();
            if (pool.Sponsor == UInt160.Zero) return data;

            data["id"] = poolId;
            data["sponsor"] = pool.Sponsor;
            data["initialAmount"] = pool.InitialAmount;
            data["remainingAmount"] = pool.RemainingAmount;
            data["expiryTime"] = pool.ExpiryTime;
            data["maxClaimPerUser"] = pool.MaxClaimPerUser;
            data["active"] = pool.Active;
            data["createTime"] = pool.CreateTime;

            return data;
        }

        #endregion
    }
}
