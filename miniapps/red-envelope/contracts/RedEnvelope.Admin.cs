using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace RedEnvelope.Contract
{
    public partial class RedEnvelope
    {
        #region Owner Management

        [Safe]
        public static UInt160 GetOwner()
        {
            return (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_OWNER);
        }

        public static void SetOwner(UInt160 newOwner)
        {
            ValidateOwner();
            ExecutionEngine.Assert(newOwner.IsValid, "invalid address");
            Storage.Put(Storage.CurrentContext, PREFIX_OWNER, newOwner);
        }

        [Safe]
        public static bool IsOwner()
        {
            UInt160 owner = GetOwner();
            return owner != null && Runtime.CheckWitness(owner);
        }

        public static bool Verify()
        {
            return IsOwner();
        }

        #endregion

        #region Pause / Resume

        public static void Pause()
        {
            ValidateOwner();
            Storage.Put(Storage.CurrentContext, PREFIX_PAUSED, 1);
        }

        public static void Resume()
        {
            ValidateOwner();
            Storage.Delete(Storage.CurrentContext, PREFIX_PAUSED);
        }

        [Safe]
        public static bool IsPaused()
        {
            ByteString val = Storage.Get(Storage.CurrentContext, PREFIX_PAUSED);
            return val != null && (BigInteger)val != 0;
        }

        #endregion

        #region Upgrade / Destroy

        public static void Update(ByteString nef, string manifest)
        {
            ValidateOwner();
            ContractManagement.Update(nef, manifest);
        }

        public static void Destroy()
        {
            ValidateOwner();
            ContractManagement.Destroy();
        }

        #endregion

        #region Internal

        private static void ValidateOwner()
        {
            UInt160 owner = GetOwner();
            ExecutionEngine.Assert(owner != null && Runtime.CheckWitness(owner), "not owner");
        }

        #endregion
    }
}
