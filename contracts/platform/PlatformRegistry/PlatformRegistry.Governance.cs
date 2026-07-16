using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // ===================================================================
    //  PlatformRegistry — governance (design section 3.1)
    //
    //  Platform admin rotation copies the audited PlatformGame.Admin.cs
    //  timelock pattern verbatim (the version whose seconds-vs-ms bug was
    //  already fixed). App-admin rotation is the same two-step pair per
    //  app, whose EXECUTE path pushes onAdminRotated into the minted shim
    //  so the locally cached escape key never drifts stale.
    // ===================================================================
    public partial class PlatformRegistry
    {
        // ---- platform admin (24h timelock, PlatformGame.Admin.cs verbatim) ----

        /// <summary>
        /// Propose a new platform admin. The change becomes executable
        /// after TIMELOCK_DELAY_MS.
        /// </summary>
        public static void ProposeAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ValidateAddress(newAdmin);
            ExecutionEngine.Assert(newAdmin != Admin(), "same admin");

            BigInteger executeAfter = Runtime.Time + TIMELOCK_DELAY_MS;
            Storage.Put(Storage.CurrentContext, PREFIX_PENDING_PLATFORM_ADMIN, newAdmin);
            Storage.Put(Storage.CurrentContext, PREFIX_PLATFORM_ADMIN_CHANGE_TIME, executeAfter);

            OnAdminTimelockProposed(newAdmin, executeAfter);
        }

        /// <summary>
        /// Execute a pending admin change after the timelock expires.
        /// </summary>
        public static void ExecuteAdminChange()
        {
            ByteString pending = Storage.Get(Storage.CurrentContext, PREFIX_PENDING_PLATFORM_ADMIN);
            ExecutionEngine.Assert(pending != null, "no pending admin");

            BigInteger changeTime = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PLATFORM_ADMIN_CHANGE_TIME);
            ExecutionEngine.Assert(Runtime.Time >= changeTime, "timelock active");

            UInt160 previousAdmin = Admin();
            UInt160 newAdmin = (UInt160)pending;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
            Storage.Delete(Storage.CurrentContext, PREFIX_PENDING_PLATFORM_ADMIN);
            Storage.Delete(Storage.CurrentContext, PREFIX_PLATFORM_ADMIN_CHANGE_TIME);

            OnAdminChanged(previousAdmin, newAdmin);
        }

        /// <summary>
        /// Cancel a pending admin change. Only the current admin may cancel.
        /// </summary>
        public static void CancelAdminChange()
        {
            ValidateAdmin();
            Storage.Delete(Storage.CurrentContext, PREFIX_PENDING_PLATFORM_ADMIN);
            Storage.Delete(Storage.CurrentContext, PREFIX_PLATFORM_ADMIN_CHANGE_TIME);
        }

        // ---- two-step per-app admin rotation ----

        /// <summary>Current app admin proposes routinely; the platform admin
        /// lane is the timelocked, event-emitting recovery rotation whose
        /// blast radius is bounded by the escape hatch and the timelocked
        /// payout address (resolved objection 7).</summary>
        public static void ProposeAppAdmin(string appId, UInt160 newAdmin)
        {
            RequireRegistered(appId);
            RequireAppAdminOrPlatformAdmin(appId);
            ValidateAddress(newAdmin);
            ExecutionEngine.Assert(newAdmin != AppAdminOf(appId), "same admin");
            BigInteger executeAfter = Runtime.Time + TIMELOCK_DELAY_MS;
            PendingAddress pending = new PendingAddress { Value = newAdmin, Eta = executeAfter };
            Storage.Put(Storage.CurrentContext, AppKey(PREFIX_PENDING_APP_ADMIN, appId), StdLib.Serialize(pending));
            OnAppAdminRotationProposed(appId, newAdmin, executeAfter);
        }

        /// <summary>
        /// Execute a matured app-admin rotation and PUSH the new admin into
        /// the minted shim in the same transaction, so the account's cached
        /// escape key can never drift stale (resolved objection 5).
        /// </summary>
        public static void ExecuteAppAdminChange(string appId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AppKey(PREFIX_PENDING_APP_ADMIN, appId));
            ExecutionEngine.Assert(raw != null, "no pending app admin");
            PendingAddress pending = (PendingAddress)StdLib.Deserialize(raw);
            ExecutionEngine.Assert(Runtime.Time >= pending.Eta, "timelock active");
            UInt160 previousAdmin = AppAdminOf(appId);
            Storage.Put(Storage.CurrentContext, AppKey(PREFIX_APP_ADMIN, appId), pending.Value);
            Storage.Delete(Storage.CurrentContext, AppKey(PREFIX_PENDING_APP_ADMIN, appId));
            UInt160 account = AccountOf(appId);
            if (account != UInt160.Zero)
            {
                Contract.Call(account, "onAdminRotated", CallFlags.All, pending.Value);
            }
            OnAppAdminRotated(appId, previousAdmin, pending.Value);
        }

        public static void CancelAppAdminChange(string appId)
        {
            RequireRegistered(appId);
            RequireAppAdminOrPlatformAdmin(appId);
            Storage.Delete(Storage.CurrentContext, AppKey(PREFIX_PENDING_APP_ADMIN, appId));
        }

        // ---- pause switches ----

        /// <summary>Per-app pause: app-or-platform admin (pause autonomy).</summary>
        public static void SetAppPaused(string appId, bool paused)
        {
            RequireRegistered(appId);
            RequireAppAdminOrPlatformAdmin(appId);
            if (paused) Storage.Put(Storage.CurrentContext, AppKey(PREFIX_APP_PAUSED, appId), 1);
            else Storage.Delete(Storage.CurrentContext, AppKey(PREFIX_APP_PAUSED, appId));
            OnAppPausedChanged(appId, paused);
        }

        /// <summary>
        /// Global kill switch, recording pausedAt — the anchor of the
        /// AppAccount escape window. Re-pausing never rewinds the recorded
        /// timestamp, so repeat calls cannot reset escape clocks.
        /// </summary>
        public static void SetGlobalPaused(bool paused)
        {
            ValidateAdmin();
            ByteString current = Storage.Get(Storage.CurrentContext, PREFIX_GLOBAL_PAUSED_AT);
            if (paused)
            {
                if (current == null) Storage.Put(Storage.CurrentContext, PREFIX_GLOBAL_PAUSED_AT, Runtime.Time);
            }
            else if (current != null)
            {
                Storage.Delete(Storage.CurrentContext, PREFIX_GLOBAL_PAUSED_AT);
            }
            ByteString recorded = Storage.Get(Storage.CurrentContext, PREFIX_GLOBAL_PAUSED_AT);
            OnGlobalPausedChanged(paused, recorded == null ? 0 : (BigInteger)recorded);
        }

        // ---- timelocked, hash-pinned self-upgrade ----

        public static void ScheduleUpdate(ByteString nefFile, string manifest)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(
                nefFile != null && nefFile.Length > 0 && manifest != null && manifest.Length > 0,
                "invalid upgrade artifact");
            BigInteger executeAfter = Runtime.Time + TIMELOCK_DELAY_MS;
            Storage.Put(Storage.CurrentContext, PREFIX_UPGRADE_TIME, executeAfter);
            Storage.Put(Storage.CurrentContext, PREFIX_UPGRADE_HASH,
                CryptoLib.Sha256(Helper.Concat(nefFile, (ByteString)manifest)));
            OnUpgradeScheduled(executeAfter);
        }

        /// <summary>Admin-gated, timelocked upgrade pinned to the scheduled
        /// sha256(nef ++ manifest) — the spine cannot be hot-swapped.</summary>
        public static void Update(ByteString nefFile, string manifest)
        {
            ValidateAdmin();
            ByteString rawTime = Storage.Get(Storage.CurrentContext, PREFIX_UPGRADE_TIME);
            ExecutionEngine.Assert(rawTime != null, "no upgrade scheduled");
            ExecutionEngine.Assert(Runtime.Time >= (BigInteger)rawTime, "timelock active");
            ByteString expected = Storage.Get(Storage.CurrentContext, PREFIX_UPGRADE_HASH);
            ByteString actual = CryptoLib.Sha256(Helper.Concat(nefFile, (ByteString)manifest));
            ExecutionEngine.Assert(expected == actual, "upgrade data mismatch");
            Storage.Delete(Storage.CurrentContext, PREFIX_UPGRADE_TIME);
            Storage.Delete(Storage.CurrentContext, PREFIX_UPGRADE_HASH);
            ContractManagement.Update(nefFile, manifest, null);
            OnContractUpgraded(CryptoLib.Sha256(nefFile), CryptoLib.Sha256((ByteString)manifest));
        }

        public static void CancelUpdate()
        {
            ValidateAdmin();
            Storage.Delete(Storage.CurrentContext, PREFIX_UPGRADE_TIME);
            Storage.Delete(Storage.CurrentContext, PREFIX_UPGRADE_HASH);
        }
    }
}
