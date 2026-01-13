using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// Core partial class for all MiniApp contracts.
    ///
    /// ARCHITECTURE:
    /// - All MiniApp contracts inherit from this partial class
    /// - Provides standardized admin, gateway, and pause management
    /// - Enforces security boundaries via ValidateAdmin/ValidateGateway
    ///
    /// SECURITY MODEL:
    /// - Admin: Human operator with full control (SetAdmin, SetGateway, Update)
    /// - Gateway: TEE-attested service layer (only caller for business methods)
    /// - Users: Never call MiniApp contracts directly; they pay via PaymentHub
    ///
    /// STORAGE LAYOUT:
    /// - 0x01-0x05: Reserved for this Core class
    /// - 0x10+: Available for app-specific storage
    /// </summary>
    public partial class MiniAppContract : SmartContract
    {
        #region Standard Storage Prefixes (0x01-0x06 reserved)

        protected static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        protected static readonly byte[] PREFIX_GATEWAY = new byte[] { 0x02 };
        protected static readonly byte[] PREFIX_PAYMENTHUB = new byte[] { 0x03 };
        protected static readonly byte[] PREFIX_PAUSED = new byte[] { 0x04 };
        protected static readonly byte[] PREFIX_PAUSE_REGISTRY = new byte[] { 0x05 };
        protected static readonly byte[] PREFIX_RECEIPT_USED = new byte[] { 0x06 };

        #endregion

        #region Standard Getters

        public static UInt160 Admin() =>
            (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);

        public static UInt160 Gateway() =>
            (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_GATEWAY);

        public static UInt160 PaymentHub() =>
            (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_PAYMENTHUB);

        public static UInt160 PauseRegistry() =>
            (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_PAUSE_REGISTRY);

        public static bool IsPaused() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PAUSED) == 1;

        #endregion

        #region Standard Validation

        /// <summary>
        /// Validates that the caller has admin privileges.
        /// SECURITY: Uses CheckWitness to verify cryptographic signature.
        /// CORRECTNESS: Fails if admin not set or signature invalid.
        /// </summary>
        protected static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != null && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        /// <summary>
        /// Validates that the caller is the ServiceLayerGateway.
        /// SECURITY: Uses CallingScriptHash (unforgeable) instead of CheckWitness.
        /// CORRECTNESS: Only TEE-attested gateway can invoke business methods.
        /// WHY CallingScriptHash: Prevents replay attacks; gateway signs its own tx.
        /// </summary>
        protected static void ValidateGateway()
        {
            UInt160 gw = Gateway();
            ExecutionEngine.Assert(gw != null && gw.IsValid, "gateway not set");
            ExecutionEngine.Assert(Runtime.CallingScriptHash == gw, "only gateway");
        }

        /// <summary>
        /// Validates that an address is non-null and valid.
        /// SECURITY: Prevents storing invalid addresses that could lock funds.
        /// </summary>
        protected static void ValidateAddress(UInt160 addr)
        {
            ExecutionEngine.Assert(addr != null && addr.IsValid, "invalid address");
        }

        /// <summary>
        /// Validates that the contract is not locally paused.
        /// SECURITY: Emergency stop mechanism for admin.
        /// </summary>
        protected static void ValidateNotPaused()
        {
            ExecutionEngine.Assert(!IsPaused(), "paused");
        }

        #endregion

        #region Admin Management

        /// <summary>
        /// Transfers admin role to a new address.
        /// SECURITY: Requires current admin signature (ValidateAdmin).
        /// CORRECTNESS: New admin must be valid address.
        /// </summary>
        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ValidateAddress(newAdmin);
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
        }

        /// <summary>
        /// Sets the ServiceLayerGateway address.
        /// SECURITY: Only admin can set; gateway is the sole caller for business methods.
        /// </summary>
        public static void SetGateway(UInt160 gw)
        {
            ValidateAdmin();
            ValidateAddress(gw);
            Storage.Put(Storage.CurrentContext, PREFIX_GATEWAY, gw);
        }

        /// <summary>
        /// Sets the PaymentHub address for payment routing.
        /// SECURITY: Only admin can set.
        /// </summary>
        public static void SetPaymentHub(UInt160 hub)
        {
            ValidateAdmin();
            ValidateAddress(hub);
            Storage.Put(Storage.CurrentContext, PREFIX_PAYMENTHUB, hub);
        }

        /// <summary>
        /// Sets the PauseRegistry for global pause coordination.
        /// SECURITY: Only admin can set.
        /// </summary>
        public static void SetPauseRegistry(UInt160 registry)
        {
            ValidateAdmin();
            ValidateAddress(registry);
            Storage.Put(Storage.CurrentContext, PREFIX_PAUSE_REGISTRY, registry);
        }

        /// <summary>
        /// Emergency pause/unpause the contract.
        /// SECURITY: Only admin can toggle; stops all business operations.
        /// </summary>
        public static void SetPaused(bool paused)
        {
            ValidateAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_PAUSED, paused ? 1 : 0);
        }

        /// <summary>
        /// Upgrades the contract code.
        /// SECURITY: Only admin can upgrade; preserves contract address.
        /// CORRECTNESS: Use instead of redeploy to maintain references.
        /// </summary>
        public static void Update(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nef, manifest, null);
        }

        #endregion

        #region Global Pause Check

        /// <summary>
        /// Check if globally paused via PauseRegistry.
        /// Call this with your APP_ID in ValidateNotPaused.
        /// </summary>
        protected static void ValidateNotGloballyPaused(string appId)
        {
            ValidateNotPaused();
            UInt160 registry = PauseRegistry();
            if (registry != null && registry.IsValid)
            {
                bool globalPaused = (bool)Contract.Call(
                    registry, "isPaused", CallFlags.ReadOnly,
                    new object[] { appId });
                ExecutionEngine.Assert(!globalPaused, "globally paused");
            }
        }

        #endregion

        #region Payment Receipt Validation

        protected static void ValidatePaymentReceipt(string appId, UInt160 payer, BigInteger minAmount, BigInteger receiptId)
        {
            ValidateAddress(payer);
            ExecutionEngine.Assert(minAmount > 0, "amount must be > 0");
            ExecutionEngine.Assert(receiptId > 0, "receiptId required");

            UInt160 hub = PaymentHub();
            ExecutionEngine.Assert(hub != null && hub.IsValid, "payment hub not set");

            StorageMap used = new StorageMap(Storage.CurrentContext, PREFIX_RECEIPT_USED);
            ByteString receiptKey = (ByteString)receiptId.ToByteArray();
            ExecutionEngine.Assert(used.Get(receiptKey) == null, "receipt already used");

            object receiptObj = Contract.Call(hub, "getReceipt", CallFlags.ReadOnly, receiptId);
            ExecutionEngine.Assert(receiptObj != null, "receipt not found");

            object[] receipt = (object[])receiptObj;
            ExecutionEngine.Assert(receipt.Length >= 6, "receipt not found");

            string receiptAppId = (string)receipt[1];
            UInt160 receiptPayer = (UInt160)receipt[2];
            BigInteger receiptAmount = (BigInteger)receipt[3];

            ExecutionEngine.Assert(receiptAppId == appId, "receipt app mismatch");
            ExecutionEngine.Assert(receiptPayer == payer, "receipt payer mismatch");
            ExecutionEngine.Assert(receiptAmount >= minAmount, "insufficient payment");

            used.Put(receiptKey, 1);
        }

        #endregion

        // NOTE: OnServiceCallback is NOT defined here.
        // Apps that need service callbacks should define their own implementation.
        // See MiniAppServiceConsumer for an example.
    }
}
