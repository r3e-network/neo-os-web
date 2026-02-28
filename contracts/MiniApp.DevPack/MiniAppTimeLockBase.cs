using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// MiniApp DevPack - TimeLock Base Class
    ///
    /// Extends MiniAppBase with time-locked operation functionality:
    /// - Time-based unlock mechanisms
    /// - Scheduled releases
    /// - Expiration tracking
    ///
    /// STORAGE LAYOUT (0x1C-0x1F):
    /// - 0x1C: Item unlock times
    /// - 0x1D: Item revealed status
    /// - 0x1E: Item counter
    /// - 0x1F: Reserved
    ///
    /// USE FOR:
    /// - MiniAppTimeCapsule
    /// - Any MiniApp with time-locked content
    /// </summary>
    public abstract class MiniAppTimeLockBase : MiniAppBase
    {
        #region TimeLock Storage Prefixes (0x1C-0x1F)

        protected static readonly byte[] PREFIX_ITEM_UNLOCK_TIME = new byte[] { 0x1C };
        protected static readonly byte[] PREFIX_ITEM_REVEALED = new byte[] { 0x1D };
        protected static readonly byte[] PREFIX_ITEM_COUNTER = new byte[] { 0x1E };

        #endregion

        #region Events

        public delegate void ItemLockedHandler(BigInteger itemId, BigInteger unlockTime);
        public delegate void ItemUnlockedHandler(BigInteger itemId, UInt160 unlocker);

        [DisplayName("ItemLocked")]
        public static event ItemLockedHandler OnItemLocked;

        [DisplayName("ItemUnlocked")]
        public static event ItemUnlockedHandler OnItemUnlocked;

        #endregion

        #region Item Counter

        protected static BigInteger NextItemId()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_ITEM_COUNTER);
            BigInteger current = data == null ? 0 : (BigInteger)data;
            BigInteger next = current + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_ITEM_COUNTER, next);
            return next;
        }

        [Safe]
        public static BigInteger TotalItems()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_ITEM_COUNTER);
            return data == null ? 0 : (BigInteger)data;
        }

        #endregion

        #region TimeLock Getters

        [Safe]
        public static BigInteger GetUnlockTime(BigInteger itemId)
        {
            byte[] key = Helper.Concat(PREFIX_ITEM_UNLOCK_TIME,
                (ByteString)itemId.ToByteArray());
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }

        [Safe]
        public static bool IsRevealed(BigInteger itemId)
        {
            byte[] key = Helper.Concat(PREFIX_ITEM_REVEALED,
                (ByteString)itemId.ToByteArray());
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data != null && (BigInteger)data == 1;
        }

        [Safe]
        public static bool IsUnlockable(BigInteger itemId)
        {
            BigInteger unlockTime = GetUnlockTime(itemId);
            return unlockTime > 0 && Runtime.Time >= unlockTime && !IsRevealed(itemId);
        }

        [Safe]
        public static BigInteger TimeRemaining(BigInteger itemId)
        {
            BigInteger unlockTime = GetUnlockTime(itemId);
            if (unlockTime == 0) return 0;
            if (Runtime.Time >= unlockTime) return 0;
            return unlockTime - Runtime.Time;
        }

        #endregion

        #region TimeLock Operations

        protected static void SetUnlockTime(BigInteger itemId, BigInteger unlockTime)
        {
            ExecutionEngine.Assert(unlockTime > Runtime.Time, "unlock time must be future");

            byte[] key = Helper.Concat(PREFIX_ITEM_UNLOCK_TIME,
                (ByteString)itemId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, unlockTime);

            OnItemLocked(itemId, unlockTime);
        }

        protected static void ValidateUnlockable(BigInteger itemId)
        {
            BigInteger unlockTime = GetUnlockTime(itemId);
            ExecutionEngine.Assert(unlockTime > 0, "item not found");
            ExecutionEngine.Assert(Runtime.Time >= unlockTime, "still locked");
            ExecutionEngine.Assert(!IsRevealed(itemId), "already revealed");
        }

        protected static void MarkRevealed(BigInteger itemId, UInt160 revealer)
        {
            byte[] key = Helper.Concat(PREFIX_ITEM_REVEALED,
                (ByteString)itemId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);

            OnItemUnlocked(itemId, revealer);
        }

        #endregion
    }
}
