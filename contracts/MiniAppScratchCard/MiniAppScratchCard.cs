using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public delegate void CardRevealedHandler(UInt160 player, BigInteger cardType, BigInteger prize);

    [DisplayName("MiniAppScratchCard")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Scratch Card MiniApp - Instant win cards")]
    [ContractPermission("*", "*")]
    public class MiniAppScratchCard : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_GATEWAY = new byte[] { 0x02 };

        [DisplayName("CardRevealed")]
        public static event CardRevealedHandler OnCardRevealed;

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }

        public static UInt160 Admin() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
        public static UInt160 Gateway() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_GATEWAY);
        private static void ValidateAdmin() { ExecutionEngine.Assert(Runtime.CheckWitness(Admin()), "unauthorized"); }

        public static void SetAdmin(UInt160 newAdmin) { ValidateAdmin(); Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin); }
        public static void SetGateway(UInt160 gateway) { ValidateAdmin(); Storage.Put(Storage.CurrentContext, PREFIX_GATEWAY, gateway); }

        public static void Reveal(UInt160 player, BigInteger cardType, BigInteger cost, ByteString randomness)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == Gateway(), "only gateway");
            BigInteger rand = ((byte[])randomness)[0] % 100;
            BigInteger prize = rand < 20 ? cost * cardType * 2 * 95 / 100 : 0;
            OnCardRevealed(player, cardType, prize);
        }

        public static void OnServiceCallback(BigInteger requestId, string appId, string serviceType, bool success, ByteString result, string error)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == Gateway(), "unauthorized");
        }

        public static void Update(ByteString nefFile, string manifest) { ValidateAdmin(); ContractManagement.Update(nefFile, manifest, null); }
    }
}
