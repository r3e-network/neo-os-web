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
    public delegate void BadgeIssuedHandler(BigInteger badgeId, UInt160 recipient, string badgeType, BigInteger threshold);

    /// <summary>
    /// Zero-Knowledge Badge - Prove wealth without revealing wallet.
    /// TEE verifies balance, issues SBT to new address.
    /// </summary>
    [DisplayName("MiniAppZKBadge")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. ZKBadge is a privacy-preserving credential application for wealth verification. Use it to prove asset holdings without revealing your wallet, you can receive soulbound badges with TEE-verified proofs.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-zk-badge";
        private const long VERIFY_FEE = 50000000; // 0.5 GAS
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_BADGE_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_BADGE_OWNER = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_BADGE_TYPE = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_BADGE_THRESHOLD = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_REQUEST_TO_BADGE = new byte[] { 0x14 };
        #endregion

        #region Events
        [DisplayName("BadgeIssued")]
        public static event BadgeIssuedHandler OnBadgeIssued;
        #endregion

        #region Getters
        [Safe]
        public static BigInteger TotalBadges() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_BADGE_ID);

        [Safe]
        public static string GetBadgeType(BigInteger badgeId)
        {
            byte[] key = Helper.Concat(PREFIX_BADGE_TYPE, (ByteString)badgeId.ToByteArray());
            return Storage.Get(Storage.CurrentContext, key);
        }
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_BADGE_ID, 0);
        }
        #endregion

        #region User Methods

        public static void RequestBadge(UInt160 recipient, string proofHash, BigInteger threshold, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(recipient.IsValid, "invalid recipient");
            ExecutionEngine.Assert(threshold > 0, "invalid threshold");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(recipient), "unauthorized");

            ValidatePaymentReceipt(APP_ID, recipient, VERIFY_FEE, receiptId);

            // Request TEE verification
            RequestVerification(recipient, proofHash, threshold);
        }

        private static void RequestVerification(UInt160 recipient, string proofHash, BigInteger threshold)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { recipient, proofHash, threshold });
            BigInteger requestId = (BigInteger)Contract.Call(
                gateway, "requestService", CallFlags.All,
                APP_ID, "compute", payload,
                Runtime.ExecutingScriptHash, "onVerifyCallback"
            );

            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_BADGE, (ByteString)requestId.ToByteArray()),
                StdLib.Serialize(new object[] { recipient, threshold }));
        }

        public static void OnVerifyCallback(
            BigInteger requestId, string appId, string serviceType,
            bool success, ByteString result, string error)
        {
            ValidateGateway();

            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_BADGE, (ByteString)requestId.ToByteArray()));
            if (data == null) return;

            object[] reqData = (object[])StdLib.Deserialize(data);
            UInt160 recipient = (UInt160)reqData[0];
            BigInteger threshold = (BigInteger)reqData[1];

            if (success)
            {
                object[] verifyResult = (object[])StdLib.Deserialize(result);
                bool verified = (bool)verifyResult[0];
                string badgeType = (string)verifyResult[1];

                if (verified)
                {
                    BigInteger badgeId = TotalBadges() + 1;
                    Storage.Put(Storage.CurrentContext, PREFIX_BADGE_ID, badgeId);

                    byte[] ownerKey = Helper.Concat(PREFIX_BADGE_OWNER, (ByteString)badgeId.ToByteArray());
                    Storage.Put(Storage.CurrentContext, ownerKey, recipient);

                    byte[] typeKey = Helper.Concat(PREFIX_BADGE_TYPE, (ByteString)badgeId.ToByteArray());
                    Storage.Put(Storage.CurrentContext, typeKey, badgeType);

                    byte[] thresholdKey = Helper.Concat(PREFIX_BADGE_THRESHOLD, (ByteString)badgeId.ToByteArray());
                    Storage.Put(Storage.CurrentContext, thresholdKey, threshold);

                    OnBadgeIssued(badgeId, recipient, badgeType, threshold);
                }
            }

            Storage.Delete(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_BADGE, (ByteString)requestId.ToByteArray()));
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
