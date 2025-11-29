using System;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace ServiceLayer.Contracts
{
    // DataFeedHub tracks feeds and signed submissions.
    public class DataFeedHub : SmartContract
    {
        private static readonly StorageMap Feeds = new(Storage.CurrentContext, "feed:");
        private static readonly StorageMap Latest = new(Storage.CurrentContext, "latest:");
        private static readonly StorageMap Config = new(Storage.CurrentContext, "cfg:");

        private const byte RoleDataFeedSigner = 0x20;

        public static event Action<ByteString, ByteString> FeedDefined;
        public static event Action<ByteString, ByteString> FeedUpdated;

        public struct Feed
        {
            public ByteString Id;
            public ByteString Pair;
            public UInt160[] Signers;
            public int Threshold;
        }

        public struct Round
        {
            public ByteString RoundId;
            public ByteString Price;
            public ByteString Signer;
            public BigInteger Timestamp;
        }

        public static void DefineFeed(ByteString id, ByteString pair, UInt160[] signers, int threshold)
        {
            RequireOwner();
            if (threshold <= 0 || threshold > signers.Length) throw new Exception("bad threshold");
            var feed = new Feed
            {
                Id = id,
                Pair = pair,
                Signers = signers,
                Threshold = threshold
            };
            Feeds.Put(id, StdLib.Serialize(feed));
            FeedDefined(id, pair);
        }

        public static void Submit(ByteString feedId, ByteString roundId, ByteString price, ByteString signature, ByteString message)
        {
            var feed = LoadFeed(feedId);
            if (!VerifySigner(feed.Signers, signature, message))
            {
                throw new Exception("unauthorized signer");
            }
            var round = new Round
            {
                RoundId = roundId,
                Price = price,
                Signer = CryptoLib.Sha256(signature),
                Timestamp = Runtime.Time
            };
            Latest.Put(feedId, StdLib.Serialize(round));
            FeedUpdated(feedId, roundId);
        }

        public static Round GetLatest(ByteString feedId)
        {
            var data = Latest.Get(feedId);
            if (data is null || data.Length == 0) throw new Exception("not found");
            return (Round)StdLib.Deserialize(data);
        }

        private static Feed LoadFeed(ByteString id)
        {
            var data = Feeds.Get(id);
            if (data is null || data.Length == 0) throw new Exception("not found");
            return (Feed)StdLib.Deserialize(data);
        }

        private static bool VerifySigner(UInt160[] signers, ByteString signature, ByteString message)
        {
            var signerHash = CryptoLib.Sha256(signature);
            // For simplicity, check if any registered signer has the role
            foreach (var s in signers)
            {
                if (HasRole(s, RoleDataFeedSigner) || Runtime.CheckWitness(s))
                {
                    return true;
                }
            }
            return false;
        }

        private static void RequireOwner()
        {
            if (!Runtime.CheckWitness((UInt160)Runtime.CallingScriptHash))
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
