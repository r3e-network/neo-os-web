using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        private abstract class TimeLockAccessor : MiniAppTimeLockBase
        {
            internal static BigInteger NextId() => NextItemId();

            internal static void PutUnlockTime(BigInteger itemId, BigInteger unlockTime) =>
                SetUnlockTime(itemId, unlockTime);

            internal static void PutRevealed(BigInteger itemId, UInt160 revealer) =>
                MarkRevealed(itemId, revealer);
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
