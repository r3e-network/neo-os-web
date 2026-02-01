using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppTimeCapsule
    {
        #region Query Methods

        [Safe]
        public static Map<string, object> GetCapsuleDetails(BigInteger capsuleId)
        {
            CapsuleData capsule = GetCapsuleData(capsuleId);
            Map<string, object> details = new Map<string, object>();
            if (capsule.Owner == UInt160.Zero) return details;

            details["id"] = capsuleId;
            details["owner"] = capsule.Owner;
            details["contentHash"] = capsule.ContentHash;
            details["title"] = capsule.Title;
            details["category"] = capsule.Category;
            details["unlockTime"] = capsule.UnlockTime;
            details["createTime"] = capsule.CreateTime;
            details["isPublic"] = capsule.IsPublic;
            details["isRevealed"] = capsule.IsRevealed;
            details["recipientCount"] = capsule.RecipientCount;
            details["extensionCount"] = capsule.ExtensionCount;
            details["isGifted"] = capsule.IsGifted;

            if (capsule.IsRevealed)
            {
                details["revealer"] = capsule.Revealer;
                details["revealTime"] = capsule.RevealTime;
            }

            if (capsule.IsGifted)
            {
                details["originalOwner"] = capsule.OriginalOwner;
            }

            if (!capsule.IsRevealed)
            {
                if ((BigInteger)Runtime.Time >= capsule.UnlockTime)
                {
                    details["status"] = "unlocked";
                }
                else
                {
                    details["status"] = "locked";
                    details["remainingTime"] = capsule.UnlockTime - (BigInteger)Runtime.Time;
                }
            }
            else
            {
                details["status"] = "revealed";
            }

            return details;
        }

        #endregion
    }
}
