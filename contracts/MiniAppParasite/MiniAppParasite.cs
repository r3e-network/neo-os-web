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
    public delegate void ParasiteStakedHandler(UInt160 player, BigInteger amount);
    public delegate void ParasiteWithdrawnHandler(UInt160 player, BigInteger amount);
    public delegate void ParasiteAttackHandler(UInt160 attacker, UInt160 target, BigInteger stolen, bool success);

    /// <summary>
    /// The Parasite MiniApp - DeFi staking with PvP attack mechanics.
    /// Stake GAS to earn yields, attack others to steal their rewards.
    /// </summary>
    [DisplayName("MiniAppParasite")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "The Parasite - Stake and attack")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-the-parasite";
        private const int PLATFORM_FEE_PERCENT = 5;
        private const int APY_PERCENT = 50; // 50% APY
        private const int ATTACK_SUCCESS_RATE = 40; // 40%
        private const long ATTACK_COST = 200000000; // 2 GAS
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_STAKE = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_REWARDS = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_LAST_UPDATE = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_REQUEST_TO_ATTACK = new byte[] { 0x13 };
        #endregion

        #region Events
        [DisplayName("ParasiteStaked")]
        public static event ParasiteStakedHandler OnParasiteStaked;

        [DisplayName("ParasiteWithdrawn")]
        public static event ParasiteWithdrawnHandler OnParasiteWithdrawn;

        [DisplayName("ParasiteAttack")]
        public static event ParasiteAttackHandler OnParasiteAttack;
        #endregion

        #region Getters
        [Safe]
        public static BigInteger GetStake(UInt160 player)
        {
            byte[] key = Helper.Concat(PREFIX_STAKE, player);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetRewards(UInt160 player)
        {
            byte[] key = Helper.Concat(PREFIX_REWARDS, player);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }
        #endregion

        #region User Methods
        public static void Stake(UInt160 player, BigInteger amount, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            ValidatePaymentReceipt(APP_ID, player, amount, receiptId);

            byte[] stakeKey = Helper.Concat(PREFIX_STAKE, player);
            BigInteger currentStake = (BigInteger)Storage.Get(Storage.CurrentContext, stakeKey);
            Storage.Put(Storage.CurrentContext, stakeKey, currentStake + amount);

            byte[] timeKey = Helper.Concat(PREFIX_LAST_UPDATE, player);
            Storage.Put(Storage.CurrentContext, timeKey, Runtime.Time);

            OnParasiteStaked(player, amount);
        }

        public static void Withdraw(UInt160 player)
        {
            ValidateNotGloballyPaused(APP_ID);

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            byte[] stakeKey = Helper.Concat(PREFIX_STAKE, player);
            byte[] rewardsKey = Helper.Concat(PREFIX_REWARDS, player);

            BigInteger stake = (BigInteger)Storage.Get(Storage.CurrentContext, stakeKey);
            BigInteger rewards = (BigInteger)Storage.Get(Storage.CurrentContext, rewardsKey);
            BigInteger total = stake + rewards;

            ExecutionEngine.Assert(total > 0, "nothing to withdraw");

            Storage.Put(Storage.CurrentContext, stakeKey, 0);
            Storage.Put(Storage.CurrentContext, rewardsKey, 0);

            // SECURITY FIX: Actually transfer GAS to player
            bool transferred = GAS.Transfer(Runtime.ExecutingScriptHash, player, total);
            ExecutionEngine.Assert(transferred, "withdraw transfer failed");

            OnParasiteWithdrawn(player, total);
        }
        #endregion

        #region Attack Methods
        public static void Attack(UInt160 attacker, UInt160 target, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(attacker), "unauthorized");

            ValidatePaymentReceipt(APP_ID, attacker, ATTACK_COST, receiptId);

            // Request RNG for attack outcome
            BigInteger requestId = RequestRng(attacker, target);
            byte[] key = Helper.Concat(PREFIX_REQUEST_TO_ATTACK, (ByteString)requestId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(new object[] { attacker, target }));
        }
        #endregion

        #region Service Methods
        private static BigInteger RequestRng(UInt160 attacker, UInt160 target)
        {
            UInt160 gateway = Gateway();
            ByteString payload = StdLib.Serialize(new object[] { attacker, target });
            return (BigInteger)Contract.Call(
                gateway, "requestService", CallFlags.All,
                APP_ID, "rng", payload,
                Runtime.ExecutingScriptHash, "onServiceCallback"
            );
        }

        public static void OnServiceCallback(
            BigInteger requestId, string appId, string serviceType,
            bool success, ByteString result, string error)
        {
            ValidateGateway();

            byte[] key = Helper.Concat(PREFIX_REQUEST_TO_ATTACK, (ByteString)requestId.ToByteArray());
            ByteString attackData = Storage.Get(Storage.CurrentContext, key);
            ExecutionEngine.Assert(attackData != null, "unknown request");

            object[] data = (object[])StdLib.Deserialize(attackData);
            UInt160 attacker = (UInt160)data[0];
            UInt160 target = (UInt160)data[1];

            Storage.Delete(Storage.CurrentContext, key);

            if (!success)
            {
                OnParasiteAttack(attacker, target, 0, false);
                return;
            }

            byte[] randomBytes = (byte[])result;
            bool attackSuccess = randomBytes[0] % 100 < ATTACK_SUCCESS_RATE;

            BigInteger stolen = 0;
            if (attackSuccess)
            {
                byte[] rewardsKey = Helper.Concat(PREFIX_REWARDS, target);
                BigInteger targetRewards = (BigInteger)Storage.Get(Storage.CurrentContext, rewardsKey);
                stolen = targetRewards / 2;
                Storage.Put(Storage.CurrentContext, rewardsKey, targetRewards - stolen);

                byte[] attackerRewardsKey = Helper.Concat(PREFIX_REWARDS, attacker);
                BigInteger attackerRewards = (BigInteger)Storage.Get(Storage.CurrentContext, attackerRewardsKey);
                Storage.Put(Storage.CurrentContext, attackerRewardsKey, attackerRewards + stolen);
            }

            OnParasiteAttack(attacker, target, stolen, attackSuccess);
        }
        #endregion
    }
}
