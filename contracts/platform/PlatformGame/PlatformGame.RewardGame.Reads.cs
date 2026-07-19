using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // ===================================================================
    //  PlatformGame — RewardGame read surface
    //
    //  The framework's hardcoded reads (reward-game-sdk.ts), verbatim with
    //  appId first: freePool / creditOf / activeGameOf / getGame / statsOf,
    //  plus the clone fleet's auxiliary reads (poolBalance / reservedPool /
    //  lastGameId / dailyStartsOf / gameOfRequest) and the liability
    //  counter heldForApp that the solvency invariant is checked against.
    // ===================================================================
    public partial class PlatformGameContract
    {
        private const string RG_HEX_DIGITS = "0123456789abcdef";

        #region Read-only
        /// <summary>Reward pool balance (base units, includes entries paid in).</summary>
        [Safe]
        public static BigInteger PoolBalance(string appId) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, AppKey(appId, RG_PREFIX_POOL));

        /// <summary>Sum of base rewards held by active games (base units).</summary>
        [Safe]
        public static BigInteger ReservedPool(string appId) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, AppKey(appId, RG_PREFIX_RESERVED));

        /// <summary>Pool not reserved by active games (base units).</summary>
        [Safe]
        public static BigInteger FreePool(string appId)
        {
            StorageContext ctx = Storage.CurrentContext;
            return (BigInteger)Storage.Get(ctx, AppKey(appId, RG_PREFIX_POOL))
                 - (BigInteger)Storage.Get(ctx, AppKey(appId, RG_PREFIX_RESERVED));
        }

        /// <summary>The player's pull-payment credit: prepaid entries + won payouts.</summary>
        [Safe]
        public static BigInteger CreditOf(string appId, UInt160 player) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, AppKey(appId, RG_PREFIX_CREDIT, player));

        /// <summary>
        /// The per-app liability counter: GAS this engine custodies for the
        /// tenant. Invariant: heldForApp == freePool + reserved + sum(credits).
        /// </summary>
        [Safe]
        public static BigInteger HeldForApp(string appId) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, AppKey(appId, RG_PREFIX_HELD));

        [Safe]
        public static BigInteger LastGameId(string appId) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, AppKey(appId, RG_PREFIX_GAME_ID));

        /// <summary>The player's unfinished gameId, or 0 when none.</summary>
        [Safe]
        public static BigInteger ActiveGameOf(string appId, UInt160 player) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, AppKey(appId, RG_PREFIX_ACTIVE, player));

        /// <summary>Starts the player has used in the current UTC day.</summary>
        [Safe]
        public static BigInteger DailyStartsOf(string appId, UInt160 player)
        {
            BigInteger day = (BigInteger)Runtime.Time / RG_MS_PER_DAY;
            return (BigInteger)Storage.Get(Storage.CurrentContext, RewardDayKey(appId, day, player));
        }

        /// <summary>The gameId a finalize request is bound to, or 0 when unknown.</summary>
        [Safe]
        public static BigInteger GameOfRequest(string appId, BigInteger requestId) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, AppKey(appId, RG_PREFIX_REQUEST, requestId));

        [Safe]
        public static Map<string, object> StatsOf(string appId, UInt160 player)
        {
            RewardStats s = LoadRewardStats(Storage.CurrentContext, appId, player);
            Map<string, object> r = new Map<string, object>();
            r["played"] = s.Played;
            r["solved"] = s.Solved;
            r["totalWon"] = s.TotalWon;
            return r;
        }

        /// <summary>Full game record; commitment/answerHash are lowercase hex ("" until set).</summary>
        [Safe]
        public static Map<string, object> GetGame(string appId, BigInteger gameId)
        {
            RewardGame g = LoadRewardGame(Storage.CurrentContext, appId, gameId);
            Map<string, object> r = new Map<string, object>();
            r["id"] = gameId;
            r["player"] = g.Player;
            r["difficulty"] = g.Difficulty;
            r["entry"] = g.Entry;
            r["reward"] = g.Reward;
            r["startTime"] = g.StartTime;
            r["commitment"] = RewardToHex(g.Commitment);
            r["dealtAt"] = g.DealtAt;
            r["deadline"] = g.Deadline;
            r["undos"] = g.Undos;
            r["status"] = g.Status;
            r["payout"] = g.Payout;
            r["solveMs"] = g.SolveMs;
            r["answerHash"] = RewardToHex(g.AnswerHash);
            r["ringsHit"] = g.Score;
            return r;
        }

        /// <summary>Lowercase hex encoding, two chars per byte.</summary>
        private static string RewardToHex(ByteString value)
        {
            byte[] v = (byte[])value;
            byte[] hex = (byte[])(ByteString)RG_HEX_DIGITS;
            byte[] outChars = new byte[v.Length * 2];
            for (int i = 0; i < v.Length; i++)
            {
                int b = v[i] & 0xFF;
                outChars[i * 2] = hex[b >> 4];
                outChars[i * 2 + 1] = hex[b & 0x0F];
            }
            return (string)(ByteString)outChars;
        }
        #endregion
    }
}
