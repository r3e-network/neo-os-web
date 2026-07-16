using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppTarotVrf
    {
        /// <summary>Begin a two-step admin handover.</summary>
        public static void ProposeAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ValidateAddress(newAdmin, "invalid new admin");
            ExecutionEngine.Assert(newAdmin != Admin(), "admin unchanged");
            Storage.Put(Storage.CurrentContext, PREFIX_PENDING_ADMIN, (ByteString)newAdmin);
            OnAdminProposed(Admin(), newAdmin, 0);
        }

        /// <summary>The proposed admin must explicitly witness acceptance.</summary>
        public static void AcceptAdmin()
        {
            ValidateNotBusy();
            UInt160 pending = PendingAdmin();
            ValidateAddress(pending, "pending admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(pending), "pending admin witness required");
            UInt160 previous = Admin();
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, (ByteString)pending);
            Storage.Delete(Storage.CurrentContext, PREFIX_PENDING_ADMIN);
            OnAdminChanged(previous, pending);
        }

        public static void SetPaused(bool paused)
        {
            ValidateAdmin();
            PutInteger(PREFIX_PAUSED, paused ? 1 : 0);
            OnPauseChanged(paused);
        }

        /// <summary>
        /// Propose a deployed Oracle. Activation is delayed, requires pause, and is blocked
        /// while any reading is pending so callbacks cannot be orphaned by an address change.
        /// </summary>
        public static void ProposeOracle(UInt160 newOracle)
        {
            ValidateAdmin();
            ValidateAddress(newOracle, "invalid oracle");
            ExecutionEngine.Assert(newOracle != Oracle(), "oracle unchanged");
            ExecutionEngine.Assert(ContractManagement.GetContract(newOracle) != null, "oracle contract not deployed");
            BigInteger activateAt = Runtime.Time + CHANGE_DELAY_MS;
            Storage.Put(Storage.CurrentContext, PREFIX_PENDING_ORACLE, (ByteString)newOracle);
            Storage.Put(Storage.CurrentContext, PREFIX_ORACLE_ACTIVATE_AT, activateAt);
            OnOracleProposed(Oracle(), newOracle, activateAt);
        }

        public static void ActivateOracle()
        {
            ValidateAdmin();
            UInt160 pending = PendingOracle();
            ValidateAddress(pending, "pending oracle not set");
            ExecutionEngine.Assert(IsPaused(), "pause required");
            ExecutionEngine.Assert(PendingCount() == 0, "pending readings exist");
            ExecutionEngine.Assert(Runtime.Time >= OracleActivationTime(), "oracle change timelocked");

            UInt160 previous = Oracle();
            Storage.Put(Storage.CurrentContext, PREFIX_ORACLE, (ByteString)pending);
            Storage.Delete(Storage.CurrentContext, PREFIX_PENDING_ORACLE);
            Storage.Delete(Storage.CurrentContext, PREFIX_ORACLE_ACTIVATE_AT);
            OnOracleChanged(previous, pending);
        }

        public static void CancelOracleProposal()
        {
            ValidateAdmin();
            Storage.Delete(Storage.CurrentContext, PREFIX_PENDING_ORACLE);
            Storage.Delete(Storage.CurrentContext, PREFIX_ORACLE_ACTIVATE_AT);
        }

        /// <summary>Commit an upgrade hash for delayed, reviewable execution.</summary>
        public static void ProposeUpdate(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(nef != null && nef.Length > 0, "nef required");
            ExecutionEngine.Assert(manifest != null && manifest.Length > 0, "manifest required");
            ByteString nefHash = CryptoLib.Sha256(nef);
            ByteString manifestHash = CryptoLib.Sha256((ByteString)manifest);
            BigInteger activateAt = Runtime.Time + CHANGE_DELAY_MS;
            Storage.Put(Storage.CurrentContext, PREFIX_UPDATE_NEF_HASH, nefHash);
            Storage.Put(Storage.CurrentContext, PREFIX_UPDATE_MANIFEST_HASH, manifestHash);
            Storage.Put(Storage.CurrentContext, PREFIX_UPDATE_ACTIVATE_AT, activateAt);
            OnUpdateProposed(nefHash, manifestHash, activateAt);
        }

        /// <summary>Execute only the committed upgrade after the safety delay.</summary>
        public static void Update(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(IsPaused(), "pause required");
            ExecutionEngine.Assert(PendingCount() == 0, "pending readings exist");
            ExecutionEngine.Assert(UpdateActivationTime() > 0, "update not proposed");
            ExecutionEngine.Assert(Runtime.Time >= UpdateActivationTime(), "update timelocked");

            ByteString expectedNef = Storage.Get(Storage.CurrentContext, PREFIX_UPDATE_NEF_HASH);
            ByteString expectedManifest = Storage.Get(Storage.CurrentContext, PREFIX_UPDATE_MANIFEST_HASH);
            ExecutionEngine.Assert(expectedNef == CryptoLib.Sha256(nef), "nef commitment mismatch");
            ExecutionEngine.Assert(
                expectedManifest == CryptoLib.Sha256((ByteString)manifest),
                "manifest commitment mismatch");

            Storage.Delete(Storage.CurrentContext, PREFIX_UPDATE_NEF_HASH);
            Storage.Delete(Storage.CurrentContext, PREFIX_UPDATE_MANIFEST_HASH);
            Storage.Delete(Storage.CurrentContext, PREFIX_UPDATE_ACTIVATE_AT);
            ContractManagement.Update(nef, manifest, null);
        }

        public static void CancelUpdateProposal()
        {
            ValidateAdmin();
            Storage.Delete(Storage.CurrentContext, PREFIX_UPDATE_NEF_HASH);
            Storage.Delete(Storage.CurrentContext, PREFIX_UPDATE_MANIFEST_HASH);
            Storage.Delete(Storage.CurrentContext, PREFIX_UPDATE_ACTIVATE_AT);
        }
    }
}
