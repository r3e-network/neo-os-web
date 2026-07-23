using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public partial class PlatformSocialContract
    {
        public static void Notarize(string appId, UInt160 submitter, ByteString digest)
        {
            ValidateAppNotPaused(appId);
            ValidateAppRegistered(appId, APP_TYPE_NOTARY);
            ExecutionEngine.Assert(submitter != UInt160.Zero && submitter.IsValid, "invalid submitter");
            ExecutionEngine.Assert(Runtime.CheckWitness(submitter), "submitter witness required");
            ValidateNotaryDigest(digest);
            ByteString key = NotaryKey(appId, digest);
            ExecutionEngine.Assert(GetRaw(key) == null, "digest already notarized");
            BigInteger timestamp = Runtime.Time;
            BigInteger blockIndex = Ledger.CurrentIndex;
            Put(key, StdLib.Serialize(new object[] { submitter, timestamp, blockIndex }));
            Put(AppKey(appId, PREFIX_NOTARY_COUNT), GetBigInteger(AppKey(appId, PREFIX_NOTARY_COUNT)) + 1);
            OnNotarized(appId, digest, submitter, timestamp, blockIndex);
        }

        [Safe]
        public static object[] GetNotarization(string appId, ByteString digest)
        {
            ValidateAppRegistered(appId, APP_TYPE_NOTARY);
            ValidateNotaryDigest(digest);
            ByteString raw = GetRaw(NotaryKey(appId, digest));
            if (raw == null) return new object[] { UInt160.Zero, 0, 0, false };
            object[] proof = (object[])StdLib.Deserialize(raw);
            return new object[] { proof[0], proof[1], proof[2], true };
        }

        [Safe]
        public static bool IsNotarized(string appId, ByteString digest)
        {
            ValidateAppRegistered(appId, APP_TYPE_NOTARY);
            ValidateNotaryDigest(digest);
            return GetRaw(NotaryKey(appId, digest)) != null;
        }

        [Safe]
        public static BigInteger NotarizationCount(string appId)
        {
            ValidateAppRegistered(appId, APP_TYPE_NOTARY);
            return GetBigInteger(AppKey(appId, PREFIX_NOTARY_COUNT));
        }

        private static void ValidateNotaryDigest(ByteString digest)
        {
            ExecutionEngine.Assert(digest != null && digest.Length == 32, "digest must be 32 bytes");
        }

        private static ByteString NotaryKey(string appId, ByteString digest) =>
            CryptoLib.Sha256(Helper.Concat(AppKey(appId, PREFIX_NOTARY_PROOF), digest));
    }
}
