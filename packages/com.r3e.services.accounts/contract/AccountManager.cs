using System;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace ServiceLayer.Contracts
{
    /// <summary>
    /// AccountManager tracks workspaces/accounts and linked wallets.
    /// Inherits from ServiceContractBase for standardized access control.
    ///
    /// Struct Mapping:
    /// - Account.Id → account.Account.ID (string)
    /// - Account.Owner → account.Account.Owner (UInt160 → string address)
    /// - Account.MetadataHash → SHA256 of account.Account.Metadata
    /// - Wallet.AccountId → account.WorkspaceWallet.AccountID
    /// - Wallet.Address → account.WorkspaceWallet.Address
    /// - Wallet.Status → gasbank.AccountStatus (0=active, 1=revoked)
    /// </summary>
    public class AccountManager : ServiceContractBase
    {
        // Service-specific storage
        private static readonly StorageMap Accounts = new(Storage.CurrentContext, "acct:");
        private static readonly StorageMap Wallets = new(Storage.CurrentContext, "wallet:");
        private static readonly StorageMap OwnerAccounts = new(Storage.CurrentContext, "owner:");

        // Account status
        public const byte AccountStatusActive = 0x00;
        public const byte AccountStatusSuspended = 0x01;
        public const byte AccountStatusClosed = 0x02;

        // Wallet status
        public const byte WalletStatusActive = 0x00;
        public const byte WalletStatusRevoked = 0x01;

        // Events
        public static event Action<ByteString, UInt160> AccountCreated;
        public static event Action<ByteString, UInt160> WalletLinked;
        public static event Action<ByteString, UInt160> WalletRevoked;
        public static event Action<ByteString, byte> AccountStatusChanged;

        public struct Account
        {
            public ByteString Id;
            public UInt160 Owner;
            public ByteString MetadataHash;
            public byte Status;
            public BigInteger CreatedAt;
            public BigInteger UpdatedAt;
        }

        public struct Wallet
        {
            public ByteString AccountId;
            public UInt160 Address;
            public byte Status;
            public BigInteger LinkedAt;
        }

        // ============================================================
        // ServiceContractBase Implementation
        // ============================================================

        protected override ByteString GetServiceId()
        {
            return (ByteString)"com.r3e.services.accounts";
        }

        protected override byte GetRequiredRole()
        {
            return RoleAdmin;
        }

        protected override bool ValidateRequest(byte requestType, ByteString payload)
        {
            return payload is not null && payload.Length > 0;
        }

        // ============================================================
        // Public API
        // ============================================================

        /// <summary>
        /// Create a new account.
        /// </summary>
        public static void Create(ByteString id, UInt160 owner, ByteString metadataHash)
        {
            if (id is null || id.Length == 0)
            {
                throw new Exception("Account ID required");
            }
            if (owner is null || !owner.IsValid)
            {
                throw new Exception("Invalid owner");
            }
            if (Accounts.Get(id) is not null)
            {
                throw new Exception("Account already exists");
            }

            // Verify owner signature
            if (!Runtime.CheckWitness(owner))
            {
                throw new Exception("Owner signature required");
            }

            var acct = new Account
            {
                Id = id,
                Owner = owner,
                MetadataHash = metadataHash,
                Status = AccountStatusActive,
                CreatedAt = Runtime.Time,
                UpdatedAt = Runtime.Time
            };

            Accounts.Put(id, StdLib.Serialize(acct));

            // Index by owner
            var ownerKey = (ByteString)owner + id;
            OwnerAccounts.Put(ownerKey, id);

            AccountCreated(id, owner);
        }

        /// <summary>
        /// Get account by ID.
        /// </summary>
        public static Account Get(ByteString id)
        {
            var data = Accounts.Get(id);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Account not found");
            }
            return (Account)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Get account owner.
        /// </summary>
        public static UInt160 GetOwner(ByteString id)
        {
            var acct = Get(id);
            return acct.Owner;
        }

        /// <summary>
        /// Update account metadata.
        /// </summary>
        public static void UpdateMetadata(ByteString id, ByteString metadataHash)
        {
            var acct = Get(id);
            RequireOwner(acct.Owner);

            acct.MetadataHash = metadataHash;
            acct.UpdatedAt = Runtime.Time;
            Accounts.Put(id, StdLib.Serialize(acct));
        }

        /// <summary>
        /// Transfer account ownership.
        /// </summary>
        public static void TransferOwnership(ByteString id, UInt160 newOwner)
        {
            var acct = Get(id);
            RequireOwner(acct.Owner);

            if (newOwner is null || !newOwner.IsValid)
            {
                throw new Exception("Invalid new owner");
            }

            // Remove old owner index
            var oldOwnerKey = (ByteString)acct.Owner + id;
            OwnerAccounts.Delete(oldOwnerKey);

            // Update account
            acct.Owner = newOwner;
            acct.UpdatedAt = Runtime.Time;
            Accounts.Put(id, StdLib.Serialize(acct));

            // Add new owner index
            var newOwnerKey = (ByteString)newOwner + id;
            OwnerAccounts.Put(newOwnerKey, id);
        }

        /// <summary>
        /// Link a wallet to an account.
        /// </summary>
        public static void LinkWallet(ByteString accountId, UInt160 address)
        {
            var acct = Get(accountId);
            RequireOwner(acct.Owner);

            if (address is null || !address.IsValid)
            {
                throw new Exception("Invalid wallet address");
            }

            var key = accountId + (ByteString)address;
            var w = new Wallet
            {
                AccountId = accountId,
                Address = address,
                Status = WalletStatusActive,
                LinkedAt = Runtime.Time
            };

            Wallets.Put(key, StdLib.Serialize(w));
            WalletLinked(accountId, address);
        }

        /// <summary>
        /// Revoke a wallet from an account.
        /// </summary>
        public static void RevokeWallet(ByteString accountId, UInt160 address)
        {
            var acct = Get(accountId);
            RequireOwner(acct.Owner);

            var key = accountId + (ByteString)address;
            var data = Wallets.Get(key);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Wallet not found");
            }

            var wallet = (Wallet)StdLib.Deserialize(data);
            wallet.Status = WalletStatusRevoked;
            Wallets.Put(key, StdLib.Serialize(wallet));

            WalletRevoked(accountId, address);
        }

        /// <summary>
        /// Get wallet by account and address.
        /// </summary>
        public static Wallet GetWallet(ByteString accountId, UInt160 address)
        {
            var key = accountId + (ByteString)address;
            var data = Wallets.Get(key);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Wallet not found");
            }
            return (Wallet)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Check if wallet is active for account.
        /// </summary>
        public static bool IsWalletActive(ByteString accountId, UInt160 address)
        {
            var key = accountId + (ByteString)address;
            var data = Wallets.Get(key);
            if (data is null || data.Length == 0)
            {
                return false;
            }
            var wallet = (Wallet)StdLib.Deserialize(data);
            return wallet.Status == WalletStatusActive;
        }

        /// <summary>
        /// Suspend an account (admin only).
        /// </summary>
        public static void SuspendAccount(ByteString id)
        {
            RequireAdmin();

            var acct = Get(id);
            acct.Status = AccountStatusSuspended;
            acct.UpdatedAt = Runtime.Time;
            Accounts.Put(id, StdLib.Serialize(acct));

            AccountStatusChanged(id, AccountStatusSuspended);
        }

        /// <summary>
        /// Reactivate a suspended account (admin only).
        /// </summary>
        public static void ReactivateAccount(ByteString id)
        {
            RequireAdmin();

            var acct = Get(id);
            if (acct.Status != AccountStatusSuspended)
            {
                throw new Exception("Account not suspended");
            }

            acct.Status = AccountStatusActive;
            acct.UpdatedAt = Runtime.Time;
            Accounts.Put(id, StdLib.Serialize(acct));

            AccountStatusChanged(id, AccountStatusActive);
        }

        // ============================================================
        // Helper Methods
        // ============================================================

        private static void RequireOwner(UInt160 owner)
        {
            if (owner is null || !owner.IsValid || !Runtime.CheckWitness(owner))
            {
                throw new Exception("Owner required");
            }
        }
    }
}
