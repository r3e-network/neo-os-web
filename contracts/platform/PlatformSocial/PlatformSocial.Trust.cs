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
            BigInteger heartbeatIntervalMs)
        {
            ValidateAppNotPaused(appId);
            ValidateAppRegistered(appId, APP_TYPE_TRUST);
            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "unauthorized");
            ExecutionEngine.Assert(owner != UInt160.Zero && owner.IsValid, "invalid owner");
            ExecutionEngine.Assert(heir != UInt160.Zero && heir.IsValid && heir != owner, "invalid heir");
            // Runtime.Time is BLOCK TIMESTAMP IN MILLISECONDS on Neo N3, so the
            // heartbeat interval must be in ms (HEARTBEAT_MIN_MS = 7 days,
            // HEARTBEAT_MAX_MS = 365 days). Previously the parameter was treated
            // as seconds and added directly to Runtime.Time, making the actual
            // deadline 1000x sooner than declared.
            ExecutionEngine.Assert(
                heartbeatIntervalMs >= HEARTBEAT_MIN_MS && heartbeatIntervalMs <= HEARTBEAT_MAX_MS,
                "invalid interval");

            // Read the owner's NEO credit balance as the principal
            BigInteger neoAmount = GetNeoCreditBalance(appId, owner);
            ExecutionEngine.Assert(neoAmount >= MIN_PRINCIPAL, "below minimum principal");

            ConsumeNeoCredit(appId, owner, neoAmount);

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
                HeartbeatInterval = heartbeatIntervalMs,
                Deadline = Runtime.Time + (ulong)heartbeatIntervalMs,
                Active = true,
                Executed = false,
                Cancelled = false
            };
            StoreTrust(appId, trustId, trust);

            // Solvency: track aggregate active principal so payouts can assert the
            // contract balance covers every outstanding trust, not just this one.
            ByteString totalKey = AppKey(appId, PREFIX_TRUST_ACTIVE_PRINCIPAL);
            Put(totalKey, GetBigInteger(totalKey) + neoAmount);

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

            // Audit fix M-6: refuse heartbeats once the deadline + grace window has
            // elapsed. Without this check, an owner who reappeared after the heir
            // could already legitimately execute the trust could simply heartbeat to
            // re-extend the timer indefinitely, defeating the "if owner is gone, heir
            // inherits" semantic.
            BigInteger graceDeadline = trust.Deadline + GRACE_PERIOD_MS;
            ExecutionEngine.Assert(Runtime.Time < (ulong)graceDeadline, "grace period elapsed");

            trust.LastHeartbeat = Runtime.Time;
            trust.Deadline = Runtime.Time + trust.HeartbeatInterval;
            StoreTrust(appId, trustId, trust);

            OnHeartbeatRecorded(appId, trustId, trust.Deadline);
        }

        /// <summary>
        /// Heir (or guardian) executes the trust after the deadline + grace period.
        /// </summary>
        public static void ExecuteTrust(string appId, BigInteger trustId, UInt160 executor)
        {
            ValidateAppNotPaused(appId);
            ValidateAppRegistered(appId, APP_TYPE_TRUST);
            ExecutionEngine.Assert(executor != null && executor.IsValid, "invalid executor");

            TrustData trust = GetTrust(appId, trustId);
            ExecutionEngine.Assert(trust.Active, "trust not active");
            ExecutionEngine.Assert(!trust.Executed, "already executed");

            BigInteger graceDeadline = trust.Deadline + GRACE_PERIOD_MS;
            ExecutionEngine.Assert(Runtime.Time >= (ulong)graceDeadline, "owner still alive");

            // Audit fix M-7: previous version used `Runtime.Transaction.Sender` to
            // identify the guardian, which (a) is just the first signer of the tx and
            // not a witness assertion, and (b) fails for multi-sig / contract-account
            // guardians whose `Tx.Sender` may not match `Guardians[]`. Require the
            // executor address explicitly and verify it via `CheckWitness`, matching
            // every other authorization path in this codebase.
            ExecutionEngine.Assert(Runtime.CheckWitness(executor), "executor witness required");
            bool isHeir = executor == trust.Heir;
            bool isGuardian = IsGuardian(appId, trustId, executor);
            ExecutionEngine.Assert(isHeir || isGuardian, "unauthorized executor");

            // Solvency: assert the contract balance covers EVERY outstanding active
            // trust, not just this one. The per-trust check below would still pass
            // if another trust's principal had been silently lost, leaking it to the
            // current heir at the cost of the next executor.
            ByteString totalKey = AppKey(appId, PREFIX_TRUST_ACTIVE_PRINCIPAL);
            BigInteger activeTotal = GetBigInteger(totalKey);
            ExecutionEngine.Assert(
                NEO.BalanceOf(Runtime.ExecutingScriptHash) >= activeTotal,
                "aggregate trust solvency check failed");
            ExecutionEngine.Assert(
                NEO.BalanceOf(Runtime.ExecutingScriptHash) >= trust.Principal,
                "insufficient trust liquidity");

            BigInteger platformFee = trust.Principal * TRUST_PLATFORM_FEE_BPS / 10000;
            BigInteger heirAmount = trust.Principal - platformFee;

            trust.Active = false;
            trust.Executed = true;
            StoreTrust(appId, trustId, trust);

            // Decrement aggregate liability before transfers (checks-effects-interactions).
            Put(totalKey, activeTotal - trust.Principal);

            ExecutionEngine.Assert(
                NEO.Transfer(Runtime.ExecutingScriptHash, trust.Heir, heirAmount),
                "heir transfer failed");

            if (platformFee > 0)
            {
                UInt160 admin = Admin();
                if (admin != UInt160.Zero && admin.IsValid)
                {
                    ExecutionEngine.Assert(
                        NEO.Transfer(Runtime.ExecutingScriptHash, admin, platformFee),
                        "platform fee transfer failed");
                }
            }
            EnsureNeoCreditSolvent();

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

            // Solvency: same aggregate check as ExecuteTrust — refuse the cancel if
            // the contract is already under-funded for outstanding obligations.
            ByteString totalKey = AppKey(appId, PREFIX_TRUST_ACTIVE_PRINCIPAL);
            BigInteger activeTotal = GetBigInteger(totalKey);
            ExecutionEngine.Assert(
                NEO.BalanceOf(Runtime.ExecutingScriptHash) >= activeTotal,
                "aggregate trust solvency check failed");
            ExecutionEngine.Assert(
                NEO.BalanceOf(Runtime.ExecutingScriptHash) >= trust.Principal,
                "insufficient trust liquidity");

            BigInteger penalty = trust.Principal * CANCEL_PENALTY_BPS / 10000;
            BigInteger refundAmount = trust.Principal - penalty;

            trust.Active = false;
            trust.Cancelled = true;
            StoreTrust(appId, trustId, trust);

            // Decrement aggregate liability before transfers.
            Put(totalKey, activeTotal - trust.Principal);

            ExecutionEngine.Assert(
                NEO.Transfer(Runtime.ExecutingScriptHash, trust.Owner, refundAmount),
                "refund transfer failed");

            if (penalty > 0)
            {
                UInt160 admin = Admin();
                if (admin != UInt160.Zero && admin.IsValid)
                {
                    ExecutionEngine.Assert(
                        NEO.Transfer(Runtime.ExecutingScriptHash, admin, penalty),
                        "penalty transfer failed");
                }
            }
            EnsureNeoCreditSolvent();

            OnTrustCancelled(appId, trustId, trust.Owner, refundAmount);
        }

        /// <summary>
        /// Add a guardian who can execute the trust on behalf of the heir.
        /// Bounded by MAX_GUARDIANS_PER_TRUST so a compromised owner key can't
        /// inflate per-trust storage indefinitely with spam-added guardians.
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

            ByteString countKey = AppKey(appId, PREFIX_GUARDIAN_COUNT, trustId);
            BigInteger count = GetBigInteger(countKey);
            ExecutionEngine.Assert(count < MAX_GUARDIANS_PER_TRUST, "guardian quota reached");

            Put(AppKey(appId, PREFIX_GUARDIANS, trustId, guardian), 1);
            Put(countKey, count + 1);
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
