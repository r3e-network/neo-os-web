using System;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace ServiceLayer.Contracts
{
    // SecretsVault stores references to secrets (never plaintext) with ACL bits.
    public class SecretsVault : SmartContract
    {
        private static readonly StorageMap Secrets = new(Storage.CurrentContext, "sec:");

        public static event Action<ByteString, UInt160, byte> SecretStored;
        public static event Action<ByteString, UInt160> SecretAccessed;

        public struct Secret
        {
            public ByteString Id;
            public UInt160 Owner;
            public ByteString RefHash; // reference to encrypted secret off-chain
            public byte ACL;           // bit flags (e.g., allow oracle/automation/jam)
        }

        public static void Store(ByteString id, UInt160 owner, ByteString refHash, byte acl)
        {
            RequireOwner(owner);
            if (id is null || id.Length == 0) throw new Exception("missing id");
            var secret = new Secret
            {
                Id = id,
                Owner = owner,
                RefHash = refHash,
                ACL = acl
            };
            Secrets.Put(id, StdLib.Serialize(secret));
            SecretStored(id, owner, acl);
        }

        public static Secret Get(ByteString id)
        {
            var data = Secrets.Get(id);
            if (data is null || data.Length == 0) throw new Exception("not found");
            var secret = (Secret)StdLib.Deserialize(data);
            SecretAccessed(id, secret.Owner);
            return secret;
        }

        private static void RequireOwner(UInt160 owner)
        {
            if (owner is null || !owner.IsValid || !Runtime.CheckWitness(owner))
            {
                throw new Exception("owner required");
            }
        }
    }
}
