using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHallOfFame
    {
        #region NEP-17 Receiver

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            // Accept GAS deposits for voting
        }

        #endregion
    }
}
