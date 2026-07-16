using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public delegate void TarotVrfCreditHandler(UInt160 account, BigInteger amount, BigInteger balance);
    public delegate void TarotVrfReserveHandler(UInt160 account, BigInteger amount, BigInteger reserve);
    public delegate void TarotVrfRequestedHandler(BigInteger readingId, BigInteger requestId,
        UInt160 player, BigInteger readingFee, BigInteger oracleFee, BigInteger expiresAt);
    public delegate void TarotVrfDrawnHandler(BigInteger readingId, BigInteger requestId,
        UInt160 player, BigInteger card0, BigInteger card1, BigInteger card2);
    public delegate void TarotVrfRefundedHandler(BigInteger readingId, BigInteger requestId,
        UInt160 player, BigInteger amount, BigInteger status, string reason);
    public delegate void TarotVrfAddressProposedHandler(UInt160 current, UInt160 proposed, BigInteger activateAt);
    public delegate void TarotVrfAddressChangedHandler(UInt160 previous, UInt160 current);
    public delegate void TarotVrfPauseHandler(bool paused);
    public delegate void TarotVrfUpdateProposedHandler(ByteString nefHash, ByteString manifestHash, BigInteger activateAt);

    /// <summary>
    /// Independent Morpheus-randomness Tarot contract. Players prepay a fixed reading fee;
    /// the contract pays the live Morpheus request fee from a separate oracle reserve.
    /// Successful requests reveal three distinct cards; failures and local expiries restore
    /// the full reading fee to the player's withdrawable credit.
    /// </summary>
    [DisplayName("MiniAppTarotVrf")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Morpheus-backed Tarot with three distinct unbiased cards, prepaid user credit, sponsored oracle fees, failure refunds, and permissionless expiry.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")]
    [ContractPermission("*", "requestFee", "feeCreditOf", "requestFromCallback")]
    public partial class MiniAppTarotVrf : SmartContract
    {
        internal const string APP_ID = "on-chain-tarot-vrf";
        internal const string REQUEST_TYPE = "vrf_random";
        internal const string LEGACY_CALLBACK_METHOD = "onOracleResult";
        internal const string RICH_CALLBACK_METHOD = "onMiniAppResult";
        internal const string CREDIT_MEMO = "miniapp-tarot-vrf:credit";
        internal const string ORACLE_MEMO = "miniapp-tarot-vrf:oracle";
        internal const string PAYLOAD_DOMAIN = "miniapp-tarot-vrf/request/v1";
        internal const long READING_FEE = 10_000_000;
        internal const long READING_EXPIRY_MS = 7_200_000;
        internal const long CHANGE_DELAY_MS = 86_400_000;
        internal const int MAX_PENDING = 100;
        internal const int DECK_SIZE = 78;
        internal const int CARDS_PER_READING = 3;

        internal const int STATUS_PENDING = 1;
        internal const int STATUS_DRAWN = 2;
        internal const int STATUS_ORACLE_REFUNDED = 3;
        internal const int STATUS_EXPIRED_REFUNDED = 4;

        [InitialValue("NTT7sxdJmf24HWy11mxAjD8YCifcYZMvLT", ContractParameterType.Hash160)]
        internal static readonly UInt160 LegacyTestnetOracle = default;

        internal static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        internal static readonly byte[] PREFIX_PENDING_ADMIN = new byte[] { 0x02 };
        internal static readonly byte[] PREFIX_ORACLE = new byte[] { 0x03 };
        internal static readonly byte[] PREFIX_PENDING_ORACLE = new byte[] { 0x04 };
        internal static readonly byte[] PREFIX_ORACLE_ACTIVATE_AT = new byte[] { 0x05 };
        internal static readonly byte[] PREFIX_PAUSED = new byte[] { 0x06 };
        internal static readonly byte[] PREFIX_LOCK = new byte[] { 0x07 };
        internal static readonly byte[] PREFIX_READING_ID = new byte[] { 0x08 };
        internal static readonly byte[] PREFIX_READING = new byte[] { 0x09 };
        internal static readonly byte[] PREFIX_REQUEST_READING = new byte[] { 0x10 };
        internal static readonly byte[] PREFIX_CREDIT = new byte[] { 0x11 };
        internal static readonly byte[] PREFIX_TOTAL_CREDIT = new byte[] { 0x12 };
        internal static readonly byte[] PREFIX_PENDING_FEES = new byte[] { 0x13 };
        internal static readonly byte[] PREFIX_REVENUE = new byte[] { 0x14 };
        internal static readonly byte[] PREFIX_ORACLE_RESERVE = new byte[] { 0x15 };
        internal static readonly byte[] PREFIX_PENDING_COUNT = new byte[] { 0x16 };
        internal static readonly byte[] PREFIX_ACTIVE_READING = new byte[] { 0x17 };
        internal static readonly byte[] PREFIX_PLAYER_COUNT = new byte[] { 0x18 };
        internal static readonly byte[] PREFIX_PLAYER_ITEM = new byte[] { 0x19 };
        internal static readonly byte[] PREFIX_UPDATE_NEF_HASH = new byte[] { 0x20 };
        internal static readonly byte[] PREFIX_UPDATE_MANIFEST_HASH = new byte[] { 0x21 };
        internal static readonly byte[] PREFIX_UPDATE_ACTIVATE_AT = new byte[] { 0x22 };
        // Request ids are tombstoned permanently. Deleting only the pending reverse mapping
        // would let a buggy or compromised Oracle recycle an old id and route a late legacy
        // callback into a newer reading by the same player.
        internal static readonly byte[] PREFIX_REQUEST_SEEN = new byte[] { 0x23 };
        // Successful-reading counters are kept separately from request counters.
        // A request is recorded before the Oracle responds, so deriving "cards drawn"
        // from ReadingsCount would incorrectly include pending and refunded rituals.
        internal static readonly byte[] PREFIX_COMPLETED_COUNT = new byte[] { 0x24 };
        internal static readonly byte[] PREFIX_PLAYER_COMPLETED_COUNT = new byte[] { 0x25 };

        public struct Reading
        {
            public UInt160 Player;
            public UInt160 Oracle;
            public BigInteger Network;
            public BigInteger RequestId;
            public BigInteger Status;
            public BigInteger Card0;
            public BigInteger Card1;
            public BigInteger Card2;
            public BigInteger RequestedAt;
            public BigInteger ResolvedAt;
            public BigInteger Fee;
            public BigInteger OracleFee;
            public string CallbackMethod;
            public ByteString PayloadHash;
        }

        [DisplayName("Credited")]
        public static event TarotVrfCreditHandler OnCredited;
        [DisplayName("OracleReserveFunded")]
        public static event TarotVrfReserveHandler OnOracleReserveFunded;
        [DisplayName("ReadingRequested")]
        public static event TarotVrfRequestedHandler OnReadingRequested;
        [DisplayName("ReadingDrawn")]
        public static event TarotVrfDrawnHandler OnReadingDrawn;
        [DisplayName("ReadingRefunded")]
        public static event TarotVrfRefundedHandler OnReadingRefunded;
        [DisplayName("CreditWithdrawn")]
        public static event TarotVrfCreditHandler OnCreditWithdrawn;
        [DisplayName("RevenueWithdrawn")]
        public static event TarotVrfReserveHandler OnRevenueWithdrawn;
        [DisplayName("OracleReserveWithdrawn")]
        public static event TarotVrfReserveHandler OnOracleReserveWithdrawn;
        [DisplayName("AdminProposed")]
        public static event TarotVrfAddressProposedHandler OnAdminProposed;
        [DisplayName("AdminChanged")]
        public static event TarotVrfAddressChangedHandler OnAdminChanged;
        [DisplayName("OracleProposed")]
        public static event TarotVrfAddressProposedHandler OnOracleProposed;
        [DisplayName("OracleChanged")]
        public static event TarotVrfAddressChangedHandler OnOracleChanged;
        [DisplayName("PauseChanged")]
        public static event TarotVrfPauseHandler OnPauseChanged;
        [DisplayName("UpdateProposed")]
        public static event TarotVrfUpdateProposedHandler OnUpdateProposed;

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            UInt160 deployer = Runtime.Transaction.Sender;
            ValidateAddress(deployer, "invalid deployer");
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, (ByteString)deployer);

            if (data == null)
            {
                // The current public TESTNET has one canonical Morpheus kernel and
                // the generic neon-js deploy helper cannot pass ContractManagement's
                // optional data argument. Make that exact deployment deterministic,
                // while requiring every other network to provide an explicit Oracle.
                ExecutionEngine.Assert(
                    Runtime.GetNetwork() == 894710606,
                    "initial oracle required outside canonical testnet");
                ExecutionEngine.Assert(
                    ContractManagement.GetContract(LegacyTestnetOracle) != null,
                    "canonical testnet oracle not deployed");
                Storage.Put(
                    Storage.CurrentContext,
                    PREFIX_ORACLE,
                    (ByteString)LegacyTestnetOracle);
                return;
            }
            ExecutionEngine.Assert(data is ByteString, "initial oracle must be Hash160");
            ByteString encodedOracle = (ByteString)data;
            ExecutionEngine.Assert(encodedOracle.Length == 20, "initial oracle must be Hash160");
            UInt160 initialOracle = (UInt160)(byte[])encodedOracle;
            ValidateAddress(initialOracle, "invalid initial oracle");
            ExecutionEngine.Assert(
                ContractManagement.GetContract(initialOracle) != null,
                "initial oracle contract not deployed");
            Storage.Put(Storage.CurrentContext, PREFIX_ORACLE, (ByteString)initialOracle);
        }
    }
}
