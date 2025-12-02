using System;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace ServiceLayer.Contracts
{
    /// <summary>
    /// DataFeedHub tracks feeds and signed submissions.
    /// Inherits from ServiceContractBase for standardized access control and TEE integration.
    ///
    /// Request Types:
    /// - 0x01: Price feed update
    /// - 0x02: Batch price update
    /// </summary>
    public class DataFeedHub : ServiceContractBase
    {
        // Service-specific storage
        private static readonly StorageMap Feeds = new(Storage.CurrentContext, "feed:");
        private static readonly StorageMap Latest = new(Storage.CurrentContext, "latest:");
        private static readonly StorageMap FeedHistory = new(Storage.CurrentContext, "hist:");

        // Request types
        public const byte RequestTypePriceUpdate = 0x01;
        public const byte RequestTypeBatchUpdate = 0x02;

        // Events
        public static event Action<ByteString, ByteString> FeedDefined;
        public static event Action<ByteString, ByteString, ByteString> FeedUpdated;

        public struct Feed
        {
            public ByteString Id;
            public ByteString Pair;
            public UInt160[] Signers;
            public int Threshold;
            public BigInteger Heartbeat;
            public BigInteger Deviation;
            public BigInteger CreatedAt;
        }

        public struct Round
        {
            public ByteString RoundId;
            public ByteString Price;
            public ByteString SignerKeyId;
            public BigInteger Timestamp;
            public ByteString EnclaveKeyId;
        }

        // ============================================================
        // ServiceContractBase Implementation
        // ============================================================

        protected override ByteString GetServiceId()
        {
            return (ByteString)"com.r3e.services.datafeeds";
        }

        protected override byte GetRequiredRole()
        {
            return RoleDataFeedSigner;
        }

        protected override bool ValidateRequest(byte requestType, ByteString payload)
        {
            if (requestType != RequestTypePriceUpdate &&
                requestType != RequestTypeBatchUpdate)
            {
                return false;
            }
            return payload is not null && payload.Length > 0;
        }

        // ============================================================
        // Public API
        // ============================================================

        /// <summary>
        /// Define a new price feed.
        /// </summary>
        public static void DefineFeed(
            ByteString id,
            ByteString pair,
            UInt160[] signers,
            int threshold,
            BigInteger heartbeat,
            BigInteger deviation)
        {
            RequireAdmin();

            if (id is null || id.Length == 0)
            {
                throw new Exception("Feed ID required");
            }
            if (threshold <= 0 || threshold > signers.Length)
            {
                throw new Exception("Invalid threshold");
            }

            var feed = new Feed
            {
                Id = id,
                Pair = pair,
                Signers = signers,
                Threshold = threshold,
                Heartbeat = heartbeat,
                Deviation = deviation,
                CreatedAt = Runtime.Time
            };

            Feeds.Put(id, StdLib.Serialize(feed));
            FeedDefined(id, pair);
        }

        /// <summary>
        /// Submit a price update with enclave verification.
        /// </summary>
        public static void Submit(
            ByteString feedId,
            ByteString roundId,
            ByteString price,
            ByteString signature,
            ByteString enclaveKeyId)
        {
            var feed = LoadFeed(feedId);

            // Verify enclave signature
            var messageToVerify = CryptoLib.Sha256(
                StdLib.Serialize(new object[] { feedId, roundId, price })
            );

            if (!VerifyEnclaveSignature(enclaveKeyId, (ByteString)messageToVerify, signature))
            {
                throw new Exception("Invalid enclave signature");
            }

            var round = new Round
            {
                RoundId = roundId,
                Price = price,
                SignerKeyId = enclaveKeyId,
                Timestamp = Runtime.Time,
                EnclaveKeyId = enclaveKeyId
            };

            Latest.Put(feedId, StdLib.Serialize(round));

            // Store in history
            var historyKey = feedId + roundId;
            FeedHistory.Put(historyKey, StdLib.Serialize(round));

            FeedUpdated(feedId, roundId, price);
        }

        /// <summary>
        /// Submit a price update without enclave verification (legacy mode).
        /// </summary>
        public static void SubmitLegacy(
            ByteString feedId,
            ByteString roundId,
            ByteString price,
            ByteString signature,
            ByteString message)
        {
            var feed = LoadFeed(feedId);

            if (!VerifySigner(feed.Signers, signature, message))
            {
                throw new Exception("Unauthorized signer");
            }

            var round = new Round
            {
                RoundId = roundId,
                Price = price,
                SignerKeyId = CryptoLib.Sha256(signature),
                Timestamp = Runtime.Time
            };

            Latest.Put(feedId, StdLib.Serialize(round));
            FeedUpdated(feedId, roundId, price);
        }

        /// <summary>
        /// Get latest round for a feed.
        /// </summary>
        public static Round GetLatest(ByteString feedId)
        {
            var data = Latest.Get(feedId);
            if (data is null || data.Length == 0)
            {
                throw new Exception("No data for feed");
            }
            return (Round)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Get feed definition.
        /// </summary>
        public static Feed GetFeed(ByteString feedId)
        {
            return LoadFeed(feedId);
        }

        /// <summary>
        /// Get historical round data.
        /// </summary>
        public static Round GetRound(ByteString feedId, ByteString roundId)
        {
            var historyKey = feedId + roundId;
            var data = FeedHistory.Get(historyKey);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Round not found");
            }
            return (Round)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Update feed signers.
        /// </summary>
        public static void UpdateSigners(ByteString feedId, UInt160[] signers, int threshold)
        {
            RequireAdmin();

            var feed = LoadFeed(feedId);
            if (threshold <= 0 || threshold > signers.Length)
            {
                throw new Exception("Invalid threshold");
            }

            feed.Signers = signers;
            feed.Threshold = threshold;
            Feeds.Put(feedId, StdLib.Serialize(feed));
        }

        // ============================================================
        // Helper Methods
        // ============================================================

        private static Feed LoadFeed(ByteString id)
        {
            var data = Feeds.Get(id);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Feed not found");
            }
            return (Feed)StdLib.Deserialize(data);
        }

        private static bool VerifySigner(UInt160[] signers, ByteString signature, ByteString message)
        {
            foreach (var s in signers)
            {
                if (HasRole(s, RoleDataFeedSigner) || Runtime.CheckWitness(s))
                {
                    return true;
                }
            }
            return false;
        }
    }
}
