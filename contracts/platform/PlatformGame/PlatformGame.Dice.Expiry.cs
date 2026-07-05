using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class PlatformGameContract
    {
        // A Dice bet is resolved only by the oracle callback (ResolveDiceBet /
        // RefundDiceBetFromOracle). If that callback never arrives — a Morpheus outage or
        // a stalled VRF — the player's escrowed stake would be locked forever. This
        // permissionless path lets ANYONE reclaim an unresolved bet, always paying the stake
        // back to the stored player, once a fixed expiry window has elapsed. So an oracle
        // stall can no longer strand funds.
        private const long DI_BET_EXPIRY_MS = 3600000; // 1 hour

        public static void RefundExpiredDiceBet(string appId, BigInteger betId)
        {
            RequireRegistered(appId);
            RequireGameType(appId, GameType_Dice);

            DiceBet bet = LoadDiceBet(appId, betId);
            ExecutionEngine.Assert(bet.Player != UInt160.Zero, "bet not found");
            ExecutionEngine.Assert(!bet.Resolved, "already resolved");
            ExecutionEngine.Assert((BigInteger)Runtime.Time - bet.Timestamp >= DI_BET_EXPIRY_MS, "bet not expired");

            AcquireReentrancyLock(appId);

            // Effects before interaction: mark resolved so the late oracle callback
            // (which re-asserts !Resolved) and a second refund both no-op.
            bet.Resolved = true;
            StoreDiceBet(appId, betId, bet);

            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, bet.Player, bet.Amount),
                "dice refund failed");

            ReleaseReentrancyLock(appId);
            OnDiceBetRefunded(appId, bet.Player, bet.Amount, betId);
        }
    }
}
