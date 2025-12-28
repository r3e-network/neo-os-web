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
    public delegate void MicroPlacedHandler(UInt160 player, string symbol, bool direction, BigInteger amount, BigInteger predictionId);
    public delegate void PriceRequestedHandler(BigInteger predictionId, BigInteger requestId);
    public delegate void MicroResultHandler(UInt160 player, bool won, BigInteger payout, BigInteger predictionId);
    public delegate void AutomationRegisteredHandler(BigInteger taskId, string triggerType, string schedule);
    public delegate void AutomationCancelledHandler(BigInteger taskId);
    public delegate void PeriodicExecutionTriggeredHandler(BigInteger taskId);

    /// <summary>
    /// Micro Predict - 60-second price predictions with price oracle.
    ///
    /// ARCHITECTURE (Chainlink-style):
    /// - User places 60-second prediction via PlacePrediction
    /// - After 60s, RequestResolve → Contract requests price from oracle
    /// - Gateway fulfills → Contract compares prices → Settles
    ///
    /// MECHANICS:
    /// - Predict price UP or DOWN in 60 seconds
    /// - Win: 1.9x payout (10% platform fee)
    /// </summary>
    [DisplayName("MiniAppMicroPredict")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Micro Predict - 60-second predictions with on-chain oracle")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "builtin-micropredict";
        private const int PLATFORM_FEE_PERCENT = 10;
        private const long MIN_BET = 5000000; // 0.05 GAS
        private const ulong PREDICTION_DURATION = 60000; // 60 seconds
        #endregion

        #region App Prefixes (start from 0x10)
        private static readonly byte[] PREFIX_PRED_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_PREDICTIONS = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_REQUEST_TO_PRED = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_AUTOMATION_TASK = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Prediction Data Structure
        public struct PredictionData
        {
            public UInt160 Player;
            public string Symbol;
            public bool Direction;
            public BigInteger Amount;
            public BigInteger StartPrice;
            public BigInteger Timestamp;
            public bool Resolved;
        }
        #endregion

        #region App Events
        [DisplayName("MicroPlaced")]
        public static event MicroPlacedHandler OnMicroPlaced;

        [DisplayName("PriceRequested")]
        public static event PriceRequestedHandler OnPriceRequested;

        [DisplayName("MicroResult")]
        public static event MicroResultHandler OnMicroResult;

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
            Storage.Put(Storage.CurrentContext, PREFIX_PRED_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        public static BigInteger PlacePrediction(UInt160 player, string symbol, bool direction, BigInteger amount, BigInteger startPrice)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(player), "unauthorized");
            ExecutionEngine.Assert(symbol != null && symbol.Length > 0, "symbol required");
            ExecutionEngine.Assert(amount >= MIN_BET, "min bet 0.05 GAS");
            ExecutionEngine.Assert(startPrice > 0, "start price required");

            BigInteger predictionId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PRED_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_PRED_ID, predictionId);

            PredictionData prediction = new PredictionData
            {
                Player = player,
                Symbol = symbol,
                Direction = direction,
                Amount = amount,
                StartPrice = startPrice,
                Timestamp = Runtime.Time,
                Resolved = false
            };
            StorePrediction(predictionId, prediction);

            OnMicroPlaced(player, symbol, direction, amount, predictionId);
            return predictionId;
        }

        public static void RequestResolve(BigInteger predictionId)
        {
            PredictionData prediction = GetPrediction(predictionId);
            ExecutionEngine.Assert(prediction.Player != null, "prediction not found");
            ExecutionEngine.Assert(!prediction.Resolved, "already resolved");
            ExecutionEngine.Assert(
                Runtime.CheckWitness(prediction.Player) || Runtime.CheckWitness(Admin()),
                "unauthorized"
            );
            ExecutionEngine.Assert(Runtime.Time >= prediction.Timestamp + PREDICTION_DURATION, "too early");

            BigInteger requestId = RequestPrice(predictionId, prediction.Symbol);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_PRED, (ByteString)requestId.ToByteArray()),
                predictionId);

            OnPriceRequested(predictionId, requestId);
        }

        [Safe]
        public static PredictionData GetPrediction(BigInteger predictionId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_PREDICTIONS, (ByteString)predictionId.ToByteArray()));
            if (data == null) return new PredictionData();
            return (PredictionData)StdLib.Deserialize(data);
        }

        #endregion

        #region Service Request Methods

        private static BigInteger RequestPrice(BigInteger predictionId, string symbol)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { predictionId, symbol });
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

            ByteString predIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_PRED, (ByteString)requestId.ToByteArray()));
            ExecutionEngine.Assert(predIdData != null, "unknown request");

            BigInteger predictionId = (BigInteger)predIdData;
            PredictionData prediction = GetPrediction(predictionId);
            ExecutionEngine.Assert(!prediction.Resolved, "already resolved");
            ExecutionEngine.Assert(prediction.Player != null, "prediction not found");

            if (!success)
            {
                prediction.Resolved = true;
                StorePrediction(predictionId, prediction);
                OnMicroResult(prediction.Player, false, 0, predictionId);
                return;
            }

            ExecutionEngine.Assert(result != null && result.Length > 0, "no price data");
            BigInteger endPrice = (BigInteger)StdLib.Deserialize(result);

            bool priceUp = endPrice > prediction.StartPrice;
            bool won = prediction.Direction == priceUp;
            BigInteger payout = won ? prediction.Amount * (200 - PLATFORM_FEE_PERCENT) / 100 : 0;

            prediction.Resolved = true;
            StorePrediction(predictionId, prediction);
            Storage.Delete(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_PRED, (ByteString)requestId.ToByteArray()));

            OnMicroResult(prediction.Player, won, payout, predictionId);
        }

        #endregion

        #region Internal Helpers

        private static void StorePrediction(BigInteger predictionId, PredictionData prediction)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_PREDICTIONS, (ByteString)predictionId.ToByteArray()),
                StdLib.Serialize(prediction));
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
        /// LOGIC: Settles expired predictions automatically.
        /// </summary>
        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            // Verify caller is AutomationAnchor
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            OnPeriodicExecutionTriggered(taskId);

            // Process automated settlement for expired predictions
            ProcessAutomatedSettlement();
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
        /// Internal method to process automated settlement for expired predictions.
        /// Called by OnPeriodicExecution.
        /// </summary>
        private static void ProcessAutomatedSettlement()
        {
            // Iterate through recent predictions to check if they need settlement
            BigInteger currentPredId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PRED_ID);
            BigInteger startId = currentPredId > 10 ? currentPredId - 10 : 1;

            for (BigInteger predictionId = startId; predictionId <= currentPredId; predictionId++)
            {
                PredictionData prediction = GetPrediction(predictionId);

                // Skip if prediction doesn't exist or already resolved
                if (prediction.Player == null || prediction.Resolved)
                {
                    continue;
                }

                // Check if prediction expired (60s + grace period)
                if (Runtime.Time >= prediction.Timestamp + PREDICTION_DURATION)
                {
                    // Request price to settle the prediction
                    BigInteger requestId = RequestPrice(predictionId, prediction.Symbol);
                    Storage.Put(Storage.CurrentContext,
                        Helper.Concat(PREFIX_REQUEST_TO_PRED, (ByteString)requestId.ToByteArray()),
                        predictionId);

                    OnPriceRequested(predictionId, requestId);
                }
            }
        }

        #endregion
    }
}
