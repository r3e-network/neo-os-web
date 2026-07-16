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
    /// Test-only PlatformRegistry counterparty for the AppAccount suites
    /// (the TarotOracleMockFixture idiom). It exposes the pinned pause read —
    /// [Safe] getGlobalPause() returning [paused(bool), pausedAt(ms)] — and
    /// relays calls to a minted account so Runtime.CallingScriptHash on the
    /// account genuinely equals the stored registry hash. Never deployed to
    /// any network.
    /// </summary>
    [DisplayName("RegistryMockFixture")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "In-engine registry counterparty for AppAccount cross-contract gate tests; never deployed.")]
    [ContractPermission("*", "executeTransfer", "bindRegistry", "onAdminRotated", "setPaused", "update")]
    public class RegistryMockFixture : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_PAUSED = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_PAUSED_AT = new byte[] { 0x03 };

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, (ByteString)Runtime.Transaction.Sender);
        }

        /// <summary>
        /// The registry pause read the AppAccount escape hatch consumes.
        /// Shape pinned by AppAccountSourceSecurityTests: [paused, pausedAtMs].
        /// </summary>
        [Safe]
        public static object[] GetGlobalPause()
        {
            bool paused = Storage.Get(Storage.CurrentContext, PREFIX_PAUSED) != null;
            ByteString rawAt = Storage.Get(Storage.CurrentContext, PREFIX_PAUSED_AT);
            BigInteger pausedAt = rawAt == null ? 0 : (BigInteger)rawAt;
            return new object[] { paused, pausedAt };
        }

        public static void SetGlobalPause(bool paused, BigInteger pausedAtMs)
        {
            ValidateAdmin();
            if (paused)
            {
                Storage.Put(Storage.CurrentContext, PREFIX_PAUSED, 1);
                Storage.Put(Storage.CurrentContext, PREFIX_PAUSED_AT, pausedAtMs);
            }
            else
            {
                Storage.Delete(Storage.CurrentContext, PREFIX_PAUSED);
                Storage.Delete(Storage.CurrentContext, PREFIX_PAUSED_AT);
            }
        }

        // ---- relays: make this fixture the account's calling script ----
        public static void CallExecuteTransfer(UInt160 account, UInt160 asset, UInt160 target, BigInteger amount)
        {
            Contract.Call(account, "executeTransfer", CallFlags.All, asset, target, amount);
        }

        public static string CallBindRegistry(UInt160 account)
        {
            return (string)Contract.Call(account, "bindRegistry", CallFlags.All);
        }

        public static void CallOnAdminRotated(UInt160 account, UInt160 newAdmin)
        {
            Contract.Call(account, "onAdminRotated", CallFlags.All, newAdmin);
        }

        public static void CallSetPaused(UInt160 account, bool paused)
        {
            Contract.Call(account, "setPaused", CallFlags.All, paused);
        }

        public static void CallUpdate(UInt160 account, ByteString nef, string manifest)
        {
            Contract.Call(account, "update", CallFlags.All, nef, manifest);
        }

        private static void ValidateAdmin()
        {
            UInt160 admin = (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "admin only");
        }
    }
}
