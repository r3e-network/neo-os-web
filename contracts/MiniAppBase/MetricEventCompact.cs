using System.ComponentModel;
using System.Numerics;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public delegate void MetricCompactHandler(
        string metricName,
        BigInteger value
    );

    public partial class MiniAppBase : SmartContract
    {
        // Compact event signature (no appId). Use only if manifest.contract_hash is set.
        [DisplayName("Platform_Metric")]
        public static event MetricCompactHandler OnMetricCompact;

        protected static void EmitMetricCompact(
            string metricName,
            BigInteger value)
        {
            OnMetricCompact(metricName, value);
        }
    }
}
