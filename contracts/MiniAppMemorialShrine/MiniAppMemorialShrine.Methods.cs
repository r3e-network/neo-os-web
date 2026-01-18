using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppMemorialShrine
    {
        #region 灵位管理

        /// <summary>
        /// 创建灵位 - 为逝去的亲人建立永恒的纪念
        /// 灵位创建免费，这是一项公益服务
        /// </summary>
        public static BigInteger CreateMemorial(
            UInt160 creator,
            string deceasedName,
            string photoHash,
            string relationship,
            BigInteger birthYear,
            BigInteger deathYear,
            string biography,
            string obituary)
        {
            ValidateNotGloballyPaused(APP_ID);
            
            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            // 验证输入
            ExecutionEngine.Assert(deceasedName.Length > 0 && deceasedName.Length <= 100, "invalid name");
            ExecutionEngine.Assert(photoHash.Length <= 100, "invalid photo");
            ExecutionEngine.Assert(relationship.Length <= 50, "invalid relationship");
            ExecutionEngine.Assert(birthYear >= 0 && birthYear <= 9999, "invalid birth year");
            ExecutionEngine.Assert(deathYear >= birthYear && deathYear <= 9999, "invalid death year");
            ExecutionEngine.Assert(biography.Length <= 2000, "biography too long");
            ExecutionEngine.Assert(obituary.Length <= 1000, "obituary too long");

            // 生成灵位ID
            BigInteger memorialId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_MEMORIAL_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_MEMORIAL_ID, memorialId);

            // 创建灵位
            Memorial memorial = new Memorial
            {
                Id = memorialId,
                Creator = creator,
                DeceasedName = deceasedName,
                PhotoHash = photoHash,
                Relationship = relationship,
                BirthYear = birthYear,
                DeathYear = deathYear,
                Biography = biography,
                Obituary = obituary,
                CreateTime = Runtime.Time,
                LastTributeTime = 0,
                Active = true
            };
            StoreMemorial(memorialId, memorial);

            // 记录创建者的灵位
            AddCreatorMemorial(creator, memorialId);

            // 添加到讣告栏
            if (obituary.Length > 0)
            {
                AddToObituaryBoard(memorialId);
                OnObituaryPublished(memorialId, deceasedName, obituary);
            }

            OnMemorialCreated(memorialId, creator, deceasedName, deathYear);

            return memorialId;
        }

        /// <summary>
        /// 更新灵位信息（仅创建者可操作）
        /// </summary>
        public static void UpdateMemorial(
            UInt160 caller,
            BigInteger memorialId,
            string biography,
            string obituary)
        {
            ValidateNotGloballyPaused(APP_ID);

            Memorial memorial = GetMemorial(memorialId);
            ExecutionEngine.Assert(memorial.Creator != UInt160.Zero, "memorial not found");
            ExecutionEngine.Assert(memorial.Creator == caller, "not owner");
            
            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(caller), "unauthorized");

            ExecutionEngine.Assert(biography.Length <= 2000, "biography too long");
            ExecutionEngine.Assert(obituary.Length <= 1000, "obituary too long");

            memorial.Biography = biography;
            memorial.Obituary = obituary;
            StoreMemorial(memorialId, memorial);

            OnMemorialUpdated(memorialId, "biography,obituary");
        }

        #endregion

        #region 祭拜

        /// <summary>
        /// 祭拜 - 以虔诚之心，献上祭品
        /// 祭拜费用仅用于覆盖区块链运行成本
        /// </summary>
        public static BigInteger PayTribute(
            UInt160 visitor,
            BigInteger memorialId,
            BigInteger offeringType,
            string message,
            BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(visitor), "unauthorized");

            Memorial memorial = GetMemorial(memorialId);
            ExecutionEngine.Assert(memorial.Active, "memorial not found");

            BigInteger cost = GetOfferingCost(offeringType);
            ExecutionEngine.Assert(cost > 0, "invalid offering");
            ExecutionEngine.Assert(message.Length <= 200, "message too long");

            // 验证支付
            ValidatePaymentReceipt(APP_ID, visitor, cost, receiptId);

            // 生成祭拜记录ID
            BigInteger tributeId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TRIBUTE_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_TRIBUTE_ID, tributeId);

            // 创建祭拜记录
            Tribute tribute = new Tribute
            {
                Id = tributeId,
                MemorialId = memorialId,
                Visitor = visitor,
                OfferingType = offeringType,
                Message = message,
                Timestamp = Runtime.Time
            };
            StoreTribute(tributeId, tribute);

            // 更新灵位祭品统计
            memorial.LastTributeTime = Runtime.Time;
            if (offeringType == TYPE_INCENSE) memorial.IncenseCount += 1;
            else if (offeringType == TYPE_CANDLE) memorial.CandleCount += 1;
            else if (offeringType == TYPE_FLOWER) memorial.FlowerCount += 1;
            else if (offeringType == TYPE_FRUIT) memorial.FruitCount += 1;
            else if (offeringType == TYPE_WINE) memorial.WineCount += 1;
            else if (offeringType == TYPE_FEAST) memorial.FeastCount += 1;
            StoreMemorial(memorialId, memorial);

            // 添加到灵位的祭拜记录
            AddMemorialTribute(memorialId, tributeId);

            // 记录访客祭拜过的灵位
            AddVisitorMemorial(visitor, memorialId);

            OnTributePaid(memorialId, visitor, offeringType);

            return tributeId;
        }

        /// <summary>
        /// 上香 - 快速祭拜
        /// </summary>
        public static BigInteger OfferIncense(
            UInt160 visitor,
            BigInteger memorialId,
            BigInteger receiptId)
        {
            return PayTribute(visitor, memorialId, TYPE_INCENSE, "", receiptId);
        }

        #endregion
    }
}
