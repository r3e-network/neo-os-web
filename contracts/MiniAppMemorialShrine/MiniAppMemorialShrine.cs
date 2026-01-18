using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // Event delegates
    public delegate void MemorialCreatedHandler(BigInteger memorialId, UInt160 creator, string deceasedName, BigInteger deathYear);
    public delegate void ObituaryPublishedHandler(BigInteger memorialId, string deceasedName, string obituary);
    public delegate void TributePaidHandler(BigInteger memorialId, UInt160 visitor, BigInteger offeringType);
    public delegate void MemorialUpdatedHandler(BigInteger memorialId, string fieldUpdated);

    /// <summary>
    /// Memorial Shrine MiniApp - 区块链灵位 - 永恒存在，永恒记忆
    /// 
    /// 将逝者的记忆永久铭刻于区块链之上，让思念跨越时空，让记忆永不消逝。
    /// Eternally inscribe memories of the departed on the blockchain.
    ///
    /// FEATURES:
    /// - 创建灵位：记录逝者姓名、照片、生卒年份、生平、讣告
    /// - 虔诚祭拜：以香火、鲜花、祭品表达哀思
    /// - 永恒记录：所有祭拜记录永久保存于区块链
    /// - 讣告公示：新灵位发布讣告通知
    ///
    /// 祭拜服务为公益性质，仅收取区块链运行成本。
    /// </summary>
    [DisplayName("MiniAppMemorialShrine")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "区块链灵位 - 永恒存在，永恒记忆。将逝者的记忆永久铭刻于区块链之上。")]
    [ContractPermission("*", "*")]
    public partial class MiniAppMemorialShrine : MiniAppServiceBase
    {
        #region App Constants
        private const string APP_ID = "miniapp-memorial-shrine";
        
        // 祭品费用（公益性质，仅覆盖链上成本）
        private const long OFFERING_INCENSE = 1000000;      // 0.01 GAS - 香
        private const long OFFERING_CANDLE = 2000000;       // 0.02 GAS - 蜡烛
        private const long OFFERING_FLOWER = 3000000;       // 0.03 GAS - 鲜花
        private const long OFFERING_FRUIT = 5000000;        // 0.05 GAS - 水果
        private const long OFFERING_WINE = 10000000;        // 0.1 GAS - 酒
        private const long OFFERING_FEAST = 50000000;       // 0.5 GAS - 祭宴
        
        // 祭品类型
        private const int TYPE_INCENSE = 1;
        private const int TYPE_CANDLE = 2;
        private const int TYPE_FLOWER = 3;
        private const int TYPE_FRUIT = 4;
        private const int TYPE_WINE = 5;
        private const int TYPE_FEAST = 6;
        #endregion

        #region Storage Prefixes
        private static readonly byte[] PREFIX_MEMORIAL_ID = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_MEMORIALS = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_CREATOR_MEMORIALS = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_CREATOR_MEMORIAL_COUNT = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_TRIBUTE_ID = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_TRIBUTES = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_MEMORIAL_TRIBUTES = new byte[] { 0x26 };
        private static readonly byte[] PREFIX_MEMORIAL_TRIBUTE_COUNT = new byte[] { 0x27 };
        private static readonly byte[] PREFIX_VISITOR_MEMORIALS = new byte[] { 0x28 };
        private static readonly byte[] PREFIX_VISITOR_MEMORIAL_COUNT = new byte[] { 0x29 };
        private static readonly byte[] PREFIX_RECENT_OBITUARIES = new byte[] { 0x2A };
        private static readonly byte[] PREFIX_OBITUARY_COUNT = new byte[] { 0x2B };
        private static readonly byte[] PREFIX_VISITED_FLAG = new byte[] { 0x2C };
        #endregion

        #region Data Structures
        
        public struct Memorial
        {
            public BigInteger Id;
            public UInt160 Creator;
            public string DeceasedName;
            public string PhotoHash;           // IPFS/存储哈希
            public string Relationship;
            public BigInteger BirthYear;
            public BigInteger DeathYear;
            public string Biography;
            public string Obituary;
            public BigInteger CreateTime;
            public BigInteger LastTributeTime;
            public bool Active;
            // 祭品统计
            public BigInteger IncenseCount;
            public BigInteger CandleCount;
            public BigInteger FlowerCount;
            public BigInteger FruitCount;
            public BigInteger WineCount;
            public BigInteger FeastCount;
        }

        public struct Tribute
        {
            public BigInteger Id;
            public BigInteger MemorialId;
            public UInt160 Visitor;
            public BigInteger OfferingType;
            public string Message;
            public BigInteger Timestamp;
        }
        
        #endregion

        #region Events
        [DisplayName("MemorialCreated")]
        public static event MemorialCreatedHandler OnMemorialCreated;

        [DisplayName("ObituaryPublished")]
        public static event ObituaryPublishedHandler OnObituaryPublished;

        [DisplayName("TributePaid")]
        public static event TributePaidHandler OnTributePaid;

        [DisplayName("MemorialUpdated")]
        public static event MemorialUpdatedHandler OnMemorialUpdated;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_MEMORIAL_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TRIBUTE_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_OBITUARY_COUNT, 0);
        }
        #endregion

        #region Read Methods
        
        [Safe]
        public static BigInteger GetMemorialCount() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_MEMORIAL_ID);

        [Safe]
        public static BigInteger GetObituaryCount() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_OBITUARY_COUNT);

        [Safe]
        public static Memorial GetMemorial(BigInteger memorialId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_MEMORIALS, (ByteString)memorialId.ToByteArray()));
            if (data == null) return new Memorial();
            return (Memorial)StdLib.Deserialize(data);
        }

        [Safe]
        public static Tribute GetTribute(BigInteger tributeId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_TRIBUTES, (ByteString)tributeId.ToByteArray()));
            if (data == null) return new Tribute();
            return (Tribute)StdLib.Deserialize(data);
        }

        [Safe]
        public static BigInteger GetCreatorMemorialCount(UInt160 creator)
        {
            byte[] key = Helper.Concat(PREFIX_CREATOR_MEMORIAL_COUNT, creator);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetVisitorMemorialCount(UInt160 visitor)
        {
            byte[] key = Helper.Concat(PREFIX_VISITOR_MEMORIAL_COUNT, visitor);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetMemorialTributeCount(BigInteger memorialId)
        {
            byte[] key = Helper.Concat(PREFIX_MEMORIAL_TRIBUTE_COUNT, (ByteString)memorialId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetOfferingCost(BigInteger offeringType)
        {
            if (offeringType == TYPE_INCENSE) return OFFERING_INCENSE;
            if (offeringType == TYPE_CANDLE) return OFFERING_CANDLE;
            if (offeringType == TYPE_FLOWER) return OFFERING_FLOWER;
            if (offeringType == TYPE_FRUIT) return OFFERING_FRUIT;
            if (offeringType == TYPE_WINE) return OFFERING_WINE;
            if (offeringType == TYPE_FEAST) return OFFERING_FEAST;
            return 0;
        }

        [Safe]
        public static string GetOfferingName(BigInteger offeringType)
        {
            if (offeringType == TYPE_INCENSE) return "香";
            if (offeringType == TYPE_CANDLE) return "蜡烛";
            if (offeringType == TYPE_FLOWER) return "鲜花";
            if (offeringType == TYPE_FRUIT) return "水果";
            if (offeringType == TYPE_WINE) return "酒";
            if (offeringType == TYPE_FEAST) return "祭宴";
            return "";
        }

        #endregion
    }
}
