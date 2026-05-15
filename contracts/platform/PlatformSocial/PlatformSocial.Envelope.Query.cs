using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public partial class PlatformSocialContract
    {
        /// <summary>
        /// Read envelope state.
        /// </summary>
        [Safe]
        public static EnvelopeData GetEnvelope(string appId, BigInteger envelopeId)
        {
            ByteString data = GetRaw(AppKey(appId, PREFIX_ENVELOPES, envelopeId));
            if (data == null) return new EnvelopeData();
            return (EnvelopeData)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Check whether a claimer already grabbed from the envelope.
        /// </summary>
        [Safe]
        public static bool HasClaimed(string appId, BigInteger envelopeId, UInt160 claimer)
        {
            return GetRaw(AppKey(appId, PREFIX_GRABBER, envelopeId, claimer)) != null;
        }

        /// <summary>
        /// Read range GAS pool state.
        /// </summary>
        [Safe]
        public static RangeGasPoolData GetRangeGasPool(string appId, BigInteger poolId)
        {
            ByteString data = GetRaw(AppKey(appId, PREFIX_RANGE_POOLS, poolId));
            if (data == null) return new RangeGasPoolData();
            return (RangeGasPoolData)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Check whether a claimer already claimed from the range GAS pool.
        /// </summary>
        [Safe]
        public static bool HasClaimedRangeGasPool(string appId, BigInteger poolId, UInt160 claimer)
        {
            return GetRaw(AppKey(appId, PREFIX_RANGE_CLAIMER, poolId, claimer)) != null;
        }
    }
}
