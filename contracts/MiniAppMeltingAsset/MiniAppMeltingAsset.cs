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
    public delegate void AssetCreatedHandler(BigInteger assetId, UInt160 owner, BigInteger initialValue);
    public delegate void AssetMeltedHandler(BigInteger assetId, BigInteger remainingValue);
    public delegate void AssetSavedHandler(BigInteger assetId, UInt160 saver, BigInteger addedValue);

    /// <summary>
    /// MeltingAsset MiniApp - NFTs that lose value over time unless maintained.
    /// Pay GAS to slow the melting or watch your asset disappear.
    /// </summary>
    [DisplayName("MiniAppMeltingAsset")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. MeltingAsset is a time-decaying NFT system for ephemeral art. Use it to create assets that lose value over time, you can maintain them with payments or watch them melt away.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-meltingasset";
        private const long CREATE_FEE = 100000000; // 1 GAS
        private const long MELT_RATE = 1000000; // 0.01 GAS per hour
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_ASSET_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_ASSETS = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Data Structures
        public struct MeltingNFT
        {
            public UInt160 Owner;
            public BigInteger Value;
            public BigInteger LastUpdate;
            public bool Active;
        }
        #endregion

        #region App Events
        [DisplayName("AssetCreated")]
        public static event AssetCreatedHandler OnAssetCreated;

        [DisplayName("AssetMelted")]
        public static event AssetMeltedHandler OnAssetMelted;

        [DisplayName("AssetSaved")]
        public static event AssetSavedHandler OnAssetSaved;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_ASSET_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        public static BigInteger CreateAsset(UInt160 owner, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            ValidatePaymentReceipt(APP_ID, owner, CREATE_FEE, receiptId);

            BigInteger assetId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ASSET_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_ASSET_ID, assetId);

            MeltingNFT asset = new MeltingNFT
            {
                Owner = owner,
                Value = CREATE_FEE,
                LastUpdate = Runtime.Time,
                Active = true
            };
            StoreAsset(assetId, asset);

            OnAssetCreated(assetId, owner, CREATE_FEE);
            return assetId;
        }

        public static void AddValue(BigInteger assetId, UInt160 saver, BigInteger amount, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            MeltingNFT asset = GetAsset(assetId);
            ExecutionEngine.Assert(asset.Active, "asset melted");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(saver), "unauthorized");

            ValidatePaymentReceipt(APP_ID, saver, amount, receiptId);

            // Apply melting first
            BigInteger elapsed = (Runtime.Time - (ulong)asset.LastUpdate) / 3600000;
            BigInteger melted = elapsed * MELT_RATE;
            if (melted > asset.Value) melted = asset.Value;

            asset.Value = asset.Value - melted + amount;
            asset.LastUpdate = Runtime.Time;
            StoreAsset(assetId, asset);

            OnAssetSaved(assetId, saver, amount);
        }

        [Safe]
        public static MeltingNFT GetAsset(BigInteger assetId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_ASSETS, (ByteString)assetId.ToByteArray()));
            if (data == null) return new MeltingNFT();
            return (MeltingNFT)StdLib.Deserialize(data);
        }

        [Safe]
        public static BigInteger GetCurrentValue(BigInteger assetId)
        {
            MeltingNFT asset = GetAsset(assetId);
            if (!asset.Active) return 0;

            BigInteger elapsed = (Runtime.Time - (ulong)asset.LastUpdate) / 3600000;
            BigInteger melted = elapsed * MELT_RATE;
            if (melted >= asset.Value) return 0;
            return asset.Value - melted;
        }

        #endregion

        #region Internal Helpers

        private static void StoreAsset(BigInteger assetId, MeltingNFT asset)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_ASSETS, (ByteString)assetId.ToByteArray()),
                StdLib.Serialize(asset));
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
