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
        //  Player: pull gacha
        // ===================================================================

        /// <summary>
        /// Initiate a gacha pull.  Stores the play before requesting VRF
        /// randomness from the configured oracle.
        ///
        /// FLOW:
        /// 1. Validate machine is active and has inventory
        /// 2. Consume prepaid GAS credit
        /// 3. Store play data
        /// 4. Request VRF randomness and map requestId to playId
        ///
        /// Returns: playId
        /// </summary>
        public static BigInteger PullGacha(string appId, BigInteger machineId, UInt160 player)
        {
            RequireRegistered(appId);
            RequireNotPaused(appId);
            RequireGameType(appId, GameType_Gacha);

            ValidateUserOrAbstractAccount(player);

            GachaMachine machine = LoadGachaMachine(appId, machineId);
            ExecutionEngine.Assert(machine.Creator != UInt160.Zero, "machine not found");
            ExecutionEngine.Assert(machine.Active, "machine inactive");
            ExecutionEngine.Assert(!machine.Banned, "machine banned");
            ExecutionEngine.Assert(machine.TotalWeight > 0, "invalid odds");

            AcquireReentrancyLock(appId);

            ConsumeDirectGasCredit(appId, player, machine.Price);

            BigInteger playId = AppGetInt(appId, GA_PREFIX_PLAY_ID) + 1;
            AppPut(appId, GA_PREFIX_PLAY_ID, playId);

            GachaPlay play = new GachaPlay
            {
                Player = player,
                MachineId = machineId,
                ItemIndex = 0,
                Price = machine.Price,
                Timestamp = Runtime.Time,
                Resolved = false,
                Seed = (ByteString)new byte[0]
            };
            StoreGachaPlay(appId, playId, play);

            ByteString payload = StdLib.Serialize(new object[] { appId, playId, machineId });
            BigInteger requestId = RequestOracleForCallback(player, "vrf_random", payload);
            Storage.Put(Storage.CurrentContext, AppKey(appId, GA_PREFIX_REQ_TO_PLAY, requestId), playId);
            StoreOracleRequestContext(requestId, appId, GameType_Gacha, playId);

            ReleaseReentrancyLock(appId);

            OnGachaPlayInitiated(appId, player, machineId, playId, (ByteString)new byte[0]);
            return playId;
        }

        /// <summary>
        /// Resolve a gacha pull using oracle-provided VRF bytes, then transfer
        /// the prize atomically.
        ///
        /// SECURITY:
        /// - Only the configured oracle can call this entry point
        /// - Request-bound callbacks verify requestId -> playId before payout
        /// - Transfers prize atomically
        /// </summary>
        public static void ResolveGachaPull(string appId, BigInteger playId, BigInteger requestId, BigInteger randomResult)
        {
            // Audit fix H-12: settlement must always carry the original requestId; the
            // prior public entry hard-coded 0, and the internal resolver only enforced
            // the requestId mapping when requestId > 0, so any oracle (or an attacker
            // who reached this method) could resolve any play to any outcome.
            ValidateOracle();
            ExecutionEngine.Assert(requestId > 0, "requestId required");
            ResolveGachaPullFromOracle(appId, playId, requestId, (ByteString)randomResult.ToByteArray());
        }

        private static void ResolveGachaPullFromOracle(
            string appId,
            BigInteger playId,
            BigInteger requestId,
            ByteString oracleResult)
        {
            RequireRegistered(appId);
            RequireGameType(appId, GameType_Gacha);

            ExecutionEngine.Assert(requestId > 0, "requestId required");
            {
                byte[] reqKey = AppKey(appId, GA_PREFIX_REQ_TO_PLAY, requestId);
                ByteString mappedPlay = Storage.Get(Storage.CurrentContext, reqKey);
                ExecutionEngine.Assert(mappedPlay != null && (BigInteger)mappedPlay == playId, "oracle request mismatch");
                Storage.Delete(Storage.CurrentContext, reqKey);
            }

            GachaPlay play = LoadGachaPlay(appId, playId);
            ExecutionEngine.Assert(play.Player != UInt160.Zero, "play not found");
            ExecutionEngine.Assert(!play.Resolved, "already resolved");
            ExecutionEngine.Assert(oracleResult != null && oracleResult.Length > 0, "oracle result missing");

            AcquireReentrancyLock(appId);

            BigInteger machineId = play.MachineId;
            GachaMachine machine = LoadGachaMachine(appId, machineId);
            ExecutionEngine.Assert(machine.Creator != UInt160.Zero, "machine not found");

            ByteString seed = NormalizeOracleSeed(oracleResult);
            BigInteger expectedIndex = CalculateGachaSelection(appId, seed, machineId, machine.ItemCount);

            if (expectedIndex == 0)
            {
                // No items available - resolve as empty
                play.Resolved = true;
                StoreGachaPlay(appId, playId, play);
                ReleaseReentrancyLock(appId);
                OnGachaPlayResolved(appId, play.Player, machineId, 0, playId, 0, UInt160.Zero, 0, "");
                return;
            }

            GachaItem selectedItem = LoadGachaItem(appId, machineId, expectedIndex);
            ExecutionEngine.Assert(IsGachaItemAvailable(selectedItem), "item out of stock");
            BigInteger selectedAssetType = selectedItem.AssetType;
            UInt160 selectedAssetHash = selectedItem.AssetHash;

            // Transfer prize
            BigInteger awardedAmount = 0;
            string awardedTokenId = "";

            if (selectedAssetType == GA_ASSET_NEP17)
            {
                ExecutionEngine.Assert(selectedItem.Stock >= selectedItem.Amount, "insufficient stock");
                // Mirror audit fix M-1 (FlashLoan) / NEW-H-4 (EventTicketPass):
                // selectedAssetHash is user-controlled (any account can create a
                // gacha machine and pick the prize asset). CallFlags.All would let
                // a malicious asset's `transfer` method call other contracts and
                // re-enter the platform under our witness. AllowCall + AllowNotify
                // is sufficient for a legitimate NEP-17 settlement.
                bool ok = (bool)Contract.Call(selectedAssetHash, "transfer", CallFlags.AllowCall | CallFlags.AllowNotify,
                    Runtime.ExecutingScriptHash, play.Player, selectedItem.Amount, null);
                ExecutionEngine.Assert(ok, "prize transfer failed");

                awardedAmount = selectedItem.Amount;
                selectedItem.Stock -= selectedItem.Amount;
            }
            else if (selectedAssetType == GA_ASSET_NEP11)
            {
                ExecutionEngine.Assert(selectedItem.TokenCount > 0, "no tokens");
                // Pop last token from the token list
                string tokenId = PopGachaItemToken(appId, machineId, expectedIndex, selectedItem.TokenCount);
                selectedItem.TokenCount -= 1;
                bool ok = (bool)Contract.Call(selectedAssetHash, "transfer", CallFlags.AllowCall | CallFlags.AllowNotify,
                    Runtime.ExecutingScriptHash, play.Player, tokenId, null);
                ExecutionEngine.Assert(ok, "NFT transfer failed");

                awardedTokenId = tokenId;
                awardedAmount = 1;
            }

            StoreGachaItem(appId, machineId, expectedIndex, selectedItem);

            // Update play
            play.ItemIndex = expectedIndex;
            play.Resolved = true;
            play.Seed = null;
            StoreGachaPlay(appId, playId, play);

            // Update machine stats
            machine.Plays += 1;
            machine.Revenue += play.Price;
            machine.LastPlayedAt = Runtime.Time;
            StoreGachaMachine(appId, machineId, machine);

            ReleaseReentrancyLock(appId);

            OnGachaPlayResolved(appId, play.Player, machineId, expectedIndex, playId,
                selectedAssetType, selectedAssetHash, awardedAmount,
                awardedTokenId == null ? "" : awardedTokenId);
        }
    }
}
