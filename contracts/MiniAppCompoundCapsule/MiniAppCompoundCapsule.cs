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
    public delegate void CapsuleCreatedHandler(BigInteger capsuleId, UInt160 owner, BigInteger principal, BigInteger unlockTime);
    public delegate void CapsuleUnlockedHandler(BigInteger capsuleId, UInt160 owner, BigInteger total);

    /// <summary>
    /// Compound Time Capsule - Forced savings with auto-compounding.
    /// </summary>
    [DisplayName("MiniAppCompoundCapsule")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. CompoundCapsule is an auto-compounding vault for yield optimization. Use it to lock assets with time-based unlocking, you can maximize returns through automated compounding.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-compound-capsule";
        private const int PLATFORM_FEE_PERCENT = 2;
        private const ulong MIN_LOCK_DURATION = 604800000; // 7 days minimum lock
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_CAPSULE_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_CAPSULE_OWNER = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_CAPSULE_PRINCIPAL = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_CAPSULE_UNLOCK = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_CAPSULE_COMPOUND = new byte[] { 0x14 };
        #endregion

        #region Events
        [DisplayName("CapsuleCreated")]
        public static event CapsuleCreatedHandler OnCapsuleCreated;

        [DisplayName("CapsuleUnlocked")]
        public static event CapsuleUnlockedHandler OnCapsuleUnlocked;
        #endregion

        #region Getters
        [Safe]
        public static BigInteger TotalCapsules() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_CAPSULE_ID);
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_CAPSULE_ID, 0);
        }
        #endregion

        #region User Methods

        public static void CreateCapsule(UInt160 owner, BigInteger neoAmount, BigInteger unlockTime)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(neoAmount > 0, "invalid amount");
            ExecutionEngine.Assert(unlockTime > Runtime.Time, "invalid unlock time");
            // Enforce minimum 7-day lock period
            ExecutionEngine.Assert(unlockTime >= Runtime.Time + MIN_LOCK_DURATION, "min 7 day lock required");
            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "unauthorized");

            NEO.Transfer(owner, Runtime.ExecutingScriptHash, neoAmount);

            BigInteger capsuleId = TotalCapsules() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_CAPSULE_ID, capsuleId);

            byte[] ownerKey = Helper.Concat(PREFIX_CAPSULE_OWNER, (ByteString)capsuleId.ToByteArray());
            Storage.Put(Storage.CurrentContext, ownerKey, owner);

            byte[] principalKey = Helper.Concat(PREFIX_CAPSULE_PRINCIPAL, (ByteString)capsuleId.ToByteArray());
            Storage.Put(Storage.CurrentContext, principalKey, neoAmount);

            byte[] unlockKey = Helper.Concat(PREFIX_CAPSULE_UNLOCK, (ByteString)capsuleId.ToByteArray());
            Storage.Put(Storage.CurrentContext, unlockKey, unlockTime);

            OnCapsuleCreated(capsuleId, owner, neoAmount, unlockTime);
        }

        public static void UnlockCapsule(UInt160 owner, BigInteger capsuleId)
        {
            ValidateNotGloballyPaused(APP_ID);

            byte[] ownerKey = Helper.Concat(PREFIX_CAPSULE_OWNER, (ByteString)capsuleId.ToByteArray());
            ExecutionEngine.Assert((UInt160)Storage.Get(Storage.CurrentContext, ownerKey) == owner, "not owner");

            byte[] unlockKey = Helper.Concat(PREFIX_CAPSULE_UNLOCK, (ByteString)capsuleId.ToByteArray());
            BigInteger unlockTime = (BigInteger)Storage.Get(Storage.CurrentContext, unlockKey);
            ExecutionEngine.Assert(Runtime.Time >= unlockTime, "not yet unlocked");

            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "unauthorized");

            byte[] principalKey = Helper.Concat(PREFIX_CAPSULE_PRINCIPAL, (ByteString)capsuleId.ToByteArray());
            BigInteger principal = (BigInteger)Storage.Get(Storage.CurrentContext, principalKey);

            byte[] compoundKey = Helper.Concat(PREFIX_CAPSULE_COMPOUND, (ByteString)capsuleId.ToByteArray());
            BigInteger compound = (BigInteger)Storage.Get(Storage.CurrentContext, compoundKey);

            BigInteger total = principal + compound;
            BigInteger fee = total * PLATFORM_FEE_PERCENT / 100;
            BigInteger payout = total - fee;

            Storage.Delete(Storage.CurrentContext, principalKey);
            Storage.Delete(Storage.CurrentContext, compoundKey);

            NEO.Transfer(Runtime.ExecutingScriptHash, owner, principal);
            if (compound > fee)
            {
                GAS.Transfer(Runtime.ExecutingScriptHash, owner, compound - fee);
            }

            OnCapsuleUnlocked(capsuleId, owner, payout);
        }

        #endregion
    }
}
