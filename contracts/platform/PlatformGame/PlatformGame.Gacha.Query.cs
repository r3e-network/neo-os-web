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
    public partial class PlatformGameContract
    {
        // ===================================================================
        //  Read methods
        // ===================================================================

        /// <summary>Get machine details.</summary>
        [Safe]
        public static Map<string, object> GetGachaMachine(string appId, BigInteger machineId)
        {
            GachaMachine m = LoadGachaMachine(appId, machineId);
            Map<string, object> details = new Map<string, object>();

            if (m.Creator == UInt160.Zero) return details;

            details["id"] = machineId;
            details["creator"] = m.Creator;
            details["owner"] = m.Owner;
            details["name"] = m.Name;
            details["description"] = m.Description;
            details["category"] = m.Category;
            details["price"] = m.Price;
            details["itemCount"] = m.ItemCount;
            details["totalWeight"] = m.TotalWeight;
            details["plays"] = m.Plays;
            details["revenue"] = m.Revenue;
            details["createdAt"] = m.CreatedAt;
            details["lastPlayedAt"] = m.LastPlayedAt;
            details["active"] = m.Active;
            details["banned"] = m.Banned;

            return details;
        }

        /// <summary>Get a specific item in a machine.</summary>
        [Safe]
        public static Map<string, object> GetGachaItem(string appId, BigInteger machineId, BigInteger itemIndex)
        {
            GachaItem item = LoadGachaItem(appId, machineId, itemIndex);
            Map<string, object> details = new Map<string, object>();

            if (item.Weight == 0) return details;

            details["name"] = item.Name;
            details["weight"] = item.Weight;
            details["rarity"] = item.Rarity;
            details["assetType"] = item.AssetType;
            details["assetHash"] = item.AssetHash;
            details["amount"] = item.Amount;
            details["tokenId"] = item.TokenId;
            details["stock"] = item.Stock;
            details["tokenCount"] = item.TokenCount;

            return details;
        }

        /// <summary>Get play details.</summary>
        [Safe]
        public static Map<string, object> GetGachaPlay(string appId, BigInteger playId)
        {
            GachaPlay play = LoadGachaPlay(appId, playId);
            Map<string, object> details = new Map<string, object>();

            if (play.Player == UInt160.Zero) return details;

            details["id"] = playId;
            details["player"] = play.Player;
            details["machineId"] = play.MachineId;
            details["itemIndex"] = play.ItemIndex;
            details["price"] = play.Price;
            details["timestamp"] = play.Timestamp;
            details["resolved"] = play.Resolved;

            return details;
        }
    }
}
