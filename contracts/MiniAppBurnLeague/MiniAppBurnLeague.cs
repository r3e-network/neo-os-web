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
    public delegate void GasBurnedHandler(UInt160 burner, BigInteger amount, BigInteger totalBurned);
    public delegate void RewardClaimedHandler(UInt160 claimer, BigInteger reward);

    /// <summary>
    /// Burn-to-Earn League - Burn GAS to earn platform rewards.
    /// </summary>
    [DisplayName("MiniAppBurnLeague")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. BurnLeague is a deflationary rewards application for GAS burning. Use it to burn GAS tokens competitively, you can earn platform rewards proportional to your contribution.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-burn-league";
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_USER_BURNED = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_TOTAL_BURNED = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_REWARD_POOL = new byte[] { 0x12 };
        #endregion

        #region Events
        [DisplayName("GasBurned")]
        public static event GasBurnedHandler OnGasBurned;

        [DisplayName("RewardClaimed")]
        public static event RewardClaimedHandler OnRewardClaimed;
        #endregion

        #region Getters
        [Safe]
        public static BigInteger TotalBurned() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_BURNED);

        [Safe]
        public static BigInteger GetUserBurned(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_BURNED, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BURNED, 0);
        }
        #endregion

        #region User Methods

        public static void BurnGas(UInt160 burner, BigInteger amount, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(amount > 0, "invalid amount");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(burner), "unauthorized");

            ValidatePaymentReceipt(APP_ID, burner, amount, receiptId);

            // Update user burned amount
            byte[] userKey = Helper.Concat(PREFIX_USER_BURNED, burner);
            BigInteger userBurned = (BigInteger)Storage.Get(Storage.CurrentContext, userKey);
            Storage.Put(Storage.CurrentContext, userKey, userBurned + amount);

            // Update total burned
            BigInteger totalBurned = TotalBurned();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BURNED, totalBurned + amount);

            OnGasBurned(burner, amount, totalBurned + amount);
        }

        /// <summary>
        /// SECURITY FIX: Claim rewards based on burn proportion.
        /// </summary>
        public static void ClaimReward(UInt160 claimer)
        {
            ValidateNotGloballyPaused(APP_ID);

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(claimer), "unauthorized");

            BigInteger userBurned = GetUserBurned(claimer);
            ExecutionEngine.Assert(userBurned > 0, "no burns");

            BigInteger totalBurned = TotalBurned();
            BigInteger rewardPool = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_REWARD_POOL);

            // Calculate proportional reward
            BigInteger reward = rewardPool * userBurned / totalBurned;
            ExecutionEngine.Assert(reward > 0, "no reward available");

            // Reset user burned amount after claim
            byte[] userKey = Helper.Concat(PREFIX_USER_BURNED, claimer);
            Storage.Put(Storage.CurrentContext, userKey, 0);

            // Transfer reward
            bool transferred = GAS.Transfer(Runtime.ExecutingScriptHash, claimer, reward);
            ExecutionEngine.Assert(transferred, "reward transfer failed");

            // Update reward pool
            Storage.Put(Storage.CurrentContext, PREFIX_REWARD_POOL, rewardPool - reward);

            OnRewardClaimed(claimer, reward);
        }

        /// <summary>
        /// Admin: Add funds to reward pool.
        /// </summary>
        public static void FundRewardPool(BigInteger amount)
        {
            ValidateAdmin();
            BigInteger current = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_REWARD_POOL);
            Storage.Put(Storage.CurrentContext, PREFIX_REWARD_POOL, current + amount);
        }

        #endregion
    }
}
