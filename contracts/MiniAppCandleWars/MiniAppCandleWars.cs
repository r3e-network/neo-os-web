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
    public delegate void CandleBetPlacedHandler(UInt160 player, BigInteger amount, bool isGreen, BigInteger roundId);
    public delegate void CandleRoundResolvedHandler(bool isGreen, BigInteger greenPool, BigInteger redPool, BigInteger roundId);

    /// <summary>
    /// Candle Wars MiniApp - Binary options on price direction.
    /// Players bet on whether the next candle will be green or red.
    /// </summary>
    [DisplayName("MiniAppCandleWars")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Candle Wars - Binary options game")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-candle-wars";
        private const int PLATFORM_FEE_PERCENT = 5;
        private const long MIN_BET = 5000000;    // 0.05 GAS
        private const long MAX_BET = 5000000000; // 50 GAS (anti-Martingale)
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_ROUND_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_GREEN_POOL = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_RED_POOL = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_PLAYER_BET = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_BETTING_OPEN = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_REQUEST_TO_ROUND = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_ROUND_RESULT = new byte[] { 0x16 };
        private static readonly byte[] PREFIX_ROUND_POOLS = new byte[] { 0x17 };
        #endregion

        #region Bet Structure
        public struct CandleBet
        {
            public UInt160 Player;
            public BigInteger Amount;
            public bool IsGreen;
        }
        #endregion

        #region Events
        [DisplayName("CandleBetPlaced")]
        public static event CandleBetPlacedHandler OnCandleBetPlaced;

        [DisplayName("CandleRoundResolved")]
        public static event CandleRoundResolvedHandler OnCandleRoundResolved;
        #endregion

        #region Getters
        [Safe]
        public static BigInteger CurrentRound() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ROUND_ID);

        [Safe]
        public static BigInteger GreenPool() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_GREEN_POOL);

        [Safe]
        public static BigInteger RedPool() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_RED_POOL);

        [Safe]
        public static bool IsBettingOpen() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_BETTING_OPEN) == 1;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND_ID, 1);
            Storage.Put(Storage.CurrentContext, PREFIX_BETTING_OPEN, 1);
        }
        #endregion

        #region User Methods
        public static void PlaceBet(UInt160 player, BigInteger amount, bool isGreen, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(IsBettingOpen(), "betting closed");
            ExecutionEngine.Assert(amount >= MIN_BET, "min bet 0.05 GAS");
            ExecutionEngine.Assert(amount <= MAX_BET, "max bet 50 GAS (anti-Martingale)");

            // Anti-Martingale protection
            ValidateBetLimits(player, amount);

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            ValidatePaymentReceipt(APP_ID, player, amount, receiptId);

            BigInteger roundId = CurrentRound();

            if (isGreen)
            {
                BigInteger pool = GreenPool();
                Storage.Put(Storage.CurrentContext, PREFIX_GREEN_POOL, pool + amount);
            }
            else
            {
                BigInteger pool = RedPool();
                Storage.Put(Storage.CurrentContext, PREFIX_RED_POOL, pool + amount);
            }

            CandleBet bet = new CandleBet { Player = player, Amount = amount, IsGreen = isGreen };
            byte[] key = Helper.Concat(PREFIX_PLAYER_BET, player);
            key = Helper.Concat(key, (ByteString)roundId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(bet));

            OnCandleBetPlaced(player, amount, isGreen, roundId);
        }
        #endregion

        #region Admin Methods
        public static void CloseBetting()
        {
            ValidateAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_BETTING_OPEN, 0);
        }

        public static void ResolveRound(bool isGreen)
        {
            ValidateGateway();
            BigInteger roundId = CurrentRound();
            BigInteger greenPool = GreenPool();
            BigInteger redPool = RedPool();

            // Store round result for claims
            byte[] resultKey = Helper.Concat(PREFIX_ROUND_RESULT, (ByteString)roundId.ToByteArray());
            Storage.Put(Storage.CurrentContext, resultKey, isGreen ? 1 : 0);

            // Store pools for payout calculation
            byte[] poolsKey = Helper.Concat(PREFIX_ROUND_POOLS, (ByteString)roundId.ToByteArray());
            Storage.Put(Storage.CurrentContext, poolsKey, StdLib.Serialize(new BigInteger[] { greenPool, redPool }));

            // Reset for next round
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND_ID, roundId + 1);
            Storage.Put(Storage.CurrentContext, PREFIX_GREEN_POOL, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_RED_POOL, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_BETTING_OPEN, 1);

            OnCandleRoundResolved(isGreen, greenPool, redPool, roundId);
        }

        /// <summary>
        /// SECURITY FIX: Claim winnings from a resolved round.
        /// </summary>
        public static void ClaimWinnings(UInt160 player, BigInteger roundId)
        {
            ValidateNotGloballyPaused(APP_ID);

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            // Get player's bet
            byte[] betKey = Helper.Concat(PREFIX_PLAYER_BET, player);
            betKey = Helper.Concat(betKey, (ByteString)roundId.ToByteArray());
            ByteString betData = Storage.Get(Storage.CurrentContext, betKey);
            ExecutionEngine.Assert(betData != null, "no bet found");

            CandleBet bet = (CandleBet)StdLib.Deserialize(betData);

            // Get round result
            byte[] resultKey = Helper.Concat(PREFIX_ROUND_RESULT, (ByteString)roundId.ToByteArray());
            ByteString resultData = Storage.Get(Storage.CurrentContext, resultKey);
            ExecutionEngine.Assert(resultData != null, "round not resolved");
            bool isGreen = (BigInteger)resultData == 1;

            // Check if player won
            ExecutionEngine.Assert(bet.IsGreen == isGreen, "did not win");

            // Get pools
            byte[] poolsKey = Helper.Concat(PREFIX_ROUND_POOLS, (ByteString)roundId.ToByteArray());
            BigInteger[] pools = (BigInteger[])StdLib.Deserialize(Storage.Get(Storage.CurrentContext, poolsKey));
            BigInteger winningPool = isGreen ? pools[0] : pools[1];
            BigInteger losingPool = isGreen ? pools[1] : pools[0];

            // Calculate payout
            BigInteger totalPool = winningPool + losingPool;
            BigInteger platformFee = totalPool * PLATFORM_FEE_PERCENT / 100;
            BigInteger payoutPool = totalPool - platformFee;
            BigInteger payout = payoutPool * bet.Amount / winningPool;

            // Clear bet to prevent double claim
            Storage.Delete(Storage.CurrentContext, betKey);

            // Transfer winnings
            bool transferred = GAS.Transfer(Runtime.ExecutingScriptHash, player, payout);
            ExecutionEngine.Assert(transferred, "payout failed");
        }
        #endregion
    }
}
