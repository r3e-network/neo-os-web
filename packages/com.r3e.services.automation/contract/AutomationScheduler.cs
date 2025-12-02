using System;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace ServiceLayer.Contracts
{
    /// <summary>
    /// AutomationScheduler stores cron/spec jobs and signals when due.
    /// Inherits from ServiceContractBase for standardized request lifecycle and TEE integration.
    ///
    /// Request Types:
    /// - 0x01: Cron job
    /// - 0x02: Interval job
    /// - 0x03: One-time job
    /// </summary>
    public class AutomationScheduler : ServiceContractBase
    {
        // Service-specific storage
        private static readonly StorageMap Jobs = new(Storage.CurrentContext, "job:");
        private static readonly StorageMap JobExecutions = new(Storage.CurrentContext, "exec:");

        // Request types
        public const byte RequestTypeCron = 0x01;
        public const byte RequestTypeInterval = 0x02;
        public const byte RequestTypeOneTime = 0x03;

        // Job status
        public const byte JobStatusActive = 0x00;
        public const byte JobStatusCompleted = 0x01;
        public const byte JobStatusPaused = 0x02;
        public const byte JobStatusCancelled = 0x03;

        // Events
        public static event Action<ByteString, ByteString> JobCreated;
        public static event Action<ByteString> JobDue;
        public static event Action<ByteString, byte> JobCompleted;
        public static event Action<ByteString, ByteString, BigInteger> JobExecuted;

        public struct Job
        {
            public ByteString Id;
            public ByteString ServiceId;
            public string Spec;
            public ByteString PayloadHash;
            public int MaxRuns;
            public int Runs;
            public BigInteger NextRun;
            public byte Status;
            public ByteString CallbackHash;
            public ByteString CallbackMethod;
            public BigInteger CreatedAt;
        }

        public struct JobExecution
        {
            public ByteString ExecutionId;
            public ByteString JobId;
            public BigInteger ExecutedAt;
            public byte Status;
            public ByteString ResultHash;
            public ByteString EnclaveKeyId;
        }

        // ============================================================
        // ServiceContractBase Implementation
        // ============================================================

        protected override ByteString GetServiceId()
        {
            return (ByteString)"com.r3e.services.automation";
        }

        protected override byte GetRequiredRole()
        {
            return RoleScheduler;
        }

        protected override bool ValidateRequest(byte requestType, ByteString payload)
        {
            if (requestType != RequestTypeCron &&
                requestType != RequestTypeInterval &&
                requestType != RequestTypeOneTime)
            {
                return false;
            }
            return payload is not null && payload.Length > 0;
        }

        // ============================================================
        // Public API
        // ============================================================

        /// <summary>
        /// Create a new automation job.
        /// </summary>
        public static ByteString CreateJob(
            ByteString id,
            string spec,
            ByteString payloadHash,
            int maxRuns,
            BigInteger nextRun,
            ByteString callbackHash,
            ByteString callbackMethod)
        {
            if (id is null || id.Length == 0)
            {
                throw new Exception("Job ID required");
            }
            if (Jobs.Get(id) is not null)
            {
                throw new Exception("Job already exists");
            }

            var job = new Job
            {
                Id = id,
                ServiceId = (ByteString)"com.r3e.services.automation",
                Spec = spec,
                PayloadHash = payloadHash,
                MaxRuns = maxRuns,
                Runs = 0,
                NextRun = nextRun,
                Status = JobStatusActive,
                CallbackHash = callbackHash,
                CallbackMethod = callbackMethod,
                CreatedAt = Runtime.Time
            };

            Jobs.Put(id, StdLib.Serialize(job));
            JobCreated(id, (ByteString)"com.r3e.services.automation");

            return id;
        }

        /// <summary>
        /// Mark a job as due for execution.
        /// </summary>
        public static void MarkDue(ByteString id)
        {
            RequireRole(RoleScheduler);

            var job = LoadJob(id);
            if (job.Status != JobStatusActive)
            {
                throw new Exception("Job not active");
            }

            JobDue(id);
        }

        /// <summary>
        /// Complete a job execution with enclave verification.
        /// </summary>
        public static void CompleteExecution(
            ByteString jobId,
            byte status,
            BigInteger nextRun,
            ByteString resultHash,
            ByteString signature,
            ByteString enclaveKeyId)
        {
            RequireRole(RoleScheduler);

            var job = LoadJob(jobId);
            job.Runs += 1;
            job.NextRun = nextRun;

            // Check if job should be marked as completed
            if (job.MaxRuns > 0 && job.Runs >= job.MaxRuns)
            {
                job.Status = JobStatusCompleted;
            }
            else
            {
                job.Status = status;
            }

            Jobs.Put(jobId, StdLib.Serialize(job));

            // Record execution
            var execId = CryptoLib.Sha256(StdLib.Serialize(new object[] { jobId, Runtime.Time }));
            var execution = new JobExecution
            {
                ExecutionId = (ByteString)execId,
                JobId = jobId,
                ExecutedAt = Runtime.Time,
                Status = status,
                ResultHash = resultHash,
                EnclaveKeyId = enclaveKeyId
            };
            JobExecutions.Put((ByteString)execId, StdLib.Serialize(execution));

            JobCompleted(jobId, status);
            JobExecuted(jobId, (ByteString)execId, Runtime.Time);
        }

        /// <summary>
        /// Pause a job.
        /// </summary>
        public static void PauseJob(ByteString id)
        {
            RequireAdmin();

            var job = LoadJob(id);
            if (job.Status != JobStatusActive)
            {
                throw new Exception("Job not active");
            }

            job.Status = JobStatusPaused;
            Jobs.Put(id, StdLib.Serialize(job));
        }

        /// <summary>
        /// Resume a paused job.
        /// </summary>
        public static void ResumeJob(ByteString id)
        {
            RequireAdmin();

            var job = LoadJob(id);
            if (job.Status != JobStatusPaused)
            {
                throw new Exception("Job not paused");
            }

            job.Status = JobStatusActive;
            Jobs.Put(id, StdLib.Serialize(job));
        }

        /// <summary>
        /// Cancel a job.
        /// </summary>
        public static void CancelJob(ByteString id)
        {
            RequireAdmin();

            var job = LoadJob(id);
            job.Status = JobStatusCancelled;
            Jobs.Put(id, StdLib.Serialize(job));
        }

        /// <summary>
        /// Get job by ID.
        /// </summary>
        public static Job GetJob(ByteString id)
        {
            return LoadJob(id);
        }

        /// <summary>
        /// Get job execution by ID.
        /// </summary>
        public static JobExecution GetExecution(ByteString execId)
        {
            var data = JobExecutions.Get(execId);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Execution not found");
            }
            return (JobExecution)StdLib.Deserialize(data);
        }

        // ============================================================
        // Helper Methods
        // ============================================================

        private static Job LoadJob(ByteString id)
        {
            var data = Jobs.Get(id);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Job not found");
            }
            return (Job)StdLib.Deserialize(data);
        }
    }
}
