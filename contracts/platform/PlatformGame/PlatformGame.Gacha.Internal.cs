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
        //  Internal gacha helpers
        // ===================================================================

        /// <summary>Check if an item has available inventory.</summary>
        private static bool IsGachaItemAvailable(GachaItem item)
        {
            if (item.AssetType == GA_ASSET_NEP17)
                return item.Amount > 0 && item.Stock >= item.Amount;
            if (item.AssetType == GA_ASSET_NEP11)
                return item.TokenCount > 0;
            return false;
        }

        /// <summary>
        /// Weighted random selection using the stored seed.
        /// Iterates O(N) where N <= 100.
        /// </summary>
        private static BigInteger CalculateGachaSelection(
            string appId,
            ByteString seed,
            BigInteger machineId,
            BigInteger itemCount)
        {
            BigInteger rand = ToPositiveInteger((byte[])seed);

            // Calculate available weight
            BigInteger availableWeight = 0;
            for (BigInteger i = 1; i <= itemCount; i++)
            {
                GachaItem item = LoadGachaItem(appId, machineId, i);
                if (IsGachaItemAvailable(item))
                    availableWeight += item.Weight;
            }

            if (availableWeight <= 0) return 0;

            BigInteger roll = rand % availableWeight;
            BigInteger cumulative = 0;

            for (BigInteger i = 1; i <= itemCount; i++)
            {
                GachaItem item = LoadGachaItem(appId, machineId, i);
                if (!IsGachaItemAvailable(item)) continue;
                cumulative += item.Weight;
                if (roll < cumulative) return i;
            }

            return 0;
        }

        /// <summary>Convert raw bytes to a positive BigInteger (up to 8 bytes).</summary>
        private static BigInteger ToPositiveInteger(byte[] bytes)
        {
            BigInteger value = 0;
            int limit = bytes.Length < 8 ? bytes.Length : 8;
            for (int i = 0; i < limit; i++)
            {
                value = (value << 8) + bytes[i];
            }
            return value;
        }

        /// <summary>
        /// Normalize oracle VRF bytes before weighted selection.
        /// </summary>
        private static ByteString NormalizeOracleSeed(ByteString oracleResult)
        {
            ExecutionEngine.Assert(oracleResult != null && oracleResult.Length > 0, "oracle result missing");
            return CryptoLib.Sha256(oracleResult);
        }

        /// <summary>Pop the last token from a gacha item's token list.</summary>
        private static string PopGachaItemToken(
            string appId,
            BigInteger machineId,
            BigInteger itemIndex,
            BigInteger tokenCount)
        {
            BigInteger count = tokenCount;
            ExecutionEngine.Assert(count > 0, "no tokens to pop");

            // Read the last token
            byte[] tokenKey = (byte[])Helper.Concat(
                (ByteString)AppKeyIdId(appId, GA_PREFIX_ITEM_TOKENS, machineId, itemIndex),
                (ByteString)count.ToByteArray());
            string tokenId = Storage.Get(Storage.CurrentContext, tokenKey);

            // Delete it
            Storage.Delete(Storage.CurrentContext, tokenKey);

            return tokenId;
        }

        /// <summary>
        /// Validate that caller is machine owner or app/platform admin.
        /// </summary>
        private static void RequireGachaMachineOwnerOrAdmin(string appId, GachaMachine machine)
        {
            UInt160 platformAdmin = Admin();
            if (platformAdmin != UInt160.Zero && Runtime.CheckWitness(platformAdmin))
                return;

            UInt160 appAdmin = GetGameAdmin(appId);
            if (appAdmin != UInt160.Zero && Runtime.CheckWitness(appAdmin))
                return;

            ExecutionEngine.Assert(
                Runtime.CheckWitness(machine.Owner),
                "unauthorized: not owner or admin");
        }

        // ---------------------------------------------------------------
        //  Gacha storage load/store
        // ---------------------------------------------------------------

        private static void StoreGachaMachine(string appId, BigInteger machineId, GachaMachine machine)
        {
            Storage.Put(Storage.CurrentContext,
                AppKey(appId, GA_PREFIX_MACHINES, machineId),
                StdLib.Serialize(machine));
        }

        private static GachaMachine LoadGachaMachine(string appId, BigInteger machineId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                AppKey(appId, GA_PREFIX_MACHINES, machineId));
            if (data == null) return new GachaMachine();
            return (GachaMachine)StdLib.Deserialize(data);
        }

        private static void StoreGachaItem(string appId, BigInteger machineId, BigInteger itemIndex, GachaItem item)
        {
            byte[] key = AppKeyIdId(appId, GA_PREFIX_MACHINE_ITEMS, machineId, itemIndex);
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(item));
        }

        private static GachaItem LoadGachaItem(string appId, BigInteger machineId, BigInteger itemIndex)
        {
            byte[] key = AppKeyIdId(appId, GA_PREFIX_MACHINE_ITEMS, machineId, itemIndex);
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            if (data == null) return new GachaItem();
            return (GachaItem)StdLib.Deserialize(data);
        }

        private static void StoreGachaPlay(string appId, BigInteger playId, GachaPlay play)
        {
            Storage.Put(Storage.CurrentContext,
                AppKey(appId, GA_PREFIX_PLAYS, playId),
                StdLib.Serialize(play));
        }

        private static GachaPlay LoadGachaPlay(string appId, BigInteger playId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                AppKey(appId, GA_PREFIX_PLAYS, playId));
            if (data == null) return new GachaPlay();
            return (GachaPlay)StdLib.Deserialize(data);
        }
    }
}
