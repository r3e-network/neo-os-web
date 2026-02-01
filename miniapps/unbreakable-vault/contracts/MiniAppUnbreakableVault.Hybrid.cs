using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppUnbreakableVault
    {
        #region Hybrid Mode - Frontend Calculation Support

        /// <summary>
        /// Get vault constants for frontend calculations.
        /// </summary>
        [Safe]
        public static Map<string, object> GetVaultConstants()
        {
            Map<string, object> constants = new Map<string, object>();
            constants["minBounty"] = MIN_BOUNTY;
            constants["attemptFeeEasy"] = ATTEMPT_FEE_EASY;
            constants["attemptFeeMedium"] = ATTEMPT_FEE_MEDIUM;
            constants["attemptFeeHard"] = ATTEMPT_FEE_HARD;
            constants["platformFeeBps"] = PLATFORM_FEE_BPS;
            constants["defaultExpirySeconds"] = DEFAULT_EXPIRY_SECONDS;
            constants["maxHints"] = MAX_HINTS;
            constants["currentTime"] = Runtime.Time;
            return constants;
        }

        /// <summary>
        /// Get raw vault data without status derivation.
        /// Frontend calculates: status, remainingTime, attemptsLeft
        /// </summary>
        [Safe]
        public static Map<string, object> GetVaultRaw(BigInteger vaultId)
        {
            VaultData vault = GetVault(vaultId);
            Map<string, object> data = new Map<string, object>();
            if (vault.Creator == UInt160.Zero) return data;

            data["id"] = vaultId;
            data["creator"] = vault.Creator;
            data["bounty"] = vault.Bounty;
            data["attemptCount"] = vault.AttemptCount;
            data["difficulty"] = vault.Difficulty;
            data["createdTime"] = vault.CreatedTime;
            data["expiryTime"] = vault.ExpiryTime;
            data["hintsRevealed"] = vault.HintsRevealed;
            data["broken"] = vault.Broken;
            data["expired"] = vault.Expired;
            data["winner"] = vault.Winner;
            data["title"] = vault.Title;
            data["description"] = vault.Description;

            return data;
        }

        /// <summary>
        /// Get raw platform stats without calculations.
        /// Frontend calculates: successRate, unbreakableRate
        /// </summary>
        [Safe]
        public static Map<string, object> GetPlatformStatsRaw()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalVaults"] = TotalVaults();
            stats["totalBroken"] = TotalBroken();
            stats["totalBounties"] = TotalBounties();
            stats["totalAttempts"] = TotalAttempts();
            stats["totalHackers"] = TotalHackers();
            stats["totalCreators"] = TotalCreators();
            return stats;
        }

        #endregion
    }
}
