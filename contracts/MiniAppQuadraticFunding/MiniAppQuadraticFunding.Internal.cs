using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppQuadraticFunding
    {
        #region Internal Helpers

        private static void StoreRound(BigInteger roundId, RoundData round)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_ROUNDS, (ByteString)roundId.ToByteArray()),
                StdLib.Serialize(round));
        }

        private static void StoreProject(BigInteger projectId, ProjectData project)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_PROJECTS, (ByteString)projectId.ToByteArray()),
                StdLib.Serialize(project));
        }

        private static byte[] BuildRoundProjectKey(BigInteger roundId, BigInteger index)
        {
            return Helper.Concat(
                Helper.Concat(PREFIX_ROUND_PROJECTS, (ByteString)roundId.ToByteArray()),
                (ByteString)index.ToByteArray());
        }

        private static void AddRoundProject(BigInteger roundId, BigInteger projectId)
        {
            byte[] countKey = Helper.Concat(PREFIX_ROUND_PROJECT_COUNT, (ByteString)roundId.ToByteArray());
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            Storage.Put(Storage.CurrentContext, BuildRoundProjectKey(roundId, count), projectId);
        }

        private static void AddOwnerProject(UInt160 owner, BigInteger projectId)
        {
            byte[] countKey = Helper.Concat(PREFIX_OWNER_PROJECT_COUNT, owner);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_OWNER_PROJECTS, owner),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, projectId);
        }

        private static void AddCreatorRound(UInt160 creator, BigInteger roundId)
        {
            byte[] countKey = Helper.Concat(PREFIX_CREATOR_ROUND_COUNT, creator);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_CREATOR_ROUNDS, creator),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, roundId);
        }

        private static BigInteger GetRoundProjectCountInternal(BigInteger roundId)
        {
            byte[] key = Helper.Concat(PREFIX_ROUND_PROJECT_COUNT, (ByteString)roundId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        private static BigInteger GetOwnerProjectCountInternal(UInt160 owner)
        {
            byte[] key = Helper.Concat(PREFIX_OWNER_PROJECT_COUNT, owner);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        private static BigInteger GetCreatorRoundCountInternal(UInt160 creator)
        {
            byte[] key = Helper.Concat(PREFIX_CREATOR_ROUND_COUNT, creator);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        private static byte[] BuildContributionKey(UInt160 contributor, BigInteger roundId, BigInteger projectId)
        {
            return Helper.Concat(
                Helper.Concat(
                    Helper.Concat(PREFIX_CONTRIBUTION, (ByteString)roundId.ToByteArray()),
                    (ByteString)projectId.ToByteArray()),
                contributor);
        }

        private static BigInteger GetContributionInternal(UInt160 contributor, BigInteger roundId, BigInteger projectId)
        {
            byte[] key = BuildContributionKey(contributor, roundId, projectId);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        private static void StoreContribution(UInt160 contributor, BigInteger roundId, BigInteger projectId, BigInteger amount)
        {
            byte[] key = BuildContributionKey(contributor, roundId, projectId);
            Storage.Put(Storage.CurrentContext, key, amount);
        }

        private static bool IsNeo(UInt160 asset) => asset == NEO.Hash;

        private static bool IsGas(UInt160 asset) => asset == GAS.Hash;

        private static void ValidateAsset(UInt160 asset)
        {
            ExecutionEngine.Assert(IsNeo(asset) || IsGas(asset), "unsupported asset");
        }

        private static void ValidateTextLimits(string title, string description)
        {
            if (title != null)
            {
                ExecutionEngine.Assert(title.Length <= MAX_TITLE_LENGTH, "title too long");
            }
            if (description != null)
            {
                ExecutionEngine.Assert(description.Length <= MAX_DESC_LENGTH, "description too long");
            }
        }

        private static void ValidateProjectText(string name, string description, string link)
        {
            if (name != null)
            {
                ExecutionEngine.Assert(name.Length <= MAX_PROJECT_NAME_LENGTH, "project name too long");
            }
            if (description != null)
            {
                ExecutionEngine.Assert(description.Length <= MAX_PROJECT_DESC_LENGTH, "project description too long");
            }
            if (link != null)
            {
                ExecutionEngine.Assert(link.Length <= MAX_PROJECT_LINK_LENGTH, "project link too long");
            }
        }

        private static void ValidateMemo(string memo)
        {
            if (memo != null)
            {
                ExecutionEngine.Assert(memo.Length <= MAX_MEMO_LENGTH, "memo too long");
            }
        }

        private static void RequireRoundExists(RoundData round)
        {
            ExecutionEngine.Assert(round.Creator != UInt160.Zero, "round not found");
        }

        private static void RequireProjectExists(ProjectData project)
        {
            ExecutionEngine.Assert(project.Owner != UInt160.Zero, "project not found");
        }

        #endregion
    }
}
