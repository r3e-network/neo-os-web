using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // ===================================================================
    //  CoinFlip (FogPlay) game module
    //
    //  Ported from MiniAppFogPlay.  Every method takes appId as its
    //  first parameter and all storage is namespaced via AppKey().
    //
    //  GAME MECHANICS:
    //  - Player chooses heads (true) or tails (false)
    //  - Player prepays GAS, then calls PlaceCoinFlipBet
    //  - Contract stores bet data and requests VRF from Morpheus Oracle
    //  - Oracle calls OnOracleResult -> ResolveCoinFlipBet settles
    //  - Win: 2x bet minus 5% platform fee
    //  - Lose: forfeit entire bet
    //
    //  SECURITY:
    //  - Bet data stored BEFORE requesting RNG (prevents manipulation)
    //  - Anti-Martingale limits enforced on every bet
    //  - Reentrancy guard on state-changing operations
    //  - Only configured oracle can resolve bets
    // ===================================================================
    public partial class PlatformGameContract
    {
        // ---------------------------------------------------------------
        //  CoinFlip constants
        // ---------------------------------------------------------------
        private const int CF_PLATFORM_FEE_PERCENT = 5;
        private const long CF_MIN_BET             = 5000000;     // 0.05 GAS
        private const long CF_MAX_BET             = 5000000000;  // 50 GAS

        // Anti-Martingale defaults
        private const long CF_DAILY_LIMIT         = 100000000000; // 1000 GAS
        private const long CF_COOLDOWN_MS         = 30000;        // 30 seconds
        private const int CF_MAX_CONSECUTIVE       = 20;

        // ---------------------------------------------------------------
        //  CoinFlip storage prefixes (0xB0 - 0xBF)
        // ---------------------------------------------------------------
        private static readonly byte[] CF_PREFIX_BET_ID         = new byte[] { 0xB0 };
        private static readonly byte[] CF_PREFIX_BETS           = new byte[] { 0xB1 };
        private static readonly byte[] CF_PREFIX_REQ_TO_BET     = new byte[] { 0xB2 };
        private static readonly byte[] CF_PREFIX_PLAYER_DAILY   = new byte[] { 0xB3 };
        private static readonly byte[] CF_PREFIX_PLAYER_LAST    = new byte[] { 0xB4 };
        private static readonly byte[] CF_PREFIX_PLAYER_COUNT   = new byte[] { 0xB5 };

        // ---------------------------------------------------------------
        //  CoinFlip data structures
        // ---------------------------------------------------------------
        public struct CoinFlipBet
        {
            public UInt160 Player;
            public BigInteger Amount;
            public bool Choice;       // true = heads, false = tails
            public BigInteger Timestamp;
            public bool Resolved;
        }

        // ---------------------------------------------------------------
        //  CoinFlip events
        // ---------------------------------------------------------------
        public delegate void CoinFlipBetPlacedHandler(string appId, UInt160 player, BigInteger amount, bool choice, BigInteger betId);
        public delegate void CoinFlipBetResolvedHandler(string appId, UInt160 player, BigInteger payout, bool won, BigInteger betId);
        public delegate void CoinFlipRngRequestedHandler(string appId, BigInteger betId, BigInteger requestId);

        [DisplayName("CoinFlipBetPlaced")]
        public static event CoinFlipBetPlacedHandler OnCoinFlipBetPlaced;

        [DisplayName("CoinFlipBetResolved")]
        public static event CoinFlipBetResolvedHandler OnCoinFlipBetResolved;

        [DisplayName("CoinFlipRngRequested")]
        public static event CoinFlipRngRequestedHandler OnCoinFlipRngRequested;

        // ===================================================================
        //  Player: place bet
        // ===================================================================

        /// <summary>
        /// Place a coin flip bet.  The player must have prepaid GAS.
        ///
        /// FLOW:
        /// 1. Validate game type, pause state, player authorization
        /// 2. Enforce anti-Martingale limits (max bet, daily cap, cooldown)
        /// 3. Consume prepaid GAS credit
        /// 4. Store bet data on-chain (before RNG for security)
        /// 5. Request VRF randomness from Morpheus Oracle
        /// 6. Map oracle requestId to betId for callback resolution
        ///
        /// Returns: betId
        /// </summary>
        public static BigInteger PlaceCoinFlipBet(string appId, UInt160 player, bool choice, BigInteger amount)
        {
            RequireRegistered(appId);
            RequireNotPaused(appId);
            RequireGameType(appId, GameType_CoinFlip);
            ExecutionEngine.Assert(amount >= CF_MIN_BET, "min bet 0.05 GAS");
            ExecutionEngine.Assert(amount <= CF_MAX_BET, "max bet 50 GAS");

            ValidateUserOrAbstractAccount(player);

            // Anti-Martingale validation
            ValidateCoinFlipBetLimits(appId, player, amount);

            AcquireReentrancyLock(appId);

            ConsumeDirectGasCredit(appId, player, amount);

            // Generate bet ID
            BigInteger betId = AppGetInt(appId, CF_PREFIX_BET_ID) + 1;
            AppPut(appId, CF_PREFIX_BET_ID, betId);

            // Store bet data BEFORE requesting RNG (security: prevents manipulation)
            CoinFlipBet bet = new CoinFlipBet
            {
                Player = player,
                Amount = amount,
                Choice = choice,
                Timestamp = Runtime.Time,
                Resolved = false
            };
            StoreCoinFlipBet(appId, betId, bet);

            // Record bet for anti-Martingale tracking
            RecordCoinFlipBet(appId, player, amount);

            // Request randomness from oracle
            ByteString payload = StdLib.Serialize(new object[] { appId, betId });
            BigInteger requestId = RequestOracleForCallback(player, "vrf_random", payload);

            // Map requestId -> betId for callback resolution
            byte[] reqKey = AppKey(appId, CF_PREFIX_REQ_TO_BET, requestId);
            Storage.Put(Storage.CurrentContext, reqKey, betId);
            StoreOracleRequestContext(requestId, appId, GameType_CoinFlip, betId);

            ReleaseReentrancyLock(appId);

            OnCoinFlipBetPlaced(appId, player, amount, choice, betId);
            OnCoinFlipRngRequested(appId, betId, requestId);

            return betId;
        }

        // ===================================================================
        //  Oracle: resolve bet
        // ===================================================================

        /// <summary>
        /// Resolve a coin flip bet with oracle-provided randomness.
        ///
        /// SECURITY:
        /// - Only the configured oracle can call this entry point
        /// - Request-bound callbacks verify requestId -> betId before payout
        /// - Bet data is read from storage (not from callback params)
        /// - Resolved flag prevents double-settlement
        /// - Reentrancy guard protects state
        /// </summary>
        public static void ResolveCoinFlipBet(string appId, BigInteger betId, ByteString oracleResult)
        {
            ValidateOracle();
            ResolveCoinFlipBetFromOracle(appId, betId, 0, oracleResult);
        }

        private static void ResolveCoinFlipBetFromOracle(
            string appId,
            BigInteger betId,
            BigInteger requestId,
            ByteString oracleResult)
        {
            RequireRegistered(appId);

            if (requestId > 0)
            {
                byte[] reqKey = AppKey(appId, CF_PREFIX_REQ_TO_BET, requestId);
                ByteString mappedBet = Storage.Get(Storage.CurrentContext, reqKey);
                ExecutionEngine.Assert(mappedBet != null && (BigInteger)mappedBet == betId, "oracle request mismatch");
                Storage.Delete(Storage.CurrentContext, reqKey);
            }

            CoinFlipBet bet = LoadCoinFlipBet(appId, betId);
            ExecutionEngine.Assert(bet.Player != UInt160.Zero, "bet not found");
            ExecutionEngine.Assert(!bet.Resolved, "already resolved");

            AcquireReentrancyLock(appId);

            // Determine outcome from VRF result
            bool won = false;
            BigInteger payout = 0;

            if (oracleResult != null && oracleResult.Length > 0)
            {
                byte[] randomBytes = (byte[])oracleResult;
                bool outcome = randomBytes[0] % 2 == 0;
                won = outcome == bet.Choice;
                payout = won
                    ? bet.Amount * 2 * (100 - CF_PLATFORM_FEE_PERCENT) / 100
                    : 0;

                // Pay winner
                if (won && payout > 0)
                {
                    ExecutionEngine.Assert(
                        GAS.Transfer(Runtime.ExecutingScriptHash, bet.Player, payout),
                        "coinflip payout failed");
                }
            }

            // Mark as resolved
            bet.Resolved = true;
            StoreCoinFlipBet(appId, betId, bet);

            ReleaseReentrancyLock(appId);

            OnCoinFlipBetResolved(appId, bet.Player, payout, won, betId);
        }

    }
}
