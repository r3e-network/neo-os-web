using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            if (from == Runtime.ExecutingScriptHash || amount <= 0) return;

            if (Runtime.CallingScriptHash == NEO.Hash)
            {
                CreditDirectAssetPayment(APP_ID, NEO.Hash, from, amount, data);
                return;
            }

            if (Runtime.CallingScriptHash == GAS.Hash)
            {
                return;
            }

            ExecutionEngine.Assert(false, "unsupported asset");
        }
    }
}
