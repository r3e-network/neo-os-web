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
    public delegate void KeysPurchasedHandler(UInt160 player, BigInteger keys, BigInteger potContribution);
    public delegate void DoomsdayWinnerHandler(UInt160 winner, BigInteger prize, BigInteger roundId);
    public delegate void RoundStartedHandler(BigInteger roundId, BigInteger endTime);

    /// <summary>
    /// Doomsday Clock MiniApp - FOMO3D style game.
    /// Buy keys to reset the timer. Last buyer when timer runs out wins the pot.
    /// </summary>
    [DisplayName("MiniAppDoomsdayClock")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. DoomsdayClock is a FOMO-style gaming application for countdown jackpots. Use it to buy keys and reset the timer, you can win the entire pot as the last buyer when time expires.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-doomsday-clock";
        private const int PLATFORM_FEE_PERCENT = 5;
        private const long KEY_PRICE = 100000000; // 1 GAS per key
        private const long TIME_ADDED_PER_KEY = 30; // 30 seconds per key
        private const long INITIAL_DURATION = 3600; // 1 hour initial
        private const long MAX_DURATION = 86400; // 24 hours max
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_ROUND_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_POT = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_END_TIME = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_LAST_BUYER = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_PLAYER_KEYS = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_ROUND_ACTIVE = new byte[] { 0x15 };
        #endregion

        #region Events
        [DisplayName("KeysPurchased")]
        public static event KeysPurchasedHandler OnKeysPurchased;

        [DisplayName("DoomsdayWinner")]
        public static event DoomsdayWinnerHandler OnDoomsdayWinner;

        [DisplayName("RoundStarted")]
        public static event RoundStartedHandler OnRoundStarted;
        #endregion

        #region Getters
        [Safe]
        public static BigInteger CurrentRound() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ROUND_ID);

        [Safe]
        public static BigInteger CurrentPot() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_POT);

        [Safe]
        public static BigInteger EndTime() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_END_TIME);

        [Safe]
        public static UInt160 LastBuyer() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_LAST_BUYER);

        [Safe]
        public static bool IsRoundActive() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ROUND_ACTIVE) == 1;

        [Safe]
        public static BigInteger GetPlayerKeys(UInt160 player, BigInteger roundId)
        {
            byte[] key = Helper.Concat(PREFIX_PLAYER_KEYS, player);
            key = Helper.Concat(key, (ByteString)roundId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger TimeRemaining()
        {
            BigInteger endTime = EndTime();
            BigInteger currentTime = Runtime.Time;
            if (currentTime >= endTime) return 0;
            return endTime - currentTime;
        }
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND_ACTIVE, 0);
        }
        #endregion

        #region Admin Methods
        public static void StartNewRound()
        {
            ValidateAdmin();
            ExecutionEngine.Assert(!IsRoundActive(), "round active");

            BigInteger roundId = CurrentRound() + 1;
            BigInteger endTime = Runtime.Time + INITIAL_DURATION;

            Storage.Put(Storage.CurrentContext, PREFIX_ROUND_ID, roundId);
            Storage.Put(Storage.CurrentContext, PREFIX_POT, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_END_TIME, endTime);
            Storage.Put(Storage.CurrentContext, PREFIX_LAST_BUYER, UInt160.Zero);
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND_ACTIVE, 1);

            OnRoundStarted(roundId, endTime);
        }
        #endregion

        #region User Methods
        public static void BuyKeys(UInt160 player, BigInteger keyCount, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(IsRoundActive(), "no active round");
            ExecutionEngine.Assert(keyCount > 0, "keys > 0");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            // Check if round has ended
            BigInteger currentTime = Runtime.Time;
            BigInteger endTime = EndTime();
            if (currentTime >= endTime)
            {
                // Round ended, trigger winner selection
                DeclareWinner();
                return;
            }

            BigInteger cost = keyCount * KEY_PRICE;
            ValidatePaymentReceipt(APP_ID, player, cost, receiptId);

            // Calculate pot contribution (95% goes to pot)
            BigInteger potContribution = cost * (100 - PLATFORM_FEE_PERCENT) / 100;

            // Update pot
            BigInteger currentPot = CurrentPot();
            Storage.Put(Storage.CurrentContext, PREFIX_POT, currentPot + potContribution);

            // Update last buyer
            Storage.Put(Storage.CurrentContext, PREFIX_LAST_BUYER, player);

            // Add time (capped at MAX_DURATION from now)
            BigInteger timeToAdd = keyCount * TIME_ADDED_PER_KEY;
            BigInteger newEndTime = endTime + timeToAdd;
            BigInteger maxEndTime = currentTime + MAX_DURATION;
            if (newEndTime > maxEndTime) newEndTime = maxEndTime;
            Storage.Put(Storage.CurrentContext, PREFIX_END_TIME, newEndTime);

            // Track player keys
            BigInteger roundId = CurrentRound();
            byte[] keyStorage = Helper.Concat(PREFIX_PLAYER_KEYS, player);
            keyStorage = Helper.Concat(keyStorage, (ByteString)roundId.ToByteArray());
            BigInteger playerKeys = (BigInteger)Storage.Get(Storage.CurrentContext, keyStorage);
            Storage.Put(Storage.CurrentContext, keyStorage, playerKeys + keyCount);

            OnKeysPurchased(player, keyCount, potContribution);
        }

        public static void CheckAndEndRound()
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(IsRoundActive(), "no active round");

            BigInteger currentTime = Runtime.Time;
            BigInteger endTime = EndTime();
            ExecutionEngine.Assert(currentTime >= endTime, "round not ended");

            DeclareWinner();
        }
        #endregion

        #region Internal Methods
        private static void DeclareWinner()
        {
            UInt160 winner = LastBuyer();
            BigInteger prize = CurrentPot();
            BigInteger roundId = CurrentRound();

            // End the round
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND_ACTIVE, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_POT, 0);

            OnDoomsdayWinner(winner, prize, roundId);
        }
        #endregion
    }
}
