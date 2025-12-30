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
    public delegate void VaultCreatedHandler(BigInteger vaultId, UInt160 creator, BigInteger bounty);
    public delegate void AttemptMadeHandler(BigInteger vaultId, UInt160 attacker, bool success);
    public delegate void VaultBrokenHandler(BigInteger vaultId, UInt160 winner, BigInteger reward);

    /// <summary>
    /// UnbreakableVault MiniApp - Hacker bounty challenge.
    /// Create vaults with GAS bounties, hackers try to break them.
    /// </summary>
    [DisplayName("MiniAppUnbreakableVault")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. UnbreakableVault is a security challenge application for hacker bounties. Use it to create vaults with GAS bounties, you can test security or earn rewards by breaking challenges.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-unbreakablevault";
        private const long MIN_BOUNTY = 100000000; // 1 GAS
        private const long ATTEMPT_FEE = 10000000; // 0.1 GAS
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_VAULT_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_VAULTS = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_ATTEMPTS = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Data Structures
        public struct VaultData
        {
            public UInt160 Creator;
            public BigInteger Bounty;
            public ByteString SecretHash;
            public BigInteger AttemptCount;
            public bool Broken;
            public UInt160 Winner;
        }
        #endregion

        #region App Events
        [DisplayName("VaultCreated")]
        public static event VaultCreatedHandler OnVaultCreated;

        [DisplayName("AttemptMade")]
        public static event AttemptMadeHandler OnAttemptMade;

        [DisplayName("VaultBroken")]
        public static event VaultBrokenHandler OnVaultBroken;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_VAULT_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        public static BigInteger CreateVault(UInt160 creator, ByteString secretHash, BigInteger bounty, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(bounty >= MIN_BOUNTY, "min 1 GAS bounty");
            ExecutionEngine.Assert(secretHash.Length == 32, "invalid hash");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            ValidatePaymentReceipt(APP_ID, creator, bounty, receiptId);

            BigInteger vaultId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_VAULT_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_VAULT_ID, vaultId);

            VaultData vault = new VaultData
            {
                Creator = creator,
                Bounty = bounty,
                SecretHash = secretHash,
                AttemptCount = 0,
                Broken = false,
                Winner = UInt160.Zero
            };
            StoreVault(vaultId, vault);

            OnVaultCreated(vaultId, creator, bounty);
            return vaultId;
        }

        public static bool AttemptBreak(BigInteger vaultId, UInt160 attacker, ByteString secret, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            VaultData vault = GetVault(vaultId);
            ExecutionEngine.Assert(!vault.Broken, "already broken");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(attacker), "unauthorized");

            ValidatePaymentReceipt(APP_ID, attacker, ATTEMPT_FEE, receiptId);

            vault.AttemptCount += 1;
            vault.Bounty += ATTEMPT_FEE;

            ByteString attemptHash = CryptoLib.Sha256(secret);
            bool success = attemptHash == vault.SecretHash;

            if (success)
            {
                vault.Broken = true;
                vault.Winner = attacker;
                OnVaultBroken(vaultId, attacker, vault.Bounty);
            }

            StoreVault(vaultId, vault);
            OnAttemptMade(vaultId, attacker, success);
            return success;
        }

        [Safe]
        public static VaultData GetVault(BigInteger vaultId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_VAULTS, (ByteString)vaultId.ToByteArray()));
            if (data == null) return new VaultData();
            return (VaultData)StdLib.Deserialize(data);
        }

        #endregion

        #region Internal Helpers

        private static void StoreVault(BigInteger vaultId, VaultData vault)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_VAULTS, (ByteString)vaultId.ToByteArray()),
                StdLib.Serialize(vault));
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
