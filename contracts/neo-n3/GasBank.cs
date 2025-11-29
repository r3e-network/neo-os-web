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
    ///
    /// Go Alignment:
    /// - domain/gasbank/model.go: Account balance tracking
    /// - packages/com.r3e.services.gasbank/service.go: Fee collection logic
    /// - oracle/service.go: FeeCollector interface
    ///
    /// Workflow:
    /// 1. Users deposit GAS to their account balance
    /// 2. Services request fee collection via CollectFee
    /// 3. GasBank deducts from account balance
    /// 4. Refunds possible on service failure
    /// </summary>
    public class GasBank : SmartContract
    {
        private static readonly StorageMap Balances = new(Storage.CurrentContext, "bal:");
        private static readonly StorageMap Deposits = new(Storage.CurrentContext, "dep:");
        private static readonly StorageMap Withdrawals = new(Storage.CurrentContext, "wth:");
        private static readonly StorageMap FeeRecords = new(Storage.CurrentContext, "fee:");
        private static readonly StorageMap Config = new(Storage.CurrentContext, "cfg:");

        private const byte RoleAdmin = 0x01;
        private const byte RoleServiceRunner = 0x02;

        // Events aligned with Go service layer expectations
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

        /// <summary>
        /// Deposit GAS to an account's balance.
        /// Called when user transfers GAS to the contract.
        /// </summary>
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            if (Runtime.CallingScriptHash != GAS.Hash)
            {
                throw new Exception("only GAS accepted");
            }
            if (amount <= 0)
            {
                throw new Exception("amount must be positive");
            }

            // Extract account ID from data
            ByteString accountId = (ByteString)data;
            if (accountId is null || accountId.Length == 0)
            {
                throw new Exception("account_id required in data");
            }

            // Update balance
            var balance = LoadBalance(accountId);
            balance.Available += amount;
            balance.TotalDeposited += amount;
            balance.LastUpdated = Runtime.Time;
            SaveBalance(accountId, balance);

            // Record deposit
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
        /// Only account owner can withdraw.
        /// </summary>
        public static void Withdraw(ByteString accountId, UInt160 to, BigInteger amount)
        {
            if (accountId is null || accountId.Length == 0)
            {
                throw new Exception("account_id required");
            }
            if (to is null || !to.IsValid)
            {
                throw new Exception("invalid recipient");
            }
            if (amount <= 0)
            {
                throw new Exception("amount must be positive");
            }

            // Verify ownership via AccountManager
            RequireAccountOwner(accountId);

            var balance = LoadBalance(accountId);
            if (balance.Available < amount)
            {
                throw new Exception("insufficient balance");
            }

            balance.Available -= amount;
            balance.TotalWithdrawn += amount;
            balance.LastUpdated = Runtime.Time;
            SaveBalance(accountId, balance);

            // Transfer GAS
            GAS.Transfer(Runtime.ExecutingScriptHash, to, amount, null);

            var withdrawId = GenerateId("wth", accountId, Runtime.Time);
            Withdrawn(accountId, amount, withdrawId);
            BalanceUpdated(accountId, balance.Available);
        }

        /// <summary>
        /// Collect fee for a service request.
        /// Called by service contracts (OracleHub, RandomnessHub, etc.)
        /// </summary>
        public static ByteString CollectFee(ByteString accountId, BigInteger amount, ByteString serviceId, ByteString requestId)
        {
            RequireServiceRunner();

            if (accountId is null || accountId.Length == 0)
            {
                throw new Exception("account_id required");
            }
            if (amount <= 0)
            {
                throw new Exception("amount must be positive");
            }
            if (serviceId is null || serviceId.Length == 0)
            {
                throw new Exception("service_id required");
            }
            if (requestId is null || requestId.Length == 0)
            {
                throw new Exception("request_id required");
            }

            var balance = LoadBalance(accountId);
            if (balance.Available < amount)
            {
                throw new Exception("insufficient balance");
            }

            balance.Available -= amount;
            balance.TotalFeesPaid += amount;
            balance.LastUpdated = Runtime.Time;
            SaveBalance(accountId, balance);

            // Record fee
            var feeId = GenerateId("fee", requestId, Runtime.Time);
            var feeRecord = new FeeRecord
            {
                Id = feeId,
                AccountId = accountId,
                Amount = amount,
                ServiceId = serviceId,
                RequestId = requestId,
                Status = 0, // collected
                Timestamp = Runtime.Time
            };
            FeeRecords.Put(feeId, StdLib.Serialize(feeRecord));

            FeeCollected(accountId, amount, serviceId, requestId);
            BalanceUpdated(accountId, balance.Available);

            return feeId;
        }

        /// <summary>
        /// Refund a previously collected fee.
        /// Called when a service request fails.
        /// </summary>
        public static void RefundFee(ByteString feeId)
        {
            RequireServiceRunner();

            var data = FeeRecords.Get(feeId);
            if (data is null || data.Length == 0)
            {
                throw new Exception("fee record not found");
            }

            var feeRecord = (FeeRecord)StdLib.Deserialize(data);
            if (feeRecord.Status != 0)
            {
                throw new Exception("fee already refunded");
            }

            // Refund to account
            var balance = LoadBalance(feeRecord.AccountId);
            balance.Available += feeRecord.Amount;
            balance.TotalFeesPaid -= feeRecord.Amount;
            balance.LastUpdated = Runtime.Time;
            SaveBalance(feeRecord.AccountId, balance);

            // Update fee record
            feeRecord.Status = 1; // refunded
            FeeRecords.Put(feeId, StdLib.Serialize(feeRecord));

            FeeRefunded(feeRecord.AccountId, feeRecord.Amount, feeRecord.ServiceId, feeRecord.RequestId);
            BalanceUpdated(feeRecord.AccountId, balance.Available);
        }

        /// <summary>
        /// Reserve funds for a pending operation.
        /// Prevents double-spending during async operations.
        /// </summary>
        public static void ReserveFunds(ByteString accountId, BigInteger amount, ByteString reference)
        {
            RequireServiceRunner();

            if (amount <= 0)
            {
                throw new Exception("amount must be positive");
            }

            var balance = LoadBalance(accountId);
            if (balance.Available < amount)
            {
                throw new Exception("insufficient balance");
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
            RequireServiceRunner();

            var balance = LoadBalance(accountId);
            if (balance.Reserved < amount)
            {
                throw new Exception("insufficient reserved funds");
            }

            balance.Reserved -= amount;
            balance.Available += amount;
            balance.LastUpdated = Runtime.Time;
            SaveBalance(accountId, balance);
        }

        /// <summary>
        /// Commit reserved funds as fee payment.
        /// </summary>
        public static void CommitReserved(ByteString accountId, BigInteger amount, ByteString serviceId, ByteString requestId)
        {
            RequireServiceRunner();

            var balance = LoadBalance(accountId);
            if (balance.Reserved < amount)
            {
                throw new Exception("insufficient reserved funds");
            }

            balance.Reserved -= amount;
            balance.TotalFeesPaid += amount;
            balance.LastUpdated = Runtime.Time;
            SaveBalance(accountId, balance);

            // Record fee
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
        }

        /// <summary>
        /// Get account balance.
        /// </summary>
        public static Balance GetBalance(ByteString accountId)
        {
            return LoadBalance(accountId);
        }

        /// <summary>
        /// Get fee record by ID.
        /// </summary>
        public static FeeRecord GetFeeRecord(ByteString feeId)
        {
            var data = FeeRecords.Get(feeId);
            if (data is null || data.Length == 0)
            {
                throw new Exception("not found");
            }
            return (FeeRecord)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Check if account has sufficient balance.
        /// </summary>
        public static bool HasSufficientBalance(ByteString accountId, BigInteger amount)
        {
            var balance = LoadBalance(accountId);
            return balance.Available >= amount;
        }

        // Storage helpers

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

        // Authorization helpers

        private static void RequireAccountOwner(ByteString accountId)
        {
            var accountMgr = GetAccountManager();
            if (accountMgr == UInt160.Zero)
            {
                throw new Exception("AccountManager not configured");
            }

            // Call AccountManager to get account owner
            var owner = (UInt160)Contract.Call(accountMgr, "GetOwner", CallFlags.ReadOnly, accountId);
            if (owner is null || !owner.IsValid || !Runtime.CheckWitness(owner))
            {
                throw new Exception("account owner required");
            }
        }

        private static void RequireServiceRunner()
        {
            var sender = (UInt160)Runtime.CallingScriptHash;
            if (!HasRole(sender, RoleServiceRunner) && !HasRole(sender, RoleAdmin))
            {
                throw new Exception("service runner required");
            }
        }

        public static void SetManager(UInt160 hash)
        {
            AssertAdmin();
            if (hash is null || !hash.IsValid)
            {
                throw new Exception("invalid manager");
            }
            Config.Put("manager", hash);
        }

        public static void SetAccountManager(UInt160 hash)
        {
            AssertAdmin();
            if (hash is null || !hash.IsValid)
            {
                throw new Exception("invalid account manager");
            }
            Config.Put("account_manager", hash);
        }

        private static void AssertAdmin()
        {
            var sender = (UInt160)Runtime.CallingScriptHash;
            if (!HasRole(sender, RoleAdmin) && !Runtime.CheckWitness(sender))
            {
                throw new Exception("admin required");
            }
        }

        private static bool HasRole(UInt160 account, byte role)
        {
            var mgr = GetManager();
            if (mgr == UInt160.Zero)
            {
                return Runtime.CheckWitness(account);
            }
            return (bool)Contract.Call(mgr, "HasRole", CallFlags.ReadOnly, account, role);
        }

        private static UInt160 GetManager()
        {
            var data = Config.Get("manager");
            if (data is null || data.Length == 0)
            {
                return UInt160.Zero;
            }
            return (UInt160)data;
        }

        private static UInt160 GetAccountManager()
        {
            var data = Config.Get("account_manager");
            if (data is null || data.Length == 0)
            {
                return UInt160.Zero;
            }
            return (UInt160)data;
        }
    }
}
