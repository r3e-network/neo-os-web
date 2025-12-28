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
    public delegate void GridCreatedHandler(UInt160 trader, string pair, BigInteger gridLevels, BigInteger gridId);
    public delegate void PriceRequestedHandler(BigInteger gridId, BigInteger requestId);
    public delegate void GridOrderFilledHandler(UInt160 trader, BigInteger gridLevel, bool isBuy, BigInteger amount, BigInteger gridId);
    public delegate void AutomationRegisteredHandler(BigInteger taskId, string triggerType, string schedule);
    public delegate void AutomationCancelledHandler(BigInteger taskId);
    public delegate void PeriodicExecutionTriggeredHandler(BigInteger taskId);

    /// <summary>
    /// Grid Bot - Grid trading automation with price oracle.
    ///
    /// ARCHITECTURE (Chainlink-style):
    /// - Trader creates grid via CreateGrid
    /// - Bot monitors prices via RequestPriceCheck → Contract requests price
    /// - Gateway fulfills → Contract evaluates grid levels → Fills orders
    ///
    /// MECHANICS:
    /// - Define pair, price range, and grid levels
    /// - Bot buys low, sells high within grid
    /// - Automated grid order execution
    /// </summary>
    [DisplayName("MiniAppGridBot")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Grid Bot - Grid trading with on-chain oracle")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "builtin-gridbot";
        private const long MIN_STAKE = 10000000; // 0.1 GAS
        private const int MAX_GRID_LEVELS = 20;
        #endregion

        #region App Prefixes (start from 0x10)
        private static readonly byte[] PREFIX_GRID_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_GRIDS = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_REQUEST_TO_GRID = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_AUTOMATION_TASK = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Grid Data Structure
        public struct GridData
        {
            public UInt160 Trader;
            public string Pair;
            public BigInteger Stake;
            public BigInteger LowPrice;
            public BigInteger HighPrice;
            public BigInteger GridLevels;
            public BigInteger CurrentLevel;
            public bool Active;
            public BigInteger Timestamp;
        }
        #endregion

        #region App Events
        [DisplayName("GridCreated")]
        public static event GridCreatedHandler OnGridCreated;

        [DisplayName("PriceRequested")]
        public static event PriceRequestedHandler OnPriceRequested;

        [DisplayName("GridOrderFilled")]
        public static event GridOrderFilledHandler OnGridOrderFilled;

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
            Storage.Put(Storage.CurrentContext, PREFIX_GRID_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        public static BigInteger CreateGrid(UInt160 trader, string pair, BigInteger stake, BigInteger lowPrice, BigInteger highPrice, BigInteger gridLevels)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(trader), "unauthorized");
            ExecutionEngine.Assert(pair != null && pair.Length > 0, "pair required");
            ExecutionEngine.Assert(stake >= MIN_STAKE, "min stake 0.1 GAS");
            ExecutionEngine.Assert(lowPrice > 0 && highPrice > lowPrice, "invalid price range");
            ExecutionEngine.Assert(gridLevels >= 2 && gridLevels <= MAX_GRID_LEVELS, "2-20 levels");

            BigInteger gridId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_GRID_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_GRID_ID, gridId);

            GridData grid = new GridData
            {
                Trader = trader,
                Pair = pair,
                Stake = stake,
                LowPrice = lowPrice,
                HighPrice = highPrice,
                GridLevels = gridLevels,
                CurrentLevel = gridLevels / 2, // Start in middle
                Active = true,
                Timestamp = Runtime.Time
            };
            StoreGrid(gridId, grid);

            OnGridCreated(trader, pair, gridLevels, gridId);
            return gridId;
        }

        /// <summary>
        /// Request price check for grid order evaluation.
        /// </summary>
        public static void RequestPriceCheck(BigInteger gridId)
        {
            GridData grid = GetGrid(gridId);
            ExecutionEngine.Assert(grid.Trader != null, "grid not found");
            ExecutionEngine.Assert(grid.Active, "grid inactive");
            ExecutionEngine.Assert(
                Runtime.CheckWitness(grid.Trader) || Runtime.CheckWitness(Admin()),
                "unauthorized"
            );

            BigInteger requestId = RequestPrice(gridId, grid.Pair);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_GRID, (ByteString)requestId.ToByteArray()),
                gridId);

            OnPriceRequested(gridId, requestId);
        }

        public static void DeactivateGrid(BigInteger gridId)
        {
            GridData grid = GetGrid(gridId);
            ExecutionEngine.Assert(grid.Trader != null, "grid not found");
            ExecutionEngine.Assert(Runtime.CheckWitness(grid.Trader), "unauthorized");

            grid.Active = false;
            StoreGrid(gridId, grid);
        }

        [Safe]
        public static GridData GetGrid(BigInteger gridId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_GRIDS, (ByteString)gridId.ToByteArray()));
            if (data == null) return new GridData();
            return (GridData)StdLib.Deserialize(data);
        }

        #endregion

        #region Service Request Methods

        private static BigInteger RequestPrice(BigInteger gridId, string pair)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { gridId, pair });
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

            ByteString gridIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_GRID, (ByteString)requestId.ToByteArray()));
            ExecutionEngine.Assert(gridIdData != null, "unknown request");

            BigInteger gridId = (BigInteger)gridIdData;
            GridData grid = GetGrid(gridId);
            ExecutionEngine.Assert(grid.Trader != null, "grid not found");

            Storage.Delete(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_GRID, (ByteString)requestId.ToByteArray()));

            if (!success || !grid.Active)
            {
                return;
            }

            ExecutionEngine.Assert(result != null && result.Length > 0, "no price data");
            BigInteger currentPrice = (BigInteger)StdLib.Deserialize(result);

            // Calculate grid level for current price
            BigInteger priceRange = grid.HighPrice - grid.LowPrice;
            BigInteger priceStep = priceRange / grid.GridLevels;
            BigInteger newLevel = (currentPrice - grid.LowPrice) / priceStep;

            // Clamp to valid range
            if (newLevel < 0) newLevel = 0;
            if (newLevel >= grid.GridLevels) newLevel = grid.GridLevels - 1;

            // Check if level changed
            if (newLevel != grid.CurrentLevel)
            {
                bool isBuy = newLevel < grid.CurrentLevel; // Price dropped, buy
                BigInteger tradeAmount = grid.Stake / grid.GridLevels;

                grid.CurrentLevel = newLevel;
                StoreGrid(gridId, grid);

                OnGridOrderFilled(grid.Trader, newLevel, isBuy, tradeAmount, gridId);
            }
        }

        #endregion

        #region Internal Helpers

        private static void StoreGrid(BigInteger gridId, GridData grid)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_GRIDS, (ByteString)gridId.ToByteArray()),
                StdLib.Serialize(grid));
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
        /// LOGIC: Execute grid trading orders based on current price.
        /// </summary>
        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            // Verify caller is AutomationAnchor
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            OnPeriodicExecutionTriggered(taskId);

            // Process automated grid orders
            ProcessAutomatedGridOrders();
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
        /// Internal method to process automated grid orders.
        /// Called by OnPeriodicExecution.
        /// LOGIC: Iterate through active grids and execute grid trading orders based on price.
        /// </summary>
        private static void ProcessAutomatedGridOrders()
        {
            // Get total grids
            BigInteger gridCount = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_GRID_ID);
            if (gridCount == 0) return;

            // Process recent active grids (last 10 for gas efficiency)
            BigInteger startId = gridCount > 10 ? gridCount - 10 : 1;

            for (BigInteger i = startId; i <= gridCount; i++)
            {
                GridData grid = GetGrid(i);
                if (grid.Trader == null || !grid.Active) continue;

                // Request price check for active grid
                BigInteger requestId = RequestPrice(i, grid.Pair);
                Storage.Put(Storage.CurrentContext,
                    Helper.Concat(PREFIX_REQUEST_TO_GRID, (ByteString)requestId.ToByteArray()),
                    i);

                OnPriceRequested(i, requestId);
            }
        }

        #endregion
    }
}
