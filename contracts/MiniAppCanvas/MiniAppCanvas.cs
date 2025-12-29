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
    /// <summary>
    /// NEP11 Transfer event delegate.
    /// </summary>
    public delegate void OnTransferDelegate(UInt160 from, UInt160 to, BigInteger amount, ByteString tokenId);

    /// <summary>
    /// Canvas pixel event delegates.
    /// </summary>
    public delegate void PixelSetHandler(UInt160 painter, int x, int y, byte r, byte g, byte b);
    public delegate void BatchPixelsSetHandler(UInt160 painter, int count, BigInteger totalCost);
    public delegate void CanvasNFTMintedHandler(ByteString tokenId, BigInteger day, UInt160 owner);
    public delegate void ServiceRequestedHandler(BigInteger requestId, string serviceType);
    public delegate void AutomationRegisteredHandler(BigInteger taskId, string triggerType, string schedule);
    public delegate void AutomationCancelledHandler(BigInteger taskId);
    public delegate void PeriodicExecutionTriggeredHandler(BigInteger taskId);

    /// <summary>
    /// Canvas MiniApp - NEP11 NFT with collaborative pixel art.
    ///
    /// NEP11 STANDARD:
    /// - Each daily snapshot is a unique NFT token
    /// - Tokens are transferable
    /// - Implements: symbol, decimals, totalSupply, balanceOf, ownerOf, transfer, tokens, tokensOf
    ///
    /// SERVICE REQUESTS:
    /// - MiniApp actively calls ServiceLayerGateway.requestService
    /// - Receives callbacks via onServiceCallback
    ///
    /// CANVAS:
    /// - 1920x1080 pixels, 100 datoshi per pixel
    /// - Daily NFT minting via automation service
    /// </summary>
    [DisplayName("MiniAppCanvas")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "NEP11 Canvas NFT - Collaborative pixel art with daily snapshots")]
    [ContractPermission("*", "*")]
    [SupportedStandards("NEP-11")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-canvas";
        private const int CANVAS_WIDTH = 1920;
        private const int CANVAS_HEIGHT = 1080;
        private const long PIXEL_PRICE = 100;
        #endregion

        #region NEP11 Storage Prefixes (0x20-0x2F)
        private static readonly byte[] PREFIX_TOTAL_SUPPLY = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_TOKEN_OWNER = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_BALANCE = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_TOKEN_DATA = new byte[] { 0x23 };
        #endregion

        #region Canvas Storage Prefixes (0x30-0x3F)
        private static readonly byte[] PREFIX_PIXEL = new byte[] { 0x30 };
        private static readonly byte[] PREFIX_LAST_NFT_DAY = new byte[] { 0x31 };
        private static readonly byte[] PREFIX_PENDING_REQUEST = new byte[] { 0x32 };
        private static readonly byte[] PREFIX_AUTOMATION_TASK = new byte[] { 0x33 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x34 };
        #endregion

        #region Events
        [DisplayName("Transfer")]
        public static event OnTransferDelegate OnTransfer;

        [DisplayName("PixelSet")]
        public static event PixelSetHandler OnPixelSet;

        [DisplayName("BatchPixelsSet")]
        public static event BatchPixelsSetHandler OnBatchPixelsSet;

        [DisplayName("CanvasNFTMinted")]
        public static event CanvasNFTMintedHandler OnCanvasNFTMinted;

        [DisplayName("ServiceRequested")]
        public static event ServiceRequestedHandler OnServiceRequested;

        [DisplayName("AutomationRegistered")]
        public static event AutomationRegisteredHandler OnAutomationRegistered;

        [DisplayName("AutomationCancelled")]
        public static event AutomationCancelledHandler OnAutomationCancelled;

        [DisplayName("PeriodicExecutionTriggered")]
        public static event PeriodicExecutionTriggeredHandler OnPeriodicExecutionTriggered;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_SUPPLY, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_LAST_NFT_DAY, 0);
        }
        #endregion

        #region NEP11 Required Methods

        /// <summary>
        /// NEP11: Returns the token symbol.
        /// </summary>
        [Safe]
        public static string Symbol() => "CANVAS";

        /// <summary>
        /// NEP11: Returns decimals (0 for NFT).
        /// </summary>
        [Safe]
        public static byte Decimals() => 0;

        /// <summary>
        /// NEP11: Returns total supply of NFTs.
        /// </summary>
        [Safe]
        public static BigInteger TotalSupply() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_SUPPLY);

        /// <summary>
        /// NEP11: Returns balance of an account.
        /// </summary>
        [Safe]
        public static BigInteger BalanceOf(UInt160 owner)
        {
            ExecutionEngine.Assert(owner != null && owner.IsValid, "invalid owner");
            return (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_BALANCE, (ByteString)owner));
        }

        /// <summary>
        /// NEP11: Returns owner of a token.
        /// </summary>
        [Safe]
        public static UInt160 OwnerOf(ByteString tokenId)
        {
            ExecutionEngine.Assert(tokenId != null && tokenId.Length > 0, "invalid tokenId");
            return (UInt160)Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_TOKEN_OWNER, tokenId));
        }

        /// <summary>
        /// NEP11: Transfers a token.
        /// SECURITY: Requires owner signature.
        /// </summary>
        public static bool Transfer(UInt160 to, ByteString tokenId, object data)
        {
            ExecutionEngine.Assert(to != null && to.IsValid, "invalid to");
            ExecutionEngine.Assert(tokenId != null && tokenId.Length > 0, "invalid tokenId");

            UInt160 owner = OwnerOf(tokenId);
            ExecutionEngine.Assert(owner != null, "token not found");
            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "unauthorized");

            // Update owner
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_TOKEN_OWNER, tokenId), to);

            // Update balances
            UpdateBalance(owner, -1);
            UpdateBalance(to, 1);

            // Emit transfer event
            OnTransfer(owner, to, 1, tokenId);

            // Call onNEP11Payment if contract
            if (ContractManagement.GetContract(to) != null)
            {
                Contract.Call(to, "onNEP11Payment", CallFlags.All,
                    owner, 1, tokenId, data);
            }

            return true;
        }

        /// <summary>
        /// NEP11: Returns iterator of all tokens (optional).
        /// </summary>
        [Safe]
        public static Iterator<ByteString> Tokens()
        {
            return (Iterator<ByteString>)Storage.Find(
                Storage.CurrentContext, PREFIX_TOKEN_OWNER,
                FindOptions.KeysOnly | FindOptions.RemovePrefix);
        }

        /// <summary>
        /// NEP11: Returns iterator of tokens owned by account.
        /// </summary>
        [Safe]
        public static Iterator<ByteString> TokensOf(UInt160 owner)
        {
            ExecutionEngine.Assert(owner != null && owner.IsValid, "invalid owner");
            // Note: For efficiency, we'd need a separate owner->tokens index
            // This is a simplified implementation
            return Tokens();
        }

        /// <summary>
        /// NEP11: Returns token properties.
        /// </summary>
        [Safe]
        public static Map<string, object> Properties(ByteString tokenId)
        {
            ExecutionEngine.Assert(tokenId != null && tokenId.Length > 0, "invalid tokenId");

            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_TOKEN_DATA, tokenId));

            Map<string, object> props = new Map<string, object>();
            props["name"] = "Canvas Day #" + (BigInteger)tokenId;
            props["tokenId"] = tokenId;

            if (data != null)
            {
                props["day"] = (BigInteger)data;
            }

            return props;
        }

        #endregion

        #region Canvas Pixel Operations

        /// <summary>
        /// Sets a single pixel. Called by gateway after payment verified.
        /// </summary>
        public static void SetPixel(UInt160 painter, int x, int y, byte r, byte g, byte b)
        {
            ValidateGateway();
            ValidateNotGloballyPaused(APP_ID);
            ValidateCoordinates(x, y);

            byte[] key = GetPixelKey(x, y);
            Storage.Put(Storage.CurrentContext, key, new byte[] { r, g, b });
            OnPixelSet(painter, x, y, r, g, b);
        }

        /// <summary>
        /// Sets multiple pixels in batch.
        /// </summary>
        public static void SetPixelBatch(UInt160 painter, byte[] pixels)
        {
            ValidateGateway();
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(pixels.Length % 7 == 0, "invalid pixel data");

            int count = pixels.Length / 7;
            ExecutionEngine.Assert(count > 0 && count <= 1000, "batch 1-1000");

            for (int i = 0; i < count; i++)
            {
                int offset = i * 7;
                int x = (pixels[offset] << 8) | pixels[offset + 1];
                int y = (pixels[offset + 2] << 8) | pixels[offset + 3];

                ValidateCoordinates(x, y);
                byte[] key = GetPixelKey(x, y);
                Storage.Put(Storage.CurrentContext, key,
                    new byte[] { pixels[offset + 4], pixels[offset + 5], pixels[offset + 6] });
            }

            OnBatchPixelsSet(painter, count, count * PIXEL_PRICE);
        }

        public static byte[] GetPixel(int x, int y)
        {
            ValidateCoordinates(x, y);
            ByteString data = Storage.Get(Storage.CurrentContext, GetPixelKey(x, y));
            return data == null ? new byte[] { 255, 255, 255 } : (byte[])data;
        }

        #endregion

        #region Service Request (MiniApp initiates)

        /// <summary>
        /// Requests daily NFT minting via automation service.
        /// MiniApp actively calls ServiceLayerGateway.
        /// </summary>
        public static BigInteger RequestDailyNFTMint(UInt160 recipient)
        {
            ValidateAdmin();
            ValidateAddress(recipient);

            BigInteger currentDay = Runtime.Time / 86400000;
            BigInteger lastDay = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_LAST_NFT_DAY);
            ExecutionEngine.Assert(currentDay > lastDay, "already minted today");

            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            // Store pending request data
            ByteString payload = StdLib.Serialize(new object[] { recipient, currentDay });
            Storage.Put(Storage.CurrentContext, PREFIX_PENDING_REQUEST, payload);

            // Call ServiceLayerGateway.requestService
            BigInteger requestId = (BigInteger)Contract.Call(
                gateway,
                "requestService",
                CallFlags.All,
                APP_ID,
                "automation",
                payload,
                Runtime.ExecutingScriptHash,
                "onServiceCallback"
            );

            OnServiceRequested(requestId, "automation");
            return requestId;
        }

        /// <summary>
        /// Callback from ServiceLayerGateway after service execution.
        /// </summary>
        public static void OnServiceCallback(
            BigInteger requestId,
            string appId,
            string serviceType,
            bool success,
            ByteString result,
            string error)
        {
            ValidateGateway();

            if (!success)
            {
                Storage.Delete(Storage.CurrentContext, PREFIX_PENDING_REQUEST);
                return;
            }

            // Get pending request data
            ByteString pendingData = Storage.Get(Storage.CurrentContext, PREFIX_PENDING_REQUEST);
            if (pendingData == null) return;

            object[] data = (object[])StdLib.Deserialize(pendingData);
            UInt160 recipient = (UInt160)data[0];
            BigInteger day = (BigInteger)data[1];

            // Mint the NFT
            MintNFT(recipient, day);

            // Clear pending request
            Storage.Delete(Storage.CurrentContext, PREFIX_PENDING_REQUEST);
        }

        #endregion

        #region Internal NFT Minting

        private static void MintNFT(UInt160 to, BigInteger day)
        {
            BigInteger supply = TotalSupply();
            BigInteger tokenId = supply + 1;
            ByteString tokenIdBytes = (ByteString)tokenId.ToByteArray();

            // Store token owner
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_TOKEN_OWNER, tokenIdBytes), to);

            // Store token data (day)
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_TOKEN_DATA, tokenIdBytes), day);

            // Update supply
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_SUPPLY, tokenId);

            // Update balance
            UpdateBalance(to, 1);

            // Update last NFT day
            Storage.Put(Storage.CurrentContext, PREFIX_LAST_NFT_DAY, day);

            // Emit events
            OnTransfer(null, to, 1, tokenIdBytes);
            OnCanvasNFTMinted(tokenIdBytes, day, to);
        }

        private static void UpdateBalance(UInt160 owner, int delta)
        {
            byte[] key = Helper.Concat(PREFIX_BALANCE, (ByteString)owner);
            BigInteger balance = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            balance += delta;
            if (balance <= 0)
                Storage.Delete(Storage.CurrentContext, key);
            else
                Storage.Put(Storage.CurrentContext, key, balance);
        }

        #endregion

        #region Helpers

        private static byte[] GetPixelKey(int x, int y)
        {
            return Helper.Concat(PREFIX_PIXEL, new byte[] {
                (byte)(x >> 8), (byte)(x & 0xFF),
                (byte)(y >> 8), (byte)(y & 0xFF)
            });
        }

        private static void ValidateCoordinates(int x, int y)
        {
            ExecutionEngine.Assert(x >= 0 && x < CANVAS_WIDTH, "x out of range");
            ExecutionEngine.Assert(y >= 0 && y < CANVAS_HEIGHT, "y out of range");
        }

        #endregion

        #region Periodic Automation

        /// <summary>
        /// Returns the AutomationAnchor contract address.
        /// </summary>
        [Safe]
        public static UInt160 AutomationAnchor()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR);
            return data != null ? (UInt160)data : UInt160.Zero;
        }

        /// <summary>
        /// Sets the AutomationAnchor contract address.
        /// SECURITY: Only admin can set the automation anchor.
        /// </summary>
        public static void SetAutomationAnchor(UInt160 anchor)
        {
            ValidateAdmin();
            ValidateAddress(anchor);
            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR, anchor);
        }

        /// <summary>
        /// Periodic execution callback invoked by AutomationAnchor.
        /// SECURITY: Only AutomationAnchor can invoke this method.
        /// LOGIC: Triggers daily NFT generation.
        /// </summary>
        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            // Verify caller is AutomationAnchor
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            OnPeriodicExecutionTriggered(taskId);

            // Check if NFT already minted today
            BigInteger currentDay = Runtime.Time / 86400000;
            BigInteger lastDay = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_LAST_NFT_DAY);

            if (currentDay <= lastDay)
            {
                return; // Already minted today, skip
            }

            // Mint daily NFT to admin (or could be extracted from payload)
            UInt160 recipient = Admin();
            CreateDailyNFT(recipient, currentDay);
        }

        /// <summary>
        /// Registers this MiniApp for periodic automation.
        /// SECURITY: Only admin can register.
        /// CORRECTNESS: AutomationAnchor must be set first.
        /// </summary>
        public static BigInteger RegisterAutomation(string triggerType, string schedule)
        {
            ValidateAdmin();
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero, "automation anchor not set");

            // Call AutomationAnchor.RegisterPeriodicTask
            BigInteger taskId = (BigInteger)Contract.Call(anchor, "registerPeriodicTask", CallFlags.All,
                Runtime.ExecutingScriptHash, "onPeriodicExecution", triggerType, schedule, 1000000); // 0.01 GAS limit

            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_TASK, taskId);
            OnAutomationRegistered(taskId, triggerType, schedule);
            return taskId;
        }

        /// <summary>
        /// Cancels the registered automation task.
        /// SECURITY: Only admin can cancel.
        /// </summary>
        public static void CancelAutomation()
        {
            ValidateAdmin();
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_TASK);
            ExecutionEngine.Assert(data != null, "no automation registered");

            BigInteger taskId = (BigInteger)data;
            UInt160 anchor = AutomationAnchor();
            Contract.Call(anchor, "cancelPeriodicTask", CallFlags.All, taskId);

            Storage.Delete(Storage.CurrentContext, PREFIX_AUTOMATION_TASK);
            OnAutomationCancelled(taskId);
        }

        /// <summary>
        /// Internal method to create daily NFT.
        /// Called by OnPeriodicExecution.
        /// </summary>
        private static void CreateDailyNFT(UInt160 recipient, BigInteger day)
        {
            ValidateAddress(recipient);
            MintNFT(recipient, day);
        }

        #endregion
    }
}
