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
    public delegate void DeveloperRegisteredHandler(BigInteger devId, UInt160 wallet, string name, string role);
    public delegate void TipSentHandler(UInt160 tipper, BigInteger devId, BigInteger amount, string message, string tipperName);
    public delegate void TipWithdrawnHandler(BigInteger devId, UInt160 wallet, BigInteger amount);

    /// <summary>
    /// EcoBoost - CoreDev Tipping Station.
    ///
    /// GAME MECHANICS:
    /// - Admin registers core developers with wallet addresses
    /// - Users can tip any registered developer with GAS
    /// - Developers can withdraw accumulated tips
    /// - Simple point-to-point donation experience
    /// </summary>
    [DisplayName("MiniAppDevTipping")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "EcoBoost - Support the builders who power the ecosystem")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-dev-tipping";
        private const long MIN_TIP = 100000; // 0.001 GAS minimum tip
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_DEV_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_DEV_WALLET = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_DEV_NAME = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_DEV_ROLE = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_DEV_BALANCE = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_DEV_TOTAL_TIPS = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_DEV_TIP_COUNT = new byte[] { 0x16 };
        private static readonly byte[] PREFIX_TOTAL_DONATED = new byte[] { 0x17 };
        // Tipper ranking by name
        private static readonly byte[] PREFIX_TIPPER_TOTAL = new byte[] { 0x18 };
        private static readonly byte[] PREFIX_TIPPER_COUNT = new byte[] { 0x19 };
        private static readonly byte[] PREFIX_TIP_ID = new byte[] { 0x1A };
        private static readonly byte[] PREFIX_TIP_DATA = new byte[] { 0x1B };
        #endregion

        #region Events
        [DisplayName("DeveloperRegistered")]
        public static event DeveloperRegisteredHandler OnDeveloperRegistered;

        [DisplayName("TipSent")]
        public static event TipSentHandler OnTipSent;

        [DisplayName("TipWithdrawn")]
        public static event TipWithdrawnHandler OnTipWithdrawn;
        #endregion

        #region Getters
        [Safe]
        public static BigInteger TotalDevelopers() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_DEV_ID);

        [Safe]
        public static BigInteger TotalDonated() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_DONATED);

        [Safe]
        public static BigInteger TotalTips() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TIP_ID);

        [Safe]
        public static BigInteger GetTipperTotal(string tipperName)
        {
            byte[] key = Helper.Concat(PREFIX_TIPPER_TOTAL, tipperName);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetTipperCount(string tipperName)
        {
            byte[] key = Helper.Concat(PREFIX_TIPPER_COUNT, tipperName);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static UInt160 GetDevWallet(BigInteger devId)
        {
            byte[] key = Helper.Concat(PREFIX_DEV_WALLET, (ByteString)devId.ToByteArray());
            return (UInt160)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static string GetDevName(BigInteger devId)
        {
            byte[] key = Helper.Concat(PREFIX_DEV_NAME, (ByteString)devId.ToByteArray());
            return Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static string GetDevRole(BigInteger devId)
        {
            byte[] key = Helper.Concat(PREFIX_DEV_ROLE, (ByteString)devId.ToByteArray());
            return Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetDevBalance(BigInteger devId)
        {
            byte[] key = Helper.Concat(PREFIX_DEV_BALANCE, (ByteString)devId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetDevTotalTips(BigInteger devId)
        {
            byte[] key = Helper.Concat(PREFIX_DEV_TOTAL_TIPS, (ByteString)devId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetDevTipCount(BigInteger devId)
        {
            byte[] key = Helper.Concat(PREFIX_DEV_TIP_COUNT, (ByteString)devId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_DEV_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_DONATED, 0);
        }
        #endregion

        #region Admin Methods

        /// <summary>
        /// Register a new developer (admin only).
        /// </summary>
        public static void RegisterDeveloper(UInt160 wallet, string name, string role)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(wallet.IsValid, "invalid wallet");
            ExecutionEngine.Assert(name.Length > 0 && name.Length <= 64, "invalid name");
            ExecutionEngine.Assert(role.Length > 0 && role.Length <= 64, "invalid role");

            BigInteger devId = TotalDevelopers() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_DEV_ID, devId);

            byte[] walletKey = Helper.Concat(PREFIX_DEV_WALLET, (ByteString)devId.ToByteArray());
            Storage.Put(Storage.CurrentContext, walletKey, wallet);

            byte[] nameKey = Helper.Concat(PREFIX_DEV_NAME, (ByteString)devId.ToByteArray());
            Storage.Put(Storage.CurrentContext, nameKey, name);

            byte[] roleKey = Helper.Concat(PREFIX_DEV_ROLE, (ByteString)devId.ToByteArray());
            Storage.Put(Storage.CurrentContext, roleKey, role);

            OnDeveloperRegistered(devId, wallet, name, role);
        }

        #endregion

        #region User Methods

        /// <summary>
        /// Send a tip to a developer.
        /// </summary>
        public static void Tip(UInt160 tipper, BigInteger devId, BigInteger amount, string message, string tipperName, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(devId > 0 && devId <= TotalDevelopers(), "invalid dev");
            ExecutionEngine.Assert(amount >= MIN_TIP, "tip too small");
            ExecutionEngine.Assert(message.Length <= 256, "message too long");
            ExecutionEngine.Assert(tipperName.Length <= 64, "name too long");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(tipper), "unauthorized");

            ValidatePaymentReceipt(APP_ID, tipper, amount, receiptId);

            // Use tipper address if name not provided
            string displayName = tipperName.Length > 0 ? tipperName : tipper.ToAddress(53);

            // Update developer balance
            byte[] balanceKey = Helper.Concat(PREFIX_DEV_BALANCE, (ByteString)devId.ToByteArray());
            BigInteger currentBalance = (BigInteger)Storage.Get(Storage.CurrentContext, balanceKey);
            Storage.Put(Storage.CurrentContext, balanceKey, currentBalance + amount);

            // Update developer total tips
            byte[] totalKey = Helper.Concat(PREFIX_DEV_TOTAL_TIPS, (ByteString)devId.ToByteArray());
            BigInteger totalTips = (BigInteger)Storage.Get(Storage.CurrentContext, totalKey);
            Storage.Put(Storage.CurrentContext, totalKey, totalTips + amount);

            // Update tip count
            byte[] countKey = Helper.Concat(PREFIX_DEV_TIP_COUNT, (ByteString)devId.ToByteArray());
            BigInteger tipCount = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, tipCount + 1);

            // Update global total
            BigInteger globalTotal = TotalDonated();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_DONATED, globalTotal + amount);

            // Update tipper ranking by name
            byte[] tipperTotalKey = Helper.Concat(PREFIX_TIPPER_TOTAL, displayName);
            BigInteger tipperTotal = (BigInteger)Storage.Get(Storage.CurrentContext, tipperTotalKey);
            Storage.Put(Storage.CurrentContext, tipperTotalKey, tipperTotal + amount);

            byte[] tipperCountKey = Helper.Concat(PREFIX_TIPPER_COUNT, displayName);
            BigInteger tipperCount = (BigInteger)Storage.Get(Storage.CurrentContext, tipperCountKey);
            Storage.Put(Storage.CurrentContext, tipperCountKey, tipperCount + 1);

            // Store tip record
            BigInteger tipId = TotalTips() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_TIP_ID, tipId);

            OnTipSent(tipper, devId, amount, message, displayName);
        }

        /// <summary>
        /// Withdraw accumulated tips (developer only).
        /// </summary>
        public static void Withdraw(BigInteger devId)
        {
            ValidateNotGloballyPaused(APP_ID);

            UInt160 devWallet = GetDevWallet(devId);
            ExecutionEngine.Assert(devWallet != null && devWallet.IsValid, "invalid dev");
            ExecutionEngine.Assert(Runtime.CheckWitness(devWallet), "not developer");

            byte[] balanceKey = Helper.Concat(PREFIX_DEV_BALANCE, (ByteString)devId.ToByteArray());
            BigInteger balance = (BigInteger)Storage.Get(Storage.CurrentContext, balanceKey);
            ExecutionEngine.Assert(balance > 0, "no balance");

            // Clear balance
            Storage.Put(Storage.CurrentContext, balanceKey, 0);

            // Transfer GAS to developer
            GAS.Transfer(Runtime.ExecutingScriptHash, devWallet, balance);

            OnTipWithdrawn(devId, devWallet, balance);
        }

        #endregion
    }
}
