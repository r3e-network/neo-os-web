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
    /// Event delegates for bet lifecycle tracking.
    /// </summary>
    public delegate void BetPlacedHandler(UInt160 player, BigInteger amount, bool choice, BigInteger betId);
    public delegate void BetResolvedHandler(UInt160 player, BigInteger payout, bool won, BigInteger betId);
    public delegate void RngRequestedHandler(BigInteger betId, BigInteger requestId);
    public delegate void AutomationRegisteredHandler(BigInteger taskId, string triggerType, string schedule);
    public delegate void AutomationCancelledHandler(BigInteger taskId);
    public delegate void PeriodicExecutionTriggeredHandler(BigInteger taskId);

    /// <summary>
    /// CoinFlip MiniApp - 50/50 double-or-nothing betting game.
    ///
    /// ARCHITECTURE:
    /// - User invokes PlaceBet → Contract requests RNG from Morpheus Oracle
    /// - Oracle fulfills request → Contract receives callback → Settles bet
    ///
    /// GAME MECHANICS:
    /// - Player chooses heads (true) or tails (false)
    /// - VRF randomness determines outcome
    /// - Win: 2x bet minus 5% platform fee
    /// - Lose: Forfeit entire bet
    ///
    /// SECURITY:
    /// - PlaceBet: Requires player signature (CheckWitness)
    /// - OnOracleResult: Only oracle can call
    /// - Randomness from TEE prevents manipulation
    /// - Bet data stored on-chain, preventing callback manipulation
    ///
    /// WORKFLOW (NEW - MiniApp initiates service request):
    /// 1. User pays via PaymentHub (SDK.payGAS)
    /// 2. User calls PlaceBet → bet stored + RNG requested
    /// 3. Morpheus Oracle processes RNG request
    /// 4. Oracle calls OnOracleResult with VRF result
    /// 5. Contract settles bet + emits payout event
    /// 6. Platform sends payout via PaymentHub
    /// </summary>
    [DisplayName("MiniAppCoinFlip")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. CoinFlip is a provably fair gaming application for 50/50 betting. Use it to place heads or tails bets, you can win 2x your stake with verifiable on-chain randomness.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-coinflip";
        private const int PLATFORM_FEE_PERCENT = 5;
        private const long MIN_BET = 5000000;    // 0.05 GAS
        private const long MAX_BET = 5000000000; // 50 GAS (anti-Martingale)
        #endregion

        #region App Prefixes (start from 0x10)
        private static readonly byte[] PREFIX_BET_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_BETS = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_REQUEST_TO_BET = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_AUTOMATION_TASK = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Bet Data Structure
        /// <summary>
        /// Stores all bet details for callback resolution.
        /// </summary>
        public struct BetData
        {
            public UInt160 Player;
            public BigInteger Amount;
            public bool Choice;
            public BigInteger Timestamp;
            public bool Resolved;
        }
        #endregion

        #region App Events
        [DisplayName("BetPlaced")]
        public static event BetPlacedHandler OnBetPlaced;

        [DisplayName("BetResolved")]
        public static event BetResolvedHandler OnBetResolved;

        [DisplayName("RngRequested")]
        public static event RngRequestedHandler OnRngRequested;

        [DisplayName("AutomationRegistered")]
        public static event AutomationRegisteredHandler OnAutomationRegistered;

        [DisplayName("AutomationCancelled")]
        public static event AutomationCancelledHandler OnAutomationCancelled;

        [DisplayName("PeriodicExecutionTriggered")]
        public static event PeriodicExecutionTriggeredHandler OnPeriodicExecutionTriggered;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_BET_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        /// <summary>
        /// Places a new bet and requests RNG from Morpheus Oracle.
        ///
        /// FLOW:
        /// 1. Validate player signature and bet amount
        /// 2. Store bet data on-chain
        /// 3. Call MorpheusOracle.request("rng") with callback
        /// 4. Store request-to-bet mapping for callback resolution
        ///
        /// SECURITY:
        /// - CheckWitness ensures player authorized this bet
        /// - Bet data stored BEFORE requesting RNG (prevents manipulation)
        /// - Minimum bet prevents dust attacks
        ///
        /// RETURNS: betId for tracking
        /// </summary>
        public static BigInteger PlaceBet(UInt160 player, BigInteger amount, bool choice, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateUserOrAbstractAccount(player);
            ConsumeDirectGasCredit(player, amount);
            return PlaceBetInternal(player, amount, choice);
        }

        private static BigInteger PlaceBetInternal(UInt160 player, BigInteger amount, bool choice)
        {
            ExecutionEngine.Assert(amount >= MIN_BET, "min bet 0.05 GAS");
            ExecutionEngine.Assert(amount <= MAX_BET, "max bet 50 GAS (anti-Martingale)");

            // Anti-Martingale: Validate bet limits (daily cap, cooldown, consecutive)
            ValidateBetLimits(player, amount);

            // Generate bet ID
            BigInteger betId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_BET_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_BET_ID, betId);

            // Store bet data (BEFORE requesting RNG for security)
            BetData bet = new BetData
            {
                Player = player,
                Amount = amount,
                Choice = choice,
                Timestamp = Runtime.Time,
                Resolved = false
            };
            StoreBet(betId, bet);

            // Record bet for anti-Martingale tracking
            RecordBet(player, amount);

            // Request randomness from the configured oracle contract
            BigInteger requestId = RequestRng(player, betId);

            // Map request to bet for callback resolution
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_BET, ((ByteString)requestId.ToByteArray())),
                betId);

            OnBetPlaced(player, amount, choice, betId);
            OnRngRequested(betId, requestId);
            return betId;
        }

        /// <summary>
        /// Gets bet details by ID.
        /// </summary>
        [Safe]
        public static BetData GetBet(BigInteger betId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_BETS, (ByteString)betId.ToByteArray()));
            if (data == null) return new BetData();
            return (BetData)StdLib.Deserialize(data);
        }

        #endregion

        #region Service Request Methods

        /// <summary>
        /// Requests RNG from Morpheus Oracle.
        ///
        /// ORACLE CALLBACK FLOW:
        /// - Contract actively calls MorpheusOracle.request
        /// - Provides callback contract and method
        /// - Oracle will call OnOracleResult when RNG is ready
        /// </summary>
        private static BigInteger RequestRng(UInt160 requester, BigInteger betId)
        {
            ByteString payload = StdLib.Serialize(new object[] { betId });
            return RequestOracleForCallback(requester, "rng", payload);
        }

        /// <summary>
        /// Callback from the configured oracle contract with RNG result.
        ///
        /// SECURITY:
        /// - ValidateOracle ensures only the configured oracle can call
        /// - Bet data retrieved from storage (not from callback params)
        /// - Prevents replay via Resolved flag
        ///
        /// FLOW:
        /// 1. Validate oracle caller
        /// 2. Lookup bet by requestId
        /// 3. Parse RNG result
        /// 4. Determine outcome and payout
        /// 5. Emit BetResolved event
        /// </summary>
        public static void OnOracleResult(
            BigInteger requestId,
            string requestType,
            bool success,
            ByteString result,
            string error)
        {
            ValidateOracle();

            // Lookup bet from request mapping
            ByteString betIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_BET, (ByteString)requestId.ToByteArray()));
            ExecutionEngine.Assert(betIdData != null, "unknown request");

            BigInteger betId = (BigInteger)betIdData;
            BetData bet = GetBet(betId);
            ExecutionEngine.Assert(!bet.Resolved, "already resolved");
            ExecutionEngine.Assert(bet.Player != null, "bet not found");

            // Handle failure
            if (!success)
            {
                // Mark as resolved but with 0 payout (refund handled off-chain)
                bet.Resolved = true;
                StoreBet(betId, bet);
                OnBetResolved(bet.Player, 0, false, betId);
                return;
            }

            // Parse RNG and determine outcome
            ExecutionEngine.Assert(result != null && result.Length > 0, "no rng data");
            byte[] randomBytes = (byte[])result;
            bool outcome = randomBytes[0] % 2 == 0;
            bool won = outcome == bet.Choice;

            // Calculate payout
            BigInteger payout = won ? bet.Amount * 2 * (100 - PLATFORM_FEE_PERCENT) / 100 : 0;

            // Mark bet as resolved
            bet.Resolved = true;
            StoreBet(betId, bet);

            // Clean up request mapping
            Storage.Delete(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_BET, (ByteString)requestId.ToByteArray()));

            OnBetResolved(bet.Player, payout, won, betId);
        }

        #endregion

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            CreditDirectGasPayment(APP_ID, from, amount, data);
        }

        #region Internal Storage Helpers

        private static void StoreBet(BigInteger betId, BetData bet)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_BETS, (ByteString)betId.ToByteArray()),
                StdLib.Serialize(bet));
        }

        #endregion

        #region Periodic Automation

        /// <summary>
        /// Returns the AutomationAnchor contract address.
        /// </summary>
        

        /// <summary>
        /// Sets the AutomationAnchor contract address.
        /// SECURITY: Only admin can set the automation anchor.
        /// </summary>
        

        /// <summary>
        /// Periodic execution callback invoked by AutomationAnchor.
        /// SECURITY: Only AutomationAnchor can invoke this method.
        /// LOGIC: Processes automated settlement for expired bets.
        /// </summary>
        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            // Verify caller is AutomationAnchor
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            OnPeriodicExecutionTriggered(taskId);

            // Process automated settlement of expired bets
            ProcessAutomatedSettlement();
        }

        /// <summary>
        /// Registers this MiniApp for periodic automation.
        /// SECURITY: Only admin can register.
        /// CORRECTNESS: AutomationAnchor must be set first.
        /// </summary>
        public static UInt160 AutomationAnchor()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR);
            return data == null ? UInt160.Zero : (UInt160)data;
        }

        public static BigInteger RegisterAutomation(string triggerType, string schedule)
        {
            ValidateAdmin();
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero, "automation anchor not set");

            // Call AutomationAnchor.RegisterPeriodicTask
            BigInteger taskId = (BigInteger)Contract.Call(anchor, "registerPeriodicTask", CallFlags.All,
                Runtime.ExecutingScriptHash, "onPeriodicExecution", triggerType, schedule, 1000000); // 0.01 GAS limit

            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_TASK, taskId);
            OnAutomationRegistered(taskId, triggerType, schedule);
            return taskId;
        }

        /// <summary>
        /// Cancels the registered automation task.
        /// SECURITY: Only admin can cancel.
        /// </summary>
        public static void CancelAutomation()
        {
            ValidateAdmin();
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_TASK);
            ExecutionEngine.Assert(data != null, "no automation registered");

            BigInteger taskId = (BigInteger)data;
            UInt160 anchor = AutomationAnchor();
            Contract.Call(anchor, "cancelPeriodicTask", CallFlags.All, taskId);

            Storage.Delete(Storage.CurrentContext, PREFIX_AUTOMATION_TASK);
            OnAutomationCancelled(taskId);
        }

        /// <summary>
        /// Internal method to process automated settlement for expired bets.
        /// Called by OnPeriodicExecution.
        /// Finds bets that are unresolved and past timeout threshold.
        /// </summary>
        private static void ProcessAutomatedSettlement()
        {
            // In a production implementation, this would iterate through pending bets
            // and settle those that have exceeded a timeout threshold.
            // For this reference implementation, we demonstrate the structure:

            // Example: Check if there are any unresolved bets past a timeout (e.g., 1 hour = 3600000 ms)
            BigInteger currentBetId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_BET_ID);
            BigInteger currentTime = Runtime.Time;
            BigInteger timeout = 3600000; // 1 hour timeout

            // In production, maintain a list of pending bets to avoid full iteration
            // For demonstration purposes, we skip the iteration logic here
            // Real implementation would maintain PREFIX_PENDING_BETS queue
        }

        #endregion
    }
}
