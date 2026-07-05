using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppAimMaster
    {
        #region FinalizeGame (submit the sealed op-log to the kernel) — player witness
        /// <summary>
        /// Submit the sealed op-log of an active game to the Morpheus kernel for
        /// finalization. Asserts the caller owns the active game, then submits ONE
        /// kernel request (module game.session, operation session.finalize) and stores
        /// the requestId -> gameId context so the callback can locate the game. Marks
        /// the game as settling. Returns the kernel requestId.
        /// </summary>
        public static BigInteger FinalizeGame(BigInteger gameId, string sealedOpLogHex)
        {
            StorageContext ctx = Storage.CurrentContext;
            Game g = LoadGame(ctx, gameId);
            ExecutionEngine.Assert(g.Status == 1, "game not in play");
            ExecutionEngine.Assert(Runtime.CheckWitness(g.Player), "player witness required");

            UInt160 oracle = Oracle();
            ExecutionEngine.Assert(oracle != UInt160.Zero && oracle.IsValid, "oracle not set");
            ByteString sealedOpLog = HexToBytes(sealedOpLogHex);

            BigInteger requestId = (BigInteger)Contract.Call(
                oracle,
                "submitMiniAppRequestFromIntegration",
                CallFlags.All,
                g.Player, APP_ID, MODULE_ID, OP_FINALIZE, sealedOpLog);
            ExecutionEngine.Assert(requestId > 0, "kernel request failed");

            Storage.Put(ctx, RequestKey(requestId), gameId);
            g.Status = 5;
            Storage.Put(ctx, GameKey(gameId), StdLib.Serialize(g));
            OnFinalizing(gameId, g.Player, requestId);
            return requestId;
        }
        #endregion

        #region Kernel callbacks (settlement) — oracle-only
        /// <summary>
        /// Rich kernel callback: the Morpheus kernel invokes this after FulfillRequest
        /// has already verified the TEE fulfillment against the shared RUNTIME_VERIFIER.
        /// This contract only asserts caller==Oracle(), locates the game from the
        /// requestId context, parses the fixed finalize result and settles.
        /// </summary>
        public static void onMiniAppResult(BigInteger requestId, string appId, string moduleId,
            string operation, UInt160 requester, bool success, ByteString result, string error)
        {
            StorageContext ctx = Storage.CurrentContext;
            ExecutionEngine.Assert(Runtime.CallingScriptHash == Oracle(), "oracle only");
            ExecutionEngine.Assert(operation == OP_FINALIZE, "unexpected operation");

            byte[] reqKey = RequestKey(requestId);
            ByteString stored = Storage.Get(ctx, reqKey);
            ExecutionEngine.Assert(stored is not null, "request context not found");
            BigInteger gameId = (BigInteger)stored;
            Storage.Delete(ctx, reqKey);

            Settle(ctx, gameId, success, result);
        }

        /// <summary>5-arg legacy adapter for kernels that only deliver onOracleResult.</summary>
        public static void onOracleResult(BigInteger requestId, string operation, bool success,
            ByteString result, string error)
        {
            onMiniAppResult(requestId, APP_ID, MODULE_ID, operation, UInt160.Zero, success, result, error);
        }
        #endregion

        #region Settle body (parse the fixed result codec, pay or release) — internal
        private static void Settle(StorageContext ctx, BigInteger gameId, bool success, ByteString result)
        {
            Game g = LoadGame(ctx, gameId);
            ExecutionEngine.Assert(g.Status == 5, "game not settling");

            BigInteger payout = 0;
            BigInteger elapsedMs = 0;
            BigInteger undos = 0;
            BigInteger score = 0;
            ByteString commitment = "";
            ByteString answerHash = "";

            if (success)
            {
                FinalizeResult r = ParseResult(result);
                ExecutionEngine.Assert(r.Difficulty == g.Difficulty, "difficulty mismatch");
                ExecutionEngine.Assert(r.Undos >= 0 && r.Undos <= MAX_UNDOS, "undos out of range");
                ExecutionEngine.Assert(r.ElapsedMs >= MinSolveMsOf(g.Difficulty), "solved too fast");
                ExecutionEngine.Assert(r.ElapsedMs <= LimitMsOf(g.Difficulty), "time limit exceeded");
                elapsedMs = r.ElapsedMs;
                undos = r.Undos;
                score = r.Score;
                commitment = r.Commitment;
                answerHash = r.AnswerHash;
                if (score >= TargetScoreOf(g.Difficulty))
                {
                    payout = g.Reward * (100 - UNDO_PENALTY_PCT * undos) / 100;
                }
            }

            // Effects (pull payment — no transfer here). The reservation is always
            // released; only a winning run draws its payout down from the pool.
            Storage.Put(ctx, PREFIX_RESERVED, (BigInteger)Storage.Get(ctx, PREFIX_RESERVED) - g.Reward);
            if (payout > 0)
            {
                Storage.Put(ctx, PREFIX_POOL, (BigInteger)Storage.Get(ctx, PREFIX_POOL) - payout);
                AddCredit(ctx, g.Player, payout);
            }

            Stats s = LoadStats(ctx, g.Player);
            if (payout > 0)
            {
                s.Solved += 1;
                s.TotalWon += payout;
                Storage.Put(ctx, StatsKey(g.Player), StdLib.Serialize(s));

                BigInteger topWon = (BigInteger)Storage.Get(ctx, PREFIX_TOP_WON);
                if (s.TotalWon > topWon)
                {
                    Storage.Put(ctx, PREFIX_TOP_ADDR, g.Player);
                    Storage.Put(ctx, PREFIX_TOP_WON, s.TotalWon);
                }
            }

            ClearActive(ctx, g.Player, gameId);
            g.Status = 2;
            g.Payout = payout;
            g.SolveMs = elapsedMs;
            g.Undos = undos;
            g.Score = score;
            g.Commitment = commitment;
            g.AnswerHash = answerHash;
            Storage.Put(ctx, GameKey(gameId), StdLib.Serialize(g));

            OnSolved(gameId, g.Player, g.Difficulty, elapsedMs, score, payout, s.TotalWon);
        }
        #endregion

        #region Result codec (0x02 || commitment(32) || answerHash(32) || elapsedMs(u64BE) || undos(1) || score(u32BE) || difficulty(1))
        private struct FinalizeResult
        {
            public ByteString Commitment;
            public ByteString AnswerHash;
            public BigInteger ElapsedMs;
            public BigInteger Undos;
            public BigInteger Score;
            public BigInteger Difficulty;
        }

        private static FinalizeResult ParseResult(ByteString result)
        {
            byte[] r = (byte[])result;
            ExecutionEngine.Assert(r.Length == 79, "bad result length");
            ExecutionEngine.Assert(r[0] == 0x02, "bad result tag");
            return new FinalizeResult
            {
                Commitment = (ByteString)Slice(r, 1, 32),
                AnswerHash = (ByteString)Slice(r, 33, 32),
                ElapsedMs = BeUint(r, 65, 8),
                Undos = r[73],
                Score = BeUint(r, 74, 4),
                Difficulty = r[78],
            };
        }

        private static byte[] Slice(byte[] source, int offset, int length)
        {
            byte[] output = new byte[length];
            for (int i = 0; i < length; i++) output[i] = source[offset + i];
            return output;
        }

        private static BigInteger BeUint(byte[] source, int offset, int length)
        {
            BigInteger value = 0;
            for (int i = 0; i < length; i++) value = value * 256 + source[offset + i];
            return value;
        }

        private static ByteString HexToBytes(string hex)
        {
            byte[] chars = (byte[])(ByteString)hex;
            ExecutionEngine.Assert(chars.Length % 2 == 0, "invalid hex argument");
            int outLen = chars.Length / 2;
            byte[] result = new byte[outLen];
            for (int i = 0; i < outLen; i++)
            {
                result[i] = (byte)(HexNibble(chars[i * 2]) * 16 + HexNibble(chars[i * 2 + 1]));
            }
            return (ByteString)result;
        }

        private static int HexNibble(int c)
        {
            if (c >= 48 && c <= 57) return c - 48;              // '0'..'9'
            ExecutionEngine.Assert(c >= 97 && c <= 102, "invalid hex argument"); // 'a'..'f'
            return c - 87;
        }

        private static byte[] RequestKey(BigInteger requestId) =>
            Helper.Concat(PREFIX_REQUEST, (byte[])(ByteString)requestId);
        #endregion
    }
}
