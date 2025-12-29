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
    public delegate void MercDepositHandler(UInt160 depositor, BigInteger amount);
    public delegate void BidPlacedHandler(BigInteger epoch, UInt160 candidate, BigInteger bidAmount);
    public delegate void EpochSettledHandler(BigInteger epoch, UInt160 winner, BigInteger totalBid);

    /// <summary>
    /// Governance Mercenary - Rent voting power to highest bidder.
    /// </summary>
    [DisplayName("MiniAppGovMerc")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Gov Merc - Vote rental market")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-gov-merc";
        private const int EPOCH_DURATION = 604800; // 1 week
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_USER_DEPOSIT = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_TOTAL_POOL = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_CURRENT_EPOCH = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_EPOCH_BID = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_EPOCH_WINNER = new byte[] { 0x14 };
        #endregion

        #region Events
        [DisplayName("MercDeposit")]
        public static event MercDepositHandler OnMercDeposit;

        [DisplayName("BidPlaced")]
        public static event BidPlacedHandler OnBidPlaced;

        [DisplayName("EpochSettled")]
        public static event EpochSettledHandler OnEpochSettled;
        #endregion

        #region Getters
        [Safe]
        public static BigInteger TotalPool() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_POOL);

        [Safe]
        public static BigInteger CurrentEpoch() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_CURRENT_EPOCH);
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_POOL, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_CURRENT_EPOCH, 1);
        }
        #endregion

        #region User Methods

        public static void DepositNeo(UInt160 depositor, BigInteger amount)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(amount > 0, "invalid amount");
            ExecutionEngine.Assert(Runtime.CheckWitness(depositor), "unauthorized");

            NEO.Transfer(depositor, Runtime.ExecutingScriptHash, amount);

            byte[] userKey = Helper.Concat(PREFIX_USER_DEPOSIT, depositor);
            BigInteger current = (BigInteger)Storage.Get(Storage.CurrentContext, userKey);
            Storage.Put(Storage.CurrentContext, userKey, current + amount);

            BigInteger total = TotalPool();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_POOL, total + amount);

            OnMercDeposit(depositor, amount);
        }

        public static void PlaceBid(UInt160 candidate, BigInteger bidAmount, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(bidAmount > 0, "invalid bid");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(candidate), "unauthorized");

            ValidatePaymentReceipt(APP_ID, candidate, bidAmount, receiptId);

            BigInteger epoch = CurrentEpoch();
            byte[] bidKey = Helper.Concat(PREFIX_EPOCH_BID, (ByteString)epoch.ToByteArray());
            bidKey = Helper.Concat(bidKey, candidate);

            BigInteger currentBid = (BigInteger)Storage.Get(Storage.CurrentContext, bidKey);
            Storage.Put(Storage.CurrentContext, bidKey, currentBid + bidAmount);

            OnBidPlaced(epoch, candidate, currentBid + bidAmount);
        }

        public static void WithdrawNeo(UInt160 depositor, BigInteger amount)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(depositor), "unauthorized");

            byte[] userKey = Helper.Concat(PREFIX_USER_DEPOSIT, depositor);
            BigInteger current = (BigInteger)Storage.Get(Storage.CurrentContext, userKey);
            ExecutionEngine.Assert(current >= amount, "insufficient");

            Storage.Put(Storage.CurrentContext, userKey, current - amount);

            BigInteger total = TotalPool();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_POOL, total - amount);

            NEO.Transfer(Runtime.ExecutingScriptHash, depositor, amount);
        }

        #endregion
    }
}
