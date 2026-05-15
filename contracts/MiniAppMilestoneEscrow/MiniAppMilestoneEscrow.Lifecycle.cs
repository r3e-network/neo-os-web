using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppMilestoneEscrow
    {
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_ESCROW_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_LOCKED, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_RELEASED, 0);
        }

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            if (Runtime.CallingScriptHash == NEO.Hash)
            {
                CreditDirectAssetPayment(APP_ID, NEO.Hash, from, amount, data);
                return;
            }
            if (Runtime.CallingScriptHash == GAS.Hash)
            {
                CreditDirectAssetPayment(APP_ID, GAS.Hash, from, amount, data);
                return;
            }

            ExecutionEngine.Assert(false, "unsupported asset");
        }
    }
}
