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
    public delegate void SpotCreatedHandler(BigInteger spotId, UInt160 creator, BigInteger lat, BigInteger lng);
    public delegate void SpotBoostedHandler(BigInteger spotId, UInt160 booster, BigInteger amount);
    public delegate void SpotExpiredHandler(BigInteger spotId);

    /// <summary>
    /// GeoSpotlight MiniApp - Pay to highlight locations on a global map.
    /// Higher bids get bigger spotlights visible to all users.
    /// </summary>
    [DisplayName("MiniAppGeoSpotlight")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Geo Spotlight - Location-based attention economy")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-geospotlight";
        private const long MIN_BOOST = 10000000; // 0.1 GAS
        private const long SPOT_DURATION = 3600000; // 1 hour
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_SPOT_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_SPOTS = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Data Structures
        public struct SpotData
        {
            public UInt160 Creator;
            public BigInteger Latitude;
            public BigInteger Longitude;
            public string Message;
            public BigInteger TotalBoost;
            public BigInteger CreateTime;
            public BigInteger ExpiryTime;
            public bool Active;
        }
        #endregion

        #region App Events
        [DisplayName("SpotCreated")]
        public static event SpotCreatedHandler OnSpotCreated;

        [DisplayName("SpotBoosted")]
        public static event SpotBoostedHandler OnSpotBoosted;

        [DisplayName("SpotExpired")]
        public static event SpotExpiredHandler OnSpotExpired;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_SPOT_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        public static BigInteger CreateSpot(UInt160 creator, BigInteger lat, BigInteger lng, string message, BigInteger amount, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(amount >= MIN_BOOST, "min 0.1 GAS");
            ExecutionEngine.Assert(message.Length <= 100, "message too long");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            ValidatePaymentReceipt(APP_ID, creator, amount, receiptId);

            BigInteger spotId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_SPOT_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_SPOT_ID, spotId);

            SpotData spot = new SpotData
            {
                Creator = creator,
                Latitude = lat,
                Longitude = lng,
                Message = message,
                TotalBoost = amount,
                CreateTime = Runtime.Time,
                ExpiryTime = Runtime.Time + SPOT_DURATION,
                Active = true
            };
            StoreSpot(spotId, spot);

            OnSpotCreated(spotId, creator, lat, lng);
            return spotId;
        }

        public static void BoostSpot(BigInteger spotId, UInt160 booster, BigInteger amount, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(amount >= MIN_BOOST, "min 0.1 GAS");

            SpotData spot = GetSpot(spotId);
            ExecutionEngine.Assert(spot.Active, "spot not active");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(booster), "unauthorized");

            ValidatePaymentReceipt(APP_ID, booster, amount, receiptId);

            spot.TotalBoost += amount;
            spot.ExpiryTime = Runtime.Time + SPOT_DURATION;
            StoreSpot(spotId, spot);

            OnSpotBoosted(spotId, booster, amount);
        }

        [Safe]
        public static SpotData GetSpot(BigInteger spotId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_SPOTS, (ByteString)spotId.ToByteArray()));
            if (data == null) return new SpotData();
            return (SpotData)StdLib.Deserialize(data);
        }

        #endregion

        #region Internal Helpers

        private static void StoreSpot(BigInteger spotId, SpotData spot)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_SPOTS, (ByteString)spotId.ToByteArray()),
                StdLib.Serialize(spot));
        }

        #endregion

        #region Automation
        [Safe]
        public static UInt160 AutomationAnchor()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR);
            return data != null ? (UInt160)data : UInt160.Zero;
        }

        public static void SetAutomationAnchor(UInt160 anchor)
        {
            ValidateAdmin();
            ValidateAddress(anchor);
            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR, anchor);
        }

        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");
        }
        #endregion
    }
}
