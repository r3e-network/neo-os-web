using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // ===================================================================
    //  PlatformGame — RewardGame settlement lane
    //
    //  finalizeGame submits ONE Morpheus kernel request (module
    //  game.session, operation session.finalize) for the player's active
    //  game; the kernel replays the sealed op-log inside the TEE, verifies
    //  the fulfillment against the shared RUNTIME_VERIFIER, and delivers
    //  the fixed 79-byte result to onMiniAppResult. Settlement is effects-
    //  only (pull payment): the reservation is always released, a win draws
    //  its payout down from the pool into the player's credit, and a failed
    //  verification refunds the entry to the same credit (Status 4).
    // ===================================================================
    public partial class PlatformGameContract
    {
        #region FinalizeGame (submit the sealed op-log to the kernel) — player witness
        /// <summary>
        /// Submit the sealed op-log of the player's active game to the
        /// Morpheus kernel for finalization. The game is located through
        /// the player's active-game pointer (the clone ABI's gameId argument
        /// becomes the appId-first player argument here), ONE kernel request
        /// is submitted, and the requestId -> gameId context is stored so
        /// the callback can locate the game. Returns the kernel requestId.
        /// </summary>
        public static BigInteger FinalizeGame(string appId, UInt160 player, string sealedOpLogHex)
        {
            RequireRegistered(appId);
            RequireGameType(appId, GameType_RewardGame);
            ValidateAddress(player);
            ExecutionEngine.Assert(Runtime.CheckWitness(player), "player witness required");

            StorageContext ctx = Storage.CurrentContext;
            ByteString active = Storage.Get(ctx, AppKey(appId, RG_PREFIX_ACTIVE, player));
            ExecutionEngine.Assert(active is not null, "no active game");
            BigInteger gameId = (BigInteger)active;
            RewardGame g = LoadRewardGame(ctx, appId, gameId);
            ExecutionEngine.Assert(g.Status == 1, "game not in play");

            UInt160 oracle = Oracle();
            ExecutionEngine.Assert(oracle != UInt160.Zero && oracle.IsValid, "oracle not set");
            ByteString sealedOpLog = HexToBytes(sealedOpLogHex);

            BigInteger requestId = (BigInteger)Contract.Call(
                oracle,
                "submitMiniAppRequestFromIntegration",
                CallFlags.All,
                player, appId, RG_MODULE_ID, RG_OP_FINALIZE, sealedOpLog);
            ExecutionEngine.Assert(requestId > 0, "kernel request failed");

            Storage.Put(ctx, AppKey(appId, RG_PREFIX_REQUEST, requestId), gameId);
            g.Status = 5;
            Storage.Put(ctx, AppKey(appId, RG_PREFIX_GAME, gameId), StdLib.Serialize(g));
            OnRewardFinalizing(appId, gameId, player, requestId);
            return requestId;
        }
        #endregion

        #region Kernel callback (settlement) — oracle-only
        /// <summary>
        /// Rich kernel callback: the Morpheus kernel invokes this after
        /// FulfillRequest has already verified the TEE fulfillment against
        /// the shared RUNTIME_VERIFIER. This contract asserts caller ==
        /// Oracle(), locates the game from the (appId, requestId) context,
        /// parses the fixed finalize result and settles.
        /// </summary>
        public static void OnMiniAppResult(BigInteger requestId, string appId, string moduleId,
            string operation, UInt160 requester, bool success, ByteString result, string error)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == Oracle(), "oracle only");
            ExecutionEngine.Assert(moduleId == RG_MODULE_ID, "unexpected module");
            ExecutionEngine.Assert(operation == RG_OP_FINALIZE, "unexpected operation");

            StorageContext ctx = Storage.CurrentContext;
            byte[] reqKey = AppKey(appId, RG_PREFIX_REQUEST, requestId);
            ByteString stored = Storage.Get(ctx, reqKey);
            ExecutionEngine.Assert(stored is not null, "request context not found");
            BigInteger gameId = (BigInteger)stored;

            // The callback binds the game's player as requester (the kernel
            // delivers whoever submitted the request; anything else is a
            // mis-routed or replayed delivery).
            RewardGame g = LoadRewardGame(ctx, appId, gameId);
            ExecutionEngine.Assert(g.Player == requester, "requester mismatch");

            // Always consume the context (audit: ExpireGame used to wedge
            // late callbacks and leak this row). A late delivery for a game
            // that already expired/settled/refunded is an idempotent no-op —
            // the reservation was already released by that lane.
            Storage.Delete(ctx, reqKey);
            if (g.Status != 5) return;

            SettleRewardGame(ctx, appId, gameId, success, result);
        }
        #endregion

        #region Settle body (parse the fixed result codec, pay / release / refund) — internal
        private static void SettleRewardGame(StorageContext ctx, string appId, BigInteger gameId, bool success, ByteString result)
        {
            RewardGame g = LoadRewardGame(ctx, appId, gameId);
            ExecutionEngine.Assert(g.Status == 5, "game not settling");
            RewardEconomics econ = LoadEconomics(appId);

            BigInteger payout = 0;
            BigInteger elapsedMs = 0;
            BigInteger undos = 0;
            BigInteger score = 0;
            bool solved = false;
            ByteString commitment = "";
            ByteString answerHash = "";

            if (success)
            {
                RewardFinalizeResult r = ParseRewardResult(result);
                ExecutionEngine.Assert(r.Difficulty == g.Difficulty, "difficulty mismatch");
                ExecutionEngine.Assert(r.Undos >= 0 && r.Undos <= RG_MAX_UNDOS, "undos out of range");
                ExecutionEngine.Assert(r.ElapsedMs >= RewardMinSolveMsOf(econ, g.Difficulty), "solved too fast");
                ExecutionEngine.Assert(r.ElapsedMs <= RewardLimitMsOf(econ, g.Difficulty), "time limit exceeded");
                elapsedMs = r.ElapsedMs;
                undos = r.Undos;
                score = r.Score;
                commitment = r.Commitment;
                answerHash = r.AnswerHash;
                if (score >= RewardTargetScoreOf(econ, g.Difficulty))
                {
                    solved = true;
                    // Payout = reward * (10000 - undoPenaltyBps * undos) / 10000.
                    BigInteger penalty = econ.UndoPenaltyBps * undos;
                    if (penalty > 10000) penalty = 10000;
                    payout = g.Reward * (10000 - penalty) / 10000;
                }
            }

            // Effects (pull payment — no transfer here). The reservation is
            // always released; only a winning run draws its payout down from
            // the pool into the player's credit.
            Storage.Put(ctx, AppKey(appId, RG_PREFIX_RESERVED),
                (BigInteger)Storage.Get(ctx, AppKey(appId, RG_PREFIX_RESERVED)) - g.Reward);
            if (payout > 0)
            {
                Storage.Put(ctx, AppKey(appId, RG_PREFIX_POOL),
                    (BigInteger)Storage.Get(ctx, AppKey(appId, RG_PREFIX_POOL)) - payout);
                AddRewardCredit(ctx, appId, g.Player, payout);
            }

            RewardStats s = LoadRewardStats(ctx, appId, g.Player);
            if (payout > 0)
            {
                s.Solved += 1;
                s.TotalWon += payout;
                Storage.Put(ctx, AppKey(appId, RG_PREFIX_STATS, g.Player), StdLib.Serialize(s));
            }

            ClearRewardActive(ctx, appId, g.Player, gameId);
            if (success)
            {
                g.Status = 2;
            }
            else
            {
                // Refund-on-failure (design section 3.3): the kernel could
                // not verify the run, so the entry moves back out of the
                // pool into the player's credit (reversing the start-game
                // move) and the game closes as refunded (Status 4) — the
                // framework SDK already maps that status.
                if (g.Entry > 0)
                {
                    Storage.Put(ctx, AppKey(appId, RG_PREFIX_POOL),
                        (BigInteger)Storage.Get(ctx, AppKey(appId, RG_PREFIX_POOL)) - g.Entry);
                    AddRewardCredit(ctx, appId, g.Player, g.Entry);
                }
                g.Status = 4;
            }
            g.Payout = payout;
            g.SolveMs = elapsedMs;
            g.Undos = undos;
            g.Score = score;
            g.Commitment = commitment;
            g.AnswerHash = answerHash;
            Storage.Put(ctx, AppKey(appId, RG_PREFIX_GAME, gameId), StdLib.Serialize(g));

            // Solved fires only on a verified solve (audit: refunded and
            // below-target runs used to emit it too, writing phantom
            // leaderboard rows — frontends rebuild rankings from this event).
            if (solved)
            {
                OnRewardSolved(appId, gameId, g.Player, g.Difficulty, elapsedMs, score, payout, s.TotalWon);
            }
        }
        #endregion

        #region Withdraw credit (pull payment) — pause-immune user exit
        /// <summary>Reclaim the whole credit balance (unused entries + won payouts).</summary>
        public static BigInteger Withdraw(string appId, UInt160 account)
        {
            RequireRegistered(appId);
            RequireGameType(appId, GameType_RewardGame);
            ValidateAddress(account);
            ExecutionEngine.Assert(Runtime.CheckWitness(account), "account witness required");
            StorageContext ctx = Storage.CurrentContext;
            byte[] key = AppKey(appId, RG_PREFIX_CREDIT, account);
            BigInteger credit = (BigInteger)Storage.Get(ctx, key);
            ExecutionEngine.Assert(credit > 0, "no credit");
            // Checks-effects-interactions: the ledger and the liability
            // counter are debited before the GAS moves. Deliberately no
            // pause consult — user exits are pause-immune (anchor invariant).
            Storage.Delete(ctx, key);
            AdjustRewardHeld(appId, -credit);
            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, account, credit),
                "withdraw transfer failed");
            OnRewardCreditWithdrawn(appId, account, credit);
            return credit;
        }
        #endregion

        #region Result codec (0x02 || commitment(32) || answerHash(32) || elapsedMs(u64BE) || undos(1) || score(u32BE) || difficulty(1))
        private struct RewardFinalizeResult
        {
            public ByteString Commitment;
            public ByteString AnswerHash;
            public BigInteger ElapsedMs;
            public BigInteger Undos;
            public BigInteger Score;
            public BigInteger Difficulty;
        }

        private static RewardFinalizeResult ParseRewardResult(ByteString result)
        {
            byte[] r = (byte[])result;
            ExecutionEngine.Assert(r.Length == 79, "bad result length");
            ExecutionEngine.Assert(r[0] == 0x02, "bad result tag");
            return new RewardFinalizeResult
            {
                Commitment = (ByteString)RewardSlice(r, 1, 32),
                AnswerHash = (ByteString)RewardSlice(r, 33, 32),
                ElapsedMs = RewardBeUint(r, 65, 8),
                Undos = r[73],
                Score = RewardBeUint(r, 74, 4),
                Difficulty = r[78],
            };
        }

        private static byte[] RewardSlice(byte[] source, int offset, int length)
        {
            byte[] output = new byte[length];
            for (int i = 0; i < length; i++) output[i] = source[offset + i];
            return output;
        }

        private static BigInteger RewardBeUint(byte[] source, int offset, int length)
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
        #endregion
    }
}
