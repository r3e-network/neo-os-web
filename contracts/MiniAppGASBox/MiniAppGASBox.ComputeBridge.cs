using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        private abstract class GameComputeAccessor : MiniAppGameComputeBase
        {
            internal static void ValidateBet(UInt160 player, BigInteger amount) =>
                ValidateGameBetLimits(player, amount);

            internal static void RecordBet(UInt160 player, BigInteger amount) =>
                RecordGameBet(player, amount);

            internal static ByteString BuildSeed(BigInteger operationId, UInt160 user, string scriptName) =>
                GenerateOperationSeed(operationId, user, scriptName);

            internal static void EnsureScriptHash(string scriptName, ByteString scriptHash) =>
                ValidateScriptHash(scriptName, scriptHash);

            internal static void ClearSeed(BigInteger operationId) =>
                DeleteOperationSeed(operationId);

            internal static ByteString LoadSeed(BigInteger operationId) =>
                GetOperationSeed(operationId);

            internal static void RegisterHybridScript(string scriptName, ByteString scriptHash)
            {
                ValidateAdmin();
                ExecutionEngine.Assert(scriptName != null && scriptName.Length > 0 && scriptName.Length <= 64, "invalid script name");
                ExecutionEngine.Assert(scriptHash != null && scriptHash.Length == 32, "script hash must be 32 bytes");

                StorageMap nameMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_NAME);
                nameMap.Put(scriptName, scriptHash);

                StorageMap hashMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_HASH);
                hashMap.Put(scriptHash, scriptName);

                StorageMap versionMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_VERSION);
                ByteString currentVersion = versionMap.Get(scriptName);
                BigInteger nextVersion = currentVersion == null ? 1 : (BigInteger)currentVersion + 1;
                versionMap.Put(scriptName, nextVersion);

                StorageMap enabledMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_ENABLED);
                enabledMap.Put(scriptName, 1);
            }

            internal static void EnableHybridScript(string scriptName)
            {
                ValidateAdmin();
                StorageMap nameMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_NAME);
                ExecutionEngine.Assert(nameMap.Get(scriptName) != null, "script not registered");
                StorageMap enabledMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_ENABLED);
                enabledMap.Put(scriptName, 1);
            }

            internal static void DisableHybridScript(string scriptName)
            {
                ValidateAdmin();
                StorageMap nameMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_NAME);
                ExecutionEngine.Assert(nameMap.Get(scriptName) != null, "script not registered");
                StorageMap enabledMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_ENABLED);
                enabledMap.Put(scriptName, 0);
            }

            internal static Map<string, object> GetHybridScriptInfo(string scriptName)
            {
                Map<string, object> info = new Map<string, object>();
                ByteString hash = GetScriptHash(scriptName);
                if (hash == null)
                {
                    info["exists"] = false;
                    return info;
                }

                info["exists"] = true;
                info["name"] = scriptName;
                info["hash"] = hash;
                info["version"] = GetScriptVersion(scriptName);
                info["enabled"] = IsScriptEnabled(scriptName);
                return info;
            }
        }

        private static bool IsScriptEnabled(string scriptName) =>
            MiniAppComputeBase.IsScriptEnabled(scriptName);

        private static MiniAppGameComputeBase.GameBetLimitsConfig GetGameBetLimits() =>
            MiniAppGameComputeBase.GetGameBetLimits();

        private static void ValidateGameBetLimits(UInt160 player, BigInteger amount) =>
            GameComputeAccessor.ValidateBet(player, amount);

        private static ByteString GenerateOperationSeed(BigInteger operationId, UInt160 user, string scriptName) =>
            GameComputeAccessor.BuildSeed(operationId, user, scriptName);

        private static void RecordGameBet(UInt160 player, BigInteger amount) =>
            GameComputeAccessor.RecordBet(player, amount);

        private static void ValidateScriptHash(string scriptName, ByteString scriptHash) =>
            GameComputeAccessor.EnsureScriptHash(scriptName, scriptHash);

        private static ByteString GetRegisteredScriptHash(string scriptName) =>
            MiniAppComputeBase.GetScriptHash(scriptName);

        private static void DeleteOperationSeed(BigInteger operationId) =>
            GameComputeAccessor.ClearSeed(operationId);

        private static ByteString GetStoredOperationSeed(BigInteger operationId) =>
            GameComputeAccessor.LoadSeed(operationId);

        public static void RegisterScript(string scriptName, ByteString scriptHash) =>
            GameComputeAccessor.RegisterHybridScript(scriptName, scriptHash);

        public static void EnableScript(string scriptName) =>
            GameComputeAccessor.EnableHybridScript(scriptName);

        public static void DisableScript(string scriptName) =>
            GameComputeAccessor.DisableHybridScript(scriptName);

        public static Map<string, object> GetScriptInfo(string scriptName) =>
            GameComputeAccessor.GetHybridScriptInfo(scriptName);

        public static BigInteger DebugExpectedSelection(BigInteger playId)
        {
            ExecutionEngine.Assert(IsAdminWitness(), "debug: admin only");
            PlayData play = LoadPlay(playId);
            ByteString seed = play.Seed;
            if (seed == null)
            {
                seed = GetStoredOperationSeed(playId);
            }
            ByteString verifiedSeed = RequireByteString(seed, "seed missing");
            MachineData machine = LoadMachine(play.MachineId);
            return CalculateExpectedSelection(verifiedSeed, play.MachineId, machine.ItemCount);
        }

        public static Map<string, object> DebugSelectedItem(BigInteger playId)
        {
            ExecutionEngine.Assert(IsAdminWitness(), "debug: admin only");
            BigInteger selectedIndex = DebugExpectedSelection(playId);
            PlayData play = LoadPlay(playId);
            ItemData item = LoadItem(play.MachineId, selectedIndex);

            Map<string, object> map = new Map<string, object>();
            map["index"] = selectedIndex;
            map["assetType"] = item.AssetType;
            map["assetHash"] = item.AssetHash;
            map["amount"] = item.Amount;
            map["stock"] = item.Stock;
            map["tokenCount"] = item.TokenCount;
            map["tokenId"] = item.TokenId;
            return map;
        }

        public static bool DebugTransferSelectedItem(BigInteger playId)
        {
            ExecutionEngine.Assert(IsAdminWitness(), "debug: admin only");
            BigInteger selectedIndex = DebugExpectedSelection(playId);
            PlayData play = LoadPlay(playId);
            ItemData item = LoadItem(play.MachineId, selectedIndex);
            ExecutionEngine.Assert(item.AssetType == ASSET_NEP17, "debug transfer only supports NEP-17");
            return (bool)Contract.Call(item.AssetHash, "transfer", CallFlags.All,
                Runtime.ExecutingScriptHash, play.Player, item.Amount, null);
        }

        public static void DebugEmitPlayResolved(BigInteger playId)
        {
            ExecutionEngine.Assert(IsAdminWitness(), "debug: admin only");
            BigInteger selectedIndex = DebugExpectedSelection(playId);
            PlayData play = LoadPlay(playId);
            ItemData item = LoadItem(play.MachineId, selectedIndex);
            OnPlayResolved(play.Player, play.MachineId, selectedIndex, playId,
                item.AssetType, item.AssetHash, item.Amount, item.TokenId);
        }

        public static void DebugFinalizeSettlementState(BigInteger playId)
        {
            ExecutionEngine.Assert(IsAdminWitness(), "debug: admin only");
            BigInteger selectedIndex = DebugExpectedSelection(playId);
            PlayData play = LoadPlay(playId);
            ItemData item = LoadItem(play.MachineId, selectedIndex);
            MachineData machine = LoadMachine(play.MachineId);

            if (item.AssetType == ASSET_NEP17)
            {
                item.Stock -= item.Amount;
            }
            else if (item.AssetType == ASSET_NEP11)
            {
                item.TokenCount -= 1;
            }

            StoreItem(play.MachineId, selectedIndex, item);

            play.ItemIndex = selectedIndex;
            play.Resolved = true;
            StorePlay(playId, play);

            machine.Plays = machine.Plays + 1;
            machine.Revenue = machine.Revenue + play.Price;
            machine.LastPlayedAt = Runtime.Time;
            StoreMachine(play.MachineId, machine);

            DeleteOperationSeed(playId);
        }

        public static bool DebugTransferAndFinalize(BigInteger playId)
        {
            ExecutionEngine.Assert(IsAdminWitness(), "debug: admin only");
            BigInteger selectedIndex = DebugExpectedSelection(playId);
            PlayData play = LoadPlay(playId);
            ItemData item = LoadItem(play.MachineId, selectedIndex);
            MachineData machine = LoadMachine(play.MachineId);

            ExecutionEngine.Assert(item.AssetType == ASSET_NEP17, "debug path only supports NEP-17");
            bool ok = (bool)Contract.Call(item.AssetHash, "transfer", CallFlags.All,
                Runtime.ExecutingScriptHash, play.Player, item.Amount, null);
            ExecutionEngine.Assert(ok, "transfer failed");

            item.Stock -= item.Amount;
            StoreItem(play.MachineId, selectedIndex, item);

            play.ItemIndex = selectedIndex;
            play.Resolved = true;
            StorePlay(playId, play);

            machine.Plays = machine.Plays + 1;
            machine.Revenue = machine.Revenue + play.Price;
            machine.LastPlayedAt = Runtime.Time;
            StoreMachine(play.MachineId, machine);

            DeleteOperationSeed(playId);
            return true;
        }

        public static bool DebugTransferAndEmit(BigInteger playId)
        {
            ExecutionEngine.Assert(IsAdminWitness(), "debug: admin only");
            BigInteger selectedIndex = DebugExpectedSelection(playId);
            PlayData play = LoadPlay(playId);
            ItemData item = LoadItem(play.MachineId, selectedIndex);

            ExecutionEngine.Assert(item.AssetType == ASSET_NEP17, "debug path only supports NEP-17");
            bool ok = (bool)Contract.Call(item.AssetHash, "transfer", CallFlags.All,
                Runtime.ExecutingScriptHash, play.Player, item.Amount, null);
            ExecutionEngine.Assert(ok, "transfer failed");

            OnPlayResolved(play.Player, play.MachineId, selectedIndex, playId,
                item.AssetType, item.AssetHash, item.Amount, item.TokenId);
            return true;
        }

        public static void DebugFullSettle(BigInteger playId)
        {
            ExecutionEngine.Assert(IsAdminWitness(), "debug: admin only");
            BigInteger selectedIndex = DebugExpectedSelection(playId);
            OnDebugCheckpoint(1, playId, selectedIndex);

            PlayData play = LoadPlay(playId);
            OnDebugCheckpoint(2, playId, selectedIndex);

            ItemData selectedItem = LoadItem(play.MachineId, selectedIndex);
            OnDebugCheckpoint(3, playId, selectedIndex);

            BigInteger awardedAmount = 0;
            string awardedTokenId = "";

            if (selectedItem.AssetType == ASSET_NEP17)
            {
                awardedAmount = TransferNep17Prize(play.Player, ref selectedItem);
                OnDebugCheckpoint(4, playId, selectedIndex);
            }
            else if (selectedItem.AssetType == ASSET_NEP11)
            {
                awardedTokenId = TransferNep11Prize(play.Player, play.MachineId, selectedIndex, ref selectedItem);
                OnDebugCheckpoint(4, playId, selectedIndex);
            }

            StoreItem(play.MachineId, selectedIndex, selectedItem);

            play.ItemIndex = selectedIndex;
            play.Resolved = true;
            StorePlay(playId, play);

            MachineData machine = LoadMachine(play.MachineId);
            machine.Plays = machine.Plays + 1;
            machine.Revenue = machine.Revenue + play.Price;
            machine.LastPlayedAt = Runtime.Time;
            StoreMachine(play.MachineId, machine);

            DeleteOperationSeed(playId);
            OnDebugCheckpoint(5, playId, selectedIndex);

            EmitResolvedPlay(play.Player, play.MachineId, playId, selectedIndex, selectedItem, awardedAmount, awardedTokenId);
            OnDebugCheckpoint(6, playId, selectedIndex);
        }
    }
}
