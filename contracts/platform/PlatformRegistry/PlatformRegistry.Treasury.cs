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
        /// witnessed, destination role-bound, pause-immune. Amounts above
        /// the per-app threshold must use the proposeSpend timelock pair
        /// so one compromised key cannot instantly drain a large treasury.
        /// </summary>
        public static void SpendToPayout(string appId, UInt160 asset, BigInteger amount)
        {
            RequireRegistered(appId);
            RequireAppAdmin(appId);
            ExecutionEngine.Assert(amount <= SpendThresholdOf(appId), "amount above spend threshold");
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
            Contract.Call(account, "executeTransfer", CallFlags.All, GAS.Hash, Runtime.ExecutingScriptHash, amount);
            // The callback consumed the note; its absence proves the hop landed.
            ExecutionEngine.Assert(
                Storage.Get(Storage.CurrentContext, PREFIX_TREASURY_TRANSIT) == null,
                "treasury hop not observed");
            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, row.Hash, amount, appId + ":credit"),
                "engine pool transfer failed");
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

        // ---- internals ----

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
