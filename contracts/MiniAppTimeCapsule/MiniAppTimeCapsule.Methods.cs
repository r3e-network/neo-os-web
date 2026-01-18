using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppTimeCapsule
    {
        #region User Methods

        /// <summary>
        /// Bury a new time capsule with category and title.
        /// </summary>
        public static BigInteger Bury(UInt160 owner, string contentHash, string title, BigInteger unlockTime, bool isPublic, BigInteger category, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(contentHash.Length > 0, "empty content hash");
            ExecutionEngine.Assert(title.Length <= 100, "title too long");
            ExecutionEngine.Assert(category >= 1 && category <= 5, "invalid category");

            BigInteger lockDuration = unlockTime - Runtime.Time;
            ExecutionEngine.Assert(lockDuration >= MIN_LOCK_DURATION_SECONDS, "lock too short");
            ExecutionEngine.Assert(lockDuration <= MAX_LOCK_DURATION_SECONDS, "lock too long");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            ValidatePaymentReceipt(APP_ID, owner, BURY_FEE, receiptId);

            BigInteger capsuleId = NextItemId();

            CapsuleData capsule = new CapsuleData
            {
                Owner = owner,
                ContentHash = contentHash,
                Category = category,
                UnlockTime = unlockTime,
                CreateTime = Runtime.Time,
                IsPublic = isPublic,
                IsRevealed = false,
                Revealer = UInt160.Zero,
                RevealTime = 0,
                RecipientCount = 0,
                ExtensionCount = 0,
                Title = title,
                IsGifted = false,
                OriginalOwner = owner
            };
            StoreCapsule(capsuleId, capsule);

            // Index by hash
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_HASH_INDEX, contentHash), capsuleId);

            AddUserCapsule(owner, capsuleId);
            UpdateUserStatsOnBury(owner, category);
            UpdateCategoryCount(category, 1);

            if (isPublic)
            {
                BigInteger publicCount = TotalPublicCapsules();
                Storage.Put(Storage.CurrentContext, PREFIX_PUBLIC_COUNT, publicCount + 1);
            }

            SetUnlockTime(capsuleId, unlockTime);

            OnCapsuleBuried(owner, capsuleId, unlockTime, isPublic, category);
            return capsuleId;
        }

        #endregion
    }
}
