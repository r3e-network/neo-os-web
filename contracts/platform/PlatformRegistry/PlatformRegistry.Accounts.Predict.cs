using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // ===================================================================
    //  PlatformRegistry — advisory account-hash prediction (section 4.1
    //  rule 2). The registry row records the ACTUAL post-deploy hash and
    //  remains the address of record; PredictedAccountHash is the on-chain
    //  sibling of neo-core CreateContractHash, pinned against neo-core by
    //  test, that exists only for off-chain precomputation through the
    //  fixed pipeline deployer lane. Extracted from PlatformRegistry.Accounts.cs
    //  to keep that partial under the 300-line reviewability budget.
    // ===================================================================
    public partial class PlatformRegistry
    {
        /// <summary>
        /// Advisory sibling of neo-core CreateContractHash for the stored
        /// artifact checksum: Hash160(ABORT ++ push(sender) ++ push(checksum)
        /// ++ push(appId)).
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
