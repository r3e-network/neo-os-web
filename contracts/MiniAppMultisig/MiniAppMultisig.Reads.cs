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
    public partial class MiniAppMultisig : SmartContract
    {
        #region Read-only
        [Safe]
        public static BigInteger LastVaultId() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_VAULT_ID);

        [Safe]
        public static BigInteger LastRequestId() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_REQUEST_ID);

        [Safe]
        public static BigInteger BalanceOf(BigInteger vaultId, UInt160 asset)
        {
            return (BigInteger)Storage.Get(Storage.CurrentContext, BalanceKey(vaultId, AssetByte(asset)));
        }

        [Safe]
        public static Map<string, object> GetVault(BigInteger vaultId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, VaultKey(vaultId));
            ExecutionEngine.Assert(raw is not null, "vault not found");
            Vault vault = (Vault)StdLib.Deserialize(raw);
            Map<string, object> m = new Map<string, object>();
            m["id"] = vaultId;
            m["creator"] = vault.Creator;
            m["threshold"] = vault.Threshold;
            m["createdTime"] = vault.CreatedTime;
            m["signers"] = vault.Signers;
            m["neoBalance"] = (BigInteger)Storage.Get(Storage.CurrentContext, BalanceKey(vaultId, ASSET_NEO));
            m["gasBalance"] = (BigInteger)Storage.Get(Storage.CurrentContext, BalanceKey(vaultId, ASSET_GAS));
            return m;
        }

        [Safe]
        public static Map<string, object> GetRequest(BigInteger requestId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, RequestKey(requestId));
            ExecutionEngine.Assert(raw is not null, "request not found");
            Request r = (Request)StdLib.Deserialize(raw);
            Map<string, object> m = new Map<string, object>();
            m["id"] = requestId;
            m["vaultId"] = r.VaultId;
            m["creator"] = r.Creator;
            m["recipient"] = r.Recipient;
            m["asset"] = r.Asset;
            m["amount"] = r.Amount;
            m["approvalCount"] = r.ApprovalCount;
            m["status"] = r.Status;
            m["createdTime"] = r.CreatedTime;
            m["memo"] = r.Memo;
            return m;
        }

        [Safe]
        public static bool HasApproved(BigInteger requestId, UInt160 signer)
        {
            return Storage.Get(Storage.CurrentContext, ApprovedKey(requestId, signer)) is not null;
        }
        #endregion

        #region Ownership + upgrade
        /// <summary>
        /// Captures the deployer as the upgrade authority on first deployment.
        /// The owner is never reset on subsequent updates so an upgrade cannot
        /// silently hand control to a new account.
        /// </summary>
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_OWNER, (ByteString)Runtime.Transaction.Sender);
        }

        [Safe]
        public static UInt160 GetOwner() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_OWNER);

        /// <summary>Owner-gated, instant contract upgrade.</summary>
        public static void Update(ByteString nef, string manifest)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(GetOwner()), "owner only");
            ContractManagement.Update(nef, manifest, new object[0]);
        }
        #endregion

        #region Internal
        private static byte AssetByte(UInt160 asset)
        {
            if (asset == NEO.Hash) return ASSET_NEO;
            if (asset == GAS.Hash) return ASSET_GAS;
            ExecutionEngine.Assert(false, "unsupported asset");
            return 0;
        }

        private static byte[] VaultKey(BigInteger vaultId) => Helper.Concat(PREFIX_VAULT, (byte[])(ByteString)vaultId);
        private static byte[] RequestKey(BigInteger requestId) => Helper.Concat(PREFIX_REQUEST, (byte[])(ByteString)requestId);
        private static byte[] BalanceKey(BigInteger vaultId, byte assetByte) => Helper.Concat(Helper.Concat(PREFIX_BALANCE, (byte[])(ByteString)vaultId), new byte[] { assetByte });
        private static byte[] ApprovedKey(BigInteger requestId, UInt160 signer) => Helper.Concat(Helper.Concat(PREFIX_APPROVED, (byte[])(ByteString)requestId), (byte[])signer);

        private static bool IsSignerOf(Vault vault, UInt160 who)
        {
            UInt160[] signers = vault.Signers;
            for (int i = 0; i < signers.Length; i++)
                if (signers[i] == who) return true;
            return false;
        }
        #endregion
    }
}
