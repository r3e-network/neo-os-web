using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// Hostile engine counterparty that proves the fundEnginePool transit hop
    /// holds its in-flight lock across the engine forward (finding 3). A
    /// genuine reentrant fundEnginePool would abort inside a native-transfer
    /// callback, which hangs the TestEngine host (the documented money-contract
    /// idiom), so this engine instead OBSERVES the registry's transit lock the
    /// moment it receives the forwarded pool credit: lock-down means the
    /// reentry window is open (the pre-fix drain), lock-held means a reentrant
    /// fundEnginePool would trip the "treasury hop in progress" guard (post-fix).
    /// Never deployed to any network.
    /// </summary>
    [DisplayName("ReentrantEngineMockFixture")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Hostile in-engine counterparty probing the fundEnginePool transit lock for PlatformRegistry reentrancy tests; never deployed.")]
    [ContractPermission("*", "transitHopInProgress")]
    public class ReentrantEngineMockFixture : SmartContract
    {
        private static readonly byte[] PREFIX_REGISTRY = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_OBSERVED = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_POOL = new byte[] { 0x03 };

        /// <summary>Point the probe at the registry whose transit lock it reads
        /// during the next forwarded pool credit.</summary>
        public static void Arm(UInt160 registry)
        {
            Storage.Put(Storage.CurrentContext, PREFIX_REGISTRY, (ByteString)registry);
            Storage.Delete(Storage.CurrentContext, PREFIX_OBSERVED);
        }

        // The registry pushes tenants here on attach; a no-op is enough.
        public static void ActivateApp(string appId, UInt160 appAdmin, Map<string, object> descriptor) { }

        public static void ValidateAndApplyDescriptor(string appId, string key, object value) { }

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "only GAS accepted");
            ExecutionEngine.Assert(amount > 0, "invalid amount");

            ByteString registry = Storage.Get(Storage.CurrentContext, PREFIX_REGISTRY);
            if (registry != null)
            {
                // A reentrant fundEnginePool would see this same lock state:
                // record 2 (lock held -> reentry blocked) or 1 (lock down ->
                // reentry window open) so the test can assert which it was.
                bool inProgress = (bool)Contract.Call(
                    (UInt160)registry, "transitHopInProgress", CallFlags.ReadOnly);
                Storage.Put(Storage.CurrentContext, PREFIX_OBSERVED, inProgress ? 2 : 1);
            }

            BigInteger pool = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_POOL);
            Storage.Put(Storage.CurrentContext, PREFIX_POOL, pool + amount);
        }

        /// <summary>0 = never received a forward, 1 = lock was down during the
        /// forward, 2 = lock was held during the forward.</summary>
        [Safe]
        public static BigInteger ObservedHopInProgress() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_OBSERVED);

        [Safe]
        public static BigInteger PoolReceived() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_POOL);
    }
}
