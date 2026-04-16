using System;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public partial class PlatformSocialContract
    {
        // ===================================================================
        // HeritageTrust logic -- ported from MiniAppHeritageTrust
        // ===================================================================

        #region Trust Methods

        /// <summary>
        /// Create a living trust funded by the owner's prepaid NEO credit.
        /// </summary>
        public static BigInteger CreateTrust(
            string appId,
            UInt160 owner,
            UInt160 heir,
            BigInteger deadlineSeconds)
        {
            ValidateAppNotPaused(appId);
            ValidateAppRegistered(appId, APP_TYPE_TRUST);
            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "unauthorized");
            ExecutionEngine.Assert(owner != UInt160.Zero && owner.IsValid, "invalid owner");
            ExecutionEngine.Assert(heir != UInt160.Zero && heir.IsValid && heir != owner, "invalid heir");
            ExecutionEngine.Assert(
                deadlineSeconds >= HEARTBEAT_MIN_SECONDS && deadlineSeconds <= HEARTBEAT_MAX_SECONDS,
                "invalid interval");

            // Read the owner's NEO credit balance as the principal
            StorageMap neoCredits = new StorageMap(Storage.CurrentContext, PREFIX_DIRECT_ASSET_CREDIT);
            ByteString creditKey = (ByteString)(byte[])owner;
            ByteString existing = neoCredits.Get(creditKey);
            BigInteger neoAmount = existing == null ? 0 : (BigInteger)existing;
            ExecutionEngine.Assert(neoAmount >= MIN_PRINCIPAL, "below minimum principal");

            ConsumeNeoCredit(owner, neoAmount);

            // Increment trust counter for this app
            ByteString idKey = AppKey(appId, PREFIX_TRUST_ID);
            BigInteger trustId = GetBigInteger(idKey) + 1;
            Put(idKey, trustId);

            TrustData trust = new TrustData
            {
                Owner = owner,
                Heir = heir,
                Principal = neoAmount,
                CreatedTime = Runtime.Time,
                LastHeartbeat = Runtime.Time,
                HeartbeatInterval = deadlineSeconds,
                Deadline = Runtime.Time + (ulong)deadlineSeconds,
                Active = true,
                Executed = false,
                Cancelled = false
            };
            StoreTrust(appId, trustId, trust);

            OnTrustCreated(appId, trustId, owner, heir, neoAmount);
            return trustId;
        }

        /// <summary>
        /// Owner sends a heartbeat to prove they are alive and reset the deadline.
        /// </summary>
        public static void Heartbeat(string appId, BigInteger trustId)
        {
            ValidateAppNotPaused(appId);
            ValidateAppRegistered(appId, APP_TYPE_TRUST);

            TrustData trust = GetTrust(appId, trustId);
            ExecutionEngine.Assert(trust.Active, "trust not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(trust.Owner), "unauthorized");

            trust.LastHeartbeat = Runtime.Time;
            trust.Deadline = Runtime.Time + trust.HeartbeatInterval;
            StoreTrust(appId, trustId, trust);

            OnHeartbeatRecorded(appId, trustId, trust.Deadline);
        }

        /// <summary>
        /// Heir (or guardian) executes the trust after the deadline + grace period.
        /// </summary>
        public static void ExecuteTrust(string appId, BigInteger trustId)
        {
            ValidateAppNotPaused(appId);
            ValidateAppRegistered(appId, APP_TYPE_TRUST);

            TrustData trust = GetTrust(appId, trustId);
            ExecutionEngine.Assert(trust.Active, "trust not active");
            ExecutionEngine.Assert(!trust.Executed, "already executed");

            BigInteger graceDeadline = trust.Deadline + GRACE_PERIOD_SECONDS;
            ExecutionEngine.Assert(Runtime.Time >= (ulong)graceDeadline, "owner still alive");

            // Must be the heir or a registered guardian
            bool isHeir = Runtime.CheckWitness(trust.Heir);
            bool isGuardian = IsGuardian(appId, trustId, Runtime.Transaction.Sender);
            ExecutionEngine.Assert(isHeir || isGuardian, "unauthorized executor");

            ExecutionEngine.Assert(
                NEO.BalanceOf(Runtime.ExecutingScriptHash) >= trust.Principal,
                "insufficient trust liquidity");

            BigInteger platformFee = trust.Principal * TRUST_PLATFORM_FEE_BPS / 10000;
            BigInteger heirAmount = trust.Principal - platformFee;

            trust.Active = false;
            trust.Executed = true;
            StoreTrust(appId, trustId, trust);

            ExecutionEngine.Assert(
                NEO.Transfer(Runtime.ExecutingScriptHash, trust.Heir, heirAmount),
                "heir transfer failed");

            if (platformFee > 0)
            {
                UInt160 admin = Admin();
                if (admin != UInt160.Zero && admin.IsValid)
                {
                    NEO.Transfer(Runtime.ExecutingScriptHash, admin, platformFee);
                }
            }

            OnTrustExecuted(appId, trustId, trust.Heir, heirAmount);
        }

        /// <summary>
        /// Owner cancels the trust and receives principal minus penalty.
        /// </summary>
        public static void CancelTrust(string appId, BigInteger trustId)
        {
            ValidateAppNotPaused(appId);
            ValidateAppRegistered(appId, APP_TYPE_TRUST);

            TrustData trust = GetTrust(appId, trustId);
            ExecutionEngine.Assert(trust.Active, "trust not active");
            ExecutionEngine.Assert(!trust.Executed, "already executed");
            ExecutionEngine.Assert(Runtime.CheckWitness(trust.Owner), "unauthorized");
            ExecutionEngine.Assert(
                NEO.BalanceOf(Runtime.ExecutingScriptHash) >= trust.Principal,
                "insufficient trust liquidity");

            BigInteger penalty = trust.Principal * CANCEL_PENALTY_BPS / 10000;
            BigInteger refundAmount = trust.Principal - penalty;

            trust.Active = false;
            trust.Cancelled = true;
            StoreTrust(appId, trustId, trust);

            ExecutionEngine.Assert(
                NEO.Transfer(Runtime.ExecutingScriptHash, trust.Owner, refundAmount),
                "refund transfer failed");

            if (penalty > 0)
            {
                UInt160 admin = Admin();
                if (admin != UInt160.Zero && admin.IsValid)
                {
                    NEO.Transfer(Runtime.ExecutingScriptHash, admin, penalty);
                }
            }

            OnTrustCancelled(appId, trustId, trust.Owner, refundAmount);
        }

        /// <summary>
        /// Add a guardian who can execute the trust on behalf of the heir.
        /// </summary>
        public static void AddGuardian(string appId, BigInteger trustId, UInt160 guardian)
        {
            ValidateAppNotPaused(appId);
            ValidateAppRegistered(appId, APP_TYPE_TRUST);

            TrustData trust = GetTrust(appId, trustId);
            ExecutionEngine.Assert(trust.Active, "trust not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(trust.Owner), "unauthorized");
            ExecutionEngine.Assert(guardian != UInt160.Zero && guardian.IsValid && guardian != trust.Owner, "invalid guardian");
            ExecutionEngine.Assert(!IsGuardian(appId, trustId, guardian), "already guardian");

            Put(AppKey(appId, PREFIX_GUARDIANS, trustId, guardian), 1);
        }

        /// <summary>
        /// Read trust state.
        /// </summary>
        [Safe]
        public static TrustData GetTrust(string appId, BigInteger trustId)
        {
            ByteString data = GetRaw(AppKey(appId, PREFIX_TRUSTS, trustId));
            if (data == null) return new TrustData();
            return (TrustData)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Check whether an address is a guardian of the given trust.
        /// </summary>
        [Safe]
        public static bool IsGuardian(string appId, BigInteger trustId, UInt160 guardian)
        {
            ByteString data = GetRaw(AppKey(appId, PREFIX_GUARDIANS, trustId, guardian));
            return data != null && (BigInteger)data == 1;
        }

        #endregion

        #region Trust Internal Helpers

        private static void StoreTrust(string appId, BigInteger trustId, TrustData trust)
        {
            Put(AppKey(appId, PREFIX_TRUSTS, trustId), StdLib.Serialize(trust));
        }

        #endregion
    }
}
