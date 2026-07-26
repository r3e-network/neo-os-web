using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    [DisplayName("AbstractAccountCoreMockFixture")]
    [ManifestExtra("Description", "Test-only shared AA core counterparty for PlatformRegistry integration tests; never deployed.")]
    public class AbstractAccountCoreMockFixture : SmartContract
    {
        private static readonly byte[] PrefixRegistrar = new byte[] { 0x01 };
        private static readonly byte[] PrefixOwner = new byte[] { 0x02 };
        private static readonly byte[] PrefixBinding = new byte[] { 0x03 };
        private static readonly byte[] RegistrationAccountIdDomain = new byte[] { 0xAA, 0x52, 0x47, 0x01 };
        private static readonly byte[] StablePlatformAccountOwnerDomain = new byte[] { 0xAA, 0x52, 0x47, 0x02 };

        public static void SetRegistrar(UInt160 registrar)
        {
            Storage.Put(Storage.CurrentContext, PrefixRegistrar, registrar);
        }

        [Safe]
        public static UInt160 GetPlatformRegistrar()
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, PrefixRegistrar);
            return value == null ? UInt160.Zero : (UInt160)value!;
        }

        [Safe]
        public static UInt160 ComputePlatformAccountId(ByteString appBinding, UInt160 backupOwner, uint escapeTimelock)
        {
            ByteString binding = appBinding!;
            ExecutionEngine.Assert(binding != null && binding.Length > 0, "platform app binding required");
            ExecutionEngine.Assert(binding!.Length <= 128, "platform app binding too long");
            byte[] payload = RegistrationAccountIdDomain;
            payload = Helper.Concat(payload, ReverseBytes((byte[])backupOwner));
            payload = Helper.Concat(payload, new byte[20]);
            payload = Helper.Concat(payload, new byte[20]);
            payload = Helper.Concat(payload, UInt32ToLittleEndianBytes(escapeTimelock));
            payload = Helper.Concat(payload, (byte[])binding);
            byte[] hash = (byte[])CryptoLib.Ripemd160(
                (ByteString)CryptoLib.Sha256((ByteString)payload));
            return (UInt160)(ByteString)ReverseBytes(hash);
        }

        [Safe]
        public static UInt160 ComputeStablePlatformAccountId(ByteString appBinding, uint escapeTimelock)
        {
            ByteString binding = appBinding!;
            ExecutionEngine.Assert(binding != null && binding.Length > 0, "platform app binding required");
            ExecutionEngine.Assert(binding!.Length <= 128, "platform app binding too long");
            byte[] ownerPayload = StablePlatformAccountOwnerDomain;
            ownerPayload = Helper.Concat(ownerPayload, (byte[])binding);
            byte[] ownerHash = (byte[])CryptoLib.Ripemd160(
                (ByteString)CryptoLib.Sha256((ByteString)ownerPayload));
            byte[] payload = RegistrationAccountIdDomain;
            payload = Helper.Concat(payload, ownerHash);
            payload = Helper.Concat(payload, new byte[20]);
            payload = Helper.Concat(payload, new byte[20]);
            payload = Helper.Concat(payload, UInt32ToLittleEndianBytes(escapeTimelock));
            payload = Helper.Concat(payload, (byte[])binding);
            byte[] hash = (byte[])CryptoLib.Ripemd160(
                (ByteString)CryptoLib.Sha256((ByteString)payload));
            return (UInt160)(ByteString)ReverseBytes(hash);
        }

        private static byte[] UInt32ToLittleEndianBytes(uint value)
        {
            return new byte[]
            {
                (byte)(value & 0xFF),
                (byte)((value >> 8) & 0xFF),
                (byte)((value >> 16) & 0xFF),
                (byte)((value >> 24) & 0xFF)
            };
        }

        private static byte[] ReverseBytes(byte[] source)
        {
            byte[] reversed = new byte[source.Length];
            for (int i = 0; i < source.Length; i++)
            {
                reversed[i] = source[source.Length - 1 - i];
            }
            return reversed;
        }

        public static void RegisterPlatformAccount(UInt160 accountId, ByteString appBinding, UInt160 backupOwner, uint escapeTimelock)
        {
            ByteString? rawRegistrar = Storage.Get(Storage.CurrentContext, PrefixRegistrar);
            ExecutionEngine.Assert(rawRegistrar != null, "registrar not set");
            UInt160 registrar = (UInt160)rawRegistrar!;
            ExecutionEngine.Assert(Runtime.CallingScriptHash == registrar, "unauthorized registrar");
            ExecutionEngine.Assert(
                accountId == ComputePlatformAccountId(appBinding, backupOwner, escapeTimelock),
                "account id mismatch");
            ByteString key = Helper.Concat((ByteString)PrefixOwner, (ByteString)accountId);
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, key) == null, "account exists");
            Storage.Put(Storage.CurrentContext, key, backupOwner);
            Storage.Put(
                Storage.CurrentContext,
                Helper.Concat((ByteString)PrefixBinding, (ByteString)accountId),
                appBinding);
        }

        public static void RegisterStablePlatformAccount(UInt160 accountId, ByteString appBinding, UInt160 backupOwner, uint escapeTimelock)
        {
            ByteString? rawRegistrar = Storage.Get(Storage.CurrentContext, PrefixRegistrar);
            ExecutionEngine.Assert(rawRegistrar != null, "registrar not set");
            UInt160 registrar = (UInt160)rawRegistrar!;
            ExecutionEngine.Assert(Runtime.CallingScriptHash == registrar, "unauthorized registrar");
            ExecutionEngine.Assert(
                accountId == ComputeStablePlatformAccountId(appBinding, escapeTimelock),
                "account id mismatch");
            ByteString key = Helper.Concat((ByteString)PrefixOwner, (ByteString)accountId);
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, key) == null, "account exists");
            Storage.Put(Storage.CurrentContext, key, backupOwner);
            Storage.Put(
                Storage.CurrentContext,
                Helper.Concat((ByteString)PrefixBinding, (ByteString)accountId),
                appBinding);
        }

        public static void RotatePlatformAccountOwner(UInt160 accountId, ByteString appBinding, UInt160 newBackupOwner)
        {
            ByteString? rawRegistrar = Storage.Get(Storage.CurrentContext, PrefixRegistrar);
            ExecutionEngine.Assert(rawRegistrar != null, "registrar not set");
            UInt160 registrar = (UInt160)rawRegistrar!;
            ExecutionEngine.Assert(Runtime.CallingScriptHash == registrar, "unauthorized registrar");
            ExecutionEngine.Assert(
                appBinding != null && appBinding.Length > 0 && appBinding.Length <= 128,
                "invalid platform app binding");
            ByteString binding = appBinding!;
            ExecutionEngine.Assert(
                newBackupOwner != null && newBackupOwner != UInt160.Zero && newBackupOwner.IsValid,
                "invalid platform backup owner");

            ByteString bindingKey = Helper.Concat((ByteString)PrefixBinding, (ByteString)accountId);
            ByteString? storedBinding = Storage.Get(Storage.CurrentContext, bindingKey);
            ExecutionEngine.Assert(storedBinding != null, "platform app binding not found");
            ExecutionEngine.Assert(
                StdLib.MemoryCompare(storedBinding!, binding) == 0,
                "platform app binding mismatch");
            ByteString ownerKey = Helper.Concat((ByteString)PrefixOwner, (ByteString)accountId);
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, ownerKey) != null, "account not found");
            Storage.Put(Storage.CurrentContext, ownerKey, newBackupOwner!);
        }

        [Safe]
        public static UInt160 GetBackupOwner(UInt160 accountId)
        {
            ByteString? value = Storage.Get(
                Storage.CurrentContext,
                Helper.Concat((ByteString)PrefixOwner, (ByteString)accountId));
            return value == null ? UInt160.Zero : (UInt160)value!;
        }
    }
}
