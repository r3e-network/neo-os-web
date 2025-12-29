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
    public delegate void PetAdoptedHandler(UInt160 owner, BigInteger petId, BigInteger timestamp);
    public delegate void PetObservedHandler(UInt160 owner, BigInteger petId, int state, BigInteger timestamp);
    public delegate void PetTradedHandler(UInt160 seller, UInt160 buyer, BigInteger petId, BigInteger price);

    /// <summary>
    /// Schrodinger's NFT - Quantum pet box with TEE-hidden state.
    ///
    /// GAME MECHANICS:
    /// - Users adopt a "box" containing a pet with unknown state
    /// - Pet state (Alive/Sick/Mutated/Ascended) is determined by TEE randomness
    /// - Observing the pet costs GAS and may cause state collapse
    /// - Blind trading: sell pet without revealing state
    /// </summary>
    [DisplayName("MiniAppSchrodingerNFT")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Quantum pet box - observe to collapse state")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-schrodinger-nft";
        private const int PLATFORM_FEE_PERCENT = 5;
        private const long ADOPT_FEE = 50000000; // 0.5 GAS
        private const long OBSERVE_FEE = 5000000; // 0.05 GAS
        private const long MIN_TRADE_PRICE = 10000000; // 0.1 GAS
        #endregion

        #region Pet States
        private const int STATE_UNKNOWN = 0;
        private const int STATE_ALIVE = 1;
        private const int STATE_SICK = 2;
        private const int STATE_MUTATED = 3;
        private const int STATE_ASCENDED = 4;
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_PET_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_PET_OWNER = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_PET_STATE = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_PET_OBSERVED = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_PET_BIRTH = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_LISTING = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_REQUEST_TO_PET = new byte[] { 0x16 };
        #endregion

        #region Events
        [DisplayName("PetAdopted")]
        public static event PetAdoptedHandler OnPetAdopted;

        [DisplayName("PetObserved")]
        public static event PetObservedHandler OnPetObserved;

        [DisplayName("PetTraded")]
        public static event PetTradedHandler OnPetTraded;
        #endregion

        #region Getters
        [Safe]
        public static BigInteger TotalPets() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PET_ID);

        [Safe]
        public static UInt160 PetOwner(BigInteger petId)
        {
            byte[] key = Helper.Concat(PREFIX_PET_OWNER, (ByteString)petId.ToByteArray());
            return (UInt160)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static bool IsObserved(BigInteger petId)
        {
            byte[] key = Helper.Concat(PREFIX_PET_OBSERVED, (ByteString)petId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_PET_ID, 0);
        }
        #endregion

        #region User Methods

        /// <summary>
        /// Adopt a new quantum pet box.
        /// </summary>
        public static void Adopt(UInt160 owner, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            ValidatePaymentReceipt(APP_ID, owner, ADOPT_FEE, receiptId);

            BigInteger petId = TotalPets() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_PET_ID, petId);

            byte[] ownerKey = Helper.Concat(PREFIX_PET_OWNER, (ByteString)petId.ToByteArray());
            Storage.Put(Storage.CurrentContext, ownerKey, owner);

            byte[] birthKey = Helper.Concat(PREFIX_PET_BIRTH, (ByteString)petId.ToByteArray());
            Storage.Put(Storage.CurrentContext, birthKey, Runtime.Time);

            // State remains unknown until observed
            byte[] stateKey = Helper.Concat(PREFIX_PET_STATE, (ByteString)petId.ToByteArray());
            Storage.Put(Storage.CurrentContext, stateKey, STATE_UNKNOWN);

            OnPetAdopted(owner, petId, Runtime.Time);
        }

        /// <summary>
        /// Observe pet state - may cause collapse.
        /// </summary>
        public static void Observe(UInt160 owner, BigInteger petId, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(PetOwner(petId) == owner, "not owner");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            ValidatePaymentReceipt(APP_ID, owner, OBSERVE_FEE, receiptId);

            // Request RNG to determine state
            RequestObserveRng(petId);
        }

        /// <summary>
        /// List pet for blind trade.
        /// </summary>
        public static void ListForSale(UInt160 owner, BigInteger petId, BigInteger price)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(PetOwner(petId) == owner, "not owner");
            ExecutionEngine.Assert(price >= MIN_TRADE_PRICE, "price too low");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            byte[] listKey = Helper.Concat(PREFIX_LISTING, (ByteString)petId.ToByteArray());
            Storage.Put(Storage.CurrentContext, listKey, price);
        }

        /// <summary>
        /// Buy a listed pet (blind box trade).
        /// </summary>
        public static void Buy(UInt160 buyer, BigInteger petId, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            byte[] listKey = Helper.Concat(PREFIX_LISTING, (ByteString)petId.ToByteArray());
            BigInteger price = (BigInteger)Storage.Get(Storage.CurrentContext, listKey);
            ExecutionEngine.Assert(price > 0, "not listed");

            UInt160 seller = PetOwner(petId);
            ExecutionEngine.Assert(seller != buyer, "cannot buy own pet");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(buyer), "unauthorized");

            ValidatePaymentReceipt(APP_ID, buyer, price, receiptId);

            // Transfer ownership
            byte[] ownerKey = Helper.Concat(PREFIX_PET_OWNER, (ByteString)petId.ToByteArray());
            Storage.Put(Storage.CurrentContext, ownerKey, buyer);

            // Remove listing
            Storage.Delete(Storage.CurrentContext, listKey);

            OnPetTraded(seller, buyer, petId, price);
        }

        #endregion

        #region Service Callbacks

        private static void RequestObserveRng(BigInteger petId)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { petId });
            BigInteger requestId = (BigInteger)Contract.Call(
                gateway, "requestService", CallFlags.All,
                APP_ID, "rng", payload,
                Runtime.ExecutingScriptHash, "onServiceCallback"
            );

            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_PET, (ByteString)requestId.ToByteArray()),
                petId);
        }

        public static void OnServiceCallback(
            BigInteger requestId, string appId, string serviceType,
            bool success, ByteString result, string error)
        {
            ValidateGateway();

            ByteString petIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_PET, (ByteString)requestId.ToByteArray()));
            ExecutionEngine.Assert(petIdData != null, "unknown request");

            BigInteger petId = (BigInteger)petIdData;

            if (!success) return;

            // Calculate state from randomness
            byte[] randomBytes = (byte[])result;
            int state = CalculateState(randomBytes, petId);

            // Store observed state
            byte[] stateKey = Helper.Concat(PREFIX_PET_STATE, (ByteString)petId.ToByteArray());
            Storage.Put(Storage.CurrentContext, stateKey, state);

            byte[] observedKey = Helper.Concat(PREFIX_PET_OBSERVED, (ByteString)petId.ToByteArray());
            Storage.Put(Storage.CurrentContext, observedKey, 1);

            Storage.Delete(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_PET, (ByteString)requestId.ToByteArray()));

            UInt160 owner = PetOwner(petId);
            OnPetObserved(owner, petId, state, Runtime.Time);
        }

        private static int CalculateState(byte[] randomBytes, BigInteger petId)
        {
            BigInteger rand = 0;
            for (int i = 0; i < 4 && i < randomBytes.Length; i++)
            {
                rand = rand * 256 + randomBytes[i];
            }

            // Add pet birth time for additional entropy
            byte[] birthKey = Helper.Concat(PREFIX_PET_BIRTH, (ByteString)petId.ToByteArray());
            BigInteger birthTime = (BigInteger)Storage.Get(Storage.CurrentContext, birthKey);
            rand = rand + birthTime;

            int roll = (int)(rand % 100);

            // State distribution: Alive 40%, Sick 30%, Mutated 20%, Ascended 10%
            if (roll < 40) return STATE_ALIVE;
            if (roll < 70) return STATE_SICK;
            if (roll < 90) return STATE_MUTATED;
            return STATE_ASCENDED;
        }

        #endregion
    }
}
