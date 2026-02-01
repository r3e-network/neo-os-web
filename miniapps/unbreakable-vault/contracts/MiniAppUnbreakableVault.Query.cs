using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppUnbreakableVault
    {
        #region Query Methods

        [Safe]
        public static Map<string, object> GetVaultDetails(BigInteger vaultId)
        {
            VaultData vault = GetVault(vaultId);
            Map<string, object> details = new Map<string, object>();
            if (vault.Creator == UInt160.Zero) return details;

            details["id"] = vaultId;
            details["creator"] = vault.Creator;
            details["bounty"] = vault.Bounty;
            details["attemptCount"] = vault.AttemptCount;
            details["difficulty"] = vault.Difficulty;
            details["difficultyName"] = GetDifficultyName(vault.Difficulty);
            details["attemptFee"] = GetAttemptFee(vault.Difficulty);
            details["createdTime"] = vault.CreatedTime;
            details["expiryTime"] = vault.ExpiryTime;
            details["hintsRevealed"] = vault.HintsRevealed;
            details["broken"] = vault.Broken;
            details["expired"] = vault.Expired;
            details["winner"] = vault.Winner;
            details["title"] = vault.Title;
            details["description"] = vault.Description;

            if (vault.Broken)
                details["status"] = "broken";
            else if (vault.Expired)
                details["status"] = "expired";
            else if (Runtime.Time >= vault.ExpiryTime)
                details["status"] = "claimable";
            else
            {
                details["status"] = "active";
                BigInteger remaining = vault.ExpiryTime - Runtime.Time;
                details["remainingTime"] = remaining;
                details["remainingDays"] = remaining / 86400;
            }

            return details;
        }

        [Safe]
        public static string GetDifficultyName(BigInteger difficulty)
        {
            if (difficulty == 1) return "Easy";
            if (difficulty == 2) return "Medium";
            return "Hard";
        }

        [Safe]
        public static Map<string, object> GetHackerStatsDetails(UInt160 hacker)
        {
            HackerStats stats = GetHackerStats(hacker);
            Map<string, object> details = new Map<string, object>();

            details["vaultsBroken"] = stats.VaultsBroken;
            details["totalEarned"] = stats.TotalEarned;
            details["totalAttempts"] = stats.TotalAttempts;
            details["highestBounty"] = stats.HighestBounty;
            details["badgeCount"] = stats.BadgeCount;
            details["joinTime"] = stats.JoinTime;
            details["lastActivityTime"] = stats.LastActivityTime;
            details["easyBroken"] = stats.EasyBroken;
            details["mediumBroken"] = stats.MediumBroken;
            details["hardBroken"] = stats.HardBroken;

            if (stats.TotalAttempts > 0)
                details["successRate"] = stats.VaultsBroken * 10000 / stats.TotalAttempts;

            details["hasFirstBreak"] = HasHackerBadge(hacker, 1);
            details["hasPersistent"] = HasHackerBadge(hacker, 2);
            details["hasVaultCrusher"] = HasHackerBadge(hacker, 3);
            details["hasEliteHacker"] = HasHackerBadge(hacker, 4);
            details["hasHardcoreHacker"] = HasHackerBadge(hacker, 5);
            details["hasBigEarner"] = HasHackerBadge(hacker, 6);

            return details;
        }

        [Safe]
        public static Map<string, object> GetCreatorStatsDetails(UInt160 creator)
        {
            CreatorStats stats = GetCreatorStats(creator);
            Map<string, object> details = new Map<string, object>();

            details["vaultsCreated"] = stats.VaultsCreated;
            details["vaultsBroken"] = stats.VaultsBroken;
            details["vaultsExpired"] = stats.VaultsExpired;
            details["totalBountiesPosted"] = stats.TotalBountiesPosted;
            details["totalBountiesLost"] = stats.TotalBountiesLost;
            details["totalRefunded"] = stats.TotalRefunded;
            details["highestBounty"] = stats.HighestBounty;
            details["badgeCount"] = stats.BadgeCount;
            details["joinTime"] = stats.JoinTime;
            details["lastActivityTime"] = stats.LastActivityTime;

            if (stats.VaultsCreated > 0)
                details["unbreakableRate"] = stats.VaultsExpired * 10000 / stats.VaultsCreated;

            details["hasFirstVault"] = HasCreatorBadge(creator, 1);
            details["hasBountyMaster"] = HasCreatorBadge(creator, 2);
            details["hasUnbreakable"] = HasCreatorBadge(creator, 3);
            details["hasHighRoller"] = HasCreatorBadge(creator, 4);
            details["hasVaultArchitect"] = HasCreatorBadge(creator, 5);

            return details;
        }

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalVaults"] = TotalVaults();
            stats["totalBounties"] = TotalBounties();
            stats["totalBroken"] = TotalBroken();
            stats["totalHackers"] = TotalHackers();
            stats["totalCreators"] = TotalCreators();
            stats["totalAttempts"] = TotalAttempts();

            stats["minBounty"] = MIN_BOUNTY;
            stats["attemptFeeEasy"] = ATTEMPT_FEE_EASY;
            stats["attemptFeeMedium"] = ATTEMPT_FEE_MEDIUM;
            stats["attemptFeeHard"] = ATTEMPT_FEE_HARD;
            stats["platformFeeBps"] = PLATFORM_FEE_BPS;
            stats["defaultExpirySeconds"] = DEFAULT_EXPIRY_SECONDS;
            stats["maxHints"] = MAX_HINTS;

            return stats;
        }

        #endregion
    }
}
