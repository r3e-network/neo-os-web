using System;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace ServiceLayer.Contracts
{
    /// <summary>
    /// EnclaveRegistry manages TEE enclave identity and service script verification.
    /// This is a Service Layer level contract that tracks:
    /// - Master accounts (enclave identity)
    /// - Service enclaves (script hash registry)
    ///
    /// Architecture:
    /// 1. Master Account Generation
    ///    - Enclave generates master keypair on first boot
    ///    - Master public key registered to this contract
    ///    - Master key used to sign service registrations
    ///
    /// 2. Service Enclave Registration
    ///    - Service script loaded into enclave engine
    ///    - Script content hashed (SHA256)
    ///    - (ServiceId, ScriptHash) registered to contract
    ///
    /// 3. Execution Verification
    ///    - Before execution, script is hashed
    ///    - Hash compared against registered hash
    ///    - Execution proceeds only if hashes match
    ///
    /// 4. Service Update
    ///    - Explicit update call required
    ///    - New script hash computed and registered
    ///    - Version incremented
    /// </summary>
    public class EnclaveRegistry : SmartContract
    {
        // ============================================================
        // Storage Maps
        // ============================================================

        private static readonly StorageMap MasterAccounts = new(Storage.CurrentContext, "master:");
        private static readonly StorageMap ServiceEnclaves = new(Storage.CurrentContext, "svcenc:");
        private static readonly StorageMap AttestationReports = new(Storage.CurrentContext, "attest:");
        private static readonly StorageMap TrustedMeasurements = new(Storage.CurrentContext, "measure:");
        private static readonly StorageMap Config = new(Storage.CurrentContext, "cfg:");

        // ============================================================
        // Role Constants
        // ============================================================

        private const byte RoleAdmin = 0x01;
        private const byte RoleEnclaveOperator = 0x80;

        // ============================================================
        // Status Constants
        // ============================================================

        public const byte ServiceEnclaveActive = 0x01;
        public const byte ServiceEnclaveInactive = 0x02;
        public const byte ServiceEnclaveDeprecated = 0x03;

        // ============================================================
        // Events
        // ============================================================

        /// <summary>
        /// Emitted when a master account is registered.
        /// </summary>
        public static event Action<ByteString, ByteString, BigInteger> MasterAccountRegistered;

        /// <summary>
        /// Emitted when a master account is deactivated.
        /// </summary>
        public static event Action<ByteString, BigInteger> MasterAccountDeactivated;

        /// <summary>
        /// Emitted when a service enclave is registered.
        /// </summary>
        public static event Action<ByteString, ByteString, ByteString, BigInteger> ServiceEnclaveRegistered;

        /// <summary>
        /// Emitted when a service enclave script is updated.
        /// </summary>
        public static event Action<ByteString, ByteString, ByteString, BigInteger, BigInteger> ServiceEnclaveUpdated;

        /// <summary>
        /// Emitted when a service enclave status changes.
        /// </summary>
        public static event Action<ByteString, byte, BigInteger> ServiceEnclaveStatusChanged;

        /// <summary>
        /// Emitted when an attestation report is submitted.
        /// </summary>
        public static event Action<ByteString, ByteString, ByteString, ByteString, BigInteger> AttestationReportSubmitted;

        /// <summary>
        /// Emitted when an attestation report is verified.
        /// </summary>
        public static event Action<ByteString, bool, BigInteger> AttestationReportVerified;

        /// <summary>
        /// Emitted when trusted measurements are updated.
        /// </summary>
        public static event Action<ByteString, ByteString, BigInteger> TrustedMeasurementsUpdated;

        // ============================================================
        // Data Structures
        // ============================================================

        public struct MasterAccountData
        {
            public ByteString AccountId;      // Unique master account identifier (SHA256 of public key)
            public ByteString PublicKey;      // Master public key (65 bytes, uncompressed ECDSA)
            public ByteString EnclaveId;      // Associated enclave identifier (MRENCLAVE)
            public BigInteger RegisteredAt;   // Registration timestamp
            public bool Active;               // Whether the master account is active
        }

        public struct ServiceEnclaveData
        {
            public ByteString ServiceId;      // Service identifier (e.g., "com.r3e.services.vrf")
            public ByteString ServiceName;    // Human-readable service name
            public ByteString ScriptHash;     // SHA256 hash of the service script
            public BigInteger Version;        // Script version (incremented on update)
            public ByteString MasterAccountId; // Master account that registered this service
            public byte Status;               // Service enclave status
            public BigInteger RegisteredAt;   // Initial registration timestamp
            public BigInteger UpdatedAt;      // Last update timestamp
        }

        /// <summary>
        /// SGX Attestation Report for verifying enclave authenticity.
        /// Users can verify that the master account was generated inside a genuine SGX enclave.
        /// </summary>
        public struct SGXAttestationReport
        {
            public ByteString ReportId;       // Unique report identifier
            public ByteString AccountId;      // Associated master account
            public ByteString MrEnclave;      // MRENCLAVE measurement (32 bytes) - hash of enclave code
            public ByteString MrSigner;       // MRSIGNER measurement (32 bytes) - hash of signer key
            public ByteString PublicKeyHash;  // SHA256 of master public key (embedded in ReportData)
            public ByteString RawQuote;       // Raw SGX quote bytes for external verification
            public BigInteger IsvProdId;      // ISV Product ID
            public BigInteger IsvSvn;         // ISV Security Version Number
            public bool IsDebug;              // Whether this is a debug enclave
            public bool Verified;             // Whether the report has been verified
            public BigInteger SubmittedAt;    // Submission timestamp
            public BigInteger VerifiedAt;     // Verification timestamp (0 if not verified)
        }

        /// <summary>
        /// Trusted measurements for enclave verification.
        /// Admin sets these to define which enclaves are trusted.
        /// </summary>
        public struct TrustedMeasurementData
        {
            public ByteString MeasurementId;  // Unique measurement identifier
            public ByteString MrEnclave;      // Expected MRENCLAVE (32 bytes)
            public ByteString MrSigner;       // Expected MRSIGNER (32 bytes)
            public BigInteger MinIsvSvn;      // Minimum acceptable ISV SVN
            public bool AllowDebug;           // Whether debug enclaves are allowed
            public bool Active;               // Whether this measurement is active
            public BigInteger CreatedAt;      // Creation timestamp
            public ByteString Description;    // Human-readable description
        }

        // ============================================================
        // Master Account Management
        // ============================================================

        /// <summary>
        /// Register a master account for the enclave.
        /// Called by enclave operator after TEE initialization.
        /// </summary>
        public static ByteString RegisterMasterAccount(
            ByteString publicKey,
            ByteString enclaveId,
            ByteString signature)
        {
            RequireRole(RoleEnclaveOperator);

            // Validate public key format (65 bytes uncompressed ECDSA)
            if (publicKey is null || publicKey.Length != 65)
            {
                throw new Exception("Invalid public key format (must be 65 bytes)");
            }

            // Generate account ID from public key
            var accountId = (ByteString)CryptoLib.Sha256(publicKey);

            // Check if already registered
            if (MasterAccounts.Get(accountId) is not null)
            {
                throw new Exception("Master account already registered");
            }

            // Verify signature (self-signed registration)
            var messageToVerify = CryptoLib.Sha256(
                StdLib.Serialize(new object[] { publicKey, enclaveId })
            );
            if (!CryptoLib.VerifyWithECDsa((ByteString)messageToVerify, publicKey, signature, NamedCurve.secp256r1))
            {
                throw new Exception("Invalid registration signature");
            }

            var account = new MasterAccountData
            {
                AccountId = accountId,
                PublicKey = publicKey,
                EnclaveId = enclaveId,
                RegisteredAt = Runtime.Time,
                Active = true
            };

            MasterAccounts.Put(accountId, StdLib.Serialize(account));

            MasterAccountRegistered(accountId, publicKey, Runtime.Time);

            return accountId;
        }

        /// <summary>
        /// Get master account data.
        /// </summary>
        public static MasterAccountData GetMasterAccount(ByteString accountId)
        {
            var data = MasterAccounts.Get(accountId);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Master account not found");
            }
            return (MasterAccountData)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Check if master account is valid (exists and active).
        /// </summary>
        public static bool IsMasterAccountValid(ByteString accountId)
        {
            var data = MasterAccounts.Get(accountId);
            if (data is null || data.Length == 0) return false;

            var account = (MasterAccountData)StdLib.Deserialize(data);
            return account.Active;
        }

        /// <summary>
        /// Verify a signature from a master account.
        /// </summary>
        public static bool VerifyMasterAccountSignature(ByteString accountId, ByteString message, ByteString signature)
        {
            if (!IsMasterAccountValid(accountId)) return false;

            var account = GetMasterAccount(accountId);
            return CryptoLib.VerifyWithECDsa(message, account.PublicKey, signature, NamedCurve.secp256r1);
        }

        /// <summary>
        /// Deactivate a master account.
        /// </summary>
        public static void DeactivateMasterAccount(ByteString accountId)
        {
            RequireAdmin();

            var data = MasterAccounts.Get(accountId);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Master account not found");
            }

            var account = (MasterAccountData)StdLib.Deserialize(data);
            account.Active = false;
            MasterAccounts.Put(accountId, StdLib.Serialize(account));

            MasterAccountDeactivated(accountId, Runtime.Time);
        }

        // ============================================================
        // Service Enclave Registry
        // ============================================================

        /// <summary>
        /// Register a service enclave with its script hash.
        /// Called by enclave when a service comes online.
        /// </summary>
        public static void RegisterServiceEnclave(
            ByteString serviceId,
            ByteString serviceName,
            ByteString scriptHash,
            ByteString masterAccountId,
            ByteString signature)
        {
            RequireRole(RoleEnclaveOperator);

            if (serviceId is null || serviceId.Length == 0)
            {
                throw new Exception("Service ID required");
            }
            if (scriptHash is null || scriptHash.Length != 32)
            {
                throw new Exception("Invalid script hash (must be 32 bytes SHA256)");
            }

            // Verify master account
            if (!IsMasterAccountValid(masterAccountId))
            {
                throw new Exception("Invalid master account");
            }

            // Verify signature from master account
            var messageToVerify = CryptoLib.Sha256(
                StdLib.Serialize(new object[] { serviceId, serviceName, scriptHash })
            );
            if (!VerifyMasterAccountSignature(masterAccountId, (ByteString)messageToVerify, signature))
            {
                throw new Exception("Invalid master account signature");
            }

            // Check if service already registered
            var existing = ServiceEnclaves.Get(serviceId);
            if (existing is not null && existing.Length > 0)
            {
                throw new Exception("Service enclave already registered, use UpdateServiceEnclave");
            }

            var serviceEnclave = new ServiceEnclaveData
            {
                ServiceId = serviceId,
                ServiceName = serviceName,
                ScriptHash = scriptHash,
                Version = 1,
                MasterAccountId = masterAccountId,
                Status = ServiceEnclaveActive,
                RegisteredAt = Runtime.Time,
                UpdatedAt = Runtime.Time
            };

            ServiceEnclaves.Put(serviceId, StdLib.Serialize(serviceEnclave));

            ServiceEnclaveRegistered(serviceId, serviceName, scriptHash, Runtime.Time);
        }

        /// <summary>
        /// Update a service enclave's script hash.
        /// Called when service script is updated.
        /// </summary>
        public static void UpdateServiceEnclave(
            ByteString serviceId,
            ByteString newScriptHash,
            ByteString masterAccountId,
            ByteString signature)
        {
            RequireRole(RoleEnclaveOperator);

            if (newScriptHash is null || newScriptHash.Length != 32)
            {
                throw new Exception("Invalid script hash (must be 32 bytes SHA256)");
            }

            // Load existing service enclave
            var data = ServiceEnclaves.Get(serviceId);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Service enclave not found");
            }

            var serviceEnclave = (ServiceEnclaveData)StdLib.Deserialize(data);

            // Verify master account matches
            if (serviceEnclave.MasterAccountId != masterAccountId)
            {
                throw new Exception("Master account mismatch");
            }

            // Verify signature
            var newVersion = serviceEnclave.Version + 1;
            var messageToVerify = CryptoLib.Sha256(
                StdLib.Serialize(new object[] { serviceId, newScriptHash, newVersion })
            );
            if (!VerifyMasterAccountSignature(masterAccountId, (ByteString)messageToVerify, signature))
            {
                throw new Exception("Invalid master account signature");
            }

            var oldScriptHash = serviceEnclave.ScriptHash;

            // Update service enclave
            serviceEnclave.ScriptHash = newScriptHash;
            serviceEnclave.Version = newVersion;
            serviceEnclave.UpdatedAt = Runtime.Time;

            ServiceEnclaves.Put(serviceId, StdLib.Serialize(serviceEnclave));

            ServiceEnclaveUpdated(serviceId, oldScriptHash, newScriptHash, newVersion, Runtime.Time);
        }

        /// <summary>
        /// Get service enclave data.
        /// </summary>
        public static ServiceEnclaveData GetServiceEnclave(ByteString serviceId)
        {
            var data = ServiceEnclaves.Get(serviceId);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Service enclave not found");
            }
            return (ServiceEnclaveData)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Verify a script hash against the registered service enclave.
        /// Returns true if the script hash matches the registered hash.
        /// </summary>
        public static bool VerifyServiceScript(ByteString serviceId, ByteString scriptHash)
        {
            var data = ServiceEnclaves.Get(serviceId);
            if (data is null || data.Length == 0) return false;

            var serviceEnclave = (ServiceEnclaveData)StdLib.Deserialize(data);

            if (serviceEnclave.Status != ServiceEnclaveActive) return false;

            return serviceEnclave.ScriptHash == scriptHash;
        }

        /// <summary>
        /// Check if service enclave is registered and active.
        /// </summary>
        public static bool IsServiceEnclaveActive(ByteString serviceId)
        {
            var data = ServiceEnclaves.Get(serviceId);
            if (data is null || data.Length == 0) return false;

            var serviceEnclave = (ServiceEnclaveData)StdLib.Deserialize(data);
            return serviceEnclave.Status == ServiceEnclaveActive;
        }

        /// <summary>
        /// Deactivate a service enclave.
        /// </summary>
        public static void DeactivateServiceEnclave(ByteString serviceId)
        {
            RequireAdmin();

            var data = ServiceEnclaves.Get(serviceId);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Service enclave not found");
            }

            var serviceEnclave = (ServiceEnclaveData)StdLib.Deserialize(data);
            serviceEnclave.Status = ServiceEnclaveInactive;
            serviceEnclave.UpdatedAt = Runtime.Time;

            ServiceEnclaves.Put(serviceId, StdLib.Serialize(serviceEnclave));

            ServiceEnclaveStatusChanged(serviceId, ServiceEnclaveInactive, Runtime.Time);
        }

        /// <summary>
        /// Reactivate a service enclave.
        /// </summary>
        public static void ReactivateServiceEnclave(ByteString serviceId)
        {
            RequireAdmin();

            var data = ServiceEnclaves.Get(serviceId);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Service enclave not found");
            }

            var serviceEnclave = (ServiceEnclaveData)StdLib.Deserialize(data);
            serviceEnclave.Status = ServiceEnclaveActive;
            serviceEnclave.UpdatedAt = Runtime.Time;

            ServiceEnclaves.Put(serviceId, StdLib.Serialize(serviceEnclave));

            ServiceEnclaveStatusChanged(serviceId, ServiceEnclaveActive, Runtime.Time);
        }

        /// <summary>
        /// Deprecate a service enclave (permanent).
        /// </summary>
        public static void DeprecateServiceEnclave(ByteString serviceId)
        {
            RequireAdmin();

            var data = ServiceEnclaves.Get(serviceId);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Service enclave not found");
            }

            var serviceEnclave = (ServiceEnclaveData)StdLib.Deserialize(data);
            serviceEnclave.Status = ServiceEnclaveDeprecated;
            serviceEnclave.UpdatedAt = Runtime.Time;

            ServiceEnclaves.Put(serviceId, StdLib.Serialize(serviceEnclave));

            ServiceEnclaveStatusChanged(serviceId, ServiceEnclaveDeprecated, Runtime.Time);
        }

        // ============================================================
        // Configuration
        // ============================================================

        /// <summary>
        /// Set Manager contract hash.
        /// </summary>
        public static void SetManager(UInt160 hash)
        {
            RequireAdmin();
            if (hash is null || !hash.IsValid)
            {
                throw new Exception("Invalid manager hash");
            }
            Config.Put("manager", hash);
        }

        /// <summary>
        /// Get Manager contract hash.
        /// </summary>
        public static UInt160 GetManager()
        {
            var data = Config.Get("manager");
            if (data is null || data.Length == 0) return UInt160.Zero;
            return (UInt160)data;
        }

        // ============================================================
        // Access Control
        // ============================================================

        private static void RequireAdmin()
        {
            RequireRole(RoleAdmin);
        }

        private static void RequireRole(byte role)
        {
            var caller = (UInt160)Runtime.CallingScriptHash;
            if (!HasRole(caller, role) && !Runtime.CheckWitness(caller))
            {
                throw new Exception("Role required: " + role);
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

        // ============================================================
        // SGX Remote Attestation Management
        // ============================================================

        /// <summary>
        /// Submit an SGX attestation report for a master account.
        /// This proves the master key was generated inside a genuine SGX enclave.
        /// Users can verify this report to trust the enclave.
        /// </summary>
        public static ByteString SubmitAttestationReport(
            ByteString accountId,
            ByteString mrEnclave,
            ByteString mrSigner,
            ByteString publicKeyHash,
            ByteString rawQuote,
            BigInteger isvProdId,
            BigInteger isvSvn,
            bool isDebug,
            ByteString signature)
        {
            RequireRole(RoleEnclaveOperator);

            // Validate inputs
            if (mrEnclave is null || mrEnclave.Length != 32)
            {
                throw new Exception("Invalid MRENCLAVE (must be 32 bytes)");
            }
            if (mrSigner is null || mrSigner.Length != 32)
            {
                throw new Exception("Invalid MRSIGNER (must be 32 bytes)");
            }
            if (publicKeyHash is null || publicKeyHash.Length != 32)
            {
                throw new Exception("Invalid public key hash (must be 32 bytes)");
            }

            // Verify master account exists
            var accountData = MasterAccounts.Get(accountId);
            if (accountData is null || accountData.Length == 0)
            {
                throw new Exception("Master account not found");
            }

            var account = (MasterAccountData)StdLib.Deserialize(accountData);

            // Verify public key hash matches the master account's public key
            var expectedHash = (ByteString)CryptoLib.Sha256(account.PublicKey);
            if (publicKeyHash != expectedHash)
            {
                throw new Exception("Public key hash does not match master account");
            }

            // Verify signature from master account
            var messageToVerify = CryptoLib.Sha256(
                StdLib.Serialize(new object[] { accountId, mrEnclave, mrSigner, publicKeyHash })
            );
            if (!CryptoLib.VerifyWithECDsa((ByteString)messageToVerify, account.PublicKey, signature, NamedCurve.secp256r1))
            {
                throw new Exception("Invalid attestation signature");
            }

            // Generate report ID
            var reportId = (ByteString)CryptoLib.Sha256(
                StdLib.Serialize(new object[] { accountId, mrEnclave, Runtime.Time })
            );

            var report = new SGXAttestationReport
            {
                ReportId = reportId,
                AccountId = accountId,
                MrEnclave = mrEnclave,
                MrSigner = mrSigner,
                PublicKeyHash = publicKeyHash,
                RawQuote = rawQuote,
                IsvProdId = isvProdId,
                IsvSvn = isvSvn,
                IsDebug = isDebug,
                Verified = false,
                SubmittedAt = Runtime.Time,
                VerifiedAt = 0
            };

            AttestationReports.Put(reportId, StdLib.Serialize(report));

            AttestationReportSubmitted(reportId, accountId, mrEnclave, mrSigner, Runtime.Time);

            return reportId;
        }

        /// <summary>
        /// Get attestation report by ID.
        /// </summary>
        public static SGXAttestationReport GetAttestationReport(ByteString reportId)
        {
            var data = AttestationReports.Get(reportId);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Attestation report not found");
            }
            return (SGXAttestationReport)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Get attestation report for a master account.
        /// </summary>
        public static SGXAttestationReport GetAttestationReportByAccount(ByteString accountId)
        {
            // Note: In production, you'd want an index for this lookup
            // For now, we store the latest report ID in the account
            var reportId = Config.Get("attest:" + (string)accountId);
            if (reportId is null || reportId.Length == 0)
            {
                throw new Exception("No attestation report for this account");
            }
            return GetAttestationReport(reportId);
        }

        /// <summary>
        /// Verify an attestation report against trusted measurements.
        /// Called by admin after off-chain verification (e.g., via Intel IAS or DCAP).
        /// </summary>
        public static void VerifyAttestationReport(ByteString reportId, ByteString measurementId)
        {
            RequireAdmin();

            var reportData = AttestationReports.Get(reportId);
            if (reportData is null || reportData.Length == 0)
            {
                throw new Exception("Attestation report not found");
            }

            var report = (SGXAttestationReport)StdLib.Deserialize(reportData);

            // Get trusted measurements
            var measurementData = TrustedMeasurements.Get(measurementId);
            if (measurementData is null || measurementData.Length == 0)
            {
                throw new Exception("Trusted measurement not found");
            }

            var measurement = (TrustedMeasurementData)StdLib.Deserialize(measurementData);

            if (!measurement.Active)
            {
                throw new Exception("Trusted measurement is not active");
            }

            // Verify MRENCLAVE matches
            if (report.MrEnclave != measurement.MrEnclave)
            {
                throw new Exception("MRENCLAVE does not match trusted measurement");
            }

            // Verify MRSIGNER matches
            if (report.MrSigner != measurement.MrSigner)
            {
                throw new Exception("MRSIGNER does not match trusted measurement");
            }

            // Verify ISV SVN meets minimum
            if (report.IsvSvn < measurement.MinIsvSvn)
            {
                throw new Exception("ISV SVN is below minimum required");
            }

            // Check debug enclave policy
            if (report.IsDebug && !measurement.AllowDebug)
            {
                throw new Exception("Debug enclaves are not allowed");
            }

            // Mark as verified
            report.Verified = true;
            report.VerifiedAt = Runtime.Time;
            AttestationReports.Put(reportId, StdLib.Serialize(report));

            // Store reference for account lookup
            Config.Put("attest:" + (string)report.AccountId, reportId);

            AttestationReportVerified(reportId, true, Runtime.Time);
        }

        /// <summary>
        /// Check if a master account has a verified attestation.
        /// Users can call this to verify the enclave is genuine.
        /// </summary>
        public static bool IsAccountAttested(ByteString accountId)
        {
            var reportId = Config.Get("attest:" + (string)accountId);
            if (reportId is null || reportId.Length == 0)
            {
                return false;
            }

            var reportData = AttestationReports.Get(reportId);
            if (reportData is null || reportData.Length == 0)
            {
                return false;
            }

            var report = (SGXAttestationReport)StdLib.Deserialize(reportData);
            return report.Verified;
        }

        /// <summary>
        /// Get the MRENCLAVE for a master account (for user verification).
        /// </summary>
        public static ByteString GetAccountMrEnclave(ByteString accountId)
        {
            var reportId = Config.Get("attest:" + (string)accountId);
            if (reportId is null || reportId.Length == 0)
            {
                throw new Exception("No attestation for this account");
            }

            var report = GetAttestationReport(reportId);
            return report.MrEnclave;
        }

        // ============================================================
        // Trusted Measurements Management
        // ============================================================

        /// <summary>
        /// Add a trusted measurement (admin only).
        /// This defines which enclave code is trusted.
        /// </summary>
        public static ByteString AddTrustedMeasurement(
            ByteString mrEnclave,
            ByteString mrSigner,
            BigInteger minIsvSvn,
            bool allowDebug,
            ByteString description)
        {
            RequireAdmin();

            if (mrEnclave is null || mrEnclave.Length != 32)
            {
                throw new Exception("Invalid MRENCLAVE (must be 32 bytes)");
            }
            if (mrSigner is null || mrSigner.Length != 32)
            {
                throw new Exception("Invalid MRSIGNER (must be 32 bytes)");
            }

            var measurementId = (ByteString)CryptoLib.Sha256(
                StdLib.Serialize(new object[] { mrEnclave, mrSigner })
            );

            var measurement = new TrustedMeasurementData
            {
                MeasurementId = measurementId,
                MrEnclave = mrEnclave,
                MrSigner = mrSigner,
                MinIsvSvn = minIsvSvn,
                AllowDebug = allowDebug,
                Active = true,
                CreatedAt = Runtime.Time,
                Description = description
            };

            TrustedMeasurements.Put(measurementId, StdLib.Serialize(measurement));

            TrustedMeasurementsUpdated(measurementId, mrEnclave, Runtime.Time);

            return measurementId;
        }

        /// <summary>
        /// Get trusted measurement by ID.
        /// </summary>
        public static TrustedMeasurementData GetTrustedMeasurement(ByteString measurementId)
        {
            var data = TrustedMeasurements.Get(measurementId);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Trusted measurement not found");
            }
            return (TrustedMeasurementData)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Deactivate a trusted measurement.
        /// </summary>
        public static void DeactivateTrustedMeasurement(ByteString measurementId)
        {
            RequireAdmin();

            var data = TrustedMeasurements.Get(measurementId);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Trusted measurement not found");
            }

            var measurement = (TrustedMeasurementData)StdLib.Deserialize(data);
            measurement.Active = false;
            TrustedMeasurements.Put(measurementId, StdLib.Serialize(measurement));
        }

        /// <summary>
        /// Check if an MRENCLAVE is trusted.
        /// Users can call this to verify enclave code.
        /// </summary>
        public static bool IsMrEnclaveTrusted(ByteString mrEnclave, ByteString mrSigner)
        {
            var measurementId = (ByteString)CryptoLib.Sha256(
                StdLib.Serialize(new object[] { mrEnclave, mrSigner })
            );

            var data = TrustedMeasurements.Get(measurementId);
            if (data is null || data.Length == 0)
            {
                return false;
            }

            var measurement = (TrustedMeasurementData)StdLib.Deserialize(data);
            return measurement.Active;
        }
    }
}
