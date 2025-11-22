using System;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace ServiceLayer.Contracts
{
    // ServiceRegistry tracks services, versions, and capability flags.
    public class ServiceRegistry : SmartContract
    {
        private static readonly StorageMap Services = new(Storage.CurrentContext, "svc:");
        private static readonly StorageMap Config = new(Storage.CurrentContext, "cfg:");

        private const byte RoleAdmin = 0x01;

        public static event Action<ByteString, UInt160, byte> ServiceRegistered;
        public static event Action<ByteString, byte> ServiceUpdated;
        public static event Action<ByteString, bool> ServicePaused;

        public struct Service
        {
            public ByteString Id;
            public UInt160 Owner;
            public byte Version;
            public ByteString CodeHash;   // off-chain artifact hash
            public ByteString ConfigHash; // off-chain config hash
            public byte Capabilities;     // bit flags for modules allowed
            public bool Paused;
        }

        public static void Register(ByteString id, UInt160 owner, byte version, ByteString codeHash, ByteString configHash, byte capabilities)
        {
            RequireOwner(owner);
            if (id is null || id.Length == 0) throw new Exception("missing id");
            if (Services.Get(id) is not null) throw new Exception("exists");
            var svc = new Service
            {
                Id = id,
                Owner = owner,
                Version = version,
                CodeHash = codeHash,
                ConfigHash = configHash,
                Capabilities = capabilities,
                Paused = false
            };
            Services.Put(id, StdLib.Serialize(svc));
            ServiceRegistered(id, owner, capabilities);
        }

        public static void Update(ByteString id, byte version, ByteString codeHash, ByteString configHash, byte capabilities)
        {
            var svc = Load(id);
            RequireOwner(svc.Owner);
            svc.Version = version;
            if (codeHash is not null && codeHash.Length > 0) svc.CodeHash = codeHash;
            if (configHash is not null && configHash.Length > 0) svc.ConfigHash = configHash;
            svc.Capabilities = capabilities;
            Services.Put(id, StdLib.Serialize(svc));
            ServiceUpdated(id, version);
        }

        public static void Pause(ByteString id, bool flag)
        {
            var svc = Load(id);
            RequireOwner(svc.Owner);
            svc.Paused = flag;
            Services.Put(id, StdLib.Serialize(svc));
            ServicePaused(id, flag);
        }

        public static Service Get(ByteString id)
        {
            return Load(id);
        }

        private static Service Load(ByteString id)
        {
            var data = Services.Get(id);
            if (data is null || data.Length == 0) throw new Exception("not found");
            return (Service)StdLib.Deserialize(data);
        }

        private static void RequireOwner(UInt160 owner)
        {
            if (owner is null || !owner.IsValid || (!Runtime.CheckWitness(owner) && !HasRole(owner, RoleAdmin)))
            {
                throw new Exception("owner required");
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
