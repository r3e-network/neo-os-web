using System;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppLastSurvivor
    {
        #region Owner lifecycle
        /// <summary>
        /// Contract deployment initialization. Captures the deployer as the contract
        /// owner on first deployment; the owner is preserved across upgrades so an
        /// Update never re-assigns control.
        /// </summary>
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_OWNER, Runtime.Transaction.Sender);
        }

        /// <summary>The contract owner (deployer), authorized to upgrade the contract.</summary>
        [Safe]
        public static UInt160 GetOwner() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_OWNER);

        /// <summary>Owner-gated instant contract upgrade (no timelock).</summary>
        public static void Update(ByteString nef, string manifest)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(GetOwner()), "unauthorized");
            ContractManagement.Update(nef, manifest, new object[0]);
        }
        #endregion
    }
}
