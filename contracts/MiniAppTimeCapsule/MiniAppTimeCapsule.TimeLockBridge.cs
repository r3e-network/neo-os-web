using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        private abstract class TimeLockAccessor : MiniAppTimeLockBase
        {
            internal static BigInteger NextId() => NextItemId();

            internal static void PutUnlockTime(BigInteger itemId, BigInteger unlockTime)
            {
                ExecutionEngine.Assert(unlockTime > Runtime.Time, "unlock time must be future");

                byte[] key = Helper.Concat(PREFIX_ITEM_UNLOCK_TIME, (ByteString)itemId.ToByteArray());
                Storage.Put(Storage.CurrentContext, key, unlockTime);
            }

            internal static void PutRevealed(BigInteger itemId, UInt160 revealer)
            {
                byte[] key = Helper.Concat(PREFIX_ITEM_REVEALED, (ByteString)itemId.ToByteArray());
                Storage.Put(Storage.CurrentContext, key, 1);
            }
        }

        private static BigInteger TotalItems() =>
            MiniAppTimeLockBase.TotalItems();

        private static BigInteger NextItemId() =>
            TimeLockAccessor.NextId();

        private static void SetUnlockTime(BigInteger itemId, BigInteger unlockTime) =>
            TimeLockAccessor.PutUnlockTime(itemId, unlockTime);

        private static void MarkRevealed(BigInteger itemId, UInt160 revealer) =>
            TimeLockAccessor.PutRevealed(itemId, revealer);
    }
}
