using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDailyCheckin
    {
        #region Receipt Validation

        private static void ValidateAndUseReceipt(BigInteger receiptId)
        {
            ExecutionEngine.Assert(receiptId > 0, "invalid receipt");
            byte[] key = Helper.Concat(PREFIX_RECEIPT_USED, receiptId.ToByteArray());
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, key) == null, "receipt used");
            Storage.Put(Storage.CurrentContext, key, 1);
        }

        #endregion
    }
}
