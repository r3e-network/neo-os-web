using System;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace ServiceLayer.Contracts
{
    /// <summary>
    /// GasBank manages account balances and service fee collection.
    /// Inherits from ServiceContractBase for standardized access control.
    ///
    /// Workflow:
    /// 1. Users deposit GAS to their account balance
    /// 2. Services request fee collection via CollectFee
    /// 3. GasBank deducts from account balance
    /// 4. Refunds possible on service failure
    /// </summary>
    public class GasBank : ServiceContractBase
    {
        // Service-specific storage
        private static readonly StorageMap Balances = new(Storage.CurrentContext, "bal:");
        private static readonly StorageMap Deposits = new(Storage.CurrentContext, "dep:");
        private static readonly StorageMap Withdrawals = new(Storage.CurrentContext, "wth:");
        private static readonly StorageMap FeeRecords = new(Storage.CurrentContext, "fee:");
        private static readonly StorageMap GasBankConfig = new(Storage.CurrentContext, "gbcfg:");

        // Events
        public static event Action<ByteString, BigInteger, ByteString> Deposited;
        public static event Action<ByteString, BigInteger, ByteString> Withdrawn;
        public static event Action<ByteString, BigInteger, ByteString, ByteString> FeeCollected;
        public static event Action<ByteString, BigInteger, ByteString, ByteString> FeeRefunded;
        public static event Action<ByteString, BigInteger> BalanceUpdated;

        public struct Balance
        {
            public ByteString AccountId;
            public BigInteger Available;
            public BigInteger Reserved;
            public BigInteger TotalDeposited;
            public BigInteger TotalWithdrawn;
            public BigInteger TotalFeesPaid;
            public BigInteger LastUpdated;
        }

        public struct DepositRecord
        {
            public ByteString Id;
            public ByteString AccountId;
            public BigInteger Amount;
            public UInt160 From;
            public ByteString TxHash;
            public BigInteger Timestamp;
        }

        public struct FeeRecord
        {
            public ByteString Id;
            public ByteString AccountId;
            public BigInteger Amount;
            public ByteString ServiceId;
            public ByteString RequestId;
            public byte Status; // 0=collected, 1=refunded
            public BigInteger Timestamp;
        }

        // ============================================================
        // ServiceContractBase Implementation
        // ============================================================

        protected override ByteString GetServiceId()
        {
            return (ByteString)"com.r3e.services.gasbank";
        }

        protected override byte GetRequiredRole()
        {
            return RoleServiceRunner;
        }

        protected override bool ValidateRequest(byte requestType, ByteString payload)
        {
            return payload is not null && payload.Length > 0;
        }

        // ============================================================
        // Public API
        // ============================================================

        /// <summary>
        /// Deposit GAS to an account's balance.
        /// </summary>
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            if (Runtime.CallingScriptHash != GAS.Hash)
            {
                throw new Exception("Only GAS accepted");
            }
            if (amount <= 0)
            {
                throw new Exception("Amount must be positive");
            }

            ByteString accountId = (ByteString)data;
            if (accountId is null || accountId.Length == 0)
            {
                throw new Exception("Account ID required in data");
            }

            var balance = LoadBalance(accountId);
            balance.Available += amount;
            balance.TotalDeposited += amount;
            balance.LastUpdated = Runtime.Time;
            SaveBalance(accountId, balance);

            var depositId = GenerateId("dep", accountId, Runtime.Time);
            var deposit = new DepositRecord
            {
                Id = depositId,
                AccountId = accountId,
                Amount = amount,
                From = from,
                TxHash = (ByteString)((Transaction)Runtime.ScriptContainer).Hash,
                Timestamp = Runtime.Time
            };
            Deposits.Put(depositId, StdLib.Serialize(deposit));

            Deposited(accountId, amount, depositId);
            BalanceUpdated(accountId, balance.Available);
        }

        /// <summary>
        /// Withdraw GAS from account balance.
        /// </summary>
        public static void Withdraw(ByteString accountId, UInt160 to, BigInteger amount)
        {
            if (accountId is null || accountId.Length == 0)
            {
                throw new Exception("Account ID required");
            }
            if (to is null || !to.IsValid)
            {
                throw new Exception("Invalid recipient");
            }
            if (amount <= 0)
            {
                throw new Exception("Amount must be positive");
            }

            RequireAccountOwner(accountId);

            var balance = LoadBalance(accountId);
            if (balance.Available < amount)
            {
                throw new Exception("Insufficient balance");
            }

            balance.Available -= amount;
            balance.TotalWithdrawn += amount;
            balance.LastUpdated = Runtime.Time;
            SaveBalance(accountId, balance);

            GAS.Transfer(Runtime.ExecutingScriptHash, to, amount, null);

            var withdrawId = GenerateId("wth", accountId, Runtime.Time);
            Withdrawn(accountId, amount, withdrawId);
            BalanceUpdated(accountId, balance.Available);
        }

        /// <summary>
        /// Collect fee for a service request.
        /// </summary>
        public static ByteString CollectFee(ByteString accountId, BigInteger amount, ByteString serviceId, ByteString requestId)
        {
            RequireRole(RoleServiceRunner);

            if (accountId is null || accountId.Length == 0)
            {
                throw new Exception("Account ID required");
            }
            if (amount <= 0)
            {
                throw new Exception("Amount must be positive");
            }

            var balance = LoadBalance(accountId);
            if (balance.Available < amount)
            {
                throw new Exception("Insufficient balance");
            }

            balance.Available -= amount;
            balance.TotalFeesPaid += amount;
            balance.LastUpdated = Runtime.Time;
            SaveBalance(accountId, balance);

            var feeId = GenerateId("fee", requestId, Runtime.Time);
            var feeRecord = new FeeRecord
            {
                Id = feeId,
                AccountId = accountId,
                Amount = amount,
                ServiceId = serviceId,
                RequestId = requestId,
                Status = 0,
                Timestamp = Runtime.Time
            };
            FeeRecords.Put(feeId, StdLib.Serialize(feeRecord));

            FeeCollected(accountId, amount, serviceId, requestId);
            BalanceUpdated(accountId, balance.Available);

            return feeId;
        }

        /// <summary>
        /// Refund a previously collected fee.
        /// </summary>
        public static void RefundFee(ByteString feeId)
        {
            RequireRole(RoleServiceRunner);

            var data = FeeRecords.Get(feeId);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Fee record not found");
            }

            var feeRecord = (FeeRecord)StdLib.Deserialize(data);
            if (feeRecord.Status != 0)
            {
                throw new Exception("Fee already refunded");
            }

            var balance = LoadBalance(feeRecord.AccountId);
            balance.Available += feeRecord.Amount;
            balance.TotalFeesPaid -= feeRecord.Amount;
            balance.LastUpdated = Runtime.Time;
            SaveBalance(feeRecord.AccountId, balance);

            feeRecord.Status = 1;
            FeeRecords.Put(feeId, StdLib.Serialize(feeRecord));

            FeeRefunded(feeRecord.AccountId, feeRecord.Amount, feeRecord.ServiceId, feeRecord.RequestId);
            BalanceUpdated(feeRecord.AccountId, balance.Available);
        }

        /// <summary>
        /// Reserve funds for a pending operation.
        /// </summary>
        public static void ReserveFunds(ByteString accountId, BigInteger amount, ByteString reference)
        {
            RequireRole(RoleServiceRunner);

            var balance = LoadBalance(accountId);
            if (balance.Available < amount)
            {
                throw new Exception("Insufficient balance");
            }

            balance.Available -= amount;
            balance.Reserved += amount;
            balance.LastUpdated = Runtime.Time;
            SaveBalance(accountId, balance);
        }

        /// <summary>
        /// Release reserved funds back to available.
        /// </summary>
        public static void ReleaseFunds(ByteString accountId, BigInteger amount, ByteString reference)
        {
            RequireRole(RoleServiceRunner);

            var balance = LoadBalance(accountId);
            if (balance.Reserved < amount)
            {
                throw new Exception("Insufficient reserved funds");
            }

            balance.Reserved -= amount;
            balance.Available += amount;
            balance.LastUpdated = Runtime.Time;
            SaveBalance(accountId, balance);
        }

        /// <summary>
        /// Get account balance.
        /// </summary>
        public static Balance GetBalance(ByteString accountId)
        {
            return LoadBalance(accountId);
        }

        /// <summary>
        /// Check if account has sufficient balance.
        /// </summary>
        public static bool HasSufficientBalance(ByteString accountId, BigInteger amount)
        {
            var balance = LoadBalance(accountId);
            return balance.Available >= amount;
        }

        /// <summary>
        /// Set AccountManager contract hash.
        /// </summary>
        public static void SetAccountManager(UInt160 hash)
        {
            RequireAdmin();
            if (hash is null || !hash.IsValid)
            {
                throw new Exception("Invalid account manager");
            }
            GasBankConfig.Put("account_manager", hash);
        }

        // ============================================================
        // Helper Methods
        // ============================================================

        private static Balance LoadBalance(ByteString accountId)
        {
            var data = Balances.Get(accountId);
            if (data is null || data.Length == 0)
            {
                return new Balance
                {
                    AccountId = accountId,
                    Available = 0,
                    Reserved = 0,
                    TotalDeposited = 0,
                    TotalWithdrawn = 0,
                    TotalFeesPaid = 0,
                    LastUpdated = Runtime.Time
                };
            }
            return (Balance)StdLib.Deserialize(data);
        }

        private static void SaveBalance(ByteString accountId, Balance balance)
        {
            Balances.Put(accountId, StdLib.Serialize(balance));
        }

        private static ByteString GenerateId(string prefix, ByteString seed, BigInteger timestamp)
        {
            var data = prefix + seed + timestamp.ToString();
            return CryptoLib.Sha256(data);
        }

        private static void RequireAccountOwner(ByteString accountId)
        {
            var accountMgr = GetAccountManager();
            if (accountMgr == UInt160.Zero)
            {
                throw new Exception("AccountManager not configured");
            }

            var owner = (UInt160)Contract.Call(accountMgr, "GetOwner", CallFlags.ReadOnly, accountId);
            if (owner is null || !owner.IsValid || !Runtime.CheckWitness(owner))
            {
                throw new Exception("Account owner required");
            }
        }

        private static UInt160 GetAccountManager()
        {
            var data = GasBankConfig.Get("account_manager");
            if (data is null || data.Length == 0)
            {
                return UInt160.Zero;
            }
            return (UInt160)data;
        }
    }
}
