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
    // Custom delegates for events with named parameters
    public delegate void PaymentReceivedHandler(BigInteger paymentId, string appId, UInt160 sender, BigInteger amount, string memo);
    public delegate void AppConfiguredHandler(string appId, UInt160 owner, bool enabled);
    public delegate void WithdrawnHandler(string appId, BigInteger totalAmount, int recipientCount);
    public delegate void ShareDistributedHandler(string appId, UInt160 recipient, BigInteger amount, BigInteger shareBps);
    public delegate void BalanceUpdatedHandler(string appId, BigInteger oldBalance, BigInteger newBalance);
    public delegate void AdminChangedHandler(UInt160 oldAdmin, UInt160 newAdmin);
    public delegate void AppEnabledHandler(string appId, bool enabled);
    public delegate void SplitConfiguredHandler(string appId, int recipientCount, BigInteger totalBps);

    [DisplayName("PaymentHubV2")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "GAS-only payments & settlement hub v2")]
    [ContractPermission("*", "onNEP17Payment")]
    [ContractPermission("*", "transfer")]  // Permission to call GAS.Transfer
    public class PaymentHub : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_APP = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_BALANCE = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_RECEIPT = new byte[] { 0x04 };
        // Use a separate prefix for receipt counter to avoid collision with receipt data
        // Receipt data uses PREFIX_RECEIPT + receiptId.ToByteArray()
        // Counter uses PREFIX_RECEIPT_COUNTER directly (not under PREFIX_RECEIPT)
        private static readonly byte[] PREFIX_RECEIPT_COUNTER = new byte[] { 0x05 };

        public struct AppConfig
        {
            public UInt160 Owner;
            public UInt160[] Recipients;
            public BigInteger[] SharesBps;
            public bool Enabled;
        }

        public struct PaymentData
        {
            public string AppId;
            public string Memo;
        }

        public struct Receipt
        {
            public BigInteger Id;
            public string AppId;
            public UInt160 Payer;
            public BigInteger Amount;
            public BigInteger Timestamp;  // Changed from ulong to BigInteger to avoid Neo VM conversion issues
            public string Memo;
        }

        [DisplayName("PaymentReceived")]
        public static event PaymentReceivedHandler OnPaymentReceived;

        [DisplayName("AppConfigured")]
        public static event AppConfiguredHandler OnAppConfigured;

        [DisplayName("Withdrawn")]
        public static event WithdrawnHandler OnWithdrawn;

        [DisplayName("ShareDistributed")]
        public static event ShareDistributedHandler OnShareDistributed;

        [DisplayName("BalanceUpdated")]
        public static event BalanceUpdatedHandler OnBalanceUpdated;

        [DisplayName("AdminChanged")]
        public static event AdminChangedHandler OnAdminChanged;

        [DisplayName("AppEnabled")]
        public static event AppEnabledHandler OnAppEnabled;

        [DisplayName("SplitConfigured")]
        public static event SplitConfiguredHandler OnSplitConfigured;

        public static void _deploy(object data, bool update)
        {
            if (update) return;

            Transaction tx = Runtime.Transaction;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, tx.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_RECEIPT_COUNTER, 0);
        }

        public static UInt160 Admin()
        {
            return (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
        }

        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != null, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        private static StorageMap AppMap() => new StorageMap(Storage.CurrentContext, PREFIX_APP);
        private static StorageMap BalanceMap() => new StorageMap(Storage.CurrentContext, PREFIX_BALANCE);
        private static StorageMap ReceiptMap() => new StorageMap(Storage.CurrentContext, PREFIX_RECEIPT);

        private static ByteString AppKey(string appId)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "app id required");
            return (ByteString)appId;
        }

        public static AppConfig GetApp(string appId)
        {
            ByteString raw = AppMap().Get(AppKey(appId));
            if (raw == null)
            {
                // Avoid returning `default` struct which may be represented as an empty VMArray.
                return new AppConfig
                {
                    Owner = null,
                    Recipients = new UInt160[0],
                    SharesBps = new BigInteger[0],
                    Enabled = false
                };
            }
            return (AppConfig)StdLib.Deserialize(raw);
        }

        public static BigInteger GetAppBalance(string appId)
        {
            ByteString raw = BalanceMap().Get(AppKey(appId));
            if (raw == null) return 0;
            return (BigInteger)raw;
        }

        private static void SetAppBalance(string appId, BigInteger amount)
        {
            BalanceMap().Put(AppKey(appId), amount);
        }

        private static BigInteger NextReceiptId()
        {
            // Use PREFIX_RECEIPT_COUNTER directly to avoid collision with receipt data
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_RECEIPT_COUNTER);
            BigInteger current = raw == null ? 0 : (BigInteger)raw;
            BigInteger next = current + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_RECEIPT_COUNTER, next);
            return next;
        }

        public static Receipt GetReceipt(BigInteger receiptId)
        {
            ByteString raw = ReceiptMap().Get(receiptId.ToByteArray());
            if (raw == null)
            {
                // Avoid returning `default` struct which may be represented as an empty VMArray.
                return new Receipt
                {
                    Id = 0,
                    AppId = "",
                    Payer = null,
                    Amount = 0,
                    Timestamp = 0,
                    Memo = ""
                };
            }
            return (Receipt)StdLib.Deserialize(raw);
        }

        // ============================================================================
        // Admin / App Configuration
        // ============================================================================

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != null && newAdmin.IsValid, "invalid admin");
            UInt160 oldAdmin = Admin();
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
            OnAdminChanged(oldAdmin, newAdmin);
        }

        public static void Update(ByteString nefFile, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nefFile, manifest, null);
        }

        public static void ConfigureApp(string appId, UInt160 owner, UInt160[] recipients, BigInteger[] sharesBps, bool enabled)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "app id required");
            ExecutionEngine.Assert(owner != null && owner.IsValid, "owner required");
            ValidateSplit(recipients, sharesBps);

            AppConfig cfg = new AppConfig
            {
                Owner = owner,
                Recipients = recipients,
                SharesBps = sharesBps,
                Enabled = enabled
            };

            AppMap().Put(AppKey(appId), StdLib.Serialize(cfg));
            OnAppConfigured(appId, owner, enabled);
            OnSplitConfigured(appId, recipients.Length, 10000);
        }

        public static void ConfigureSplit(string appId, UInt160[] recipients, BigInteger[] sharesBps)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "app id required");
            AppConfig cfg = GetApp(appId);
            ExecutionEngine.Assert(cfg.Owner != null && cfg.Owner.IsValid, "app not found");
            ExecutionEngine.Assert(Runtime.CheckWitness(cfg.Owner) || Runtime.CheckWitness(Admin()), "unauthorized");

            ValidateSplit(recipients, sharesBps);
            cfg.Recipients = recipients;
            cfg.SharesBps = sharesBps;
            AppMap().Put(AppKey(appId), StdLib.Serialize(cfg));
            OnSplitConfigured(appId, recipients.Length, 10000);
        }

        private static void ValidateSplit(UInt160[] recipients, BigInteger[] sharesBps)
        {
            ExecutionEngine.Assert(recipients != null && sharesBps != null, "split required");
            ExecutionEngine.Assert(recipients.Length == sharesBps.Length, "split length mismatch");
            ExecutionEngine.Assert(recipients.Length > 0 && recipients.Length <= 16, "invalid recipients");

            BigInteger total = 0;
            for (int i = 0; i < recipients.Length; i++)
            {
                ExecutionEngine.Assert(recipients[i] != null && recipients[i].IsValid, "invalid recipient");
                ExecutionEngine.Assert(sharesBps[i] >= 0, "invalid share");
                total += sharesBps[i];
            }
            ExecutionEngine.Assert(total == 10000, "shares must sum to 10000 bps");
        }

        // ============================================================================
        // Payments (GAS only)
        // ============================================================================

        // NOTE: The Pay method has been removed due to a Neo VM CONVERT error
        // when calling GAS.Transfer from within a contract method.
        //
        // To make a payment, users should call GAS.Transfer directly:
        //   GAS.Transfer(payer, PaymentHubContract, amount, appId)
        //
        // The OnNEP17Payment callback will handle the payment processing.

        // Helper method to validate payment parameters before direct GAS.Transfer
        public static bool ValidatePayment(string appId, BigInteger amount)
        {
            if (appId == null || appId.Length == 0) return false;
            if (amount <= 0) return false;

            AppConfig cfg = GetApp(appId);
            if (cfg.Owner == null || !cfg.Owner.IsValid) return false;
            if (!cfg.Enabled) return false;

            return true;
        }

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            // Enforce payments/settlement in GAS only.
            //
            // Note: Some token transfer paths may trigger NEP-17 payment callbacks on
            // contracts involved in the transfer (including senders). To avoid breaking
            // outbound transfers, we ignore callbacks that originate from this contract.
            if (Runtime.CallingScriptHash != GAS.Hash)
            {
                if (from == Runtime.ExecutingScriptHash) return;
                throw new Exception("Only GAS accepted");
            }
            if (amount <= 0) throw new Exception("Invalid amount");

            // Ignore sender-side hooks during outbound transfers.
            if (from == Runtime.ExecutingScriptHash) return;

            // Try to get appId from temporary storage first (set by Pay method)
            // If not found, try to get it from the data parameter (direct GAS.Transfer)
            ByteString appIdBytes = Storage.Get(Storage.CurrentContext, (ByteString)"pending_payment");
            string appId;

            if (appIdBytes != null)
            {
                appId = appIdBytes;
                // Clean up temporary storage
                Storage.Delete(Storage.CurrentContext, (ByteString)"pending_payment");
            }
            else if (data != null)
            {
                // Direct GAS.Transfer with appId as data
                // Use ByteString conversion to avoid Neo VM CONVERT errors
                // The data parameter from GAS.Transfer is passed as a stack item
                // which can be directly assigned to ByteString, then implicitly to string
                ByteString dataBytes = (ByteString)data;
                appId = dataBytes;
            }
            else
            {
                throw new Exception("Payment data required");
            }

            ExecutionEngine.Assert(appId != null && appId.Length > 0, "app id required");

            AppConfig cfg = GetApp(appId);
            ExecutionEngine.Assert(cfg.Owner != null && cfg.Owner.IsValid, "app not found");
            ExecutionEngine.Assert(cfg.Enabled, "app disabled");

            // Update app balance.
            BigInteger bal = GetAppBalance(appId);
            BigInteger newBal = bal + amount;
            SetAppBalance(appId, newBal);
            OnBalanceUpdated(appId, bal, newBal);

            // Store receipt.
            // Note: memo is not passed through GAS.Transfer to keep the data simple
            // and avoid CONVERT errors. Memo can be added via a separate method if needed.
            BigInteger receiptId = NextReceiptId();
            Receipt receipt = new Receipt
            {
                Id = receiptId,
                AppId = appId,
                Payer = from,
                Amount = amount,
                Timestamp = Runtime.Time,
                Memo = ""
            };
            ReceiptMap().Put(receiptId.ToByteArray(), StdLib.Serialize(receipt));

            OnPaymentReceived(receiptId, appId, from, amount, receipt.Memo);
        }

        // ============================================================================
        // Settlement
        // ============================================================================

        public static void Withdraw(string appId)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "app id required");
            AppConfig cfg = GetApp(appId);
            ExecutionEngine.Assert(cfg.Owner != null && cfg.Owner.IsValid, "app not found");

            ExecutionEngine.Assert(Runtime.CheckWitness(cfg.Owner) || Runtime.CheckWitness(Admin()), "unauthorized");

            BigInteger bal = GetAppBalance(appId);
            if (bal <= 0) return;

            BigInteger remaining = bal;
            BigInteger total = 0;
            for (int i = 0; i < cfg.SharesBps.Length; i++) total += cfg.SharesBps[i];
            ExecutionEngine.Assert(total > 0, "invalid split");

            int distributedCount = 0;
            for (int i = 0; i < cfg.Recipients.Length; i++)
            {
                BigInteger share = cfg.SharesBps[i];
                if (share <= 0) continue;

                BigInteger part = bal * share / total;
                if (part <= 0) continue;

                bool ok = GAS.Transfer(Runtime.ExecutingScriptHash, cfg.Recipients[i], part, null);
                ExecutionEngine.Assert(ok, "withdraw transfer failed");
                OnShareDistributed(appId, cfg.Recipients[i], part, share);
                remaining -= part;
                distributedCount++;
            }

            // Remainder to owner for determinism.
            if (remaining > 0)
            {
                bool ok = GAS.Transfer(Runtime.ExecutingScriptHash, cfg.Owner, remaining, null);
                ExecutionEngine.Assert(ok, "remainder transfer failed");
                OnShareDistributed(appId, cfg.Owner, remaining, 0);
            }

            SetAppBalance(appId, 0);
            OnBalanceUpdated(appId, bal, 0);
            OnWithdrawn(appId, bal, distributedCount);
        }
    }
}
