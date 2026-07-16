using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // ===================================================================
    //  PlatformRegistry — AppAccount minting (design section 4.1)
    //
    //  One canonical audited AppAccount NEF, seeded through a timelocked
    //  artifact pair and deployed once per app with manifest name = appId
    //  (same NEF + unique name => unique contract-account address). The
    //  registry row records the ACTUAL post-deploy hash — the address of
    //  record — because the measured hash semantics fold the TRANSACTION
    //  SENDER, not the calling contract, into CreateContractHash
    //  (PlatformRegistryHashSemanticsTests). predictedAccountHash is the
    //  advisory on-chain sibling, pinned against neo-core by test.
    // ===================================================================
    public partial class PlatformRegistry
    {
        // ---- timelocked canonical artifact ----

        /// <summary>
        /// Propose a new canonical AppAccount artifact. The manifest is two
        /// halves spliced around the appId at mint. Validation happens HERE
        /// so a malformed template can never brick minting later (the
        /// section 4.1 splice fuzz rule).
        /// </summary>
        public static void ProposeAppAccountArtifact(ByteString nef, string manifestFirstHalf, string manifestSecondHalf)
        {
            ValidateAdmin();
            ValidateArtifact(nef, manifestFirstHalf, manifestSecondHalf);
            BigInteger executeAfter = Runtime.Time + TIMELOCK_DELAY_MS;
            Storage.Put(Storage.CurrentContext, PREFIX_PENDING_ARTIFACT_NEF, nef);
            Storage.Put(Storage.CurrentContext, PREFIX_PENDING_ARTIFACT_HEAD, manifestFirstHalf);
            Storage.Put(Storage.CurrentContext, PREFIX_PENDING_ARTIFACT_TAIL, manifestSecondHalf);
            Storage.Put(Storage.CurrentContext, PREFIX_PENDING_ARTIFACT_ETA, executeAfter);
            OnArtifactProposed(ArtifactVersion() + 1, executeAfter);
        }

        /// <summary>Activate the pending artifact after the 24h timelock.</summary>
        public static void SetAppAccountArtifact()
        {
            ValidateAdmin();
            ByteString rawEta = Storage.Get(Storage.CurrentContext, PREFIX_PENDING_ARTIFACT_ETA);
            ExecutionEngine.Assert(rawEta != null, "no pending artifact");
            ExecutionEngine.Assert(Runtime.Time >= (BigInteger)rawEta, "timelock active");
            ByteString nef = Storage.Get(Storage.CurrentContext, PREFIX_PENDING_ARTIFACT_NEF);
            Storage.Put(Storage.CurrentContext, PREFIX_ARTIFACT_NEF, nef);
            Storage.Put(Storage.CurrentContext, PREFIX_ARTIFACT_MANIFEST_HEAD,
                Storage.Get(Storage.CurrentContext, PREFIX_PENDING_ARTIFACT_HEAD));
            Storage.Put(Storage.CurrentContext, PREFIX_ARTIFACT_MANIFEST_TAIL,
                Storage.Get(Storage.CurrentContext, PREFIX_PENDING_ARTIFACT_TAIL));
            BigInteger version = ArtifactVersion() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_ARTIFACT_VERSION, version);
            BigInteger checksum = ExtractNefChecksum(nef);
            Storage.Put(Storage.CurrentContext, PREFIX_ARTIFACT_CHECKSUM, checksum);
            DeletePendingArtifact();
            OnArtifactActivated(version, checksum);
        }

        public static void CancelAppAccountArtifact()
        {
            ValidateAdmin();
            DeletePendingArtifact();
        }

        // ---- minting ----

        /// <summary>
        /// Mint the app's treasury account: ContractManagement.Deploy of the
        /// canonical NEF under manifest name = appId, initData = [appId,
        /// registry, appAdmin]. App-admin lane pays the 10 GAS mint fee from
        /// prepaid credit; the platform pipeline lane is fee-exempt. The
        /// post-deploy bindRegistry handshake replaces the non-implementable
        /// "_deploy asserts deployer == registry".
        /// </summary>
        public static UInt160 MintAccount(string appId)
        {
            RequireNotGloballyPaused();
            RequireRegistered(appId);
            ExecutionEngine.Assert(
                Storage.Get(Storage.CurrentContext, AppKey(PREFIX_APP_ACCOUNT, appId)) == null,
                "account already minted");
            UInt160 appAdmin = AppAdminOf(appId);
            if (!IsPlatformAdminWitness())
            {
                ExecutionEngine.Assert(Runtime.CheckWitness(appAdmin), "app admin witness required");
                ConsumeCredit(appId, appAdmin, FEE_ACCOUNT_MINT);
                AccrueFees(FEE_ACCOUNT_MINT);
            }
            ByteString nef = Storage.Get(Storage.CurrentContext, PREFIX_ARTIFACT_NEF);
            ExecutionEngine.Assert(nef != null, "account artifact not set");
            string manifest = SpliceManifest(appId);
            Contract deployed = ContractManagement.Deploy(nef, manifest,
                new object[] { appId, Runtime.ExecutingScriptHash, appAdmin });
            UInt160 account = deployed.Hash;
            string echo = (string)Contract.Call(account, "bindRegistry", CallFlags.All);
            ExecutionEngine.Assert(echo == appId, "bind handshake failed");
            Storage.Put(Storage.CurrentContext, AppKey(PREFIX_APP_ACCOUNT, appId), account);
            Storage.Put(Storage.CurrentContext, AccountKey(PREFIX_APP_ID_BY_ACCOUNT, account), appId);
            OnAppAccountMinted(appId, account, ArtifactVersion());
            return account;
        }

        // ---- double-consent shim upgrades (design section 4 governance) ----

        /// <summary>App-admin consent flag for the NEXT registry-orchestrated
        /// account upgrade. One-shot: cleared when the upgrade executes.</summary>
        public static void SetShimUpgradeConsent(string appId, bool consented)
        {
            RequireRegistered(appId);
            RequireAppAdmin(appId);
            if (consented) Storage.Put(Storage.CurrentContext, AppKey(PREFIX_SHIM_CONSENT, appId), 1);
            else Storage.Delete(Storage.CurrentContext, AppKey(PREFIX_SHIM_CONSENT, appId));
            OnShimUpgradeConsentChanged(appId, consented);
        }

        /// <summary>
        /// Registry-orchestrated account upgrade: needs the platform admin
        /// (the artifact already served its own 24h timelock) AND the app's
        /// consent flag — the double-consent rule closing the fleet-repave
        /// vector. Local account state survives (update path has no re-init).
        /// </summary>
        public static void UpgradeAppAccount(string appId)
        {
            ValidateAdmin();
            RequireRegistered(appId);
            UInt160 account = AccountOf(appId);
            ExecutionEngine.Assert(account != UInt160.Zero, "no minted account");
            ExecutionEngine.Assert(
                Storage.Get(Storage.CurrentContext, AppKey(PREFIX_SHIM_CONSENT, appId)) != null,
                "app consent required");
            ByteString nef = Storage.Get(Storage.CurrentContext, PREFIX_ARTIFACT_NEF);
            ExecutionEngine.Assert(nef != null, "account artifact not set");
            string manifest = SpliceManifest(appId);
            Storage.Delete(Storage.CurrentContext, AppKey(PREFIX_SHIM_CONSENT, appId));
            Contract.Call(account, "update", CallFlags.All, nef, manifest);
            OnAppAccountUpgraded(appId, ArtifactVersion());
        }

        // ---- advisory hash prediction (section 4.1 rule 2) ----

        /// <summary>
        /// Advisory sibling of neo-core CreateContractHash for the stored
        /// artifact checksum: Hash160(ABORT ++ push(sender) ++ push(checksum)
        /// ++ push(appId)). The registry row remains the address of record;
        /// this read exists for off-chain precomputation through the fixed
        /// pipeline deployer lane.
        /// </summary>
        [Safe]
        public static UInt160 PredictedAccountHash(UInt160 deployerSender, string appId)
        {
            ValidateAddress(deployerSender);
            ValidateAppIdFormat(appId);
            ByteString rawChecksum = Storage.Get(Storage.CurrentContext, PREFIX_ARTIFACT_CHECKSUM);
            ExecutionEngine.Assert(rawChecksum != null, "account artifact not set");
            ByteString script = (ByteString)new byte[] { 0x38 }; // ABORT
            script = Helper.Concat(script, EncodePushData((ByteString)deployerSender));
            script = Helper.Concat(script, EncodePushInteger((BigInteger)rawChecksum));
            script = Helper.Concat(script, EncodePushData((ByteString)appId));
            return (UInt160)CryptoLib.Ripemd160(CryptoLib.Sha256(script));
        }

        // ---- internals ----

        private static void ValidateArtifact(ByteString nef, string head, string tail)
        {
            ExecutionEngine.Assert(nef != null && nef.Length >= 8, "invalid nef");
            ExecutionEngine.Assert(
                nef[0] == 0x4E && nef[1] == 0x45 && nef[2] == 0x46 && nef[3] == 0x33,
                "invalid nef magic");
            ExecutionEngine.Assert(head != null && head.Length >= 8, "invalid manifest first half");
            ExecutionEngine.Assert(tail != null && tail.Length >= 1, "invalid manifest second half");
            ExecutionEngine.Assert(head.Length + tail.Length + MAX_APP_ID_LENGTH <= MAX_MANIFEST_LENGTH, "manifest too large");
            // Char-wise comparison: Substring yields a Buffer on the VM, and
            // Buffer == ByteString is reference equality — never use it.
            ExecutionEngine.Assert(EndsWithNameMarker(head), "first half must end at the manifest name");
            ExecutionEngine.Assert(tail[0] == '"', "second half must open with the name-closing quote");
            // Trial splice: the probe id exercises every allowed appId
            // character class; if this parses and the name round-trips, any
            // valid appId splices into well-formed JSON.
            string probe = "artifact-probe.app_1";
            Map<string, object> parsed = (Map<string, object>)StdLib.JsonDeserialize(head + probe + tail);
            ExecutionEngine.Assert(parsed != null, "manifest halves do not splice");
            ExecutionEngine.Assert((string)parsed["name"] == probe, "manifest name is not splice-addressable");
        }

        // The first half must end with the 8-character marker '"name":"' so
        // the appId splices in as the manifest name value.
        private static bool EndsWithNameMarker(string head)
        {
            string marker = "\"name\":\"";
            int offset = head.Length - 8;
            for (int i = 0; i < 8; i++)
            {
                if (head[offset + i] != marker[i]) return false;
            }
            return true;
        }

        private static void DeletePendingArtifact()
        {
            Storage.Delete(Storage.CurrentContext, PREFIX_PENDING_ARTIFACT_NEF);
            Storage.Delete(Storage.CurrentContext, PREFIX_PENDING_ARTIFACT_HEAD);
            Storage.Delete(Storage.CurrentContext, PREFIX_PENDING_ARTIFACT_TAIL);
            Storage.Delete(Storage.CurrentContext, PREFIX_PENDING_ARTIFACT_ETA);
        }

        private static string SpliceManifest(string appId)
        {
            string head = Storage.Get(Storage.CurrentContext, PREFIX_ARTIFACT_MANIFEST_HEAD);
            string tail = Storage.Get(Storage.CurrentContext, PREFIX_ARTIFACT_MANIFEST_TAIL);
            return head + appId + tail;
        }

        // NEF checksum = the last 4 bytes of the file, little-endian unsigned
        // (a zero byte is appended so the BigInteger cast never sign-extends).
        private static BigInteger ExtractNefChecksum(ByteString nef)
        {
            byte[] raw = (byte[])nef;
            byte[] tail = Helper.Range(raw, raw.Length - 4, 4);
            return (BigInteger)(ByteString)Helper.Concat(tail, new byte[] { 0x00 });
        }

        // PUSHDATA1 encoding for payloads under 256 bytes (sender + appId).
        private static ByteString EncodePushData(ByteString data)
        {
            ExecutionEngine.Assert(data.Length < 256, "push data too long");
            return Helper.Concat((ByteString)new byte[] { 0x0C, (byte)data.Length }, data);
        }

        // ScriptBuilder.EmitPush(BigInteger) for non-negative values: PUSH0-16
        // for tiny values, else the minimal little-endian form zero-padded to
        // the 1/2/4/8-byte bucket behind PUSHINT8/16/32/64.
        private static ByteString EncodePushInteger(BigInteger value)
        {
            ExecutionEngine.Assert(value >= 0, "negative push value");
            if (value <= 16) return (ByteString)new byte[] { (byte)(0x10 + (byte)value) };
            byte[] raw = value.ToByteArray();
            if (raw.Length == 1) return Helper.Concat((ByteString)new byte[] { 0x00 }, (ByteString)raw);
            if (raw.Length == 2) return Helper.Concat((ByteString)new byte[] { 0x01 }, (ByteString)raw);
            if (raw.Length <= 4) return Helper.Concat((ByteString)new byte[] { 0x02 }, PadUnsigned(raw, 4));
            ExecutionEngine.Assert(raw.Length <= 8, "push value too large");
            return Helper.Concat((ByteString)new byte[] { 0x03 }, PadUnsigned(raw, 8));
        }

        private static ByteString PadUnsigned(byte[] raw, int size)
        {
            ByteString padded = (ByteString)raw;
            for (int i = raw.Length; i < size; i++)
            {
                padded = Helper.Concat(padded, (ByteString)new byte[] { 0x00 });
            }
            return padded;
        }
    }
}
