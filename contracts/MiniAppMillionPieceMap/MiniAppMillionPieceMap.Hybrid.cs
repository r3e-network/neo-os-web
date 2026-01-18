using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppMillionPieceMap
    {
        #region Hybrid Mode - Frontend Calculation Support

        /// <summary>
        /// Get map constants for frontend calculations.
        /// </summary>
        [Safe]
        public static Map<string, object> GetMapConstants()
        {
            Map<string, object> constants = new Map<string, object>();
            constants["regionSize"] = REGION_SIZE;
            constants["piecePrice"] = PIECE_PRICE;
            constants["totalRegions"] = TOTAL_REGIONS;
            return constants;
        }

        /// <summary>
        /// Get raw region data without calculations.
        /// Frontend calculates: completionPercent, coordinates
        /// </summary>
        [Safe]
        public static Map<string, object> GetRegionRaw(BigInteger regionId)
        {
            RegionData region = GetRegion(regionId);
            Map<string, object> data = new Map<string, object>();

            data["id"] = regionId;
            data["claimedPieces"] = region.ClaimedPieces;
            data["totalPieces"] = REGION_SIZE * REGION_SIZE;

            return data;
        }

        #endregion
    }
}
