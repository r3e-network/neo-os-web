using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // ===================================================================
    //  PlatformRegistry — treasury policy (design section 4.3)
    //
    //  The minted AppAccount holds funds but decides nothing: every spend
    //  lane lives here and every destination is ROLE-BOUND — the timelocked
    //  payout address or the app's registered engine hash. No method in
    //  this estate takes a free destination. spendToPayout and the spend
    //  timelock pair are witness-gated exits and therefore pause-immune
    //  (the anchor invariant).
    // ===================================================================
    public partial class PlatformRegistry
    {
        // ---- payout address (24h timelocked changes) ----

        public static void ProposePayoutAddress(string appId, UInt160 value)
        {
            RequireRegistered(appId);
            RequireAppAdmin(appId);
            ValidateAddress(value);
            ExecutionEngine.Assert(value != Runtime.ExecutingScriptHash, "payout cannot be the registry");
            BigInteger executeAfter = Runtime.Time + TIMELOCK_DELAY_MS;
            PendingAddress pending = new PendingAddress { Value = value, Eta = executeAfter };
            Storage.Put(Storage.CurrentContext, AppKey(PREFIX_PENDING_PAYOUT, appId), StdLib.Serialize(pending));
            OnPayoutAddressProposed(appId, value, executeAfter);
        }

        public static void ExecutePayoutAddress(string appId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AppKey(PREFIX_PENDING_PAYOUT, appId));
            ExecutionEngine.Assert(raw != null, "no pending payout address");
            PendingAddress pending = (PendingAddress)StdLib.Deserialize(raw);
            ExecutionEngine.Assert(Runtime.Time >= pending.Eta, "timelock active");
            Storage.Put(Storage.CurrentContext, AppKey(PREFIX_PAYOUT, appId), pending.Value);
            Storage.Delete(Storage.CurrentContext, AppKey(PREFIX_PENDING_PAYOUT, appId));
            OnPayoutAddressChanged(appId, pending.Value);
        }

        public static void CancelPayoutAddress(string appId)
        {
            RequireRegistered(appId);
            RequireAppAdmin(appId);
            Storage.Delete(Storage.CurrentContext, AppKey(PREFIX_PENDING_PAYOUT, appId));
        }

        // ---- spendToPayout: the app-admin exit lane ----

        /// <summary>
        /// Move treasury funds to the registered payout address. App-admin
        /// witnessed, destination role-bound, immune to the GLOBAL registry
        /// pause (respects the account's LOCAL pause). The per-app threshold
        /// bounds CUMULATIVE outflow over a rolling 24h window, not per call —
        /// so many sub-threshold spends from a compromised key cannot drain
        /// the treasury past the threshold in one window. Larger single spends
        /// must use the timelocked proposeSpend/executeSpend pair.
        /// </summary>
        public static void SpendToPayout(string appId, UInt160 asset, BigInteger amount)
        {
            RequireRegistered(appId);
            RequireAppAdmin(appId);
            ExecutionEngine.Assert(amount > 0, "invalid amount");
            ExecutionEngine.Assert(
                SpentInWindow(appId) + amount <= SpendThresholdOf(appId),
                "window spend budget exceeded");
            RecordWindowSpend(appId, amount);
            RelayPayout(appId, asset, amount);
        }

        public static void ProposeSpend(string appId, UInt160 asset, BigInteger amount)
        {
            RequireRegistered(appId);
            RequireAppAdmin(appId);
            ValidateAsset(asset);
            ExecutionEngine.Assert(amount > 0, "invalid amount");
            BigInteger executeAfter = Runtime.Time + TIMELOCK_DELAY_MS;
            PendingSpend pending = new PendingSpend { Asset = asset, Amount = amount, Eta = executeAfter };
            Storage.Put(Storage.CurrentContext, AppKey(PREFIX_PENDING_SPEND, appId), StdLib.Serialize(pending));
            OnSpendProposed(appId, asset, amount, executeAfter);
        }

        public static void ExecuteSpend(string appId)
        {
            RequireRegistered(appId);
            RequireAppAdmin(appId);
            ByteString raw = Storage.Get(Storage.CurrentContext, AppKey(PREFIX_PENDING_SPEND, appId));
            ExecutionEngine.Assert(raw != null, "no pending spend");
            PendingSpend pending = (PendingSpend)StdLib.Deserialize(raw);
            ExecutionEngine.Assert(Runtime.Time >= pending.Eta, "timelock active");
            Storage.Delete(Storage.CurrentContext, AppKey(PREFIX_PENDING_SPEND, appId));
            RelayPayout(appId, pending.Asset, pending.Amount);
        }

        public static void CancelSpend(string appId)
        {
            RequireRegistered(appId);
            RequireAppAdmin(appId);
            Storage.Delete(Storage.CurrentContext, AppKey(PREFIX_PENDING_SPEND, appId));
        }

        // ---- fundEnginePool: treasury -> engine reward pool in one call ----

        /// <summary>
        /// Destination hard-bound to the app's registered engine hash. The
        /// account cannot attach a memo, so the GAS makes a two-hop transit:
        /// account -> registry (validated against the transit note by
        /// OnNEP17Payment, credited nowhere) -> engine with memo
        /// "appId:credit" so it lands in the engine's per-app pool.
        ///
        /// The transit note is the in-flight LOCK and is held across the
        /// engine forward (finding 3): OnNEP17Payment validates but does NOT
        /// clear it, so a hostile engine that reenters fundEnginePool from its
        /// pool-credit callback trips the still-live "treasury hop in progress"
        /// guard and the whole hop reverts. The note is cleared only after the
        /// forward completes.
        /// </summary>
        public static void FundEnginePool(string appId, BigInteger amount)
        {
            RequireNotGloballyPaused();
            RequireRegistered(appId);
            RequireAppNotPaused(appId);
            RequireAppAdmin(appId);
            UInt160 account = AccountOf(appId);
            ExecutionEngine.Assert(account != UInt160.Zero, "no minted account");
            string engineId = EngineIdOf(appId);
            ExecutionEngine.Assert(engineId.Length > 0, "no engine attached");
            EngineRow row = GetEngineRow(engineId);
            ExecutionEngine.Assert(row != null && row.Active, "engine not active");
            ExecutionEngine.Assert(amount > 0, "invalid amount");
            ExecutionEngine.Assert(
                Storage.Get(Storage.CurrentContext, PREFIX_TREASURY_TRANSIT) == null,
                "treasury hop in progress");
            TransitNote note = new TransitNote { Account = account, Amount = amount };
            Storage.Put(Storage.CurrentContext, PREFIX_TREASURY_TRANSIT, StdLib.Serialize(note));
            // account -> registry; the callback validates the note and returns
            // without clearing it, so the lock stays live across the forward.
            Contract.Call(account, "executeTransfer", CallFlags.All, GAS.Hash, Runtime.ExecutingScriptHash, amount);
            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, row.Hash, amount, appId + ":credit"),
                "engine pool transfer failed");
            // Forward landed without reentrancy: release the in-flight lock.
            Storage.Delete(Storage.CurrentContext, PREFIX_TREASURY_TRANSIT);
            OnEnginePoolFunded(appId, row.Hash, amount);
        }

        // ---- platform fee revenue (registration + mint fees) ----

        /// <summary>Withdraw accrued platform fees. Destination is hard-bound
        /// to the platform admin; user credit liabilities are untouchable
        /// through this lane by construction of the fee accumulator.</summary>
        public static void WithdrawPlatformFees(BigInteger amount)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(amount > 0, "invalid amount");
            BigInteger fees = AccruedFees();
            ExecutionEngine.Assert(fees >= amount, "insufficient accrued fees");
            BigInteger next = fees - amount;
            if (next == 0) Storage.Delete(Storage.CurrentContext, PREFIX_ACCRUED_FEES);
            else Storage.Put(Storage.CurrentContext, PREFIX_ACCRUED_FEES, next);
            UInt160 admin = Admin();
            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, admin, amount),
                "fee withdrawal failed");
            OnPlatformFeesWithdrawn(admin, amount);
        }

        // ---- [Safe] treasury reads ----

        /// <summary>Whether a fundEnginePool transit hop is mid-flight (the
        /// in-flight reentrancy lock is set). Only ever true transiently
        /// inside a single fundEnginePool transaction; always false between
        /// transactions.</summary>
        [Safe]
        public static bool TransitHopInProgress() =>
            Storage.Get(Storage.CurrentContext, PREFIX_TREASURY_TRANSIT) != null;

        [Safe]
        public static UInt160 PayoutAddressOf(string appId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AppKey(PREFIX_PAYOUT, appId));
            return raw == null ? UInt160.Zero : (UInt160)raw;
        }

        [Safe]
        public static BigInteger SpendThresholdOf(string appId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AppKey(PREFIX_SPEND_THRESHOLD, appId));
            return raw == null ? DEFAULT_SPEND_THRESHOLD : (BigInteger)raw;
        }

        /// <summary>Cumulative spendToPayout outflow inside the current rolling
        /// 24h window; zero once the anchor has aged past the window.</summary>
        [Safe]
        public static BigInteger SpentInWindow(string appId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AppKey(PREFIX_SPEND_WINDOW, appId));
            if (raw == null) return 0;
            object[] stored = (object[])StdLib.Deserialize(raw);
            BigInteger anchor = (BigInteger)stored[0];
            if (Runtime.Time - anchor >= SPEND_WINDOW_MS) return 0;
            return (BigInteger)stored[1];
        }

        // ---- internals ----

        // Rolling-window accumulator (the audited PlatformGame.Dice M-4
        // pattern): keep the anchor while it is younger than the window and
        // add to the running total; otherwise start a fresh window at now.
        private static void RecordWindowSpend(string appId, BigInteger amount)
        {
            BigInteger now = Runtime.Time;
            BigInteger anchor = now;
            BigInteger spent = 0;
            ByteString existing = Storage.Get(Storage.CurrentContext, AppKey(PREFIX_SPEND_WINDOW, appId));
            if (existing != null)
            {
                object[] stored = (object[])StdLib.Deserialize(existing);
                BigInteger storedAnchor = (BigInteger)stored[0];
                if (now - storedAnchor < SPEND_WINDOW_MS)
                {
                    anchor = storedAnchor;
                    spent = (BigInteger)stored[1];
                }
            }
            Storage.Put(Storage.CurrentContext, AppKey(PREFIX_SPEND_WINDOW, appId),
                StdLib.Serialize(new object[] { anchor, spent + amount }));
        }

        // The single payout relay: destination is ALWAYS the registered
        // payout address, never a caller-supplied value.
        private static void RelayPayout(string appId, UInt160 asset, BigInteger amount)
        {
            UInt160 account = AccountOf(appId);
            ExecutionEngine.Assert(account != UInt160.Zero, "no minted account");
            UInt160 payout = PayoutAddressOf(appId);
            ExecutionEngine.Assert(payout != UInt160.Zero, "no payout address");
            ValidateAsset(asset);
            ExecutionEngine.Assert(amount > 0, "invalid amount");
            Contract.Call(account, "executeTransfer", CallFlags.All, asset, payout, amount);
            OnPayoutSpent(appId, asset, amount);
        }

        private static void ValidateAsset(UInt160 asset)
        {
            ExecutionEngine.Assert(asset == GAS.Hash || asset == NEO.Hash, "unsupported asset");
        }
    }
}
