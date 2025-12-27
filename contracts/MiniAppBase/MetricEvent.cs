using System.ComponentModel;
using System.Numerics;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// Delegate for Platform_Metric event handler.
    /// Used by platform indexer to capture custom business metrics.
    /// </summary>
    /// <param name="appId">MiniApp identifier</param>
    /// <param name="metricName">Metric name (see standard metric names below)</param>
    /// <param name="value">Metric value as BigInteger (counts, amounts, etc.)</param>
    public delegate void MetricHandler(
        string appId,
        string metricName,
        BigInteger value
    );

    public partial class MiniAppBase : SmartContract
    {
        /// <summary>
        /// Platform_Metric event for emitting custom business metrics.
        ///
        /// Standard Metric Names:
        /// - UserJoined: New user joined the app (value = 1)
        /// - VolumeTraded: Trading volume in smallest unit (value = amount in base units)
        /// - ItemMinted: NFT or token minted (value = count)
        /// - GamePlayed: Game round completed (value = 1)
        /// - VoteCast: Governance vote submitted (value = 1)
        ///
        /// Custom metric names are allowed but should follow CamelCase convention.
        /// </summary>
        [DisplayName("Platform_Metric")]
        public static event MetricHandler OnMetric;

        /// <summary>
        /// Emits a Platform_Metric event for indexer capture.
        /// </summary>
        /// <param name="appId">MiniApp identifier (should match AppRegistry app_id)</param>
        /// <param name="metricName">Metric name (standard or custom)</param>
        /// <param name="value">Metric value (non-negative recommended)</param>
        protected static void EmitMetric(
            string appId,
            string metricName,
            BigInteger value)
        {
            OnMetric(appId, metricName, value);
        }
    }
}
