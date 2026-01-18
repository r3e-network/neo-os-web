using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHeritageTrust
    {
        #region User-Facing Methods

        /// <summary>
        /// Create a new living trust with NEO deposit.
        /// </summary>
        public static BigInteger CreateTrust(
            UInt160 owner,
            UInt160 heir,
            BigInteger neoAmount,
            BigInteger heartbeatIntervalDays,
            string trustName,
            string notes,
            BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(heir.IsValid && heir != owner, "invalid heir");
            ExecutionEngine.Assert(neoAmount >= MIN_PRINCIPAL, "below minimum principal");
            ExecutionEngine.Assert(trustName.Length > 0 && trustName.Length <= 100, "invalid name");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            BigInteger intervalSeconds = heartbeatIntervalDays * 86400;
            ExecutionEngine.Assert(intervalSeconds >= MIN_HEARTBEAT_SECONDS && intervalSeconds <= MAX_HEARTBEAT_SECONDS, "invalid interval");

            ValidatePaymentReceipt(APP_ID, owner, neoAmount, receiptId);

            BigInteger trustId = TotalTrusts() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_TRUST_ID, trustId);

            Trust trust = new Trust
            {
                Owner = owner,
                PrimaryHeir = heir,
                Principal = neoAmount,
                AccruedYield = 0,
                ClaimedYield = 0,
                CreatedTime = Runtime.Time,
                LastHeartbeat = Runtime.Time,
                HeartbeatInterval = intervalSeconds,
                Deadline = Runtime.Time + intervalSeconds,
                Active = true,
                Executed = false,
                Cancelled = false,
                TrustName = trustName,
                Notes = notes
            };
            StoreTrust(trustId, trust);

            AddUserTrust(owner, trustId);
            AddHeirTrust(heir, trustId);
            UpdateOwnerStatsOnCreate(owner, neoAmount);
            UpdateTotalPrincipal(neoAmount);

            OnTrustCreated(trustId, owner, heir, neoAmount);
            return trustId;
        }

        /// <summary>
        /// Record heartbeat to reset inheritance timer.
        /// </summary>
        public static void Heartbeat(BigInteger trustId)
        {
            ValidateNotGloballyPaused(APP_ID);

            Trust trust = GetTrust(trustId);
            ExecutionEngine.Assert(trust.Active, "trust not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(trust.Owner), "unauthorized");

            trust.LastHeartbeat = Runtime.Time;
            trust.Deadline = Runtime.Time + trust.HeartbeatInterval;
            StoreTrust(trustId, trust);

            UpdateOwnerStatsOnHeartbeat(trust.Owner);

            OnHeartbeatRecorded(trustId, trust.Deadline);
        }

        /// <summary>
        /// Claim accumulated GAS yield from trust.
        /// </summary>
        public static void ClaimYield(BigInteger trustId)
        {
            ValidateNotGloballyPaused(APP_ID);

            Trust trust = GetTrust(trustId);
            ExecutionEngine.Assert(trust.Active, "trust not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(trust.Owner), "unauthorized");
            ExecutionEngine.Assert(trust.AccruedYield > 0, "no yield to claim");

            BigInteger yieldAmount = trust.AccruedYield;
            trust.AccruedYield = 0;
            trust.ClaimedYield += yieldAmount;
            StoreTrust(trustId, trust);

            GAS.Transfer(Runtime.ExecutingScriptHash, trust.Owner, yieldAmount);

            UpdateOwnerStatsOnYieldClaim(trust.Owner, yieldAmount);
            UpdateTotalYield(yieldAmount);

            OnYieldClaimed(trustId, trust.Owner, yieldAmount);
        }

        /// <summary>
        /// Execute trust after owner presumed deceased (deadline passed).
        /// </summary>
        public static void ExecuteTrust(BigInteger trustId)
        {
            ValidateNotGloballyPaused(APP_ID);

            Trust trust = GetTrust(trustId);
            ExecutionEngine.Assert(trust.Active, "trust not active");
            ExecutionEngine.Assert(!trust.Executed, "already executed");

            BigInteger graceDeadline = trust.Deadline + GRACE_PERIOD_SECONDS;
            ExecutionEngine.Assert(Runtime.Time >= graceDeadline, "owner still alive");

            bool isHeir = Runtime.CheckWitness(trust.PrimaryHeir);
            bool isGuardian = IsGuardian(trustId, Runtime.Transaction.Sender);
            ExecutionEngine.Assert(isHeir || isGuardian, "unauthorized executor");

            BigInteger platformFee = trust.Principal * PLATFORM_FEE_BPS / 10000;
            BigInteger heirAmount = trust.Principal - platformFee;

            trust.Active = false;
            trust.Executed = true;
            StoreTrust(trustId, trust);

            NEO.Transfer(Runtime.ExecutingScriptHash, trust.PrimaryHeir, heirAmount);

            if (platformFee > 0)
            {
                UInt160 admin = Admin();
                if (admin != null && admin.IsValid)
                {
                    NEO.Transfer(Runtime.ExecutingScriptHash, admin, platformFee);
                }
            }

            UpdateOwnerStatsOnExecute(trust.Owner);
            UpdateTotalExecuted();
            UpdateTotalPrincipal(-trust.Principal);

            OnTrustExecuted(trustId, trust.PrimaryHeir, heirAmount);
        }

        /// <summary>
        /// Cancel trust and return principal (with penalty if early).
        /// </summary>
        public static void CancelTrust(BigInteger trustId)
        {
            ValidateNotGloballyPaused(APP_ID);

            Trust trust = GetTrust(trustId);
            ExecutionEngine.Assert(trust.Active, "trust not active");
            ExecutionEngine.Assert(!trust.Executed, "already executed");
            ExecutionEngine.Assert(Runtime.CheckWitness(trust.Owner), "unauthorized");

            BigInteger penalty = trust.Principal * CANCEL_PENALTY_BPS / 10000;
            BigInteger refundAmount = trust.Principal - penalty;

            trust.Active = false;
            trust.Cancelled = true;
            StoreTrust(trustId, trust);

            NEO.Transfer(Runtime.ExecutingScriptHash, trust.Owner, refundAmount);

            if (penalty > 0)
            {
                UInt160 admin = Admin();
                if (admin != null && admin.IsValid)
                {
                    NEO.Transfer(Runtime.ExecutingScriptHash, admin, penalty);
                }
            }

            UpdateOwnerStatsOnCancel(trust.Owner);
            UpdateTotalCancelled();
            UpdateTotalPrincipal(-trust.Principal);

            OnTrustCancelled(trustId, trust.Owner, refundAmount);
        }

        /// <summary>
        /// Change the primary heir of a trust.
        /// </summary>
        public static void ChangeHeir(BigInteger trustId, UInt160 newHeir)
        {
            ValidateNotGloballyPaused(APP_ID);

            Trust trust = GetTrust(trustId);
            ExecutionEngine.Assert(trust.Active, "trust not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(trust.Owner), "unauthorized");
            ExecutionEngine.Assert(newHeir.IsValid && newHeir != trust.Owner, "invalid heir");

            UInt160 oldHeir = trust.PrimaryHeir;
            trust.PrimaryHeir = newHeir;
            StoreTrust(trustId, trust);

            RemoveHeirTrust(oldHeir, trustId);
            AddHeirTrust(newHeir, trustId);

            OnHeirChanged(trustId, oldHeir, newHeir);
            OnTrustModified(trustId, "heir_changed");
        }

        /// <summary>
        /// Add additional principal to an existing trust.
        /// </summary>
        public static void AddPrincipal(BigInteger trustId, BigInteger neoAmount, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            Trust trust = GetTrust(trustId);
            ExecutionEngine.Assert(trust.Active, "trust not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(trust.Owner), "unauthorized");
            ExecutionEngine.Assert(neoAmount > 0, "invalid amount");

            ValidatePaymentReceipt(APP_ID, trust.Owner, neoAmount, receiptId);

            trust.Principal += neoAmount;
            StoreTrust(trustId, trust);

            UpdateOwnerStatsOnPrincipalAdd(trust.Owner, neoAmount);
            UpdateTotalPrincipal(neoAmount);

            OnPrincipalAdded(trustId, neoAmount, trust.Principal);
            OnTrustModified(trustId, "principal_added");
        }

        /// <summary>
        /// Add a guardian who can execute the trust.
        /// </summary>
        public static void AddGuardian(BigInteger trustId, UInt160 guardian)
        {
            ValidateNotGloballyPaused(APP_ID);

            Trust trust = GetTrust(trustId);
            ExecutionEngine.Assert(trust.Active, "trust not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(trust.Owner), "unauthorized");
            ExecutionEngine.Assert(guardian.IsValid && guardian != trust.Owner, "invalid guardian");
            ExecutionEngine.Assert(!IsGuardian(trustId, guardian), "already guardian");

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_GUARDIANS, (ByteString)trustId.ToByteArray()),
                guardian);
            Storage.Put(Storage.CurrentContext, key, 1);

            UpdateOwnerStatsOnGuardianAdd(trust.Owner);

            OnGuardianAdded(trustId, guardian);
            OnTrustModified(trustId, "guardian_added");
        }

        /// <summary>
        /// Update heartbeat interval for a trust.
        /// </summary>
        public static void UpdateHeartbeatInterval(BigInteger trustId, BigInteger newIntervalDays)
        {
            ValidateNotGloballyPaused(APP_ID);

            Trust trust = GetTrust(trustId);
            ExecutionEngine.Assert(trust.Active, "trust not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(trust.Owner), "unauthorized");

            BigInteger intervalSeconds = newIntervalDays * 86400;
            ExecutionEngine.Assert(intervalSeconds >= MIN_HEARTBEAT_SECONDS && intervalSeconds <= MAX_HEARTBEAT_SECONDS, "invalid interval");

            trust.HeartbeatInterval = intervalSeconds;
            trust.Deadline = trust.LastHeartbeat + intervalSeconds;
            StoreTrust(trustId, trust);

            OnTrustModified(trustId, "interval_updated");
        }
        #endregion
    }
}
