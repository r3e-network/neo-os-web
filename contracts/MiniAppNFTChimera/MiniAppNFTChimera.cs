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
    public delegate void FusionRequestedHandler(BigInteger fusionId, UInt160 owner, BigInteger nft1, BigInteger nft2);
    public delegate void FusionCompletedHandler(BigInteger fusionId, BigInteger newNftId, BigInteger rarity);
    public delegate void ChimeraCreatedHandler(BigInteger nftId, UInt160 owner, BigInteger[] traits);

    /// <summary>
    /// NFTChimera MiniApp - Fuse two NFTs to create hybrid offspring.
    /// RNG determines trait inheritance and mutation chances.
    /// </summary>
    [DisplayName("MiniAppNFTChimera")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "NFT Chimera - NFT fusion and evolution")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-nftchimera";
        private const long FUSION_FEE = 50000000; // 0.5 GAS
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_NFT_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_NFTS = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_FUSION_ID = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_FUSIONS = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_REQUEST_MAP = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Data Structures
        public struct ChimeraNFT
        {
            public UInt160 Owner;
            public BigInteger Parent1;
            public BigInteger Parent2;
            public BigInteger Rarity;
            public BigInteger Generation;
            public BigInteger CreateTime;
        }

        public struct FusionRequest
        {
            public UInt160 Owner;
            public BigInteger NFT1;
            public BigInteger NFT2;
            public bool Completed;
        }
        #endregion

        #region App Events
        [DisplayName("FusionRequested")]
        public static event FusionRequestedHandler OnFusionRequested;

        [DisplayName("FusionCompleted")]
        public static event FusionCompletedHandler OnFusionCompleted;

        [DisplayName("ChimeraCreated")]
        public static event ChimeraCreatedHandler OnChimeraCreated;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_NFT_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_FUSION_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        public static BigInteger MintGenesis(UInt160 owner, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            ValidatePaymentReceipt(APP_ID, owner, FUSION_FEE, receiptId);

            BigInteger nftId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_NFT_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_NFT_ID, nftId);

            ChimeraNFT nft = new ChimeraNFT
            {
                Owner = owner,
                Parent1 = 0,
                Parent2 = 0,
                Rarity = 1,
                Generation = 0,
                CreateTime = Runtime.Time
            };
            StoreNFT(nftId, nft);

            OnChimeraCreated(nftId, owner, new BigInteger[] { 1 });
            return nftId;
        }

        public static BigInteger RequestFusion(UInt160 owner, BigInteger nft1, BigInteger nft2, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            ChimeraNFT chimera1 = GetNFT(nft1);
            ChimeraNFT chimera2 = GetNFT(nft2);
            ExecutionEngine.Assert(chimera1.Owner == owner && chimera2.Owner == owner, "not owner");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            ValidatePaymentReceipt(APP_ID, owner, FUSION_FEE, receiptId);

            BigInteger fusionId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_FUSION_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_FUSION_ID, fusionId);

            FusionRequest fusion = new FusionRequest
            {
                Owner = owner,
                NFT1 = nft1,
                NFT2 = nft2,
                Completed = false
            };
            StoreFusion(fusionId, fusion);

            BigInteger requestId = RequestRng(fusionId);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_REQUEST_MAP, (ByteString)requestId.ToByteArray()),
                fusionId);

            OnFusionRequested(fusionId, owner, nft1, nft2);
            return fusionId;
        }

        [Safe]
        public static ChimeraNFT GetNFT(BigInteger nftId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_NFTS, (ByteString)nftId.ToByteArray()));
            if (data == null) return new ChimeraNFT();
            return (ChimeraNFT)StdLib.Deserialize(data);
        }

        #endregion

        #region Service Callbacks

        private static BigInteger RequestRng(BigInteger fusionId)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { fusionId });
            return (BigInteger)Contract.Call(gateway, "requestService", CallFlags.All,
                APP_ID, "rng", payload, Runtime.ExecutingScriptHash, "onServiceCallback");
        }

        public static void OnServiceCallback(BigInteger requestId, string appId, string serviceType,
            bool success, ByteString result, string error)
        {
            ValidateGateway();

            ByteString fusionIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_REQUEST_MAP, (ByteString)requestId.ToByteArray()));
            if (fusionIdData == null) return;

            BigInteger fusionId = (BigInteger)fusionIdData;
            FusionRequest fusion = GetFusion(fusionId);

            if (success && result != null && !fusion.Completed)
            {
                object[] rngResult = (object[])StdLib.Deserialize(result);
                BigInteger rarity = ((BigInteger)rngResult[0] % 5) + 1;

                ChimeraNFT parent1 = GetNFT(fusion.NFT1);
                ChimeraNFT parent2 = GetNFT(fusion.NFT2);

                BigInteger nftId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_NFT_ID) + 1;
                Storage.Put(Storage.CurrentContext, PREFIX_NFT_ID, nftId);

                BigInteger maxGen = parent1.Generation > parent2.Generation ? parent1.Generation : parent2.Generation;

                ChimeraNFT newNft = new ChimeraNFT
                {
                    Owner = fusion.Owner,
                    Parent1 = fusion.NFT1,
                    Parent2 = fusion.NFT2,
                    Rarity = rarity,
                    Generation = maxGen + 1,
                    CreateTime = Runtime.Time
                };
                StoreNFT(nftId, newNft);

                fusion.Completed = true;
                StoreFusion(fusionId, fusion);

                OnFusionCompleted(fusionId, nftId, rarity);
            }

            Storage.Delete(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_REQUEST_MAP, (ByteString)requestId.ToByteArray()));
        }

        #endregion

        #region Internal Helpers

        private static void StoreNFT(BigInteger nftId, ChimeraNFT nft)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_NFTS, (ByteString)nftId.ToByteArray()),
                StdLib.Serialize(nft));
        }

        private static void StoreFusion(BigInteger fusionId, FusionRequest fusion)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_FUSIONS, (ByteString)fusionId.ToByteArray()),
                StdLib.Serialize(fusion));
        }

        [Safe]
        private static FusionRequest GetFusion(BigInteger fusionId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_FUSIONS, (ByteString)fusionId.ToByteArray()));
            if (data == null) return new FusionRequest();
            return (FusionRequest)StdLib.Deserialize(data);
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
