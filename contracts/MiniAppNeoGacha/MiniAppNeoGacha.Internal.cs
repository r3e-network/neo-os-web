using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppNeoGacha
    {
        #region Internal Helpers


        /// <summary>
        /// [DEPRECATED] O(n) loop - use frontend calculation instead.
        /// Frontend should call GetMachineItemsForFrontend() and calculate weight locally.
        /// Only kept for legacy callback compatibility.
        /// </summary>
        private static BigInteger GetAvailableWeight(BigInteger machineId, BigInteger itemCount)
        {
            BigInteger total = 0;
            for (BigInteger i = 1; i <= itemCount; i++)
            {
                ItemData item = LoadItem(machineId, i);
                if (IsItemAvailable(item))
                {
                    total += item.Weight;
                }
            }
            return total;
        }

        private static bool IsItemAvailable(ItemData item)
        {
            if (item.AssetType == ASSET_NEP17)
            {
                return item.Amount > 0 && item.Stock >= item.Amount;
            }
            if (item.AssetType == ASSET_NEP11)
            {
                return item.TokenCount > 0;
            }
            return false;
        }

        private static BigInteger ToPositiveInteger(byte[] bytes)
        {
            byte[] unsigned = new byte[bytes.Length + 1];
            for (int i = 0; i < bytes.Length; i++)
            {
                unsigned[i] = bytes[i];
            }
            return new BigInteger(unsigned);
        }

        private static void ValidateOwnerOrAdmin(UInt160 owner, MachineData machine)
        {
            bool isAdmin = Runtime.CheckWitness(Admin());
            bool isOwner = Runtime.CheckWitness(owner) && owner == machine.Owner;
            ExecutionEngine.Assert(isAdmin || isOwner, "unauthorized");
        }

        private static byte[] GetMachineKey(BigInteger machineId) =>
            Helper.Concat(PREFIX_MACHINES, (ByteString)machineId.ToByteArray());

        private static byte[] GetItemKey(BigInteger machineId, BigInteger itemIndex)
        {
            byte[] key = Helper.Concat(PREFIX_MACHINE_ITEMS, (ByteString)machineId.ToByteArray());
            return Helper.Concat(key, (ByteString)itemIndex.ToByteArray());
        }

        private static byte[] GetItemTokenKey(BigInteger machineId, BigInteger itemIndex, BigInteger tokenIndex)
        {
            byte[] key = Helper.Concat(PREFIX_ITEM_TOKEN_LIST, (ByteString)machineId.ToByteArray());
            key = Helper.Concat(key, (ByteString)itemIndex.ToByteArray());
            return Helper.Concat(key, (ByteString)tokenIndex.ToByteArray());
        }

        private static byte[] GetPlayKey(BigInteger playId) =>
            Helper.Concat(PREFIX_PLAYS, (ByteString)playId.ToByteArray());

        #region Storage Field Constants
        private static readonly byte[] MACHINE_FIELD_CREATOR = new byte[] { 0x01 };
        private static readonly byte[] MACHINE_FIELD_OWNER = new byte[] { 0x02 };
        private static readonly byte[] MACHINE_FIELD_NAME = new byte[] { 0x03 };
        private static readonly byte[] MACHINE_FIELD_DESCRIPTION = new byte[] { 0x04 };
        private static readonly byte[] MACHINE_FIELD_CATEGORY = new byte[] { 0x05 };
        private static readonly byte[] MACHINE_FIELD_TAGS = new byte[] { 0x06 };
        private static readonly byte[] MACHINE_FIELD_PRICE = new byte[] { 0x07 };
        private static readonly byte[] MACHINE_FIELD_ITEM_COUNT = new byte[] { 0x08 };
        private static readonly byte[] MACHINE_FIELD_TOTAL_WEIGHT = new byte[] { 0x09 };
        private static readonly byte[] MACHINE_FIELD_PLAYS = new byte[] { 0x0A };
        private static readonly byte[] MACHINE_FIELD_REVENUE = new byte[] { 0x0B };
        private static readonly byte[] MACHINE_FIELD_SALES = new byte[] { 0x0C };
        private static readonly byte[] MACHINE_FIELD_SALES_VOLUME = new byte[] { 0x0D };
        private static readonly byte[] MACHINE_FIELD_CREATED_AT = new byte[] { 0x0E };
        private static readonly byte[] MACHINE_FIELD_LAST_PLAYED_AT = new byte[] { 0x0F };
        private static readonly byte[] MACHINE_FIELD_ACTIVE = new byte[] { 0x10 };
        private static readonly byte[] MACHINE_FIELD_LISTED = new byte[] { 0x11 };
        private static readonly byte[] MACHINE_FIELD_BANNED = new byte[] { 0x12 };
        private static readonly byte[] MACHINE_FIELD_LOCKED = new byte[] { 0x13 };
        private static readonly byte[] MACHINE_FIELD_SALE_PRICE = new byte[] { 0x14 };

        // Item field constants
        private static readonly byte[] ITEM_FIELD_NAME = new byte[] { 0x01 };
        private static readonly byte[] ITEM_FIELD_WEIGHT = new byte[] { 0x02 };
        private static readonly byte[] ITEM_FIELD_RARITY = new byte[] { 0x03 };
        private static readonly byte[] ITEM_FIELD_ASSET_TYPE = new byte[] { 0x04 };
        private static readonly byte[] ITEM_FIELD_ASSET_HASH = new byte[] { 0x05 };
        private static readonly byte[] ITEM_FIELD_AMOUNT = new byte[] { 0x06 };
        private static readonly byte[] ITEM_FIELD_TOKEN_ID = new byte[] { 0x07 };
        private static readonly byte[] ITEM_FIELD_STOCK = new byte[] { 0x08 };
        private static readonly byte[] ITEM_FIELD_TOKEN_COUNT = new byte[] { 0x09 };
        private static readonly byte[] ITEM_FIELD_DECIMALS = new byte[] { 0x0A };

        // Play field constants
        private static readonly byte[] PLAY_FIELD_PLAYER = new byte[] { 0x01 };
        private static readonly byte[] PLAY_FIELD_MACHINE_ID = new byte[] { 0x02 };
        private static readonly byte[] PLAY_FIELD_ITEM_INDEX = new byte[] { 0x03 };
        private static readonly byte[] PLAY_FIELD_PRICE = new byte[] { 0x04 };
        private static readonly byte[] PLAY_FIELD_TIMESTAMP = new byte[] { 0x05 };
        private static readonly byte[] PLAY_FIELD_RESOLVED = new byte[] { 0x06 };
        private static readonly byte[] PLAY_FIELD_SEED = new byte[] { 0x07 };
        private static readonly byte[] PLAY_FIELD_HYBRID_MODE = new byte[] { 0x08 };
        #endregion

        #region Storage Helpers
        private static BigInteger GetBigInteger(byte[] key, byte[] field)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, Helper.Concat(key, field));
            return data == null ? 0 : (BigInteger)data;
        }

        private static string GetString(byte[] key, byte[] field)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, Helper.Concat(key, field));
            return data == null ? "" : data;
        }

        private static UInt160 GetUInt160(byte[] key, byte[] field)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, Helper.Concat(key, field));
            return data == null ? UInt160.Zero : (UInt160)data;
        }

        private static bool GetBool(byte[] key, byte[] field) =>
            GetBigInteger(key, field) == 1;

        private static void PutBool(byte[] key, byte[] field, bool value) =>
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, field), value ? 1 : 0);

        private static void StoreMachine(BigInteger machineId, MachineData m)
        {
            byte[] key = GetMachineKey(machineId);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, MACHINE_FIELD_CREATOR), m.Creator);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, MACHINE_FIELD_OWNER), m.Owner);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, MACHINE_FIELD_NAME), m.Name);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, MACHINE_FIELD_DESCRIPTION), m.Description);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, MACHINE_FIELD_CATEGORY), m.Category);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, MACHINE_FIELD_TAGS), m.Tags);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, MACHINE_FIELD_PRICE), m.Price);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, MACHINE_FIELD_ITEM_COUNT), m.ItemCount);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, MACHINE_FIELD_TOTAL_WEIGHT), m.TotalWeight);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, MACHINE_FIELD_PLAYS), m.Plays);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, MACHINE_FIELD_REVENUE), m.Revenue);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, MACHINE_FIELD_SALES), m.Sales);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, MACHINE_FIELD_SALES_VOLUME), m.SalesVolume);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, MACHINE_FIELD_CREATED_AT), m.CreatedAt);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, MACHINE_FIELD_LAST_PLAYED_AT), m.LastPlayedAt);
            PutBool(key, MACHINE_FIELD_ACTIVE, m.Active);
            PutBool(key, MACHINE_FIELD_LISTED, m.Listed);
            PutBool(key, MACHINE_FIELD_BANNED, m.Banned);
            PutBool(key, MACHINE_FIELD_LOCKED, m.Locked);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, MACHINE_FIELD_SALE_PRICE), m.SalePrice);
        }

        private static MachineData LoadMachine(BigInteger machineId)
        {
            byte[] key = GetMachineKey(machineId);
            return new MachineData
            {
                Creator = GetUInt160(key, MACHINE_FIELD_CREATOR),
                Owner = GetUInt160(key, MACHINE_FIELD_OWNER),
                Name = GetString(key, MACHINE_FIELD_NAME),
                Description = GetString(key, MACHINE_FIELD_DESCRIPTION),
                Category = GetString(key, MACHINE_FIELD_CATEGORY),
                Tags = GetString(key, MACHINE_FIELD_TAGS),
                Price = GetBigInteger(key, MACHINE_FIELD_PRICE),
                ItemCount = GetBigInteger(key, MACHINE_FIELD_ITEM_COUNT),
                TotalWeight = GetBigInteger(key, MACHINE_FIELD_TOTAL_WEIGHT),
                Plays = GetBigInteger(key, MACHINE_FIELD_PLAYS),
                Revenue = GetBigInteger(key, MACHINE_FIELD_REVENUE),
                Sales = GetBigInteger(key, MACHINE_FIELD_SALES),
                SalesVolume = GetBigInteger(key, MACHINE_FIELD_SALES_VOLUME),
                CreatedAt = GetBigInteger(key, MACHINE_FIELD_CREATED_AT),
                LastPlayedAt = GetBigInteger(key, MACHINE_FIELD_LAST_PLAYED_AT),
                Active = GetBool(key, MACHINE_FIELD_ACTIVE),
                Listed = GetBool(key, MACHINE_FIELD_LISTED),
                Banned = GetBool(key, MACHINE_FIELD_BANNED),
                Locked = GetBool(key, MACHINE_FIELD_LOCKED),
                SalePrice = GetBigInteger(key, MACHINE_FIELD_SALE_PRICE)
            };
        }

        private static void StoreItem(BigInteger machineId, BigInteger itemIndex, ItemData item)
        {
            byte[] key = GetItemKey(machineId, itemIndex);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, ITEM_FIELD_NAME), item.Name);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, ITEM_FIELD_WEIGHT), item.Weight);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, ITEM_FIELD_RARITY), item.Rarity);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, ITEM_FIELD_ASSET_TYPE), item.AssetType);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, ITEM_FIELD_ASSET_HASH), item.AssetHash);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, ITEM_FIELD_AMOUNT), item.Amount);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, ITEM_FIELD_TOKEN_ID), item.TokenId);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, ITEM_FIELD_STOCK), item.Stock);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, ITEM_FIELD_TOKEN_COUNT), item.TokenCount);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, ITEM_FIELD_DECIMALS), item.Decimals);
        }

        private static ItemData LoadItem(BigInteger machineId, BigInteger itemIndex)
        {
            byte[] key = GetItemKey(machineId, itemIndex);
            return new ItemData
            {
                Name = GetString(key, ITEM_FIELD_NAME),
                Weight = GetBigInteger(key, ITEM_FIELD_WEIGHT),
                Rarity = GetString(key, ITEM_FIELD_RARITY),
                AssetType = GetBigInteger(key, ITEM_FIELD_ASSET_TYPE),
                AssetHash = GetUInt160(key, ITEM_FIELD_ASSET_HASH),
                Amount = GetBigInteger(key, ITEM_FIELD_AMOUNT),
                TokenId = GetString(key, ITEM_FIELD_TOKEN_ID),
                Stock = GetBigInteger(key, ITEM_FIELD_STOCK),
                TokenCount = GetBigInteger(key, ITEM_FIELD_TOKEN_COUNT),
                Decimals = GetBigInteger(key, ITEM_FIELD_DECIMALS)
            };
        }

        private static void StorePlay(BigInteger playId, PlayData play)
        {
            byte[] key = GetPlayKey(playId);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, PLAY_FIELD_PLAYER), play.Player);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, PLAY_FIELD_MACHINE_ID), play.MachineId);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, PLAY_FIELD_ITEM_INDEX), play.ItemIndex);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, PLAY_FIELD_PRICE), play.Price);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, PLAY_FIELD_TIMESTAMP), play.Timestamp);
            PutBool(key, PLAY_FIELD_RESOLVED, play.Resolved);
            if (play.Seed != null)
            {
                Storage.Put(Storage.CurrentContext, Helper.Concat(key, PLAY_FIELD_SEED), play.Seed);
            }
            PutBool(key, PLAY_FIELD_HYBRID_MODE, play.HybridMode);
        }

        private static PlayData LoadPlay(BigInteger playId)
        {
            byte[] key = GetPlayKey(playId);
            ByteString seedData = Storage.Get(Storage.CurrentContext, Helper.Concat(key, PLAY_FIELD_SEED));
            return new PlayData
            {
                Player = GetUInt160(key, PLAY_FIELD_PLAYER),
                MachineId = GetBigInteger(key, PLAY_FIELD_MACHINE_ID),
                ItemIndex = GetBigInteger(key, PLAY_FIELD_ITEM_INDEX),
                Price = GetBigInteger(key, PLAY_FIELD_PRICE),
                Timestamp = GetBigInteger(key, PLAY_FIELD_TIMESTAMP),
                Resolved = GetBool(key, PLAY_FIELD_RESOLVED),
                Seed = seedData,
                HybridMode = GetBool(key, PLAY_FIELD_HYBRID_MODE)
            };
        }

        private static void StoreItemToken(BigInteger machineId, BigInteger itemIndex, BigInteger tokenIndex, string tokenId)
        {
            byte[] key = GetItemTokenKey(machineId, itemIndex, tokenIndex);
            Storage.Put(Storage.CurrentContext, key, tokenId);
        }

        private static string RemoveItemToken(BigInteger machineId, BigInteger itemIndex, ref ItemData item, string requestedTokenId)
        {
            BigInteger count = item.TokenCount;
            ExecutionEngine.Assert(count > 0, "no tokens");

            string selectedTokenId = "";
            BigInteger selectedIndex = 0;

            if (requestedTokenId != null && requestedTokenId.Length > 0)
            {
                for (BigInteger i = 1; i <= count; i++)
                {
                    byte[] key = GetItemTokenKey(machineId, itemIndex, i);
                    string stored = Storage.Get(Storage.CurrentContext, key);
                    if (stored == requestedTokenId)
                    {
                        selectedIndex = i;
                        selectedTokenId = stored;
                        break;
                    }
                }
                ExecutionEngine.Assert(selectedIndex > 0, "token not found");
            }
            else
            {
                selectedIndex = count;
                byte[] key = GetItemTokenKey(machineId, itemIndex, selectedIndex);
                selectedTokenId = Storage.Get(Storage.CurrentContext, key);
            }

            if (selectedIndex < count)
            {
                byte[] lastKey = GetItemTokenKey(machineId, itemIndex, count);
                string lastToken = Storage.Get(Storage.CurrentContext, lastKey);
                byte[] selectedKey = GetItemTokenKey(machineId, itemIndex, selectedIndex);
                Storage.Put(Storage.CurrentContext, selectedKey, lastToken);
                Storage.Delete(Storage.CurrentContext, lastKey);
            }
            else
            {
                byte[] key = GetItemTokenKey(machineId, itemIndex, count);
                Storage.Delete(Storage.CurrentContext, key);
            }

            item.TokenCount = count - 1;
            return selectedTokenId;
        }



        /// <summary>
        /// Secure on-chain selection calculation for Hybrid mode.
        /// Re-runs the selection logic deterministically using the stored seed.
        /// Iterates O(N) where N <= 100.
        /// </summary>
        private static BigInteger CalculateExpectedSelection(
            ByteString seed,
            BigInteger machineId,
            BigInteger itemCount)
        {
            BigInteger rand = ToPositiveInteger((byte[])seed);
            BigInteger availableWeight = GetAvailableWeight(machineId, itemCount);

            if (availableWeight <= 0) return 0;

            BigInteger roll = rand % availableWeight;
            BigInteger cumulative = 0;

            for (BigInteger i = 1; i <= itemCount; i++)
            {
                ItemData item = LoadItem(machineId, i);
                if (!IsItemAvailable(item)) continue;
                cumulative += item.Weight;
                if (roll < cumulative)
                {
                    return i;
                }
            }
            return 0;
        }
        #endregion

        #endregion
    }
}
