using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class PlatformGameContract
    {
        // A Gacha play is resolved only by the oracle callback (ResolveGachaPull /
        // RefundGachaPlayFromOracle). If that callback never arrives — a Morpheus outage or
        // a stalled VRF — the player's escrowed stake would be locked forever. This
        // permissionless path lets ANYONE reclaim an unresolved play, always paying the
        // original pull price back to the stored player, once a fixed expiry window has
        // elapsed. So an oracle stall can no longer strand funds.
        private const long GA_PLAY_EXPIRY_MS = 3600000; // 1 hour

        public static void RefundExpiredGachaPlay(string appId, BigInteger playId)
        {
            RequireRegistered(appId);
            RequireGameType(appId, GameType_Gacha);

            GachaPlay play = LoadGachaPlay(appId, playId);
            ExecutionEngine.Assert(play.Player != UInt160.Zero, "play not found");
            ExecutionEngine.Assert(!play.Resolved, "already resolved");
            ExecutionEngine.Assert((BigInteger)Runtime.Time - play.Timestamp >= GA_PLAY_EXPIRY_MS, "play not expired");

            AcquireReentrancyLock(appId);

            // Effects before interaction: mark resolved so the late oracle callback
            // (which re-asserts !Resolved) and a second refund both no-op.
            play.Resolved = true;
            StoreGachaPlay(appId, playId, play);

            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, play.Player, play.Price),
                "gacha refund failed");

            ReleaseReentrancyLock(appId);
            OnGachaPlayRefunded(appId, play.Player, play.MachineId, playId, play.Price);
        }
    }
}
