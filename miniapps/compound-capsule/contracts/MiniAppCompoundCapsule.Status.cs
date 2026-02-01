using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCompoundCapsule
    {
        #region Capsule Status Methods

        [Safe]
        public static Map<string, object> GetCapsuleStatus(BigInteger capsuleId)
        {
            Capsule c = GetCapsule(capsuleId);
            Map<string, object> status = new Map<string, object>();
            if (c.Owner == UInt160.Zero) return status;

            status["id"] = capsuleId;
            status["owner"] = c.Owner;
            status["principal"] = c.Principal;
            status["compound"] = c.Compound;
            status["total"] = c.Principal + c.Compound;
            status["lockDays"] = c.LockDays;
            status["apyBps"] = c.ApyBps;
            status["active"] = c.Active;
            status["earlyWithdrawn"] = c.EarlyWithdrawn;

            if (c.Active)
            {
                BigInteger remaining = c.UnlockTime - Runtime.Time;
                status["remainingSeconds"] = remaining > 0 ? remaining : 0;
                status["remainingDays"] = remaining > 0 ? remaining / 86400 : 0;
                status["canUnlock"] = Runtime.Time >= c.UnlockTime;
                status["status"] = Runtime.Time >= c.UnlockTime ? "matured" : "locked";
            }
            else
            {
                status["status"] = c.EarlyWithdrawn ? "early_withdrawn" : "unlocked";
            }

            // Calculate current tier
            status["currentTier"] = GetTierForLockDays(c.LockDays);

            return status;
        }

        [Safe]
        public static BigInteger GetTierForLockDays(BigInteger days)
        {
            if (days >= TIER4_DAYS) return 4;
            if (days >= TIER3_DAYS) return 3;
            if (days >= TIER2_DAYS) return 2;
            return 1;
        }

        #endregion

        #region Automation

        public static new void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            if (payload != null && payload.Length > 0)
            {
                // Payload encodes a single capsule ID to avoid on-chain array deserialization.
                BigInteger capsuleId = (BigInteger)payload;
                CompoundCapsuleYield(capsuleId);
            }
        }

        #endregion
    }
}
