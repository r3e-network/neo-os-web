using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppStreamVault
    {
        #region User Methods

        /// <summary>
        /// Create a new stream vault.
        /// </summary>
        public static BigInteger CreateStream(
            UInt160 creator,
            UInt160 beneficiary,
            UInt160 asset,
            BigInteger totalAmount,
            BigInteger rateAmount,
            BigInteger intervalSeconds,
            string title,
            string notes)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(creator);
            ValidateAddress(beneficiary);
            ValidateAsset(asset);
            ValidateTextLimits(title, notes);

            ExecutionEngine.Assert(totalAmount > 0, "invalid total amount");
            ExecutionEngine.Assert(rateAmount > 0, "invalid rate amount");
            ExecutionEngine.Assert(rateAmount <= totalAmount, "rate exceeds total");
            ExecutionEngine.Assert(intervalSeconds >= MIN_INTERVAL_SECONDS && intervalSeconds <= MAX_INTERVAL_SECONDS, "invalid interval");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            if (IsNeo(asset))
            {
                ExecutionEngine.Assert(totalAmount >= MIN_NEO, "min 1 NEO");
            }
            else
            {
                ExecutionEngine.Assert(totalAmount >= MIN_GAS, "min 0.1 GAS");
            }

            bool transferred = IsNeo(asset)
                ? NEO.Transfer(creator, Runtime.ExecutingScriptHash, totalAmount)
                : GAS.Transfer(creator, Runtime.ExecutingScriptHash, totalAmount);
            ExecutionEngine.Assert(transferred, "transfer failed");

            BigInteger streamId = TotalStreams() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_STREAM_ID, streamId);

            StreamData stream = new StreamData
            {
                Creator = creator,
                Beneficiary = beneficiary,
                Asset = asset,
                TotalAmount = totalAmount,
                ReleasedAmount = 0,
                RateAmount = rateAmount,
                IntervalSeconds = intervalSeconds,
                StartTime = Runtime.Time,
                LastClaimTime = Runtime.Time,
                CreatedTime = Runtime.Time,
                Active = true,
                Cancelled = false,
                Title = title,
                Notes = notes
            };

            StoreStream(streamId, stream);
            AddUserStream(creator, streamId);
            AddBeneficiaryStream(beneficiary, streamId);
            UpdateTotalLocked(totalAmount);

            OnStreamCreated(streamId, creator, beneficiary, asset, totalAmount, rateAmount, intervalSeconds);
            return streamId;
        }

        /// <summary>
        /// Claim available stream releases.
        /// </summary>
        public static void ClaimStream(UInt160 beneficiary, BigInteger streamId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(beneficiary);
            ExecutionEngine.Assert(Runtime.CheckWitness(beneficiary), "unauthorized");

            StreamData stream = GetStream(streamId);
            ExecutionEngine.Assert(stream.Creator != UInt160.Zero, "stream not found");
            ExecutionEngine.Assert(stream.Active, "stream inactive");
            ExecutionEngine.Assert(stream.Beneficiary == beneficiary, "not beneficiary");

            BigInteger timestamp = Runtime.Time;
            ExecutionEngine.Assert(stream.IntervalSeconds > 0, "invalid interval");
            ExecutionEngine.Assert(timestamp > stream.LastClaimTime, "nothing to claim");

            BigInteger elapsed = timestamp - stream.LastClaimTime;
            BigInteger periods = elapsed / stream.IntervalSeconds;
            ExecutionEngine.Assert(periods > 0, "nothing to claim");

            BigInteger claimable = periods * stream.RateAmount;
            BigInteger remaining = stream.TotalAmount - stream.ReleasedAmount;
            if (claimable > remaining)
            {
                claimable = remaining;
            }
            ExecutionEngine.Assert(claimable > 0, "nothing to claim");

            stream.ReleasedAmount += claimable;
            stream.LastClaimTime += periods * stream.IntervalSeconds;

            if (stream.ReleasedAmount >= stream.TotalAmount)
            {
                stream.Active = false;
            }

            StoreStream(streamId, stream);
            UpdateTotalLocked(0 - claimable);
            UpdateTotalReleased(claimable);

            bool transferred = IsNeo(stream.Asset)
                ? NEO.Transfer(Runtime.ExecutingScriptHash, beneficiary, claimable)
                : GAS.Transfer(Runtime.ExecutingScriptHash, beneficiary, claimable);
            ExecutionEngine.Assert(transferred, "transfer failed");

            OnStreamClaimed(streamId, beneficiary, claimable, stream.ReleasedAmount);
            if (!stream.Active)
            {
                OnStreamCompleted(streamId, beneficiary);
            }
        }

        /// <summary>
        /// Cancel an active stream and refund remaining funds to the creator.
        /// </summary>
        public static void CancelStream(UInt160 creator, BigInteger streamId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(creator);
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "unauthorized");

            StreamData stream = GetStream(streamId);
            ExecutionEngine.Assert(stream.Creator != UInt160.Zero, "stream not found");
            ExecutionEngine.Assert(stream.Active, "stream inactive");
            ExecutionEngine.Assert(stream.Creator == creator, "not creator");

            BigInteger remaining = stream.TotalAmount - stream.ReleasedAmount;
            stream.Active = false;
            stream.Cancelled = true;
            StoreStream(streamId, stream);

            if (remaining > 0)
            {
                UpdateTotalLocked(0 - remaining);
                bool transferred = IsNeo(stream.Asset)
                    ? NEO.Transfer(Runtime.ExecutingScriptHash, creator, remaining)
                    : GAS.Transfer(Runtime.ExecutingScriptHash, creator, remaining);
                ExecutionEngine.Assert(transferred, "transfer failed");
            }

            OnStreamCancelled(streamId, creator, remaining);
        }

        #endregion
    }
}
