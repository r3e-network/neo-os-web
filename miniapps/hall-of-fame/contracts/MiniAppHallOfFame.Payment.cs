using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHallOfFame
    {
        #region NEP-17 Receiver

        /// <summary>
        /// Handle NEP-17 token payments (GAS deposits).
        /// 
        /// Used for accepting GAS deposits for voting.
        /// Payments are validated through the payment receipt system.
        /// </summary>
        /// <param name="from">Sender address</param>
        /// <param name="amount">Payment amount</param>
        /// <param name="data">Payment data</param>
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            // Accept GAS deposits for voting
        }

        #endregion
    }
}
