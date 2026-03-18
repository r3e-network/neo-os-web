using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            CreditDirectGasPayment(APP_ID, from, amount, data);
        }
    }
}
