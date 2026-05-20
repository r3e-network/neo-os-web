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

        /// <summary>Upgrade the contract. Only the platform admin may call.</summary>
        public static void Update(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nef, manifest, new object[0]);
            // Audit fix H-13: declare a typed `ContractUpgraded` event on this
            // contract and raise it here once added.
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

        /// <summary>Check whether the entire contract is paused.</summary>
        [Safe]
        public static bool IsContractPaused()
        {
            ByteString val = Storage.Get(Storage.CurrentContext, PREFIX_PAUSED);
            return val != null && (BigInteger)val == 1;
        }

        #endregion

        #region Admin / Oracle / AA setters

        /// <summary>Set the oracle contract address. Admin only.</summary>
        public static void SetOracle(UInt160 oracle)
        {
            ValidateAdmin();
            ValidateAddress(oracle);
            Storage.Put(Storage.CurrentContext, PREFIX_ORACLE, oracle);
        }

        /// <summary>Set the abstract account contract. Admin only.</summary>
        public static void SetAbstractAccount(UInt160 abstractAccount)
        {
            ValidateAdmin();
            ValidateAddress(abstractAccount);
            Storage.Put(Storage.CurrentContext, PREFIX_ABSTRACT_ACCOUNT, abstractAccount);
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
        /// after TIMELOCK_DELAY_SECONDS.
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

            // Audit fix M-6 / H-13: declare a typed `AdminChanged` event on this
            // contract so off-chain monitors can see the actual switch (the prior
            // implementation only signaled on `ProposeAdmin`, leaving subscribers
            // blind to the moment the admin actually rotated).
            UInt160 newAdmin = (UInt160)pending;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
            Storage.Delete(Storage.CurrentContext, PREFIX_PENDING_PLATFORM_ADMIN);
            Storage.Delete(Storage.CurrentContext, PREFIX_PLATFORM_ADMIN_CHANGE_TIME);
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
    }
}
