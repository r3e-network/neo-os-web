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
    public delegate void TrustCreatedHandler(BigInteger trustId, UInt160 owner, UInt160 heir, BigInteger principal);
    public delegate void YieldClaimedHandler(BigInteger trustId, UInt160 owner, BigInteger amount);
    public delegate void TrustExecutedHandler(BigInteger trustId, UInt160 heir, BigInteger principal);

    /// <summary>
    /// Heritage Trust DAO - Living trust with automated inheritance.
    ///
    /// MECHANICS:
    /// - Deposit NEO, earn GAS yields while alive
    /// - On death (heartbeat timeout), principal transfers to heir
    /// - Platform takes small fee from final yield
    /// </summary>
    [DisplayName("MiniAppHeritageTrust")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. HeritageTrust is a living trust protocol for estate planning. Use it to create automated trusts, you can earn yields while alive and transfer principal to heirs automatically.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-heritage-trust";
        private const int HEARTBEAT_INTERVAL = 2592000; // 30 days
        private const int PLATFORM_FEE_PERCENT = 5;
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_TRUST_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_TRUST_OWNER = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_TRUST_HEIR = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_TRUST_PRINCIPAL = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_TRUST_DEADLINE = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_TRUST_ACTIVE = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_TRUST_YIELD = new byte[] { 0x16 };
        #endregion

        #region Events
        [DisplayName("TrustCreated")]
        public static event TrustCreatedHandler OnTrustCreated;

        [DisplayName("YieldClaimed")]
        public static event YieldClaimedHandler OnYieldClaimed;

        [DisplayName("TrustExecuted")]
        public static event TrustExecutedHandler OnTrustExecuted;
        #endregion

        #region Getters
        [Safe]
        public static BigInteger TotalTrusts() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TRUST_ID);

        [Safe]
        public static BigInteger GetPrincipal(BigInteger trustId)
        {
            byte[] key = Helper.Concat(PREFIX_TRUST_PRINCIPAL, (ByteString)trustId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static bool IsActive(BigInteger trustId)
        {
            byte[] key = Helper.Concat(PREFIX_TRUST_ACTIVE, (ByteString)trustId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_TRUST_ID, 0);
        }
        #endregion

        #region User Methods

        public static void CreateTrust(UInt160 owner, UInt160 heir, BigInteger neoAmount)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(heir.IsValid && heir != owner, "invalid heir");
            ExecutionEngine.Assert(neoAmount > 0, "invalid amount");
            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "unauthorized");

            // Transfer NEO to contract
            NEO.Transfer(owner, Runtime.ExecutingScriptHash, neoAmount);

            BigInteger trustId = TotalTrusts() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_TRUST_ID, trustId);

            byte[] ownerKey = Helper.Concat(PREFIX_TRUST_OWNER, (ByteString)trustId.ToByteArray());
            Storage.Put(Storage.CurrentContext, ownerKey, owner);

            byte[] heirKey = Helper.Concat(PREFIX_TRUST_HEIR, (ByteString)trustId.ToByteArray());
            Storage.Put(Storage.CurrentContext, heirKey, heir);

            byte[] principalKey = Helper.Concat(PREFIX_TRUST_PRINCIPAL, (ByteString)trustId.ToByteArray());
            Storage.Put(Storage.CurrentContext, principalKey, neoAmount);

            byte[] deadlineKey = Helper.Concat(PREFIX_TRUST_DEADLINE, (ByteString)trustId.ToByteArray());
            Storage.Put(Storage.CurrentContext, deadlineKey, Runtime.Time + HEARTBEAT_INTERVAL);

            byte[] activeKey = Helper.Concat(PREFIX_TRUST_ACTIVE, (ByteString)trustId.ToByteArray());
            Storage.Put(Storage.CurrentContext, activeKey, 1);

            OnTrustCreated(trustId, owner, heir, neoAmount);
        }

        public static void Heartbeat(UInt160 owner, BigInteger trustId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(IsActive(trustId), "trust not active");

            byte[] ownerKey = Helper.Concat(PREFIX_TRUST_OWNER, (ByteString)trustId.ToByteArray());
            ExecutionEngine.Assert((UInt160)Storage.Get(Storage.CurrentContext, ownerKey) == owner, "not owner");
            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "unauthorized");

            byte[] deadlineKey = Helper.Concat(PREFIX_TRUST_DEADLINE, (ByteString)trustId.ToByteArray());
            Storage.Put(Storage.CurrentContext, deadlineKey, Runtime.Time + HEARTBEAT_INTERVAL);
        }

        public static void ClaimYield(UInt160 owner, BigInteger trustId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(IsActive(trustId), "trust not active");

            byte[] ownerKey = Helper.Concat(PREFIX_TRUST_OWNER, (ByteString)trustId.ToByteArray());
            ExecutionEngine.Assert((UInt160)Storage.Get(Storage.CurrentContext, ownerKey) == owner, "not owner");
            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "unauthorized");

            byte[] yieldKey = Helper.Concat(PREFIX_TRUST_YIELD, (ByteString)trustId.ToByteArray());
            BigInteger yield = (BigInteger)Storage.Get(Storage.CurrentContext, yieldKey);
            ExecutionEngine.Assert(yield > 0, "no yield");

            Storage.Put(Storage.CurrentContext, yieldKey, 0);
            GAS.Transfer(Runtime.ExecutingScriptHash, owner, yield);

            OnYieldClaimed(trustId, owner, yield);
        }

        public static void ExecuteTrust(BigInteger trustId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(IsActive(trustId), "trust not active");

            byte[] deadlineKey = Helper.Concat(PREFIX_TRUST_DEADLINE, (ByteString)trustId.ToByteArray());
            BigInteger deadline = (BigInteger)Storage.Get(Storage.CurrentContext, deadlineKey);
            ExecutionEngine.Assert(Runtime.Time >= deadline, "owner still alive");

            byte[] heirKey = Helper.Concat(PREFIX_TRUST_HEIR, (ByteString)trustId.ToByteArray());
            UInt160 heir = (UInt160)Storage.Get(Storage.CurrentContext, heirKey);

            BigInteger principal = GetPrincipal(trustId);

            byte[] activeKey = Helper.Concat(PREFIX_TRUST_ACTIVE, (ByteString)trustId.ToByteArray());
            Storage.Put(Storage.CurrentContext, activeKey, 0);

            NEO.Transfer(Runtime.ExecutingScriptHash, heir, principal);

            OnTrustExecuted(trustId, heir, principal);
        }

        #endregion
    }
}
