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
    public delegate void BoxCreatedHandler(BigInteger boxId, UInt160 creator, BigInteger value);
    public delegate void BoxSwappedHandler(BigInteger boxId1, BigInteger boxId2, UInt160 user1, UInt160 user2);
    public delegate void BoxRevealedHandler(BigInteger boxId, UInt160 owner, BigInteger actualValue);

    /// <summary>
    /// QuantumSwap MiniApp - Blind box exchange where you don't know what you'll get.
    /// Users deposit GAS into sealed boxes, then randomly swap with others.
    /// Like Schrödinger's cat - value is unknown until revealed.
    /// </summary>
    [DisplayName("MiniAppQuantumSwap")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Quantum Swap - Blind box exchange with unknown values")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-quantumswap";
        private const long MIN_DEPOSIT = 10000000; // 0.1 GAS
        private const long MAX_DEPOSIT = 10000000000; // 100 GAS
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_BOX_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_BOXES = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_PENDING = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_AUTOMATION_TASK = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Data Structures
        public struct BoxData
        {
            public UInt160 Owner;
            public BigInteger Value;
            public bool Sealed;
            public bool Swapped;
            public BigInteger SwappedWith;
            public BigInteger CreateTime;
        }
        #endregion

        #region App Events
        [DisplayName("BoxCreated")]
        public static event BoxCreatedHandler OnBoxCreated;

        [DisplayName("BoxSwapped")]
        public static event BoxSwappedHandler OnBoxSwapped;

        [DisplayName("BoxRevealed")]
        public static event BoxRevealedHandler OnBoxRevealed;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_BOX_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        /// <summary>
        /// Create a sealed box with hidden value.
        /// </summary>
        public static BigInteger CreateBox(UInt160 creator, BigInteger amount, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(amount >= MIN_DEPOSIT && amount <= MAX_DEPOSIT, "amount out of range");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            ValidatePaymentReceipt(APP_ID, creator, amount, receiptId);

            BigInteger boxId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_BOX_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_BOX_ID, boxId);

            BoxData box = new BoxData
            {
                Owner = creator,
                Value = amount,
                Sealed = true,
                Swapped = false,
                SwappedWith = 0,
                CreateTime = Runtime.Time
            };
            StoreBox(boxId, box);

            // Add to pending swap pool
            AddToPendingPool(boxId);

            OnBoxCreated(boxId, creator, amount);
            return boxId;
        }

        /// <summary>
        /// Request random swap with another box.
        /// </summary>
        public static void RequestSwap(BigInteger boxId, UInt160 requester)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(requester), "unauthorized");

            BoxData box = GetBox(boxId);
            ExecutionEngine.Assert(box.Owner == requester, "not owner");
            ExecutionEngine.Assert(box.Sealed && !box.Swapped, "box not available");

            // Find random partner from pending pool
            BigInteger partnerId = FindRandomPartner(boxId);
            if (partnerId > 0)
            {
                ExecuteSwap(boxId, partnerId);
            }
        }

        /// <summary>
        /// Reveal box contents after swap.
        /// </summary>
        public static BigInteger RevealBox(BigInteger boxId, UInt160 owner)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "unauthorized");

            BoxData box = GetBox(boxId);
            ExecutionEngine.Assert(box.Owner == owner, "not owner");
            ExecutionEngine.Assert(box.Swapped, "not swapped yet");
            ExecutionEngine.Assert(box.Sealed, "already revealed");

            box.Sealed = false;
            StoreBox(boxId, box);

            OnBoxRevealed(boxId, owner, box.Value);
            return box.Value;
        }

        [Safe]
        public static BoxData GetBox(BigInteger boxId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_BOXES, (ByteString)boxId.ToByteArray()));
            if (data == null) return new BoxData();
            return (BoxData)StdLib.Deserialize(data);
        }

        #endregion

        #region Internal Helpers

        private static void StoreBox(BigInteger boxId, BoxData box)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_BOXES, (ByteString)boxId.ToByteArray()),
                StdLib.Serialize(box));
        }

        private static void AddToPendingPool(BigInteger boxId)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_PENDING, (ByteString)boxId.ToByteArray()), 1);
        }

        private static void RemoveFromPendingPool(BigInteger boxId)
        {
            Storage.Delete(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_PENDING, (ByteString)boxId.ToByteArray()));
        }

        private static BigInteger FindRandomPartner(BigInteger excludeId)
        {
            BigInteger maxId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_BOX_ID);
            BigInteger seed = Runtime.Time;

            for (int i = 0; i < 10; i++)
            {
                BigInteger candidateId = (seed + i) % maxId + 1;
                if (candidateId != excludeId)
                {
                    ByteString pending = Storage.Get(Storage.CurrentContext,
                        Helper.Concat((ByteString)PREFIX_PENDING, (ByteString)candidateId.ToByteArray()));
                    if (pending != null)
                    {
                        return candidateId;
                    }
                }
            }
            return 0;
        }

        private static void ExecuteSwap(BigInteger boxId1, BigInteger boxId2)
        {
            BoxData box1 = GetBox(boxId1);
            BoxData box2 = GetBox(boxId2);

            // Swap values
            BigInteger tempValue = box1.Value;
            box1.Value = box2.Value;
            box2.Value = tempValue;

            box1.Swapped = true;
            box1.SwappedWith = boxId2;
            box2.Swapped = true;
            box2.SwappedWith = boxId1;

            StoreBox(boxId1, box1);
            StoreBox(boxId2, box2);

            RemoveFromPendingPool(boxId1);
            RemoveFromPendingPool(boxId2);

            OnBoxSwapped(boxId1, boxId2, box1.Owner, box2.Owner);
        }

        #endregion

        #region Automation
        [Safe]
        public static UInt160 AutomationAnchor()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR);
            return data != null ? (UInt160)data : UInt160.Zero;
        }

        public static void SetAutomationAnchor(UInt160 anchor)
        {
            ValidateAdmin();
            ValidateAddress(anchor);
            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR, anchor);
        }

        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");
        }
        #endregion
    }
}
