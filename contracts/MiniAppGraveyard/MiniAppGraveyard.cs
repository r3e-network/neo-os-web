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
    public delegate void MemoryBuriedHandler(BigInteger memoryId, UInt160 owner, string contentHash);
    public delegate void MemoryForgottenHandler(BigInteger memoryId);

    /// <summary>
    /// Digital Graveyard - Pay to permanently delete encrypted data.
    /// </summary>
    [DisplayName("MiniAppGraveyard")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. Graveyard is a data management application for permanent deletion. Use it to bury encrypted memories on-chain, you can permanently forget data with verified deletion proofs.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-graveyard";
        private const long BURY_FEE = 10000000; // 0.1 GAS
        private const long FORGET_FEE = 100000000; // 1 GAS
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_MEMORY_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_MEMORY_OWNER = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_MEMORY_HASH = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_MEMORY_FORGOTTEN = new byte[] { 0x13 };
        #endregion

        #region Events
        [DisplayName("MemoryBuried")]
        public static event MemoryBuriedHandler OnMemoryBuried;

        [DisplayName("MemoryForgotten")]
        public static event MemoryForgottenHandler OnMemoryForgotten;
        #endregion

        #region Getters
        [Safe]
        public static BigInteger TotalMemories() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_MEMORY_ID);

        [Safe]
        public static bool IsForgotten(BigInteger memoryId)
        {
            byte[] key = Helper.Concat(PREFIX_MEMORY_FORGOTTEN, (ByteString)memoryId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_MEMORY_ID, 0);
        }
        #endregion

        #region User Methods

        public static void BuryMemory(UInt160 owner, string contentHash, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(contentHash.Length > 0, "invalid content");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            ValidatePaymentReceipt(APP_ID, owner, BURY_FEE, receiptId);

            BigInteger memoryId = TotalMemories() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_MEMORY_ID, memoryId);

            byte[] ownerKey = Helper.Concat(PREFIX_MEMORY_OWNER, (ByteString)memoryId.ToByteArray());
            Storage.Put(Storage.CurrentContext, ownerKey, owner);

            byte[] hashKey = Helper.Concat(PREFIX_MEMORY_HASH, (ByteString)memoryId.ToByteArray());
            Storage.Put(Storage.CurrentContext, hashKey, contentHash);

            OnMemoryBuried(memoryId, owner, contentHash);
        }

        public static void ForgetMemory(UInt160 owner, BigInteger memoryId, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(!IsForgotten(memoryId), "already forgotten");

            byte[] ownerKey = Helper.Concat(PREFIX_MEMORY_OWNER, (ByteString)memoryId.ToByteArray());
            ExecutionEngine.Assert((UInt160)Storage.Get(Storage.CurrentContext, ownerKey) == owner, "not owner");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            ValidatePaymentReceipt(APP_ID, owner, FORGET_FEE, receiptId);

            byte[] forgottenKey = Helper.Concat(PREFIX_MEMORY_FORGOTTEN, (ByteString)memoryId.ToByteArray());
            Storage.Put(Storage.CurrentContext, forgottenKey, 1);

            // Clear content hash (TEE will destroy encryption key)
            byte[] hashKey = Helper.Concat(PREFIX_MEMORY_HASH, (ByteString)memoryId.ToByteArray());
            Storage.Delete(Storage.CurrentContext, hashKey);

            OnMemoryForgotten(memoryId);
        }

        /// <summary>
        /// SECURITY FIX: Allow admin to withdraw collected fees.
        /// </summary>
        public static void WithdrawFees(UInt160 recipient, BigInteger amount)
        {
            ValidateAdmin();
            ValidateAddress(recipient);
            ExecutionEngine.Assert(amount > 0, "amount must be positive");

            BigInteger balance = GAS.BalanceOf(Runtime.ExecutingScriptHash);
            ExecutionEngine.Assert(balance >= amount, "insufficient balance");

            bool transferred = GAS.Transfer(Runtime.ExecutingScriptHash, recipient, amount);
            ExecutionEngine.Assert(transferred, "withdraw failed");
        }

        #endregion
    }
}
