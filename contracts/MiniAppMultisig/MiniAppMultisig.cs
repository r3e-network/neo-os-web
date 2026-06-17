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
    /// MiniAppMultisig — on-chain custody multisig wallet (M-of-N).
    ///
    /// WHY THIS DESIGN: the dApi wallet (OneGate/NeoLine signMessage/NEP-413)
    /// cannot produce the raw secp256r1 witness a native Neo CheckMultisig script
    /// needs, so partial-witness collection is impossible client-side. Instead a
    /// shared VAULT (set of signer addresses + threshold) custodies NEO/GAS in
    /// THIS contract; spends are proposed as requests and each signer approves
    /// with a NORMAL single-sig invoke authenticated by Runtime.CheckWitness. When
    /// approvals reach the threshold the contract itself transfers the funds to the
    /// recipient. No raw multisig witness is ever required.
    ///
    /// SECURITY:
    /// - Only NEO and GAS deposits accepted (OnNEP17Payment caller check).
    /// - Amounts are stored/compared in BASE UNITS (BigInteger) exactly as the
    ///   native token reports them — NEO is indivisible (0 decimals), GAS has 8;
    ///   the contract never rescales, so there is no 10^8 class of bug.
    /// - Only a vault signer may create a request (and only up to the vault
    ///   balance), approve it, or cancel it; one approval per signer.
    /// - Execution uses checks-effects-interactions: status + balance are written
    ///   BEFORE the outbound transfer, so a re-entrant recipient cannot double
    ///   spend. A failed transfer asserts, reverting the whole atomic invocation.
    /// </summary>
    [DisplayName("MiniAppMultisig")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "On-chain M-of-N custody multisig wallet: shared NEO/GAS vault, per-signer CheckWitness approvals, contract-executed release at threshold.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")] // GAS
    [ContractPermission("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", "transfer")] // NEO
    public partial class MiniAppMultisig : SmartContract
    {
        #region Constants
        private const int MIN_SIGNERS = 2;
        private const int MAX_SIGNERS = 16;
        private const int MAX_MEMO_LENGTH = 160;

        private const byte STATUS_PENDING = 0;
        private const byte STATUS_EXECUTED = 1;
        private const byte STATUS_CANCELLED = 2;

        private const byte ASSET_NEO = 1;
        private const byte ASSET_GAS = 2;
        #endregion

        #region Storage prefixes
        private static readonly byte[] PREFIX_OWNER = new byte[] { 0x01 };        // -> deployer (upgrade authority)
        private static readonly byte[] PREFIX_VAULT_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_VAULT = new byte[] { 0x11 };       // + vaultId -> Vault
        private static readonly byte[] PREFIX_BALANCE = new byte[] { 0x12 };     // + vaultId + assetByte -> BigInteger
        private static readonly byte[] PREFIX_REQUEST_ID = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_REQUEST = new byte[] { 0x21 };     // + reqId -> Request
        private static readonly byte[] PREFIX_APPROVED = new byte[] { 0x22 };    // + reqId + signer -> 1
        #endregion

        #region Events
        [DisplayName("VaultCreated")]
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger> OnVaultCreated;

        [DisplayName("Deposited")]
        public static event Action<BigInteger, UInt160, UInt160, BigInteger> OnDeposited;

        [DisplayName("RequestCreated")]
        public static event Action<BigInteger, BigInteger, UInt160, UInt160, BigInteger> OnRequestCreated;

        [DisplayName("Approved")]
        public static event Action<BigInteger, UInt160, BigInteger> OnApproved;

        [DisplayName("RequestExecuted")]
        public static event Action<BigInteger, UInt160, UInt160, BigInteger> OnRequestExecuted;

        [DisplayName("RequestCancelled")]
        public static event Action<BigInteger> OnRequestCancelled;

        /// <summary>A threshold-reaching approval found the vault no longer able to
        /// cover the request (requestId, requested amount, available balance).</summary>
        [DisplayName("RequestUnfunded")]
        public static event Action<BigInteger, BigInteger, BigInteger> OnRequestUnfunded;
        #endregion

        #region Types
        public struct Vault
        {
            public UInt160 Creator;
            public BigInteger Threshold;
            public BigInteger CreatedTime;
            public UInt160[] Signers;
        }

        public struct Request
        {
            public BigInteger VaultId;
            public UInt160 Creator;
            public UInt160 Recipient;
            public UInt160 Asset;
            public BigInteger Amount;
            public BigInteger ApprovalCount;
            public BigInteger Status;
            public BigInteger CreatedTime;
            public string Memo;
        }
        #endregion

        #region Deposit
        /// <summary>
        /// Fund a vault by transferring NEO or GAS to this contract with the target
        /// vaultId in the transfer data. Rejects any other asset and unknown vault.
        /// </summary>
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            UInt160 caller = Runtime.CallingScriptHash;
            byte assetByte;
            if (caller == NEO.Hash) assetByte = ASSET_NEO;
            else if (caller == GAS.Hash) assetByte = ASSET_GAS;
            else { ExecutionEngine.Assert(false, "only NEO or GAS accepted"); return; }

            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(data is not null, "vault id required in transfer data");
            BigInteger vaultId = (BigInteger)data;

            StorageContext ctx = Storage.CurrentContext;
            ExecutionEngine.Assert(Storage.Get(ctx, VaultKey(vaultId)) is not null, "vault not found");

            byte[] balKey = BalanceKey(vaultId, assetByte);
            BigInteger bal = (BigInteger)Storage.Get(ctx, balKey) + amount;
            Storage.Put(ctx, balKey, bal);
            OnDeposited(vaultId, from, caller, amount);
        }
        #endregion

        #region Vault + request lifecycle
        public static BigInteger CreateVault(UInt160 creator, UInt160[] signers, BigInteger threshold)
        {
            ExecutionEngine.Assert(creator is not null && creator.IsValid && !creator.IsZero, "invalid creator");
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "creator witness required");
            ExecutionEngine.Assert(signers is not null, "signers required");

            int count = signers.Length;
            ExecutionEngine.Assert(count >= MIN_SIGNERS && count <= MAX_SIGNERS, "signer count out of range");
            ExecutionEngine.Assert(threshold >= 1 && threshold <= count, "invalid threshold");
            for (int i = 0; i < count; i++)
            {
                UInt160 s = signers[i];
                ExecutionEngine.Assert(s is not null && s.IsValid && !s.IsZero, "invalid signer");
                for (int j = i + 1; j < count; j++)
                    ExecutionEngine.Assert(s != signers[j], "duplicate signer");
            }

            StorageContext ctx = Storage.CurrentContext;
            BigInteger vaultId = (BigInteger)Storage.Get(ctx, PREFIX_VAULT_ID) + 1;
            Storage.Put(ctx, PREFIX_VAULT_ID, vaultId);

            Vault vault = new Vault
            {
                Creator = creator,
                Threshold = threshold,
                CreatedTime = Runtime.Time,
                Signers = signers,
            };
            Storage.Put(ctx, VaultKey(vaultId), StdLib.Serialize(vault));
            OnVaultCreated(vaultId, creator, threshold, count);
            return vaultId;
        }

        public static BigInteger CreateRequest(
            BigInteger vaultId,
            UInt160 creator,
            UInt160 recipient,
            UInt160 asset,
            BigInteger amount,
            string memo)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "creator witness required");
            ExecutionEngine.Assert(recipient is not null && recipient.IsValid && !recipient.IsZero, "invalid recipient");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(memo is null || memo.Length <= MAX_MEMO_LENGTH, "memo too long");
            byte assetByte = AssetByte(asset);

            StorageContext ctx = Storage.CurrentContext;
            ByteString rawVault = Storage.Get(ctx, VaultKey(vaultId));
            ExecutionEngine.Assert(rawVault is not null, "vault not found");
            Vault vault = (Vault)StdLib.Deserialize(rawVault);
            ExecutionEngine.Assert(IsSignerOf(vault, creator), "creator not a vault signer");

            BigInteger bal = (BigInteger)Storage.Get(ctx, BalanceKey(vaultId, assetByte));
            ExecutionEngine.Assert(amount <= bal, "amount exceeds vault balance");

            BigInteger reqId = (BigInteger)Storage.Get(ctx, PREFIX_REQUEST_ID) + 1;
            Storage.Put(ctx, PREFIX_REQUEST_ID, reqId);

            Request request = new Request
            {
                VaultId = vaultId,
                Creator = creator,
                Recipient = recipient,
                Asset = asset,
                Amount = amount,
                ApprovalCount = 0,
                Status = STATUS_PENDING,
                CreatedTime = Runtime.Time,
                Memo = memo ?? "",
            };
            Storage.Put(ctx, RequestKey(reqId), StdLib.Serialize(request));
            OnRequestCreated(reqId, vaultId, creator, recipient, amount);
            return reqId;
        }

        public static void Approve(BigInteger requestId, UInt160 signer)
        {
            ExecutionEngine.Assert(signer is not null && signer.IsValid && !signer.IsZero, "invalid signer");
            ExecutionEngine.Assert(Runtime.CheckWitness(signer), "signer witness required");

            StorageContext ctx = Storage.CurrentContext;
            ByteString rawReq = Storage.Get(ctx, RequestKey(requestId));
            ExecutionEngine.Assert(rawReq is not null, "request not found");
            Request request = (Request)StdLib.Deserialize(rawReq);
            ExecutionEngine.Assert(request.Status == STATUS_PENDING, "request not pending");

            Vault vault = (Vault)StdLib.Deserialize(Storage.Get(ctx, VaultKey(request.VaultId)));
            ExecutionEngine.Assert(IsSignerOf(vault, signer), "not a signer");

            byte[] approvedKey = ApprovedKey(requestId, signer);
            ExecutionEngine.Assert(Storage.Get(ctx, approvedKey) is null, "already approved");
            Storage.Put(ctx, approvedKey, 1);

            request.ApprovalCount += 1;
            OnApproved(requestId, signer, request.ApprovalCount);

            if (request.ApprovalCount >= vault.Threshold)
            {
                byte assetByte = AssetByte(request.Asset);
                byte[] balKey = BalanceKey(request.VaultId, assetByte);
                BigInteger bal = (BigInteger)Storage.Get(ctx, balKey);
                if (request.Amount > bal)
                {
                    // Tri-repo review MP-D-04: another request spent the balance
                    // after this one was created, so it can never execute.
                    // Asserting here would force EVERY finalizing signer into a
                    // reverting transaction and leave the request stuck PENDING
                    // forever. Mark it CANCELLED gracefully instead (the vault
                    // keeps its funds; the creator can recreate once refunded).
                    request.Status = STATUS_CANCELLED;
                    Storage.Put(ctx, RequestKey(requestId), StdLib.Serialize(request));
                    OnRequestUnfunded(requestId, request.Amount, bal);
                    OnRequestCancelled(requestId);
                    return;
                }

                // Effects BEFORE interaction (reentrancy-safe + atomic on failure).
                Storage.Put(ctx, balKey, bal - request.Amount);
                request.Status = STATUS_EXECUTED;
                Storage.Put(ctx, RequestKey(requestId), StdLib.Serialize(request));

                bool ok = (bool)Contract.Call(
                    request.Asset, "transfer", CallFlags.All,
                    new object[] { Runtime.ExecutingScriptHash, request.Recipient, request.Amount, "" });
                ExecutionEngine.Assert(ok, "asset transfer failed");

                OnRequestExecuted(requestId, request.Recipient, request.Asset, request.Amount);
            }
            else
            {
                Storage.Put(ctx, RequestKey(requestId), StdLib.Serialize(request));
            }
        }

        public static void Cancel(BigInteger requestId, UInt160 caller)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(caller), "caller witness required");
            StorageContext ctx = Storage.CurrentContext;
            ByteString rawReq = Storage.Get(ctx, RequestKey(requestId));
            ExecutionEngine.Assert(rawReq is not null, "request not found");
            Request request = (Request)StdLib.Deserialize(rawReq);
            ExecutionEngine.Assert(request.Status == STATUS_PENDING, "request not pending");
            // Tri-repo review MP-D-04: any vault signer may cancel a pending
            // request, not just its creator. A request only spends with M-of-N
            // approvals anyway, and creator-only cancel left stuck requests
            // dangling forever when the creator key was lost or unavailable.
            Vault vault = (Vault)StdLib.Deserialize(Storage.Get(ctx, VaultKey(request.VaultId)));
            ExecutionEngine.Assert(IsSignerOf(vault, caller), "only a vault signer can cancel");
            request.Status = STATUS_CANCELLED;
            Storage.Put(ctx, RequestKey(requestId), StdLib.Serialize(request));
            OnRequestCancelled(requestId);
        }
        #endregion

    }
}
