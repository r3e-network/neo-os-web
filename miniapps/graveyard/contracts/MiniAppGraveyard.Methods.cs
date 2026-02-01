using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGraveyard
    {
        #region User Methods

        /// <summary>
        /// Bury a new encrypted memory on-chain.
        /// </summary>
        public static BigInteger BuryMemory(UInt160 owner, string contentHash, BigInteger memoryType, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(contentHash.Length > 0, "invalid content");
            ExecutionEngine.Assert(memoryType >= 1 && memoryType <= 5, "invalid type");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            ValidatePaymentReceipt(APP_ID, owner, BURY_FEE, receiptId);

            UserStats stats = GetUserStatsData(owner);
            bool isNewUser = stats.JoinTime == 0;

            BigInteger memoryId = TotalMemories() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_MEMORY_ID, memoryId);

            Memory memory = new Memory
            {
                Owner = owner,
                ContentHash = contentHash,
                MemoryType = memoryType,
                BuriedTime = Runtime.Time,
                ForgottenTime = 0,
                Epitaph = "",
                Forgotten = false
            };
            StoreMemory(memoryId, memory);

            AddUserMemory(owner, memoryId);
            UpdateTotalBuried();
            UpdateUserStatsOnBury(owner, memoryType, BURY_FEE, isNewUser);

            OnMemoryBuried(memoryId, owner, contentHash, memoryType);
            return memoryId;
        }

        /// <summary>
        /// Permanently forget a memory.
        /// </summary>
        public static void ForgetMemory(UInt160 owner, BigInteger memoryId, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            Memory memory = GetMemory(memoryId);
            ExecutionEngine.Assert(memory.Owner == owner, "not owner");
            ExecutionEngine.Assert(!memory.Forgotten, "already forgotten");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            ValidatePaymentReceipt(APP_ID, owner, FORGET_FEE, receiptId);

            memory.Forgotten = true;
            memory.ForgottenTime = Runtime.Time;
            memory.ContentHash = "";
            StoreMemory(memoryId, memory);

            UpdateTotalForgotten();
            UpdateUserStatsOnForget(owner, FORGET_FEE);

            OnMemoryForgotten(memoryId, owner, Runtime.Time);
        }

        /// <summary>
        /// Add an epitaph to a memory.
        /// </summary>
        public static void AddEpitaph(BigInteger memoryId, string epitaph)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(epitaph.Length > 0 && epitaph.Length <= MAX_EPITAPH_LENGTH, "invalid epitaph");

            Memory memory = GetMemory(memoryId);
            ExecutionEngine.Assert(Runtime.CheckWitness(memory.Owner), "unauthorized");
            ExecutionEngine.Assert(!memory.Forgotten, "memory forgotten");

            memory.Epitaph = epitaph;
            StoreMemory(memoryId, memory);

            OnEpitaphAdded(memoryId, epitaph);
        }

        #endregion
    }
}
