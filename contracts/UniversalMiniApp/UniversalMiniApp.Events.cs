using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // Event delegates for app events
    public delegate void AppEventHandler(string appId, string eventType, ByteString data);
    public delegate void MetricHandler(string appId, string name, BigInteger value);

    public partial class UniversalMiniApp
    {
        #region Events Module

        [DisplayName("AppEvent")]
        public static event AppEventHandler OnAppEvent;

        [DisplayName("Metric")]
        public static event MetricHandler OnMetric;

        /// <summary>
        /// Emit a custom app event.
        /// </summary>
        public static void EmitAppEvent(string appId, string eventType, ByteString data)
        {
            ValidateNotPaused();
            ValidateGateway();
            ValidateAppId(appId);
            ExecutionEngine.Assert(IsAppRegistered(appId), "app not registered");
            ExecutionEngine.Assert(eventType != null && eventType.Length > 0, "event type required");

            OnAppEvent(appId, eventType, data ?? (ByteString)"");
        }

        /// <summary>
        /// Emit a metric event.
        /// </summary>
        public static void EmitMetric(string appId, string name, BigInteger value)
        {
            ValidateNotPaused();
            ValidateGateway();
            ValidateAppId(appId);
            ExecutionEngine.Assert(IsAppRegistered(appId), "app not registered");
            ExecutionEngine.Assert(name != null && name.Length > 0, "metric name required");

            OnMetric(appId, name, value);
        }

        #endregion
    }
}
