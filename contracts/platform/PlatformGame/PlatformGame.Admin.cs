using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class PlatformGameContract
    {
        // ===================================================================
        //  Lifecycle
        // ===================================================================

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }

        /// <summary>
        /// Schedule a contract upgrade. The upgrade becomes executable after
        /// TIMELOCK_DELAY_MS and is pinned to sha256(nefFile ++ manifest), so
        /// the executed artifact is exactly the one that was announced.
        /// Only the platform admin may call.
        /// </summary>
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

        /// <summary>
        /// Execute a scheduled upgrade. Admin-gated, timelocked, and pinned to
        /// the scheduled sha256(nefFile ++ manifest) — the engine cannot be
        /// hot-swapped by a single compromised admin key (audit fix H2,
        /// ported from PlatformRegistry.Governance.cs).
        /// </summary>
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
            ContractManagement.Update(nefFile, manifest, new object[0]);
            // Audit fix H-13: emit typed event so off-chain monitors can
            // observe contract upgrades. The nef/manifest hashes are captured
            // before the upgrade since Runtime.ExecutingScriptHash still
            // refers to the old contract at this point.
            UInt160 caller = Runtime.ExecutingScriptHash;
            OnContractUpgraded(caller,
                CryptoLib.Sha256(nefFile),
                CryptoLib.Sha256((ByteString)manifest));
        }

        /// <summary>Cancel a scheduled upgrade. Only the platform admin may cancel.</summary>
        public static void CancelUpdate()
        {
            ValidateAdmin();
            Storage.Delete(Storage.CurrentContext, PREFIX_UPGRADE_TIME);
            Storage.Delete(Storage.CurrentContext, PREFIX_UPGRADE_HASH);
        }

        // ===================================================================
        //  Platform infrastructure: admin, oracle, AA, pause
        //
        //  Self-contained equivalents of MiniAppBase.  This contract does
        //  NOT inherit from MiniAppContract to avoid class conflicts.
        // ===================================================================

        #region Admin / Oracle / AA getters

        /// <summary>Get the platform admin address.</summary>
        [Safe]
        public static UInt160 Admin()
        {
            ByteString val = Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
            return val == null ? UInt160.Zero : (UInt160)val;
        }

        /// <summary>Get the oracle contract address.</summary>
        [Safe]
        public static UInt160 Oracle()
        {
            ByteString val = Storage.Get(Storage.CurrentContext, PREFIX_ORACLE);
            return val == null ? UInt160.Zero : (UInt160)val;
        }

        /// <summary>Get the abstract account contract address.</summary>
        [Safe]
        public static UInt160 AbstractAccount()
        {
            ByteString val = Storage.Get(Storage.CurrentContext, PREFIX_ABSTRACT_ACCOUNT);
            return val == null ? UInt160.Zero : (UInt160)val;
        }

        /// <summary>Get the PlatformRegistry this engine answers to (zero when unbound).</summary>
        [Safe]
        public static UInt160 Registry()
        {
            ByteString val = Storage.Get(Storage.CurrentContext, PREFIX_GAME_REGISTRY);
            return val == null ? UInt160.Zero : (UInt160)val;
        }

        /// <summary>Check whether the entire contract is paused.</summary>
        [Safe]
        public static bool IsContractPaused()
        {
            ByteString val = Storage.Get(Storage.CurrentContext, PREFIX_PAUSED);
            return val != null && (BigInteger)val == 1;
        }

        #endregion

        #region Admin / Oracle / AA setters

        /// <summary>
        /// Bind the oracle contract address. Initial bind only: once set, the
        /// oracle can only be repointed through the timelocked ProposeOracle /
        /// ExecuteOracleChange pair (audit fix H2). Admin only.
        /// </summary>
        public static void SetOracle(UInt160 oracle)
        {
            ValidateAdmin();
            ValidateAddress(oracle);
            // Audit fix H2: the first bind stays instant so deploy wiring
            // keeps working, but a repoint must go through the timelocked
            // pair below — one compromised admin key cannot instantly
            // redirect the settlement trust root.
            ExecutionEngine.Assert(Oracle() == UInt160.Zero, "oracle already set: use propose/execute");
            Storage.Put(Storage.CurrentContext, PREFIX_ORACLE, oracle);
        }

        /// <summary>Set the abstract account contract. Admin only.</summary>
        public static void SetAbstractAccount(UInt160 abstractAccount)
        {
            ValidateAdmin();
            ValidateAddress(abstractAccount);
            Storage.Put(Storage.CurrentContext, PREFIX_ABSTRACT_ACCOUNT, abstractAccount);
        }

        /// <summary>
        /// Set the PlatformRegistry hash that owns the activateApp /
        /// validateAndApplyDescriptor push ABI (design section 3.3). Admin only.
        /// </summary>
        public static void SetRegistry(UInt160 registry)
        {
            ValidateAdmin();
            ValidateAddress(registry);
            Storage.Put(Storage.CurrentContext, PREFIX_GAME_REGISTRY, registry);
        }

        /// <summary>Emergency pause the entire contract. Admin only.</summary>
        public static void SetContractPaused(bool paused)
        {
            ValidateAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_PAUSED, paused ? 1 : 0);
        }

        #endregion

        // ===================================================================
        //  Platform admin management (with timelock)
        // ===================================================================

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

            // Audit fix M-6 / H-13: emit AdminChanged so off-chain monitors can
            // observe the actual rotation (the prior implementation only signaled
            // on ProposeAdmin, leaving subscribers blind to the actual switch).
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

        // ===================================================================
        //  Platform oracle repoint (with timelock, audit fix H2)
        // ===================================================================

        /// <summary>
        /// Propose a new oracle. The change becomes executable after
        /// TIMELOCK_DELAY_MS. Only the platform admin may call.
        /// </summary>
        public static void ProposeOracle(UInt160 newOracle)
        {
            ValidateAdmin();
            ValidateAddress(newOracle);
            ExecutionEngine.Assert(newOracle != Oracle(), "same oracle");

            BigInteger executeAfter = Runtime.Time + TIMELOCK_DELAY_MS;
            Storage.Put(Storage.CurrentContext, PREFIX_PENDING_ORACLE, newOracle);
            Storage.Put(Storage.CurrentContext, PREFIX_ORACLE_CHANGE_TIME, executeAfter);

            OnOracleChangeProposed(newOracle, executeAfter);
        }

        /// <summary>
        /// Execute a pending oracle change after the timelock expires.
        /// </summary>
        public static void ExecuteOracleChange()
        {
            ByteString pending = Storage.Get(Storage.CurrentContext, PREFIX_PENDING_ORACLE);
            ExecutionEngine.Assert(pending != null, "no pending oracle");

            BigInteger changeTime = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ORACLE_CHANGE_TIME);
            ExecutionEngine.Assert(Runtime.Time >= changeTime, "timelock active");

            UInt160 previousOracle = Oracle();
            UInt160 newOracle = (UInt160)pending;
            Storage.Put(Storage.CurrentContext, PREFIX_ORACLE, newOracle);
            Storage.Delete(Storage.CurrentContext, PREFIX_PENDING_ORACLE);
            Storage.Delete(Storage.CurrentContext, PREFIX_ORACLE_CHANGE_TIME);

            OnOracleChanged(previousOracle, newOracle);
        }

        /// <summary>
        /// Cancel a pending oracle change. Only the current admin may cancel.
        /// </summary>
        public static void CancelOracleChange()
        {
            ValidateAdmin();
            Storage.Delete(Storage.CurrentContext, PREFIX_PENDING_ORACLE);
            Storage.Delete(Storage.CurrentContext, PREFIX_ORACLE_CHANGE_TIME);
        }
    }
}
