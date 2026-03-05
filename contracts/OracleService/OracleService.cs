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
    // Emitted when a user/miniapp requests external data via the oracle
    public delegate void OracleRequestedHandler(UInt160 user, string requestId, string url, string method, string headers, string body, string jsonPath);

    // Emitted when the TEE successfully fetches and fulfills the oracle request
    public delegate void OracleFulfilledHandler(string requestId, int statusCode, string value, ByteString attestationHash, ulong timestamp);

    [DisplayName("OracleService")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "On-chain request-response Oracle Service with TEE attestation")]
    public class OracleService : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_GATEWAY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_REQUESTS = new byte[] { 0x03 };

        public struct OracleRequest
        {
            public UInt160 User;
            public string Url;
            public ulong Timestamp;
            public bool IsFulfilled;
            public string Value;
            public ByteString AttestationHash;
        }

        [DisplayName("OracleRequested")]
        public static event OracleRequestedHandler OnOracleRequested;

        [DisplayName("OracleFulfilled")]
        public static event OracleFulfilledHandler OnOracleFulfilled;

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

        public static void SetGateway(UInt160 gateway)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "invalid gateway");
            Storage.Put(Storage.CurrentContext, PREFIX_GATEWAY, gateway);
        }

        public static UInt160 Gateway()
        {
            return (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_GATEWAY);
        }

        private static void ValidateGateway()
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(gateway), "unauthorized");
        }

        private static StorageMap RequestMap() => new StorageMap(Storage.CurrentContext, PREFIX_REQUESTS);

        /// <summary>
        /// Request external data. This emits an event picked up by the platform indexer,
        /// which forwards it to the NeoOracle TEE service.
        /// </summary>
        public static void Request(string requestId, string url, string method, string headers, string body, string jsonPath)
        {
            ExecutionEngine.Assert(requestId != null && requestId.Length > 0, "requestId required");
            ExecutionEngine.Assert(url != null && url.Length > 0, "url required");

            Transaction tx = Runtime.Transaction;
            
            // Store pending request
            OracleRequest req = new OracleRequest
            {
                User = tx.Sender,
                Url = url,
                Timestamp = Runtime.Time,
                IsFulfilled = false,
                Value = "",
                AttestationHash = (ByteString)""
            };
            
            RequestMap().Put(requestId, StdLib.Serialize(req));
            
            // Emit event for off-chain TEE to pick up
            OnOracleRequested(tx.Sender, requestId, url, method, headers, body, jsonPath);
        }

        public static OracleRequest GetRequest(string requestId)
        {
            ByteString raw = RequestMap().Get(requestId);
            if (raw == null)
            {
                return new OracleRequest
                {
                    User = UInt160.Zero,
                    Url = "",
                    Timestamp = 0,
                    IsFulfilled = false,
                    Value = "",
                    AttestationHash = (ByteString)""
                };
            }
            return (OracleRequest)StdLib.Deserialize(raw);
        }

        /// <summary>
        /// Fulfill the request. Only the attested TEE gateway can call this method.
        /// </summary>
        public static void Fulfill(string requestId, int statusCode, string value, ByteString attestationHash)
        {
            ValidateGateway();

            ExecutionEngine.Assert(requestId != null && requestId.Length > 0, "requestId required");
            ExecutionEngine.Assert(attestationHash != null && attestationHash.Length > 0, "attestation hash required");

            StorageMap map = RequestMap();
            ByteString raw = map.Get(requestId);
            ExecutionEngine.Assert(raw != null, "request not found");

            OracleRequest req = (OracleRequest)StdLib.Deserialize(raw);
            ExecutionEngine.Assert(!req.IsFulfilled, "request already fulfilled");

            req.IsFulfilled = true;
            req.Value = value;
            req.AttestationHash = attestationHash;

            map.Put(requestId, StdLib.Serialize(req));
            
            OnOracleFulfilled(requestId, statusCode, value, attestationHash, Runtime.Time);
        }

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != null && newAdmin.IsValid, "invalid admin");
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
        }

        public static void UpdateContract(ByteString nefFile, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nefFile, manifest, null);
        }
    }
}
