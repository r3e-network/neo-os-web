using System;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        #region NEP-17 Receiver

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            if (Runtime.CallingScriptHash != GAS.Hash)
            {
                throw new Exception("Only GAS accepted");
            }

            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            if (from == Runtime.ExecutingScriptHash) return;
        }

        #endregion
    }
}
