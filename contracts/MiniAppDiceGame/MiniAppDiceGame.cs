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
    public delegate void DiceRolledHandler(UInt160 player, BigInteger chosen, BigInteger rolled, BigInteger payout);

    [DisplayName("MiniAppDiceGame")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Dice Game MiniApp - Roll dice, win up to 6x")]
    [ContractPermission("*", "*")]
    public class MiniAppDiceGame : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_GATEWAY = new byte[] { 0x02 };

        [DisplayName("DiceRolled")]
        public static event DiceRolledHandler OnDiceRolled;

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }

        public static UInt160 Admin() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
        public static UInt160 Gateway() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_GATEWAY);

        private static void ValidateAdmin()
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Admin()), "unauthorized");
        }

        public static void SetAdmin(UInt160 newAdmin) { ValidateAdmin(); Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin); }
        public static void SetGateway(UInt160 gateway) { ValidateAdmin(); Storage.Put(Storage.CurrentContext, PREFIX_GATEWAY, gateway); }

        public static void Roll(UInt160 player, BigInteger chosenNumber, BigInteger betAmount, ByteString randomness)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == Gateway(), "only gateway");
            ExecutionEngine.Assert(chosenNumber >= 1 && chosenNumber <= 6, "choose 1-6");

            BigInteger rolled = (((byte[])randomness)[0] % 6) + 1;
            BigInteger payout = rolled == chosenNumber ? betAmount * 6 * 95 / 100 : 0;
            OnDiceRolled(player, chosenNumber, rolled, payout);
        }

        public static void OnServiceCallback(BigInteger requestId, string appId, string serviceType, bool success, ByteString result, string error)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == Gateway(), "unauthorized");
        }

        public static void Update(ByteString nefFile, string manifest) { ValidateAdmin(); ContractManagement.Update(nefFile, manifest, null); }
    }
}
