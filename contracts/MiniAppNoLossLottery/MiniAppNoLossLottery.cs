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
    public delegate void LotteryStakedHandler(UInt160 player, BigInteger amount, BigInteger roundId);
    public delegate void LotteryWithdrawnHandler(UInt160 player, BigInteger amount);
    public delegate void LotteryWinnerHandler(UInt160 winner, BigInteger prize, BigInteger roundId);

    /// <summary>
    /// No-Loss Lottery MiniApp - Stake to enter, winners take yield, everyone keeps principal.
    /// </summary>
    [DisplayName("MiniAppNoLossLottery")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. NoLossLottery is a savings protocol for risk-free prize winning. Use it to stake funds and enter lottery draws, you can win yield prizes while keeping your principal safe.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-no-loss-lottery";
        private const int YIELD_RATE_PERCENT = 5;
        private const ulong MIN_STAKE_DURATION = 86400000; // 24 hours in ms (anti-flash-loan)
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_ROUND_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_TOTAL_STAKED = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_PLAYER_STAKE = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_REQUEST_TO_ROUND = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_STAKE_TIMESTAMP = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_PARTICIPANT_COUNT = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_PARTICIPANT_INDEX = new byte[] { 0x16 };
        private static readonly byte[] PREFIX_PARTICIPANT_AT = new byte[] { 0x17 };
        #endregion

        #region Events
        [DisplayName("LotteryStaked")]
        public static event LotteryStakedHandler OnLotteryStaked;

        [DisplayName("LotteryWithdrawn")]
        public static event LotteryWithdrawnHandler OnLotteryWithdrawn;

        [DisplayName("LotteryWinner")]
        public static event LotteryWinnerHandler OnLotteryWinner;
        #endregion

        #region Getters
        [Safe]
        public static BigInteger CurrentRound() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ROUND_ID);

        [Safe]
        public static BigInteger TotalStaked() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_STAKED);

        [Safe]
        public static BigInteger GetStake(UInt160 player)
        {
            byte[] key = Helper.Concat(PREFIX_PLAYER_STAKE, player);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetStakeTimestamp(UInt160 player)
        {
            byte[] key = Helper.Concat(PREFIX_STAKE_TIMESTAMP, player);
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }

        [Safe]
        public static BigInteger ParticipantCount()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_PARTICIPANT_COUNT);
            return data == null ? 0 : (BigInteger)data;
        }

        [Safe]
        public static UInt160 GetParticipantAt(BigInteger index)
        {
            byte[] key = Helper.Concat(PREFIX_PARTICIPANT_AT, (ByteString)index.ToByteArray());
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? UInt160.Zero : (UInt160)data;
        }
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND_ID, 1);
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

            byte[] stakeKey = Helper.Concat(PREFIX_PLAYER_STAKE, player);
            BigInteger currentStake = (BigInteger)Storage.Get(Storage.CurrentContext, stakeKey);

            // Track new participants for weighted random selection
            if (currentStake == 0)
            {
                AddParticipant(player);
            }

            Storage.Put(Storage.CurrentContext, stakeKey, currentStake + amount);

            // Record stake timestamp for anti-flash-loan protection
            byte[] timestampKey = Helper.Concat(PREFIX_STAKE_TIMESTAMP, player);
            Storage.Put(Storage.CurrentContext, timestampKey, Runtime.Time);

            BigInteger total = TotalStaked();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_STAKED, total + amount);

            OnLotteryStaked(player, amount, CurrentRound());
        }

        public static void Withdraw(UInt160 player)
        {
            ValidateNotGloballyPaused(APP_ID);

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            byte[] stakeKey = Helper.Concat(PREFIX_PLAYER_STAKE, player);
            BigInteger stake = (BigInteger)Storage.Get(Storage.CurrentContext, stakeKey);
            ExecutionEngine.Assert(stake > 0, "no stake");

            // Anti-flash-loan: enforce minimum stake duration (24 hours)
            BigInteger stakeTime = GetStakeTimestamp(player);
            BigInteger elapsed = Runtime.Time - stakeTime;
            ExecutionEngine.Assert(elapsed >= MIN_STAKE_DURATION, "min 24h stake required");

            Storage.Put(Storage.CurrentContext, stakeKey, 0);

            // Remove from participant list
            RemoveParticipant(player);

            BigInteger total = TotalStaked();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_STAKED, total - stake);

            bool transferred = GAS.Transfer(Runtime.ExecutingScriptHash, player, stake);
            ExecutionEngine.Assert(transferred, "principal transfer failed");

            OnLotteryWithdrawn(player, stake);
        }
        #endregion

        #region Admin Methods
        public static void InitiateDraw()
        {
            ValidateAdmin();
            BigInteger total = TotalStaked();
            ExecutionEngine.Assert(total > 0, "no stakes");

            BigInteger roundId = CurrentRound();
            BigInteger requestId = RequestRng(roundId);

            byte[] key = Helper.Concat(PREFIX_REQUEST_TO_ROUND, (ByteString)requestId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, roundId);
        }
        #endregion

        #region Service Methods
        private static BigInteger RequestRng(BigInteger roundId)
        {
            UInt160 gateway = Gateway();
            ByteString payload = StdLib.Serialize(new object[] { roundId });
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

            byte[] key = Helper.Concat(PREFIX_REQUEST_TO_ROUND, (ByteString)requestId.ToByteArray());
            ByteString roundData = Storage.Get(Storage.CurrentContext, key);
            ExecutionEngine.Assert(roundData != null, "unknown request");

            BigInteger roundId = (BigInteger)roundData;
            Storage.Delete(Storage.CurrentContext, key);

            if (!success)
            {
                OnLotteryWinner(UInt160.Zero, 0, roundId);
                return;
            }

            BigInteger total = TotalStaked();
            BigInteger prize = total * YIELD_RATE_PERCENT / 100;

            // Select winner using weighted random selection based on stake amounts
            UInt160 winner = SelectWinnerWeighted(result, total);

            if (prize > 0 && winner != UInt160.Zero)
            {
                bool transferred = GAS.Transfer(Runtime.ExecutingScriptHash, winner, prize);
                ExecutionEngine.Assert(transferred, "prize transfer failed");
            }

            Storage.Put(Storage.CurrentContext, PREFIX_ROUND_ID, roundId + 1);

            OnLotteryWinner(winner, prize, roundId);
        }
        #endregion

        #region Participant Management
        private static void AddParticipant(UInt160 player)
        {
            byte[] indexKey = Helper.Concat(PREFIX_PARTICIPANT_INDEX, player);
            ByteString existingIndex = Storage.Get(Storage.CurrentContext, indexKey);
            if (existingIndex != null) return;

            BigInteger count = ParticipantCount();
            byte[] atKey = Helper.Concat(PREFIX_PARTICIPANT_AT, (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, atKey, player);
            Storage.Put(Storage.CurrentContext, indexKey, count);
            Storage.Put(Storage.CurrentContext, PREFIX_PARTICIPANT_COUNT, count + 1);
        }

        private static void RemoveParticipant(UInt160 player)
        {
            byte[] indexKey = Helper.Concat(PREFIX_PARTICIPANT_INDEX, player);
            ByteString indexData = Storage.Get(Storage.CurrentContext, indexKey);
            if (indexData == null) return;

            BigInteger index = (BigInteger)indexData;
            BigInteger lastIndex = ParticipantCount() - 1;

            if (index < lastIndex)
            {
                UInt160 lastPlayer = GetParticipantAt(lastIndex);
                byte[] atKey = Helper.Concat(PREFIX_PARTICIPANT_AT, (ByteString)index.ToByteArray());
                Storage.Put(Storage.CurrentContext, atKey, lastPlayer);
                byte[] lastIndexKey = Helper.Concat(PREFIX_PARTICIPANT_INDEX, lastPlayer);
                Storage.Put(Storage.CurrentContext, lastIndexKey, index);
            }

            byte[] lastAtKey = Helper.Concat(PREFIX_PARTICIPANT_AT, (ByteString)lastIndex.ToByteArray());
            Storage.Delete(Storage.CurrentContext, lastAtKey);
            Storage.Delete(Storage.CurrentContext, indexKey);
            Storage.Put(Storage.CurrentContext, PREFIX_PARTICIPANT_COUNT, lastIndex);
        }

        private static UInt160 SelectWinnerWeighted(ByteString rngResult, BigInteger totalStaked)
        {
            BigInteger count = ParticipantCount();
            if (count == 0) return UInt160.Zero;

            byte[] randomBytes = (byte[])rngResult;
            BigInteger rngValue = 0;
            for (int i = 0; i < randomBytes.Length && i < 8; i++)
            {
                rngValue = (rngValue << 8) + randomBytes[i];
            }
            if (rngValue < 0) rngValue = -rngValue;

            BigInteger target = rngValue % totalStaked;
            BigInteger cumulative = 0;

            for (BigInteger i = 0; i < count; i++)
            {
                UInt160 participant = GetParticipantAt(i);
                BigInteger stake = GetStake(participant);
                cumulative += stake;
                if (cumulative > target)
                {
                    return participant;
                }
            }

            return GetParticipantAt(count - 1);
        }
        #endregion
    }
}
