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
    public delegate void DepositHandler(BigInteger poolId, UInt160 depositor, BigInteger amount);
    public delegate void YieldDistributedHandler(BigInteger poolId, BigInteger totalYield);

    /// <summary>
    /// Dark Pool Governance - Anonymous voting pool with privacy.
    /// </summary>
    [DisplayName("MiniAppDarkPool")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Dark Pool - Anonymous governance")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-dark-pool";
        private const ulong MIN_DEPOSIT_DURATION = 86400000; // 24 hours (anti-flash-loan)
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_POOL_TOTAL = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_USER_SHARE = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_TOTAL_YIELD = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_DEPOSIT_TIME = new byte[] { 0x13 };
        #endregion

        #region Events
        [DisplayName("Deposit")]
        public static event DepositHandler OnDeposit;

        [DisplayName("YieldDistributed")]
        public static event YieldDistributedHandler OnYieldDistributed;
        #endregion

        #region Getters
        [Safe]
        public static BigInteger TotalPooled() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_POOL_TOTAL);
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_POOL_TOTAL, 0);
        }
        #endregion

        #region User Methods

        public static void Deposit(UInt160 depositor, BigInteger neoAmount)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(neoAmount > 0, "invalid amount");
            ExecutionEngine.Assert(Runtime.CheckWitness(depositor), "unauthorized");

            NEO.Transfer(depositor, Runtime.ExecutingScriptHash, neoAmount);

            byte[] shareKey = Helper.Concat(PREFIX_USER_SHARE, depositor);
            BigInteger currentShare = (BigInteger)Storage.Get(Storage.CurrentContext, shareKey);
            Storage.Put(Storage.CurrentContext, shareKey, currentShare + neoAmount);

            // Record deposit timestamp for anti-flash-loan
            byte[] timeKey = Helper.Concat(PREFIX_DEPOSIT_TIME, depositor);
            Storage.Put(Storage.CurrentContext, timeKey, Runtime.Time);

            BigInteger totalPooled = TotalPooled();
            Storage.Put(Storage.CurrentContext, PREFIX_POOL_TOTAL, totalPooled + neoAmount);

            OnDeposit(0, depositor, neoAmount);
        }

        public static void Withdraw(UInt160 depositor, BigInteger neoAmount)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(depositor), "unauthorized");

            // Anti-flash-loan: enforce 24h minimum deposit duration
            byte[] timeKey = Helper.Concat(PREFIX_DEPOSIT_TIME, depositor);
            ByteString timeData = Storage.Get(Storage.CurrentContext, timeKey);
            ExecutionEngine.Assert(timeData != null, "no deposit found");
            BigInteger depositTime = (BigInteger)timeData;
            BigInteger elapsed = Runtime.Time - depositTime;
            ExecutionEngine.Assert(elapsed >= MIN_DEPOSIT_DURATION, "min 24h deposit required");

            byte[] shareKey = Helper.Concat(PREFIX_USER_SHARE, depositor);
            BigInteger currentShare = (BigInteger)Storage.Get(Storage.CurrentContext, shareKey);
            ExecutionEngine.Assert(currentShare >= neoAmount, "insufficient balance");

            Storage.Put(Storage.CurrentContext, shareKey, currentShare - neoAmount);

            BigInteger totalPooled = TotalPooled();
            Storage.Put(Storage.CurrentContext, PREFIX_POOL_TOTAL, totalPooled - neoAmount);

            NEO.Transfer(Runtime.ExecutingScriptHash, depositor, neoAmount);
        }

        #endregion
    }
}
