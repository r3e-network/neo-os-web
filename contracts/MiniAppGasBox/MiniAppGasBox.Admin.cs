using System;
using System.ComponentModel;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGasBox : SmartContract
    {
        #region Owner / upgrade
        private static readonly byte[] PREFIX_OWNER = new byte[] { 0x01 }; // deployer-set contract owner

        [DisplayName("ContractUpgraded")]
        public static event Action OnContractUpgraded;

        /// <summary>
        /// Capture the deployer as the contract owner on first deployment. The
        /// owner is never reset on upgrade so an owner-gated Update cannot orphan
        /// the contract.
        /// </summary>
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_OWNER, Runtime.Transaction.Sender);
        }

        /// <summary>The deployer-set owner authorized to upgrade the contract.</summary>
        [Safe]
        public static UInt160 GetOwner()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_OWNER);
            return raw is null ? UInt160.Zero : (UInt160)raw;
        }

        /// <summary>
        /// Owner-gated, instant (no timelock) contract upgrade. Replaces the NEF
        /// and manifest in place via ContractManagement.Update; the nccs compiler
        /// auto-infers the required ContractManagement "update" permission from
        /// this call, so no explicit [ContractPermission] entry is needed.
        /// </summary>
        public static void Update(ByteString nef, string manifest)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(GetOwner()), "unauthorized");
            ContractManagement.Update(nef, manifest, new object[0]);
            OnContractUpgraded();
        }
        #endregion
    }
}
