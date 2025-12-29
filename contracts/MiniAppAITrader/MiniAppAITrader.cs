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
    public delegate void StrategyCreatedHandler(UInt160 trader, string pair, BigInteger strategyId);
    public delegate void PriceRequestedHandler(BigInteger strategyId, BigInteger requestId);
    public delegate void TradeExecutedHandler(UInt160 trader, string pair, bool isBuy, BigInteger amount, BigInteger price, BigInteger strategyId);
    public delegate void AutomationRegisteredHandler(BigInteger taskId, string triggerType, string schedule);
    public delegate void AutomationCancelledHandler(BigInteger taskId);
    public delegate void PeriodicExecutionTriggeredHandler(BigInteger taskId);

    /// <summary>
    /// AI Trader - AI-powered trading with price oracle.
    ///
    /// ARCHITECTURE (Chainlink-style):
    /// - Trader creates strategy via CreateStrategy
    /// - Strategy monitors prices via RequestPriceCheck → Contract requests price
    /// - Gateway fulfills → Contract evaluates AI signals → Executes trades
    ///
    /// MECHANICS:
    /// - Define pair, direction bias, and stake
    /// - AI signals determine buy/sell timing
    /// - Trades execute based on oracle price data
    /// </summary>
    [DisplayName("MiniAppAITrader")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "AI Trader - AI-powered trading with on-chain oracle")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-aitrader";
        private const long MIN_STAKE = 10000000; // 0.1 GAS
        #endregion

        #region App Prefixes (start from 0x10)
        private static readonly byte[] PREFIX_STRATEGY_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_STRATEGIES = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_REQUEST_TO_STRATEGY = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_AUTOMATION_TASK = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Strategy Data Structure
        public struct StrategyData
        {
            public UInt160 Trader;
            public string Pair;
            public BigInteger Stake;
            public bool Active;
            public BigInteger LastPrice;
            public BigInteger Timestamp;
        }
        #endregion

        #region App Events
        [DisplayName("StrategyCreated")]
        public static event StrategyCreatedHandler OnStrategyCreated;

        [DisplayName("PriceRequested")]
        public static event PriceRequestedHandler OnPriceRequested;

        [DisplayName("TradeExecuted")]
        public static event TradeExecutedHandler OnTradeExecuted;

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
            Storage.Put(Storage.CurrentContext, PREFIX_STRATEGY_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        public static BigInteger CreateStrategy(UInt160 trader, string pair, BigInteger stake)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(trader), "unauthorized");
            ExecutionEngine.Assert(pair != null && pair.Length > 0, "pair required");
            ExecutionEngine.Assert(stake >= MIN_STAKE, "min stake 0.1 GAS");

            BigInteger strategyId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_STRATEGY_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_STRATEGY_ID, strategyId);

            StrategyData strategy = new StrategyData
            {
                Trader = trader,
                Pair = pair,
                Stake = stake,
                Active = true,
                LastPrice = 0,
                Timestamp = Runtime.Time
            };
            StoreStrategy(strategyId, strategy);

            OnStrategyCreated(trader, pair, strategyId);
            return strategyId;
        }

        /// <summary>
        /// Request price check for AI signal evaluation.
        /// </summary>
        public static void RequestPriceCheck(BigInteger strategyId)
        {
            StrategyData strategy = GetStrategy(strategyId);
            ExecutionEngine.Assert(strategy.Trader != null, "strategy not found");
            ExecutionEngine.Assert(strategy.Active, "strategy inactive");
            ExecutionEngine.Assert(
                Runtime.CheckWitness(strategy.Trader) || Runtime.CheckWitness(Admin()),
                "unauthorized"
            );

            BigInteger requestId = RequestPrice(strategyId, strategy.Pair);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_STRATEGY, (ByteString)requestId.ToByteArray()),
                strategyId);

            OnPriceRequested(strategyId, requestId);
        }

        public static void DeactivateStrategy(BigInteger strategyId)
        {
            StrategyData strategy = GetStrategy(strategyId);
            ExecutionEngine.Assert(strategy.Trader != null, "strategy not found");
            ExecutionEngine.Assert(Runtime.CheckWitness(strategy.Trader), "unauthorized");

            strategy.Active = false;
            StoreStrategy(strategyId, strategy);
        }

        [Safe]
        public static StrategyData GetStrategy(BigInteger strategyId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_STRATEGIES, (ByteString)strategyId.ToByteArray()));
            if (data == null) return new StrategyData();
            return (StrategyData)StdLib.Deserialize(data);
        }

        #endregion

        #region Service Request Methods

        private static BigInteger RequestPrice(BigInteger strategyId, string pair)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { strategyId, pair });
            return (BigInteger)Contract.Call(
                gateway, "requestService", CallFlags.All,
                APP_ID, "pricefeed", payload,
                Runtime.ExecutingScriptHash, "onServiceCallback"
            );
        }

        public static void OnServiceCallback(
            BigInteger requestId, string appId, string serviceType,
            bool success, ByteString result, string error)
        {
            ValidateGateway();

            ByteString strategyIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_STRATEGY, (ByteString)requestId.ToByteArray()));
            ExecutionEngine.Assert(strategyIdData != null, "unknown request");

            BigInteger strategyId = (BigInteger)strategyIdData;
            StrategyData strategy = GetStrategy(strategyId);
            ExecutionEngine.Assert(strategy.Trader != null, "strategy not found");

            Storage.Delete(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_STRATEGY, (ByteString)requestId.ToByteArray()));

            if (!success || !strategy.Active)
            {
                return;
            }

            ExecutionEngine.Assert(result != null && result.Length > 0, "no price data");
            BigInteger currentPrice = (BigInteger)StdLib.Deserialize(result);

            // AI signal: Simple momentum - buy if price up, sell if down
            bool isBuy = strategy.LastPrice == 0 || currentPrice > strategy.LastPrice;

            // Update last price
            strategy.LastPrice = currentPrice;
            StoreStrategy(strategyId, strategy);

            // Emit trade event (actual execution handled off-chain)
            OnTradeExecuted(strategy.Trader, strategy.Pair, isBuy, strategy.Stake, currentPrice, strategyId);
        }

        #endregion

        #region Internal Helpers

        private static void StoreStrategy(BigInteger strategyId, StrategyData strategy)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_STRATEGIES, (ByteString)strategyId.ToByteArray()),
                StdLib.Serialize(strategy));
        }

        #endregion

        #region Periodic Automation

        /// <summary>
        /// Returns the AutomationAnchor contract address.
        /// </summary>
        [Safe]
        public static UInt160 AutomationAnchor()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR);
            return data != null ? (UInt160)data : UInt160.Zero;
        }

        /// <summary>
        /// Sets the AutomationAnchor contract address.
        /// SECURITY: Only admin can set the automation anchor.
        /// </summary>
        public static void SetAutomationAnchor(UInt160 anchor)
        {
            ValidateAdmin();
            ValidateAddress(anchor);
            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR, anchor);
        }

        /// <summary>
        /// Periodic execution callback invoked by AutomationAnchor.
        /// SECURITY: Only AutomationAnchor can invoke this method.
        /// LOGIC: Execute pending AI trading signals for active strategies.
        /// </summary>
        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            // Verify caller is AutomationAnchor
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            OnPeriodicExecutionTriggered(taskId);

            // Process automated trading
            ProcessAutomatedTrading();
        }

        /// <summary>
        /// Registers this MiniApp for periodic automation.
        /// SECURITY: Only admin can register.
        /// CORRECTNESS: AutomationAnchor must be set first.
        /// </summary>
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
        /// Internal method to process automated trading.
        /// Called by OnPeriodicExecution.
        /// LOGIC: Iterate through active strategies and execute pending AI trading signals.
        /// </summary>
        private static void ProcessAutomatedTrading()
        {
            // Get total strategies
            BigInteger strategyCount = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_STRATEGY_ID);
            if (strategyCount == 0) return;

            // Process recent active strategies (last 10 for gas efficiency)
            BigInteger startId = strategyCount > 10 ? strategyCount - 10 : 1;

            for (BigInteger i = startId; i <= strategyCount; i++)
            {
                StrategyData strategy = GetStrategy(i);
                if (strategy.Trader == null || !strategy.Active) continue;

                // Request price check for active strategy
                BigInteger requestId = RequestPrice(i, strategy.Pair);
                Storage.Put(Storage.CurrentContext,
                    Helper.Concat(PREFIX_REQUEST_TO_STRATEGY, (ByteString)requestId.ToByteArray()),
                    i);

                OnPriceRequested(i, requestId);
            }
        }

        #endregion
    }
}
