using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace RedEnvelope.Contract
{
    /// <summary>
    /// Standalone Red Envelope NFT contract.
    ///
    /// Envelope types:
    /// 0 = Spreading (single NFT passed along, each holder opens once for random GAS)
    /// 1 = Lucky Pool (pool can be claimed by many users; each claim mints a claim NFT)
    /// 2 = Claim NFT (minted from lucky pool claim; can transfer before opening)
    /// </summary>
    [DisplayName("RedEnvelope")]
    [SupportedStandards(NepStandard.Nep11)]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "6.0.0")]
    [ManifestExtra("Description", "Standalone dual-type red envelope NFT with random GAS distribution and reclaimable unclaimed balance.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]  // GAS
    [ContractPermission("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", "*")]  // NEO
    [ContractPermission("*", "onNEP11Payment")]
    public partial class RedEnvelope : Nep11Token<RedEnvelopeState>
    {
        #region Constants

        private const long MIN_AMOUNT = 10_000_000;             // 0.1 GAS
        private const int MAX_PACKETS = 100;
        private const long MIN_PER_PACKET = 1_000_000;          // 0.01 GAS
        private const long DEFAULT_EXPIRY_SECONDS = 604_800;    // 7 days
        private const long DEFAULT_MIN_NEO = 100;
        private const long DEFAULT_MIN_HOLD_SECONDS = 172_800;  // 2 days

        internal const int ENVELOPE_TYPE_SPREADING = 0;
        internal const int ENVELOPE_TYPE_POOL = 1;
        internal const int ENVELOPE_TYPE_CLAIM = 2;

        private static readonly UInt160 GAS_HASH =
            Neo.SmartContract.Framework.Native.GAS.Hash;
        private static readonly UInt160 NEO_HASH =
            Neo.SmartContract.Framework.Native.NEO.Hash;

        #endregion

        #region Storage Prefixes (0x10+ to avoid Nep11Token base 0x00-0x04)

        private static readonly byte[] PREFIX_OWNER = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_PAUSED = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_ENVELOPE_ID = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_ENVELOPE_DATA = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_OPENER = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_SEED = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_TOTAL_ENVELOPES = new byte[] { 0x16 };
        private static readonly byte[] PREFIX_TOTAL_DISTRIBUTED = new byte[] { 0x17 };
        private static readonly byte[] PREFIX_POOL_CLAIMER = new byte[] { 0x18 };
        private static readonly byte[] PREFIX_POOL_CLAIM_INDEX = new byte[] { 0x19 };

        #endregion

        #region Envelope Data

        /// <summary>
        /// Mutable and queryable per-envelope state.
        /// For pool envelopes (type=1), no NFT token is minted.
        /// </summary>
        public struct EnvelopeData
        {
            public UInt160 Creator;
            public BigInteger TotalAmount;
            public BigInteger PacketCount;
            public string Message;
            public BigInteger EnvelopeType;
            public BigInteger ParentEnvelopeId;
            public BigInteger OpenedCount;
            public BigInteger RemainingAmount;
            public BigInteger MinNeoRequired;
            public BigInteger MinHoldSeconds;
            public bool Active;
            public BigInteger ExpiryTime;
        }

        #endregion

        #region Event Delegates

        public delegate void EnvelopeCreatedHandler(
            BigInteger envelopeId,
            UInt160 creator,
            BigInteger totalAmount,
            BigInteger packetCount,
            BigInteger envelopeType);

        public delegate void EnvelopeOpenedHandler(
            BigInteger envelopeId,
            UInt160 opener,
            BigInteger amount,
            BigInteger remainingPackets);

        public delegate void EnvelopeBurnedHandler(
            BigInteger envelopeId,
            UInt160 lastHolder);

        public delegate void EnvelopeRefundedHandler(
            BigInteger envelopeId,
            UInt160 creator,
            BigInteger refundAmount);

        #endregion

        #region Events

        [DisplayName("EnvelopeCreated")]
        public static event EnvelopeCreatedHandler OnEnvelopeCreated;

        [DisplayName("EnvelopeOpened")]
        public static event EnvelopeOpenedHandler OnEnvelopeOpened;

        [DisplayName("EnvelopeBurned")]
        public static event EnvelopeBurnedHandler OnEnvelopeBurned;

        [DisplayName("EnvelopeRefunded")]
        public static event EnvelopeRefundedHandler OnEnvelopeRefunded;

        #endregion

        #region Lifecycle

        public static void _deploy(object data, bool update)
        {
            if (update) return;

            var ctx = Storage.CurrentContext;
            Storage.Put(ctx, PREFIX_OWNER, Runtime.Transaction.Sender);
            Storage.Put(ctx, PREFIX_ENVELOPE_ID, 0);
            Storage.Put(ctx, PREFIX_TOTAL_ENVELOPES, 0);
            Storage.Put(ctx, PREFIX_TOTAL_DISTRIBUTED, 0);
        }

        #endregion

        #region Envelope Creation

        /// <summary>
        /// Receives GAS and creates either:
        /// - spreading envelope NFT (type=0), or
        /// - lucky pool envelope (type=1)
        ///
        /// data format:
        /// object[] { packetCount, expirySeconds, message, minNeoRequired, minHoldSeconds, envelopeType }
        /// envelopeType defaults to 0 (spreading).
        /// </summary>
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS_HASH, "only GAS accepted");
            if (from == null || !from.IsValid) return;

            AssertNotPaused();
            ExecutionEngine.Assert(amount >= MIN_AMOUNT, "min 0.1 GAS");

            object[] config = data == null ? new object[0] : (object[])data;
            BigInteger packetCount = config.Length > 0 ? (BigInteger)config[0] : 1;
            BigInteger expirySeconds = config.Length > 1 ? (BigInteger)config[1] : DEFAULT_EXPIRY_SECONDS;
            string message = config.Length > 2 ? (string)config[2] : "";
            BigInteger minNeo = config.Length > 3 ? (BigInteger)config[3] : DEFAULT_MIN_NEO;
            BigInteger minHold = config.Length > 4 ? (BigInteger)config[4] : DEFAULT_MIN_HOLD_SECONDS;
            BigInteger envelopeType = config.Length > 5 ? (BigInteger)config[5] : ENVELOPE_TYPE_SPREADING;

            ExecutionEngine.Assert(packetCount > 0 && packetCount <= MAX_PACKETS, "1-100 packets");
            ExecutionEngine.Assert(amount >= packetCount * MIN_PER_PACKET, "min 0.01 GAS/packet");
            ExecutionEngine.Assert(
                envelopeType == ENVELOPE_TYPE_SPREADING || envelopeType == ENVELOPE_TYPE_POOL,
                "invalid envelope type");

            BigInteger envelopeId = AllocateEnvelopeId();
            BigInteger effectiveExpiry = expirySeconds > 0 ? expirySeconds : DEFAULT_EXPIRY_SECONDS;
            BigInteger effectiveMinNeo = minNeo > 0 ? minNeo : DEFAULT_MIN_NEO;
            BigInteger effectiveMinHold = minHold > 0 ? minHold : DEFAULT_MIN_HOLD_SECONDS;

            ByteString seed = CryptoLib.Sha256(
                Helper.Concat((ByteString)envelopeId.ToByteArray(), (ByteString)from));
            new StorageMap(Storage.CurrentContext, PREFIX_SEED).Put(envelopeId.ToByteArray(), seed);

            EnvelopeData envelope = new EnvelopeData
            {
                Creator = from,
                TotalAmount = amount,
                PacketCount = packetCount,
                Message = message,
                EnvelopeType = envelopeType,
                ParentEnvelopeId = 0,
                OpenedCount = 0,
                RemainingAmount = amount,
                MinNeoRequired = effectiveMinNeo,
                MinHoldSeconds = effectiveMinHold,
                Active = true,
                ExpiryTime = (BigInteger)Runtime.Time + effectiveExpiry
            };
            StoreEnvelopeData(envelopeId, envelope);

            // Spreading type mints one NFT immediately; pool type does not.
            if (envelopeType == ENVELOPE_TYPE_SPREADING)
            {
                ByteString tokenId = (ByteString)envelopeId.ToByteArray();
                Mint(tokenId, new RedEnvelopeState
                {
                    Owner = from,
                    Name = "RedEnvelope #" + envelopeId.ToString(),
                    EnvelopeId = envelopeId,
                    Creator = from,
                    TotalAmount = amount,
                    PacketCount = packetCount,
                    Message = message,
                    EnvelopeType = envelopeType,
                    ParentEnvelopeId = 0
                });
            }

            var ctx = Storage.CurrentContext;
            BigInteger totalEnv = (BigInteger)Storage.Get(ctx, PREFIX_TOTAL_ENVELOPES);
            Storage.Put(ctx, PREFIX_TOTAL_ENVELOPES, totalEnv + 1);

            BigInteger totalDist = (BigInteger)Storage.Get(ctx, PREFIX_TOTAL_DISTRIBUTED);
            Storage.Put(ctx, PREFIX_TOTAL_DISTRIBUTED, totalDist + amount);

            OnEnvelopeCreated(envelopeId, from, amount, packetCount, envelopeType);
        }

        /// <summary>
        /// Compatibility entrypoint for legacy frontend flows.
        /// Transfers GAS from creator into this contract, then OnNEP17Payment handles creation.
        /// </summary>
        public static BigInteger CreateEnvelope(
            UInt160 creator,
            string name,
            string message,
            BigInteger totalAmount,
            BigInteger packetCount,
            BigInteger expirySeconds,
            BigInteger minNeoRequired,
            BigInteger minHoldSeconds,
            BigInteger receiptId)
        {
            AssertNotPaused();
            ExecutionEngine.Assert(creator != null && creator.IsValid, "invalid creator");
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "unauthorized");

            BigInteger nextEnvelopeId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ENVELOPE_ID) + 1;

            object[] payload = new object[]
            {
                packetCount,
                expirySeconds,
                message,
                minNeoRequired,
                minHoldSeconds,
                ENVELOPE_TYPE_SPREADING
            };

            ExecutionEngine.Assert(
                GAS.Transfer(creator, Runtime.ExecutingScriptHash, totalAmount, payload),
                "GAS transfer failed");

            return nextEnvelopeId;
        }

        public static BigInteger createEnvelope(
            UInt160 creator,
            string name,
            string message,
            BigInteger totalAmount,
            BigInteger packetCount,
            BigInteger expirySeconds,
            BigInteger minNeoRequired,
            BigInteger minHoldSeconds,
            BigInteger receiptId)
        {
            return CreateEnvelope(
                creator,
                name,
                message,
                totalAmount,
                packetCount,
                expirySeconds,
                minNeoRequired,
                minHoldSeconds,
                receiptId);
        }

        #endregion

        #region Internal Helpers

        private static BigInteger AllocateEnvelopeId()
        {
            var ctx = Storage.CurrentContext;
            BigInteger envelopeId = (BigInteger)Storage.Get(ctx, PREFIX_ENVELOPE_ID) + 1;
            Storage.Put(ctx, PREFIX_ENVELOPE_ID, envelopeId);
            return envelopeId;
        }

        private static void StoreEnvelopeData(BigInteger envelopeId, EnvelopeData envelope)
        {
            Storage.Put(
                Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_ENVELOPE_DATA, (ByteString)envelopeId.ToByteArray()),
                StdLib.Serialize(envelope));
        }

        internal static EnvelopeData GetEnvelopeData(BigInteger envelopeId)
        {
            ByteString raw = Storage.Get(
                Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_ENVELOPE_DATA, (ByteString)envelopeId.ToByteArray()));
            if (raw == null) return new EnvelopeData();
            return (EnvelopeData)StdLib.Deserialize(raw);
        }

        internal static bool EnvelopeExists(EnvelopeData envelope)
        {
            return envelope.Creator != null && envelope.Creator.IsValid;
        }

        internal static ByteString GetSeed(BigInteger envelopeId)
        {
            return new StorageMap(Storage.CurrentContext, PREFIX_SEED).Get(envelopeId.ToByteArray());
        }

        private static void DeleteSeed(BigInteger envelopeId)
        {
            new StorageMap(Storage.CurrentContext, PREFIX_SEED).Delete(envelopeId.ToByteArray());
        }

        internal static void StorePoolClaimId(BigInteger poolId, BigInteger claimIndex, BigInteger claimId)
        {
            ByteString key = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_POOL_CLAIM_INDEX, (ByteString)poolId.ToByteArray()),
                (ByteString)claimIndex.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, claimId);
        }

        internal static BigInteger GetPoolClaimId(BigInteger poolId, BigInteger claimIndex)
        {
            ByteString key = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_POOL_CLAIM_INDEX, (ByteString)poolId.ToByteArray()),
                (ByteString)claimIndex.ToByteArray());
            ByteString val = Storage.Get(Storage.CurrentContext, key);
            if (val == null) return 0;
            return (BigInteger)val;
        }

        internal static void AssertNotPaused()
        {
            ByteString paused = Storage.Get(Storage.CurrentContext, PREFIX_PAUSED);
            ExecutionEngine.Assert(paused == null || (BigInteger)paused == 0, "contract paused");
        }

        internal static RedEnvelopeState GetTokenState(ByteString tokenId)
        {
            return new StorageMap(Storage.CurrentContext, Prefix_Token).GetObject<RedEnvelopeState>(tokenId);
        }

        #endregion
    }
}
