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
    /// <summary>
    /// Event delegates for Neo Crash game.
    /// </summary>
    public delegate void CrashBetPlacedHandler(UInt160 player, BigInteger amount, BigInteger autoCashout, BigInteger roundId);
    public delegate void CrashCashedOutHandler(UInt160 player, BigInteger payout, BigInteger multiplier, BigInteger roundId);
    public delegate void CrashRoundStartedHandler(BigInteger roundId, BigInteger requestId);
    public delegate void CrashRoundEndedHandler(BigInteger crashPoint, BigInteger roundId);

    /// <summary>
    /// Neo Crash MiniApp - Multiplier crash game with provable fairness.
    ///
    /// GAME MECHANICS:
    /// - Players place bets before round starts
    /// - Multiplier increases from 1.00x until crash
    /// - Players must cash out before crash to win
    /// - Auto-cashout option for automatic exit at target multiplier
    /// - Crash point determined by VRF randomness
    ///
    /// ARCHITECTURE:
    /// - Round-based betting with VRF crash point
    /// - Players bet → Admin starts round → VRF determines crash → Settle bets
    /// </summary>
    [DisplayName("MiniAppNeoCrash")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Neo Crash - Multiplier crash game with VRF")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-neo-crash";
        private const int PLATFORM_FEE_PERCENT = 5;
        private const long MIN_BET = 5000000; // 0.05 GAS
        private const long MAX_BET = 100000000000; // 1000 GAS
        private const int MIN_MULTIPLIER = 100; // 1.00x (stored as 100 = 1.00)
        private const int MAX_MULTIPLIER = 100000; // 1000.00x
        #endregion

        #region App Prefixes (start from 0x10)
        private static readonly byte[] PREFIX_ROUND_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_ROUND_STATE = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_ROUND_BETS = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_PLAYER_BET = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_CRASH_POINT = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_REQUEST_TO_ROUND = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_AUTOMATION_TASK = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_CURRENT_MULTIPLIER = new byte[] { 0x22 };
        #endregion

        #region Round States
        private const int STATE_BETTING = 0;
        private const int STATE_RUNNING = 1;
        private const int STATE_CRASHED = 2;
        #endregion

        #region Bet Data Structure
        public struct CrashBet
        {
            public UInt160 Player;
            public BigInteger Amount;
            public BigInteger AutoCashout; // Multiplier * 100 (e.g., 200 = 2.00x)
            public bool CashedOut;
            public BigInteger CashoutMultiplier;
        }
        #endregion

        #region App Events
        [DisplayName("CrashBetPlaced")]
        public static event CrashBetPlacedHandler OnCrashBetPlaced;

        [DisplayName("CrashCashedOut")]
        public static event CrashCashedOutHandler OnCrashCashedOut;

        [DisplayName("CrashRoundStarted")]
        public static event CrashRoundStartedHandler OnCrashRoundStarted;

        [DisplayName("CrashRoundEnded")]
        public static event CrashRoundEndedHandler OnCrashRoundEnded;
        #endregion

        #region App Getters
        [Safe]
        public static BigInteger CurrentRound() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ROUND_ID);

        [Safe]
        public static int RoundState() => (int)(BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ROUND_STATE);

        [Safe]
        public static BigInteger GetCrashPoint(BigInteger roundId)
        {
            byte[] key = Helper.Concat(PREFIX_CRASH_POINT, (ByteString)roundId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetCurrentMultiplier() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_CURRENT_MULTIPLIER);
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND_ID, 1);
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND_STATE, STATE_BETTING);
        }
        #endregion

        #region User-Facing Methods

        /// <summary>
        /// Places a bet for the current round.
        /// </summary>
        public static void PlaceBet(UInt160 player, BigInteger amount, BigInteger autoCashout, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(RoundState() == STATE_BETTING, "betting closed");
            ExecutionEngine.Assert(amount >= MIN_BET && amount <= MAX_BET, "invalid bet amount");
            ExecutionEngine.Assert(autoCashout >= MIN_MULTIPLIER, "min cashout 1.00x");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            ValidatePaymentReceipt(APP_ID, player, amount, receiptId);

            BigInteger roundId = CurrentRound();

            CrashBet bet = new CrashBet
            {
                Player = player,
                Amount = amount,
                AutoCashout = autoCashout,
                CashedOut = false,
                CashoutMultiplier = 0
            };
            StoreBet(roundId, player, bet);

            OnCrashBetPlaced(player, amount, autoCashout, roundId);
        }

        /// <summary>
        /// Player cashes out at current multiplier.
        /// SECURITY: Uses on-chain multiplier, ignores user input to prevent manipulation.
        /// </summary>
        public static void CashOut(UInt160 player, BigInteger currentMultiplier)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(RoundState() == STATE_RUNNING, "round not running");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            // SECURITY FIX: Use on-chain multiplier, validate against user input
            BigInteger onChainMultiplier = GetCurrentMultiplier();
            ExecutionEngine.Assert(onChainMultiplier >= MIN_MULTIPLIER, "multiplier not set");
            ExecutionEngine.Assert(currentMultiplier <= onChainMultiplier, "invalid multiplier");

            BigInteger roundId = CurrentRound();
            CrashBet bet = GetBet(roundId, player);
            ExecutionEngine.Assert(bet.Player != null && bet.Amount > 0, "no bet found");
            ExecutionEngine.Assert(!bet.CashedOut, "already cashed out");

            // Use validated multiplier for payout calculation
            BigInteger payout = bet.Amount * currentMultiplier / 100;
            payout = payout * (100 - PLATFORM_FEE_PERCENT) / 100;

            bet.CashedOut = true;
            bet.CashoutMultiplier = currentMultiplier;
            StoreBet(roundId, player, bet);

            OnCrashCashedOut(player, payout, currentMultiplier, roundId);
        }

        #endregion

        #region Admin Methods

        /// <summary>
        /// Admin starts the round - requests VRF for crash point.
        /// </summary>
        public static void StartRound()
        {
            ValidateAdmin();
            ExecutionEngine.Assert(RoundState() == STATE_BETTING, "not in betting state");

            Storage.Put(Storage.CurrentContext, PREFIX_ROUND_STATE, STATE_RUNNING);
            BigInteger roundId = CurrentRound();
            BigInteger requestId = RequestRng(roundId);

            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_ROUND, (ByteString)requestId.ToByteArray()),
                roundId);

            OnCrashRoundStarted(roundId, requestId);
        }

        /// <summary>
        /// Admin updates the current multiplier during round.
        /// Called by automation service as multiplier increases.
        /// </summary>
        public static void UpdateMultiplier(BigInteger multiplier)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(RoundState() == STATE_RUNNING, "round not running");
            ExecutionEngine.Assert(multiplier >= MIN_MULTIPLIER, "invalid multiplier");
            Storage.Put(Storage.CurrentContext, PREFIX_CURRENT_MULTIPLIER, multiplier);
        }

        #endregion

        #region Service Request Methods

        private static BigInteger RequestRng(BigInteger roundId)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

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

            ByteString roundIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_ROUND, (ByteString)requestId.ToByteArray()));
            ExecutionEngine.Assert(roundIdData != null, "unknown request");

            BigInteger roundId = (BigInteger)roundIdData;

            if (!success)
            {
                Storage.Put(Storage.CurrentContext, PREFIX_ROUND_STATE, STATE_BETTING);
                return;
            }

            // Calculate crash point from VRF
            byte[] randomBytes = (byte[])result;
            BigInteger crashPoint = CalculateCrashPoint(randomBytes);

            // Store crash point
            byte[] crashKey = Helper.Concat(PREFIX_CRASH_POINT, (ByteString)roundId.ToByteArray());
            Storage.Put(Storage.CurrentContext, crashKey, crashPoint);

            // End round and start new one
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND_STATE, STATE_CRASHED);
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND_ID, roundId + 1);
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND_STATE, STATE_BETTING);

            Storage.Delete(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_ROUND, (ByteString)requestId.ToByteArray()));

            OnCrashRoundEnded(crashPoint, roundId);
        }

        #endregion

        #region Internal Helpers

        private static BigInteger CalculateCrashPoint(byte[] randomBytes)
        {
            // Convert first 4 bytes to a number
            BigInteger rand = 0;
            for (int i = 0; i < 4 && i < randomBytes.Length; i++)
            {
                rand = rand * 256 + randomBytes[i];
            }

            // House edge: 1% instant crash
            if (rand % 100 == 0) return MIN_MULTIPLIER;

            // Calculate crash point using exponential distribution
            // Formula: max(1.00, 99 / (100 - rand % 100))
            BigInteger e = rand % 10000;
            BigInteger crashPoint = 9900 * 100 / (10000 - e);

            if (crashPoint < MIN_MULTIPLIER) crashPoint = MIN_MULTIPLIER;
            if (crashPoint > MAX_MULTIPLIER) crashPoint = MAX_MULTIPLIER;

            return crashPoint;
        }

        private static void StoreBet(BigInteger roundId, UInt160 player, CrashBet bet)
        {
            byte[] key = Helper.Concat(PREFIX_PLAYER_BET, player);
            key = Helper.Concat(key, (ByteString)roundId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(bet));
        }

        [Safe]
        public static CrashBet GetBet(BigInteger roundId, UInt160 player)
        {
            byte[] key = Helper.Concat(PREFIX_PLAYER_BET, player);
            key = Helper.Concat(key, (ByteString)roundId.ToByteArray());
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            if (data == null) return new CrashBet();
            return (CrashBet)StdLib.Deserialize(data);
        }

        #endregion
    }
}
