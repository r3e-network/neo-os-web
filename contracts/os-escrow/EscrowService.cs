using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.OS
{
    public delegate void EscrowCreatedHandler(string appId, BigInteger escrowId, UInt160 depositor, UInt160 beneficiary, BigInteger totalAmount);
    public delegate void EscrowFundedHandler(string appId, BigInteger escrowId, BigInteger amount);
    public delegate void MilestoneCompletedHandler(string appId, BigInteger escrowId, int milestoneIndex, string milestoneName, BigInteger amount);
    public delegate void EscrowRefundedHandler(string appId, BigInteger escrowId, BigInteger refundAmount);
    public delegate void EscrowConfiguredHandler(string appId);
    public delegate void EscrowAdminChangedHandler(UInt160 oldAdmin, UInt160 newAdmin);

    [DisplayName("EscrowService")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "OS EscrowService — app-scoped milestone-based escrow with GAS custody")]
    [ContractPermission("*", "*")]
    public class EscrowService : SmartContract
    {
        // ── Storage Prefixes ──────────────────────────────────────────────
        private static readonly byte[] PREFIX_ADMIN         = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_SCRIPT_ENGINE = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_ESCROWS       = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_COUNTERS      = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_APP_CONFIG    = new byte[] { 0x30 };

        // ── Escrow Status ─────────────────────────────────────────────────
        public const byte STATUS_CREATED   = 0;
        public const byte STATUS_FUNDED    = 1;
        public const byte STATUS_ACTIVE    = 2;
        public const byte STATUS_COMPLETED = 3;
        public const byte STATUS_REFUNDED  = 4;

        // ── Limits ────────────────────────────────────────────────────────
        private const int MAX_MILESTONES = 20;

        // ── Structs ───────────────────────────────────────────────────────

        public struct AppConfig
        {
            public string AppId;
            public bool Active;
            public BigInteger UpdatedAt;
        }

        public struct MilestoneData
        {
            public string Name;
            public BigInteger Amount;
            public bool Completed;
        }

        public struct EscrowData
        {
            public BigInteger EscrowId;
            public string AppId;
            public UInt160 Depositor;
            public UInt160 Beneficiary;
            public BigInteger TotalAmount;
            public BigInteger ReleasedAmount;
            public byte Status;
            public BigInteger CreatedAt;
            public int MilestoneCount;
        }

        // ── Events ────────────────────────────────────────────────────────
        [DisplayName("EscrowCreated")]
        public static event EscrowCreatedHandler OnEscrowCreated = delegate { };

        [DisplayName("EscrowFunded")]
        public static event EscrowFundedHandler OnEscrowFunded = delegate { };

        [DisplayName("MilestoneCompleted")]
        public static event MilestoneCompletedHandler OnMilestoneCompleted = delegate { };

        [DisplayName("EscrowRefunded")]
        public static event EscrowRefundedHandler OnEscrowRefunded = delegate { };

        [DisplayName("EscrowConfigured")]
        public static event EscrowConfiguredHandler OnEscrowConfigured = delegate { };

        [DisplayName("AdminChanged")]
        public static event EscrowAdminChangedHandler OnAdminChanged = delegate { };

        // ── Lifecycle ─────────────────────────────────────────────────────

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Transaction tx = Runtime.Transaction;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, tx.Sender);
        }

        public static void Update(ByteString nefFile, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nefFile, manifest, new object[0]);
        }

        // ── Admin Management ──────────────────────────────────────────────

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != UInt160.Zero && newAdmin.IsValid, "invalid admin");
            UInt160 oldAdmin = GetAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, (ByteString)newAdmin);
            OnAdminChanged(oldAdmin, newAdmin);
        }

        [Safe]
        public static UInt160 GetAdmin()
        {
            return ReadAddress(PREFIX_ADMIN);
        }

        public static void SetScriptEngine(UInt160 engine)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(engine != UInt160.Zero && engine.IsValid, "invalid engine");
            Storage.Put(Storage.CurrentContext, PREFIX_SCRIPT_ENGINE, (ByteString)engine);
        }

        // ── Configuration ─────────────────────────────────────────────────

        public static void Configure(string appId)
        {
            ValidateAppId(appId);
            ValidateAdmin();

            AppConfig config = new AppConfig
            {
                AppId = appId,
                Active = true,
                UpdatedAt = Runtime.Time
            };

            Storage.Put(Storage.CurrentContext, AppConfigKey(appId), StdLib.Serialize(config));
            OnEscrowConfigured(appId);
        }

        // ── Escrow Operations ─────────────────────────────────────────────

        public static BigInteger CreateEscrow(
            string appId,
            UInt160 depositor,
            UInt160 beneficiary,
            BigInteger totalAmount,
            string[] milestoneNames,
            BigInteger[] milestoneAmounts)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(depositor != UInt160.Zero && depositor.IsValid, "invalid depositor");
            ExecutionEngine.Assert(beneficiary != UInt160.Zero && beneficiary.IsValid, "invalid beneficiary");
            ExecutionEngine.Assert(totalAmount > 0, "total amount must be > 0");
            ExecutionEngine.Assert(Runtime.CheckWitness(depositor), "unauthorized");

            RequireActiveApp(appId);

            ExecutionEngine.Assert(milestoneNames != null && milestoneNames!.Length > 0, "milestones required");
            ExecutionEngine.Assert(milestoneAmounts != null && milestoneAmounts!.Length > 0, "milestone amounts required");
            ExecutionEngine.Assert(milestoneNames!.Length == milestoneAmounts!.Length, "milestones/amounts mismatch");
            ExecutionEngine.Assert(milestoneNames.Length <= MAX_MILESTONES, "too many milestones");

            // Verify milestone amounts sum to total
            BigInteger milestoneSum = 0;
            for (int i = 0; i < milestoneAmounts.Length; i++)
            {
                ExecutionEngine.Assert(milestoneAmounts[i] > 0, "milestone amount must be > 0");
                milestoneSum += milestoneAmounts[i];
            }
            ExecutionEngine.Assert(milestoneSum == totalAmount, "milestone amounts must sum to total");

            BigInteger escrowId = ReadBigInteger(EscrowCounterKey(appId)) + 1;
            Storage.Put(Storage.CurrentContext, EscrowCounterKey(appId), escrowId);

            EscrowData escrow = new EscrowData
            {
                EscrowId = escrowId,
                AppId = appId,
                Depositor = depositor,
                Beneficiary = beneficiary,
                TotalAmount = totalAmount,
                ReleasedAmount = 0,
                Status = STATUS_CREATED,
                CreatedAt = Runtime.Time,
                MilestoneCount = milestoneNames.Length
            };

            StoreEscrow(appId, escrowId, escrow);

            // Store milestones individually
            for (int i = 0; i < milestoneNames.Length; i++)
            {
                MilestoneData milestone = new MilestoneData
                {
                    Name = milestoneNames[i] ?? "",
                    Amount = milestoneAmounts[i],
                    Completed = false
                };
                StoreMilestone(appId, escrowId, i, milestone);
            }

            OnEscrowCreated(appId, escrowId, depositor, beneficiary, totalAmount);

            // ScriptEngine hook
            TriggerScriptHook(appId, "onEscrowStateChange", escrowId, STATUS_CREATED);

            return escrowId;
        }

        public static void FundEscrow(string appId, BigInteger escrowId, UInt160 depositor, BigInteger amount)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(depositor != UInt160.Zero && depositor.IsValid, "invalid depositor");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(Runtime.CheckWitness(depositor), "unauthorized");

            EscrowData escrow = GetEscrowInternal(appId, escrowId);
            ExecutionEngine.Assert(escrow.EscrowId > 0, "escrow not found");
            ExecutionEngine.Assert(escrow.Depositor == depositor, "wrong depositor");
            ExecutionEngine.Assert(escrow.Status == STATUS_CREATED, "escrow already funded");

            ExecutionEngine.Assert(amount == escrow.TotalAmount, "must fund exact total amount");

            // Transfer GAS from depositor to this contract
            bool transferred = (bool)Contract.Call(
                GAS.Hash, "transfer", CallFlags.All,
                depositor, Runtime.ExecutingScriptHash, amount, appId);
            ExecutionEngine.Assert(transferred, "fund transfer failed");

            escrow.Status = STATUS_ACTIVE;
            StoreEscrow(appId, escrowId, escrow);

            OnEscrowFunded(appId, escrowId, amount);

            TriggerScriptHook(appId, "onEscrowStateChange", escrowId, STATUS_ACTIVE);
        }

        public static void CompleteMilestone(string appId, BigInteger escrowId, int milestoneIndex)
        {
            ValidateAppId(appId);
            ValidateAdmin();

            EscrowData escrow = GetEscrowInternal(appId, escrowId);
            ExecutionEngine.Assert(escrow.EscrowId > 0, "escrow not found");
            ExecutionEngine.Assert(escrow.Status == STATUS_ACTIVE, "escrow not active");
            ExecutionEngine.Assert(milestoneIndex >= 0 && milestoneIndex < escrow.MilestoneCount, "invalid milestone index");

            MilestoneData milestone = GetMilestoneInternal(appId, escrowId, milestoneIndex);
            ExecutionEngine.Assert(!milestone.Completed, "milestone already completed");

            milestone.Completed = true;
            StoreMilestone(appId, escrowId, milestoneIndex, milestone);

            // Transfer milestone amount to beneficiary
            bool transferred = (bool)Contract.Call(
                GAS.Hash, "transfer", CallFlags.All,
                Runtime.ExecutingScriptHash, escrow.Beneficiary, milestone.Amount, null);
            ExecutionEngine.Assert(transferred, "milestone release failed");

            escrow.ReleasedAmount += milestone.Amount;

            // Check if all milestones complete
            if (escrow.ReleasedAmount >= escrow.TotalAmount)
            {
                escrow.Status = STATUS_COMPLETED;
            }

            StoreEscrow(appId, escrowId, escrow);

            OnMilestoneCompleted(appId, escrowId, milestoneIndex, milestone.Name, milestone.Amount);

            if (escrow.Status == STATUS_COMPLETED)
            {
                TriggerScriptHook(appId, "onEscrowStateChange", escrowId, STATUS_COMPLETED);
            }
        }

        public static void Refund(string appId, BigInteger escrowId)
        {
            ValidateAppId(appId);
            ValidateAdmin();

            EscrowData escrow = GetEscrowInternal(appId, escrowId);
            ExecutionEngine.Assert(escrow.EscrowId > 0, "escrow not found");
            ExecutionEngine.Assert(escrow.Status == STATUS_ACTIVE, "escrow not active");

            BigInteger refundAmount = escrow.TotalAmount - escrow.ReleasedAmount;
            ExecutionEngine.Assert(refundAmount > 0, "nothing to refund");

            escrow.Status = STATUS_REFUNDED;
            StoreEscrow(appId, escrowId, escrow);

            // Transfer remaining to depositor
            bool transferred = (bool)Contract.Call(
                GAS.Hash, "transfer", CallFlags.All,
                Runtime.ExecutingScriptHash, escrow.Depositor, refundAmount, null);
            ExecutionEngine.Assert(transferred, "refund transfer failed");

            OnEscrowRefunded(appId, escrowId, refundAmount);

            TriggerScriptHook(appId, "onEscrowStateChange", escrowId, STATUS_REFUNDED);
        }

        // ── Safe Queries ──────────────────────────────────────────────────

        [Safe]
        public static EscrowData GetEscrow(string appId, BigInteger escrowId)
        {
            ValidateAppId(appId);
            return GetEscrowInternal(appId, escrowId);
        }

        [Safe]
        public static MilestoneData GetMilestone(string appId, BigInteger escrowId, int milestoneIndex)
        {
            ValidateAppId(appId);
            return GetMilestoneInternal(appId, escrowId, milestoneIndex);
        }

        [Safe]
        public static BigInteger GetEscrowCount(string appId)
        {
            ValidateAppId(appId);
            return ReadBigInteger(EscrowCounterKey(appId));
        }

        // ── Internal Helpers ──────────────────────────────────────────────

        private static void ValidateAdmin()
        {
            UInt160 admin = GetAdmin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        private static void ValidateAppId(string appId)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "appId required");
        }

        private static void RequireActiveApp(string appId)
        {
            AppConfig config = GetAppConfigInternal(appId);
            ExecutionEngine.Assert(config.AppId.Length > 0, "app not configured");
            ExecutionEngine.Assert(config.Active, "app inactive");
        }

        private static UInt160 ReadAddress(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? UInt160.Zero : (UInt160)value;
        }

        private static BigInteger ReadBigInteger(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? 0 : (BigInteger)value;
        }

        private static void WriteBigInteger(byte[] key, BigInteger value)
        {
            if (value == 0)
                Storage.Delete(Storage.CurrentContext, key);
            else
                Storage.Put(Storage.CurrentContext, key, value);
        }

        // ── Key Builders ──────────────────────────────────────────────────

        private static byte[] AppConfigKey(string appId)
        {
            return Helper.Concat(PREFIX_APP_CONFIG, (ByteString)(appId ?? ""));
        }

        private static byte[] EscrowKey(string appId, BigInteger escrowId)
        {
            return Helper.Concat(PREFIX_ESCROWS,
                (ByteString)((appId ?? "") + "|" + escrowId));
        }

        private static byte[] MilestoneKey(string appId, BigInteger escrowId, int index)
        {
            return Helper.Concat(PREFIX_ESCROWS,
                (ByteString)((appId ?? "") + "|" + escrowId + "|m" + index));
        }

        private static byte[] EscrowCounterKey(string appId)
        {
            return Helper.Concat(PREFIX_COUNTERS, (ByteString)(appId ?? ""));
        }

        // ── Escrow/Milestone Read/Write ───────────────────────────────────

        private static AppConfig GetAppConfigInternal(string appId)
        {
            ByteString? raw = Storage.Get(Storage.CurrentContext, AppConfigKey(appId));
            if (raw == null)
            {
                return new AppConfig
                {
                    AppId = "",
                    Active = false,
                    UpdatedAt = 0
                };
            }
            return (AppConfig)StdLib.Deserialize(raw);
        }

        private static EscrowData GetEscrowInternal(string appId, BigInteger escrowId)
        {
            ExecutionEngine.Assert(escrowId > 0, "invalid escrow id");
            ByteString? data = Storage.Get(Storage.CurrentContext, EscrowKey(appId, escrowId));
            if (data == null)
            {
                return new EscrowData
                {
                    EscrowId = 0,
                    AppId = "",
                    Depositor = UInt160.Zero,
                    Beneficiary = UInt160.Zero,
                    TotalAmount = 0,
                    ReleasedAmount = 0,
                    Status = 0,
                    CreatedAt = 0,
                    MilestoneCount = 0
                };
            }
            return (EscrowData)StdLib.Deserialize(data);
        }

        private static void StoreEscrow(string appId, BigInteger escrowId, EscrowData escrow)
        {
            Storage.Put(Storage.CurrentContext, EscrowKey(appId, escrowId), StdLib.Serialize(escrow));
        }

        private static MilestoneData GetMilestoneInternal(string appId, BigInteger escrowId, int index)
        {
            ByteString? data = Storage.Get(Storage.CurrentContext, MilestoneKey(appId, escrowId, index));
            if (data == null)
            {
                return new MilestoneData
                {
                    Name = "",
                    Amount = 0,
                    Completed = false
                };
            }
            return (MilestoneData)StdLib.Deserialize(data);
        }

        private static void StoreMilestone(string appId, BigInteger escrowId, int index, MilestoneData milestone)
        {
            Storage.Put(Storage.CurrentContext, MilestoneKey(appId, escrowId, index), StdLib.Serialize(milestone));
        }

        // ── ScriptEngine Hook ─────────────────────────────────────────────

        private static void TriggerScriptHook(string appId, string hookName, BigInteger escrowId, BigInteger status)
        {
            UInt160 engine = ReadAddress(PREFIX_SCRIPT_ENGINE);
            if (engine == UInt160.Zero || !engine.IsValid) return;

            try
            {
                Contract.Call(engine, "execute", CallFlags.All, appId, hookName, escrowId, status);
            }
            catch
            {
                // Script failure must not block escrow operations
            }
        }
    }
}
