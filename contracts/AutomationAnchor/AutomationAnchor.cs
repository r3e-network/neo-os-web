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
    public delegate void TaskRegisteredHandler(ByteString taskId, UInt160 target, string method);
    public delegate void ExecutedHandler(ByteString taskId, BigInteger nonce, ByteString txHash);

    [DisplayName("AutomationAnchor")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "On-chain automation task anchoring with nonce-based anti-replay and GAS deposit pool")]
    [ContractPermission("{0xd2a4cff31913016155e38e474a2c06d08be276cf}", "onNEP17Payment")]
    public class AutomationAnchor : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_UPDATER = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_TASK = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_NONCE = new byte[] { 0x04 };
        private static readonly byte[] PREFIX_EXEC = new byte[] { 0x05 };
        private static readonly byte[] PREFIX_BALANCE = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_SCHEDULE = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_LAST_EXECUTION = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_TASK_OWNER = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_PERIODIC_TASK_COUNTER = new byte[] { 0x24 };

        public struct Task
        {
            public ByteString TaskId;
            public UInt160 Target;
            public string Method;
            public ByteString Trigger;
            public BigInteger GasLimit;
            public bool Enabled;
        }

        public struct ScheduleData
        {
            public string TriggerType;       // "cron" or "interval"
            public string Schedule;          // cron expression or "hourly|daily|weekly|monthly"
            public BigInteger IntervalSeconds; // for custom intervals
            public BigInteger LastExecution;
            public BigInteger NextExecution;
            public bool Paused;
        }

        public struct ExecutionRecord
        {
            public ByteString TaskId;
            public BigInteger Nonce;
            public ByteString TxHash;
            public ulong Timestamp;
        }

        // V1 Events
        [DisplayName("TaskRegistered")]
        public static event TaskRegisteredHandler OnTaskRegistered;

        [DisplayName("Executed")]
        public static event ExecutedHandler OnExecuted;

        // V2 Events - Periodic Tasks
        public delegate void PeriodicTaskRegisteredHandler(BigInteger taskId, UInt160 target, string method, string triggerType, string schedule);
        public delegate void TaskDepositedHandler(BigInteger taskId, UInt160 from, BigInteger amount);
        public delegate void TaskWithdrawnHandler(BigInteger taskId, UInt160 to, BigInteger amount);
        public delegate void PeriodicTaskExecutedHandler(BigInteger taskId, BigInteger fee, BigInteger remainingBalance);
        public delegate void TaskPausedHandler(BigInteger taskId);
        public delegate void TaskResumedHandler(BigInteger taskId);
        public delegate void TaskCancelledHandler(BigInteger taskId, BigInteger refundAmount);

        [DisplayName("PeriodicTaskRegistered")]
        public static event PeriodicTaskRegisteredHandler OnPeriodicTaskRegistered;

        [DisplayName("TaskDeposited")]
        public static event TaskDepositedHandler OnTaskDeposited;

        [DisplayName("TaskWithdrawn")]
        public static event TaskWithdrawnHandler OnTaskWithdrawn;

        [DisplayName("PeriodicTaskExecuted")]
        public static event PeriodicTaskExecutedHandler OnPeriodicTaskExecuted;

        [DisplayName("TaskPaused")]
        public static event TaskPausedHandler OnTaskPaused;

        [DisplayName("TaskResumed")]
        public static event TaskResumedHandler OnTaskResumed;

        [DisplayName("TaskCancelled")]
        public static event TaskCancelledHandler OnTaskCancelled;

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Transaction tx = Runtime.Transaction;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, tx.Sender);
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

        public static void SetUpdater(UInt160 updater)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(updater != null && updater.IsValid, "invalid updater");
            Storage.Put(Storage.CurrentContext, PREFIX_UPDATER, updater);
        }

        public static UInt160 Updater()
        {
            return (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_UPDATER);
        }

        private static void ValidateUpdater()
        {
            UInt160 updater = Updater();
            ExecutionEngine.Assert(updater != null && updater.IsValid, "updater not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(updater), "unauthorized");
        }

        private static StorageMap TaskMap() => new StorageMap(Storage.CurrentContext, PREFIX_TASK);
        private static StorageMap NonceMap() => new StorageMap(Storage.CurrentContext, PREFIX_NONCE);
        private static StorageMap ExecMap() => new StorageMap(Storage.CurrentContext, PREFIX_EXEC);
        private static StorageMap BalanceMap() => new StorageMap(Storage.CurrentContext, PREFIX_BALANCE);
        private static StorageMap ScheduleMap() => new StorageMap(Storage.CurrentContext, PREFIX_SCHEDULE);
        private static StorageMap LastExecutionMap() => new StorageMap(Storage.CurrentContext, PREFIX_LAST_EXECUTION);
        private static StorageMap TaskOwnerMap() => new StorageMap(Storage.CurrentContext, PREFIX_TASK_OWNER);

        public static Task GetTask(ByteString taskId)
        {
            ExecutionEngine.Assert(taskId != null && taskId.Length > 0, "taskId required");
            ByteString raw = TaskMap().Get(taskId);
            if (raw == null)
            {
                // Avoid returning `default` struct which may be represented as an empty VMArray.
                return new Task
                {
                    TaskId = (ByteString)"",
                    Target = null,
                    Method = "",
                    Trigger = (ByteString)"",
                    GasLimit = 0,
                    Enabled = false
                };
            }
            return (Task)StdLib.Deserialize(raw);
        }

        public static void RegisterTask(ByteString taskId, UInt160 target, string method, ByteString trigger, BigInteger gasLimit, bool enabled)
        {
            ValidateAdmin();

            ExecutionEngine.Assert(taskId != null && taskId.Length > 0, "taskId required");
            ExecutionEngine.Assert(target != null && target.IsValid, "target required");
            ExecutionEngine.Assert(method != null && method.Length > 0, "method required");
            ExecutionEngine.Assert(gasLimit >= 0, "invalid gasLimit");

            Task t = new Task
            {
                TaskId = taskId,
                Target = target,
                Method = method,
                Trigger = trigger ?? (ByteString)"",
                GasLimit = gasLimit,
                Enabled = enabled
            };
            TaskMap().Put(taskId, StdLib.Serialize(t));
            OnTaskRegistered(taskId, target, method);
        }

        public static bool IsNonceUsed(ByteString taskId, BigInteger nonce)
        {
            byte[] key = Helper.Concat((byte[])taskId, nonce.ToByteArray());
            return NonceMap().Get(key) != null;
        }

        public static void MarkExecuted(ByteString taskId, BigInteger nonce, ByteString txHash)
        {
            ValidateUpdater();

            Task t = GetTask(taskId);
            ExecutionEngine.Assert(t.TaskId != null && t.TaskId.Length > 0, "task not found");
            ExecutionEngine.Assert(t.Enabled, "task disabled");
            ExecutionEngine.Assert(nonce >= 0, "invalid nonce");
            ExecutionEngine.Assert(txHash != null && txHash.Length > 0, "txHash required");

            byte[] nonceKey = Helper.Concat((byte[])taskId, nonce.ToByteArray());
            ExecutionEngine.Assert(NonceMap().Get(nonceKey) == null, "nonce already used");
            NonceMap().Put(nonceKey, 1);

            ExecutionRecord rec = new ExecutionRecord
            {
                TaskId = taskId,
                Nonce = nonce,
                TxHash = txHash,
                Timestamp = Runtime.Time
            };
            ExecMap().Put(nonceKey, StdLib.Serialize(rec));
            OnExecuted(taskId, nonce, txHash);
        }

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != null && newAdmin.IsValid, "invalid admin");
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
        }

        // ========== V2 Periodic Task Methods ==========

        /// <summary>
        /// Register a new periodic automation task with GAS deposit pool.
        /// </summary>
        /// <param name="target">Target contract address to invoke</param>
        /// <param name="method">Method name to call on target contract</param>
        /// <param name="triggerType">"cron" or "interval"</param>
        /// <param name="schedule">Cron expression (e.g., "0 0 * * *") or interval ("hourly", "daily", "weekly", "monthly")</param>
        /// <param name="gasLimit">Gas limit per execution</param>
        /// <returns>taskId - unique identifier for the periodic task</returns>
        public static BigInteger RegisterPeriodicTask(UInt160 target, string method, string triggerType, string schedule, BigInteger gasLimit)
        {
            Transaction tx = Runtime.Transaction;
            ExecutionEngine.Assert(Runtime.CheckWitness(tx.Sender), "unauthorized");

            ExecutionEngine.Assert(target != null && target.IsValid, "invalid target");
            ExecutionEngine.Assert(Runtime.CheckWitness(target), "target witness required");
            ExecutionEngine.Assert(method != null && method.Length > 0, "method required");
            ExecutionEngine.Assert(gasLimit > 0, "gasLimit must be > 0");
            ExecutionEngine.Assert(triggerType == "cron" || triggerType == "interval", "triggerType must be 'cron' or 'interval'");
            ExecutionEngine.Assert(schedule != null && schedule.Length > 0, "schedule required");

            // Generate unique task ID
            BigInteger taskId = GetNextPeriodicTaskId();

            // Store task owner for authorization checks
            TaskOwnerMap().Put(taskId.ToByteArray(), tx.Sender);

            // Calculate interval seconds based on schedule
            BigInteger intervalSeconds = 0;
            if (triggerType == "interval")
            {
                intervalSeconds = ParseIntervalSchedule(schedule);
            }

            // Create schedule data
            ScheduleData scheduleData = new ScheduleData
            {
                TriggerType = triggerType,
                Schedule = schedule,
                IntervalSeconds = intervalSeconds,
                LastExecution = 0,
                NextExecution = CalculateNextExecution(triggerType, schedule, 0, intervalSeconds),
                Paused = false
            };

            // Store schedule
            ScheduleMap().Put(taskId.ToByteArray(), StdLib.Serialize(scheduleData));

            // Initialize balance to 0
            BalanceMap().Put(taskId.ToByteArray(), 0);

            // Emit event
            OnPeriodicTaskRegistered(taskId, target, method, triggerType, schedule);

            return taskId;
        }

        /// <summary>
        /// Cancel a periodic task and refund remaining GAS balance to owner.
        /// </summary>
        /// <param name="taskId">Task identifier</param>
        public static void CancelPeriodicTask(BigInteger taskId)
        {
            ValidateTaskOwner(taskId);

            // Get owner before deleting task data
            UInt160 owner = GetTaskOwner(taskId);

            // Get remaining balance
            BigInteger balance = BalanceOf(taskId);

            // Delete all task data
            ScheduleMap().Delete(taskId.ToByteArray());
            LastExecutionMap().Delete(taskId.ToByteArray());
            TaskOwnerMap().Delete(taskId.ToByteArray());
            BalanceMap().Delete(taskId.ToByteArray());

            // Refund balance if any
            if (balance > 0)
            {
                // Transfer GAS back to owner
                bool ok = GAS.Transfer(Runtime.ExecutingScriptHash, owner, balance, null);
                ExecutionEngine.Assert(ok, "refund transfer failed");
            }

            OnTaskCancelled(taskId, balance);
        }

        /// <summary>
        /// Pause a periodic task (stops automatic execution).
        /// </summary>
        /// <param name="taskId">Task identifier</param>
        public static void PauseTask(BigInteger taskId)
        {
            ValidateTaskOwner(taskId);

            ScheduleData schedule = GetSchedule(taskId);
            ExecutionEngine.Assert(!schedule.Paused, "task already paused");

            schedule.Paused = true;
            StoreSchedule(taskId, schedule);

            OnTaskPaused(taskId);
        }

        /// <summary>
        /// Resume a paused periodic task.
        /// </summary>
        /// <param name="taskId">Task identifier</param>
        public static void ResumeTask(BigInteger taskId)
        {
            ValidateTaskOwner(taskId);

            ScheduleData schedule = GetSchedule(taskId);
            ExecutionEngine.Assert(schedule.Paused, "task not paused");

            schedule.Paused = false;
            // Recalculate next execution from current time
            schedule.NextExecution = CalculateNextExecution(schedule.TriggerType, schedule.Schedule, Runtime.Time, schedule.IntervalSeconds);
            StoreSchedule(taskId, schedule);

            OnTaskResumed(taskId);
        }

        /// <summary>
        /// Deposit GAS into a task's balance pool. Can be called directly or via NEP17 payment callback.
        /// </summary>
        /// <param name="taskId">Task identifier</param>
        public static void Deposit(BigInteger taskId)
        {
            // This method is kept for explicit deposit calls
            // Actual deposits should use OnNEP17Payment with taskId in data field
            throw new Exception("Use GAS.transfer with taskId in data field");
        }

        /// <summary>
        /// Withdraw GAS from a task's balance pool.
        /// </summary>
        /// <param name="taskId">Task identifier</param>
        /// <param name="amount">Amount to withdraw</param>
        public static void Withdraw(BigInteger taskId, BigInteger amount)
        {
            ValidateTaskOwner(taskId);
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            BigInteger balance = BalanceOf(taskId);
            ExecutionEngine.Assert(balance >= amount, "insufficient balance");

            BigInteger newBalance = balance - amount;
            BalanceMap().Put(taskId.ToByteArray(), newBalance);

            UInt160 owner = GetTaskOwner(taskId);
            bool ok = GAS.Transfer(Runtime.ExecutingScriptHash, owner, amount, null);
            ExecutionEngine.Assert(ok, "withdraw transfer failed");

            OnTaskWithdrawn(taskId, owner, amount);
        }

        /// <summary>
        /// Get the GAS balance for a task.
        /// </summary>
        /// <param name="taskId">Task identifier</param>
        /// <returns>GAS balance</returns>
        public static BigInteger BalanceOf(BigInteger taskId)
        {
            ByteString balanceBytes = BalanceMap().Get(taskId.ToByteArray());
            if (balanceBytes == null) return 0;
            return (BigInteger)balanceBytes;
        }

        /// <summary>
        /// Execute a periodic task. Called by the updater service at scheduled intervals.
        /// Deducts GAS fee from task balance before invoking target contract.
        /// </summary>
        /// <param name="taskId">Task identifier</param>
        /// <param name="payload">Arbitrary payload data to pass to target contract</param>
        public static void ExecutePeriodicTask(BigInteger taskId, ByteString payload)
        {
            ValidateUpdater();

            // Get schedule data
            ScheduleData schedule = GetSchedule(taskId);
            ExecutionEngine.Assert(!schedule.Paused, "task is paused");

            // Check balance and calculate fee
            BigInteger balance = BalanceOf(taskId);
            // Fee model: Fixed 1 GAS per execution
            // Architecture decision: Gas price calculation delegated to off-chain updater service
            // which has access to real-time network gas prices
            BigInteger fee = 1;

            ExecutionEngine.Assert(balance >= fee, "insufficient balance for execution");

            // Deduct fee from balance
            BigInteger newBalance = balance - fee;
            BalanceMap().Put(taskId.ToByteArray(), newBalance);

            // Update execution timestamp
            BigInteger currentTime = Runtime.Time;
            schedule.LastExecution = currentTime;
            schedule.NextExecution = CalculateNextExecution(schedule.TriggerType, schedule.Schedule, currentTime, schedule.IntervalSeconds);
            StoreSchedule(taskId, schedule);
            LastExecutionMap().Put(taskId.ToByteArray(), currentTime);

            // Architecture: Target contract invocation handled by off-chain updater service
            // This design separates scheduling (on-chain) from execution (off-chain TEE)
            // Benefits: Lower gas costs, flexible execution logic, TEE security guarantees

            OnPeriodicTaskExecuted(taskId, fee, newBalance);
        }

        /// <summary>
        /// NEP17 payment callback - accepts GAS deposits for tasks.
        /// </summary>
        /// <param name="from">Sender address</param>
        /// <param name="amount">GAS amount</param>
        /// <param name="data">Should contain taskId as BigInteger</param>
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            // Only accept GAS tokens
            if (Runtime.CallingScriptHash != GAS.Hash)
            {
                throw new Exception("Only GAS accepted");
            }

            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            // Ignore sender-side hooks during outbound transfers
            if (from == Runtime.ExecutingScriptHash) return;

            // Data must contain taskId
            ExecutionEngine.Assert(data != null, "taskId required in data field");

            BigInteger taskId;
            try
            {
                taskId = (BigInteger)data;
            }
            catch
            {
                throw new Exception("data must be taskId as BigInteger");
            }

            // Verify task exists by checking if it has a schedule
            ByteString scheduleBytes = ScheduleMap().Get(taskId.ToByteArray());
            ExecutionEngine.Assert(scheduleBytes != null, "task not found");

            // Add to task balance
            BigInteger currentBalance = BalanceOf(taskId);
            BigInteger newBalance = currentBalance + amount;
            BalanceMap().Put(taskId.ToByteArray(), newBalance);

            OnTaskDeposited(taskId, from, amount);
        }

        // ========== Helper Methods ==========

        /// <summary>
        /// Get the next available periodic task ID.
        /// </summary>
        private static BigInteger GetNextPeriodicTaskId()
        {
            ByteString counterBytes = Storage.Get(Storage.CurrentContext, PREFIX_PERIODIC_TASK_COUNTER);
            BigInteger counter = counterBytes == null ? 1 : (BigInteger)counterBytes + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_PERIODIC_TASK_COUNTER, counter);
            return counter;
        }

        /// <summary>
        /// Get schedule data for a task.
        /// </summary>
        private static ScheduleData GetSchedule(BigInteger taskId)
        {
            ByteString scheduleBytes = ScheduleMap().Get(taskId.ToByteArray());
            ExecutionEngine.Assert(scheduleBytes != null, "task not found");
            return (ScheduleData)StdLib.Deserialize(scheduleBytes);
        }

        /// <summary>
        /// Store schedule data for a task.
        /// </summary>
        private static void StoreSchedule(BigInteger taskId, ScheduleData schedule)
        {
            ScheduleMap().Put(taskId.ToByteArray(), StdLib.Serialize(schedule));
        }

        /// <summary>
        /// Get the owner of a task.
        /// </summary>
        private static UInt160 GetTaskOwner(BigInteger taskId)
        {
            ByteString ownerBytes = TaskOwnerMap().Get(taskId.ToByteArray());
            ExecutionEngine.Assert(ownerBytes != null, "task owner not found");
            return (UInt160)ownerBytes;
        }

        /// <summary>
        /// Validate that the caller is the task owner.
        /// </summary>
        private static void ValidateTaskOwner(BigInteger taskId)
        {
            UInt160 owner = GetTaskOwner(taskId);
            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "unauthorized: not task owner");
        }

        /// <summary>
        /// Parse interval schedule string into seconds.
        /// Supported: "hourly", "daily", "weekly", "monthly", or numeric seconds as string.
        /// </summary>
        private static BigInteger ParseIntervalSchedule(string schedule)
        {
            if (schedule == "hourly") return 3600;      // 1 hour in seconds
            if (schedule == "daily") return 86400;      // 24 hours in seconds
            if (schedule == "weekly") return 604800;    // 7 days in seconds
            if (schedule == "monthly") return 2592000;  // 30 days in seconds

            // Try to parse as numeric seconds
            // Neo N3 doesn't have built-in string to int conversion, so we'll validate format
            // For simplicity, we'll reject unknown formats
            throw new Exception("Invalid interval schedule. Use: hourly, daily, weekly, monthly");
        }

        /// <summary>
        /// Calculate next execution timestamp based on trigger type and schedule.
        /// For interval triggers, adds interval to lastExecution (or current time if lastExecution is 0).
        /// For cron triggers, returns default 24h interval (actual cron parsing handled by off-chain TEE service).
        /// </summary>
        /// <param name="triggerType">"cron" or "interval"</param>
        /// <param name="schedule">Schedule expression</param>
        /// <param name="lastExecution">Last execution timestamp (0 if never executed)</param>
        /// <param name="intervalSeconds">Pre-calculated interval in seconds (for interval type)</param>
        /// <returns>Next execution timestamp in seconds</returns>
        private static BigInteger CalculateNextExecution(string triggerType, string schedule, BigInteger lastExecution, BigInteger intervalSeconds)
        {
            if (triggerType == "interval")
            {
                BigInteger baseTime = lastExecution > 0 ? lastExecution : Runtime.Time;
                return baseTime + intervalSeconds;
            }
            else if (triggerType == "cron")
            {
                // Cron expression parsing delegated to off-chain TEE updater service
                // On-chain stores schedule string; TEE calculates actual execution times
                // Default fallback: 24 hours from current time (in seconds)
                return Runtime.Time + 86400;
            }

            throw new Exception("Invalid trigger type");
        }

        public static void Update(ByteString nefFile, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nefFile, manifest, null);
        }
    }
}
