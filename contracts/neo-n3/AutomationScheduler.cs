using System;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace ServiceLayer.Contracts
{
    // AutomationScheduler stores cron/spec jobs and signals when due.
    public class AutomationScheduler : SmartContract
    {
        private static readonly StorageMap Jobs = new(Storage.CurrentContext, "job:");
        private static readonly StorageMap Config = new(Storage.CurrentContext, "cfg:");

        private const byte RoleScheduler = 0x02;

        public static event Action<ByteString, ByteString> JobCreated;
        public static event Action<ByteString> JobDue;
        public static event Action<ByteString, byte> JobCompleted;

        public struct Job
        {
            public ByteString Id;
            public ByteString ServiceId;
            public string Spec; // cron or interval string
            public ByteString PayloadHash;
            public int MaxRuns;
            public int Runs;
            public BigInteger NextRun;
            public byte Status; // 0=active,1=completed,2=paused
        }

        public static void CreateJob(ByteString id, ByteString serviceId, string spec, ByteString payloadHash, int maxRuns, BigInteger nextRun)
        {
            RequireOwner();
            if (id is null || id.Length == 0) throw new Exception("missing id");
            if (Jobs.Get(id) is not null) throw new Exception("exists");
            var job = new Job
            {
                Id = id,
                ServiceId = serviceId,
                Spec = spec,
                PayloadHash = payloadHash,
                MaxRuns = maxRuns,
                Runs = 0,
                NextRun = nextRun,
                Status = 0
            };
            Jobs.Put(id, StdLib.Serialize(job));
            JobCreated(id, serviceId);
        }

        public static void MarkDue(ByteString id)
        {
            RequireRunner();
            var job = Load(id);
            if (job.Status != 0) throw new Exception("inactive");
            JobDue(id);
        }

        public static void Complete(ByteString id, byte status, BigInteger nextRun)
        {
            RequireRunner();
            var job = Load(id);
            job.Runs += 1;
            job.Status = status;
            job.NextRun = nextRun;
            Jobs.Put(id, StdLib.Serialize(job));
            JobCompleted(id, status);
        }

        public static Job GetJob(ByteString id) => Load(id);

        private static Job Load(ByteString id)
        {
            var data = Jobs.Get(id);
            if (data is null || data.Length == 0) throw new Exception("not found");
            return (Job)StdLib.Deserialize(data);
        }

        private static void RequireOwner()
        {
            var sender = (UInt160)Runtime.CallingScriptHash;
            if (!HasRole(sender, RoleScheduler) && !Runtime.CheckWitness(sender))
            {
                throw new Exception("owner required");
            }
        }

        private static void RequireRunner()
        {
            var sender = (UInt160)Runtime.CallingScriptHash;
            if (!HasRole(sender, RoleScheduler) && !Runtime.CheckWitness(sender))
            {
                throw new Exception("runner required");
            }
        }

        public static void SetManager(UInt160 hash)
        {
            if (hash is null || !hash.IsValid) throw new Exception("invalid manager");
            if (!Runtime.CheckWitness(hash)) throw new Exception("manager auth required");
            Config.Put("manager", hash);
        }

        private static bool HasRole(UInt160 account, byte role)
        {
            var mgr = GetManager();
            if (mgr == UInt160.Zero) return Runtime.CheckWitness(account);
            return (bool)Contract.Call(mgr, "HasRole", CallFlags.ReadOnly, account, role);
        }

        private static UInt160 GetManager()
        {
            var data = Config.Get("manager");
            if (data is null || data.Length == 0) return UInt160.Zero;
            return (UInt160)data;
        }
    }
}
