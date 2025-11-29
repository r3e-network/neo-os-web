using System;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace ServiceLayer.Contracts
{
    // OracleHub registers requests and marks fulfillment; off-chain runner handles HTTP.
    public class OracleHub : SmartContract
    {
        private static readonly StorageMap Requests = new(Storage.CurrentContext, "req:");
        private static readonly StorageMap Config = new(Storage.CurrentContext, "cfg:");

        private const byte RoleOracleRunner = 0x04;

        public static event Action<ByteString, ByteString, long> OracleRequested;
        public static event Action<ByteString, ByteString> OracleFulfilled;

        public struct Request
        {
            public ByteString Id;
            public ByteString ServiceId;
            public ByteString PayloadHash;
            public long Fee;
            public byte Status; // 0=pending,1=fulfilled,2=failed
            public BigInteger RequestedAt;
            public BigInteger FulfilledAt;
            public ByteString ResultHash;
        }

        public static void SubmitRequest(ByteString id, ByteString serviceId, ByteString payloadHash, long fee)
        {
            if (id is null || id.Length == 0) throw new Exception("missing id");
            if (Requests.Get(id) is not null) throw new Exception("exists");
            var req = new Request
            {
                Id = id,
                ServiceId = serviceId,
                PayloadHash = payloadHash,
                Fee = fee,
                Status = 0,
                RequestedAt = Runtime.Time
            };
            Requests.Put(id, StdLib.Serialize(req));
            OracleRequested(id, serviceId, fee);
        }

        public static void Fulfill(ByteString id, ByteString resultHash, byte status)
        {
            var req = Load(id);
            RequireRunner();
            req.Status = status;
            req.ResultHash = resultHash;
            req.FulfilledAt = Runtime.Time;
            Requests.Put(id, StdLib.Serialize(req));
            OracleFulfilled(id, resultHash);
        }

        public static Request Get(ByteString id)
        {
            return Load(id);
        }

        private static Request Load(ByteString id)
        {
            var data = Requests.Get(id);
            if (data is null || data.Length == 0) throw new Exception("not found");
            return (Request)StdLib.Deserialize(data);
        }

        private static void RequireRunner()
        {
            var sender = (UInt160)Runtime.CallingScriptHash;
            if (!HasRole(sender, RoleOracleRunner) && !Runtime.CheckWitness(sender))
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
