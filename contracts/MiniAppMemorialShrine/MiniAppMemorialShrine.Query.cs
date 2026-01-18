using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppMemorialShrine
    {
        #region 查询方法

        /// <summary>
        /// 获取灵位详情
        /// </summary>
        [Safe]
        public static Map<string, object> GetMemorialDetails(BigInteger memorialId)
        {
            Memorial m = GetMemorial(memorialId);
            Map<string, object> details = new Map<string, object>();
            
            if (m.Creator == UInt160.Zero) return details;

            details["id"] = m.Id;
            details["creator"] = m.Creator;
            details["deceasedName"] = m.DeceasedName;
            details["photoHash"] = m.PhotoHash;
            details["relationship"] = m.Relationship;
            details["birthYear"] = m.BirthYear;
            details["deathYear"] = m.DeathYear;
            details["biography"] = m.Biography;
            details["obituary"] = m.Obituary;
            details["createTime"] = m.CreateTime;
            details["lastTributeTime"] = m.LastTributeTime;
            details["active"] = m.Active;
            
            // 祭品统计
            details["incenseCount"] = m.IncenseCount;
            details["candleCount"] = m.CandleCount;
            details["flowerCount"] = m.FlowerCount;
            details["fruitCount"] = m.FruitCount;
            details["wineCount"] = m.WineCount;
            details["feastCount"] = m.FeastCount;

            return details;
        }

        /// <summary>
        /// 获取祭拜记录详情
        /// </summary>
        [Safe]
        public static Map<string, object> GetTributeDetails(BigInteger tributeId)
        {
            Tribute t = GetTribute(tributeId);
            Map<string, object> details = new Map<string, object>();

            if (t.Visitor == UInt160.Zero) return details;

            details["id"] = t.Id;
            details["memorialId"] = t.MemorialId;
            details["visitor"] = t.Visitor;
            details["offeringType"] = t.OfferingType;
            details["offeringName"] = GetOfferingName(t.OfferingType);
            details["message"] = t.Message;
            details["timestamp"] = t.Timestamp;

            return details;
        }

        /// <summary>
        /// 获取祭品列表
        /// </summary>
        [Safe]
        public static Map<string, object>[] GetOfferingMenu()
        {
            Map<string, object>[] menu = new Map<string, object>[6];

            menu[0] = new Map<string, object>();
            menu[0]["type"] = TYPE_INCENSE;
            menu[0]["name"] = "香";
            menu[0]["cost"] = OFFERING_INCENSE;

            menu[1] = new Map<string, object>();
            menu[1]["type"] = TYPE_CANDLE;
            menu[1]["name"] = "蜡烛";
            menu[1]["cost"] = OFFERING_CANDLE;

            menu[2] = new Map<string, object>();
            menu[2]["type"] = TYPE_FLOWER;
            menu[2]["name"] = "鲜花";
            menu[2]["cost"] = OFFERING_FLOWER;

            menu[3] = new Map<string, object>();
            menu[3]["type"] = TYPE_FRUIT;
            menu[3]["name"] = "水果";
            menu[3]["cost"] = OFFERING_FRUIT;

            menu[4] = new Map<string, object>();
            menu[4]["type"] = TYPE_WINE;
            menu[4]["name"] = "酒";
            menu[4]["cost"] = OFFERING_WINE;

            menu[5] = new Map<string, object>();
            menu[5]["type"] = TYPE_FEAST;
            menu[5]["name"] = "祭宴";
            menu[5]["cost"] = OFFERING_FEAST;

            return menu;
        }

        /// <summary>
        /// 获取用户创建的灵位
        /// </summary>
        [Safe]
        public static BigInteger[] GetCreatorMemorials(UInt160 creator)
        {
            BigInteger count = GetCreatorMemorialCount(creator);
            int arraySize = count > 100 ? 100 : (int)count;
            BigInteger[] memorials = new BigInteger[arraySize];

            for (int i = 0; i < arraySize; i++)
            {
                memorials[i] = GetCreatorMemorialAt(creator, i);
            }

            return memorials;
        }

        /// <summary>
        /// 获取用户祭拜过的灵位
        /// </summary>
        [Safe]
        public static BigInteger[] GetVisitorMemorials(UInt160 visitor)
        {
            BigInteger count = GetVisitorMemorialCount(visitor);
            int arraySize = count > 100 ? 100 : (int)count;
            BigInteger[] memorials = new BigInteger[arraySize];

            for (int i = 0; i < arraySize; i++)
            {
                memorials[i] = GetVisitorMemorialAt(visitor, i);
            }

            return memorials;
        }

        /// <summary>
        /// 获取灵位的祭拜记录
        /// </summary>
        [Safe]
        public static BigInteger[] GetMemorialTributes(BigInteger memorialId, BigInteger offset, BigInteger limit)
        {
            BigInteger count = GetMemorialTributeCount(memorialId);
            if (offset >= count) return new BigInteger[0];

            BigInteger remaining = count - offset;
            int arraySize = remaining > limit ? (int)limit : (int)remaining;
            if (arraySize > 50) arraySize = 50;

            BigInteger[] tributes = new BigInteger[arraySize];

            for (int i = 0; i < arraySize; i++)
            {
                BigInteger index = count - 1 - offset - i;
                tributes[i] = GetMemorialTributeAt(memorialId, index);
            }

            return tributes;
        }

        #endregion
    }
}
