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
    /// Morpheus-kernel stand-in for the skill-game contract test suites. It mirrors the
    /// two kernel surfaces the games use: it hands back an incrementing requestId from
    /// submitMiniAppRequestFromIntegration (as the real kernel does), and it delivers a
    /// finalize result back to a game's onMiniAppResult callback FROM this contract so
    /// the game's caller==Oracle() gate is exercised through a real cross-contract call.
    /// The kernel's RUNTIME_VERIFIER signature check is out of scope here — the games
    /// trust caller==Oracle(), and the kernel's FulfillRequest already verified the TEE
    /// fulfillment. Never deployed to any network.
    /// </summary>
    [DisplayName("GameOracleMockFixture")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Kernel stand-in for skill-game contract tests; never deployed.")]
    [ContractPermission("*", "onMiniAppResult")]
    public class GameOracleMockFixture : SmartContract
    {
        private static readonly byte[] PREFIX_COUNTER = new byte[] { 0x01 };

        /// <summary>Increment and return the next requestId (mirrors the kernel return).</summary>
        public static BigInteger SubmitMiniAppRequestFromIntegration(
            UInt160 requester, string appId, string moduleId, string operation, ByteString payload)
        {
            StorageContext ctx = Storage.CurrentContext;
            BigInteger next = (BigInteger)Storage.Get(ctx, PREFIX_COUNTER) + 1;
            Storage.Put(ctx, PREFIX_COUNTER, next);
            return next;
        }

        /// <summary>Deliver a finalize result to the game's onMiniAppResult callback.</summary>
        public static void Deliver(UInt160 consumer, BigInteger requestId, string appId,
            string moduleId, string operation, UInt160 requester, bool success, ByteString result, string error)
        {
            Contract.Call(consumer, "onMiniAppResult", CallFlags.All,
                requestId, appId, moduleId, operation, requester, success, result, error);
        }

        /// <summary>Deliver via the 5-arg legacy adapter path.</summary>
        public static void DeliverLegacy(UInt160 consumer, BigInteger requestId,
            string operation, bool success, ByteString result, string error)
        {
            Contract.Call(consumer, "onOracleResult", CallFlags.All,
                requestId, operation, success, result, error);
        }
    }
}
