using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // Event delegates for TimeCapsule lifecycle
    public delegate void CapsuleBuriedHandler(UInt160 owner, BigInteger capsuleId, BigInteger unlockTime, bool isPublic, BigInteger category);
    public delegate void CapsuleRevealedHandler(BigInteger capsuleId, UInt160 revealer, string contentHash);
    public delegate void CapsuleFishedHandler(UInt160 fisher, BigInteger capsuleId, BigInteger reward);
    public delegate void CapsuleGiftedHandler(BigInteger capsuleId, UInt160 from, UInt160 to);
    public delegate void CapsuleExtendedHandler(BigInteger capsuleId, BigInteger newUnlockTime);
    public delegate void RecipientAddedHandler(BigInteger capsuleId, UInt160 recipient);

    /// <summary>
    /// TEE Time Capsule - Complete encrypted message platform.
    /// </summary>
    [DisplayName("MiniAppTimeCapsule")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "3.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. TimeCapsule is a complete encrypted message platform with categories, recipients, fishing rewards, gifting, and TEE-protected privacy.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppTimeCapsule : MiniAppTimeLockBase
    {
        #region App Constants
        private const string APP_ID = "miniapp-time-capsule";
        private const long BURY_FEE = 20000000;         // 0.2 GAS
        private const long FISH_FEE = 5000000;          // 0.05 GAS
        private const long EXTEND_FEE = 10000000;       // 0.1 GAS
        private const long GIFT_FEE = 15000000;         // 0.15 GAS
        private const long FISH_REWARD = 2000000;       // 0.02 GAS reward
        private const long MIN_LOCK_DURATION_SECONDS = 86400;  // 1 day minimum
        private const long MAX_LOCK_DURATION_SECONDS = 31536000; // 10 years max
        #endregion

        #region App Storage Prefixes (0x20+)
        private static readonly byte[] PREFIX_CAPSULES = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_HASH_INDEX = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_USER_STATS = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_USER_CAPSULES = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_USER_CAPSULE_COUNT = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_RECIPIENTS = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_RECIPIENT_COUNT = new byte[] { 0x26 };
        private static readonly byte[] PREFIX_CATEGORY_COUNT = new byte[] { 0x27 };
        private static readonly byte[] PREFIX_PUBLIC_COUNT = new byte[] { 0x28 };
        private static readonly byte[] PREFIX_TOTAL_REVEALED = new byte[] { 0x29 };
        private static readonly byte[] PREFIX_TOTAL_FISHED = new byte[] { 0x2A };
        private static readonly byte[] PREFIX_TOTAL_GIFTED = new byte[] { 0x2B };
        #endregion

        #region Data Structures
        public struct CapsuleData
        {
            public UInt160 Owner;
            public string ContentHash;
            public BigInteger Category;
            public BigInteger UnlockTime;
            public BigInteger CreateTime;
            public bool IsPublic;
            public bool IsRevealed;
            public UInt160 Revealer;
            public BigInteger RevealTime;
            public BigInteger RecipientCount;
            public BigInteger ExtensionCount;
            public string Title;
            public bool IsGifted;
            public UInt160 OriginalOwner;
        }

        public struct UserStats
        {
            public BigInteger CapsulesBuried;
            public BigInteger CapsulesRevealed;
            public BigInteger CapsulesFished;
            public BigInteger CapsulesGifted;
            public BigInteger CapsulesReceived;
            public BigInteger TotalSpent;
            public BigInteger TotalEarned;
            public BigInteger FishingRewards;
            public BigInteger JoinTime;
            public BigInteger FavCategory;
        }
        #endregion

        #region Events
        [DisplayName("CapsuleBuried")]
        public static event CapsuleBuriedHandler OnCapsuleBuried;

        [DisplayName("CapsuleRevealed")]
        public static event CapsuleRevealedHandler OnCapsuleRevealed;

        [DisplayName("CapsuleFished")]
        public static event CapsuleFishedHandler OnCapsuleFished;

        [DisplayName("CapsuleGifted")]
        public static event CapsuleGiftedHandler OnCapsuleGifted;

        [DisplayName("CapsuleExtended")]
        public static event CapsuleExtendedHandler OnCapsuleExtended;

        [DisplayName("RecipientAdded")]
        public static event RecipientAddedHandler OnRecipientAdded;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_PUBLIC_COUNT, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_REVEALED, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_FISHED, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_GIFTED, 0);
        }
        #endregion

        #region Read Methods
        [Safe]
        public static BigInteger TotalCapsules() => TotalItems();

        [Safe]
        public static BigInteger TotalPublicCapsules() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PUBLIC_COUNT);

        [Safe]
        public static BigInteger TotalRevealed() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_REVEALED);

        [Safe]
        public static BigInteger TotalFished() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_FISHED);

        [Safe]
        public static BigInteger TotalGifted() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_GIFTED);

        [Safe]
        public static CapsuleData GetCapsuleData(BigInteger capsuleId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_CAPSULES, (ByteString)capsuleId.ToByteArray()));
            if (data == null) return new CapsuleData();
            return (CapsuleData)StdLib.Deserialize(data);
        }

        [Safe]
        public static UserStats GetUserStats(UInt160 user)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_USER_STATS, user));
            if (data == null) return new UserStats();
            return (UserStats)StdLib.Deserialize(data);
        }

        [Safe]
        public static BigInteger GetUserCapsuleCount(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_CAPSULE_COUNT, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetCategoryCount(BigInteger category)
        {
            byte[] key = Helper.Concat(PREFIX_CATEGORY_COUNT, (ByteString)category.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static bool IsRecipient(BigInteger capsuleId, UInt160 user)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_RECIPIENTS, (ByteString)capsuleId.ToByteArray()),
                user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }

        [Safe]
        public static BigInteger GetRecipientCount(BigInteger capsuleId)
        {
            byte[] key = Helper.Concat(PREFIX_RECIPIENT_COUNT, (ByteString)capsuleId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }
        #endregion
    }
}
