using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppJumpRush
    {
        private const string DOMAIN_BIND = "miniapp-game-bind-v1";
        private const string DOMAIN_SETTLE = "miniapp-game-settle-v1";

        #region BindPuzzle
        public static void BindPuzzle(BigInteger gameId, string commitmentHex, string signatureHex)
        {
            StorageContext ctx = Storage.CurrentContext;
            Game g = LoadGame(ctx, gameId);
            ExecutionEngine.Assert(g.Status == 0, "game not awaiting bind");
            ByteString commitment = (ByteString)HexToBytes(commitmentHex, 32);
            ByteString signature = (ByteString)HexToBytes(signatureHex, 64);

            ByteString digest = BuildBindDigest(gameId, g.Player, g.Difficulty, commitment);
            ExecutionEngine.Assert(
                CryptoLib.VerifyWithECDsa(digest, TeeSignerStored(ctx), signature, NamedCurveHash.secp256r1SHA256),
                "invalid tee signature");

            g.Commitment = commitment;
            g.DealtAt = Runtime.Time;
            g.Deadline = g.DealtAt + LimitMsOf(g.Difficulty);
            g.Status = 1;
            Storage.Put(ctx, GameKey(gameId), StdLib.Serialize(g));
            OnPuzzleBound(gameId, g.Player, commitmentHex, g.DealtAt, g.Deadline);
        }
        #endregion

        #region SettleVerified
        public static BigInteger SettleVerified(BigInteger gameId, string problemHashHex,
            string answerHashHex, BigInteger elapsedMs, BigInteger undos, string signatureHex)
        {
            StorageContext ctx = Storage.CurrentContext;
            Game g = LoadGame(ctx, gameId);
            ExecutionEngine.Assert(g.Status == 1, "game not in play");
            ByteString problemHash = (ByteString)HexToBytes(problemHashHex, 32);
            ExecutionEngine.Assert(problemHash == g.Commitment, "problem does not match the committed puzzle");
            ByteString answerHash = (ByteString)HexToBytes(answerHashHex, 32);
            ExecutionEngine.Assert(undos >= 0 && undos <= MAX_UNDOS, "undos out of range");
            ExecutionEngine.Assert(elapsedMs >= MinSolveMsOf(g.Difficulty), "solved too fast");
            ExecutionEngine.Assert(elapsedMs <= LimitMsOf(g.Difficulty), "time limit exceeded");
            ExecutionEngine.Assert((BigInteger)Runtime.Time <= g.Deadline + SETTLE_GRACE_MS, "settlement window closed");
            ByteString signature = (ByteString)HexToBytes(signatureHex, 64);

            ByteString digest = BuildSettleDigest(gameId, g.Player, g.Difficulty, problemHash, answerHash, elapsedMs, undos);
            ExecutionEngine.Assert(
                CryptoLib.VerifyWithECDsa(digest, TeeSignerStored(ctx), signature, NamedCurveHash.secp256r1SHA256),
                "invalid tee signature");

            BigInteger payout = g.Reward * (100 - UNDO_PENALTY_PCT * undos) / 100;

            Storage.Put(ctx, PREFIX_RESERVED, (BigInteger)Storage.Get(ctx, PREFIX_RESERVED) - g.Reward);
            Storage.Put(ctx, PREFIX_POOL, (BigInteger)Storage.Get(ctx, PREFIX_POOL) - payout);
            AddCredit(ctx, g.Player, payout);

            Stats s = LoadStats(ctx, g.Player);
            s.Solved += 1;
            s.TotalWon += payout;
            Storage.Put(ctx, StatsKey(g.Player), StdLib.Serialize(s));

            BigInteger topWon = (BigInteger)Storage.Get(ctx, PREFIX_TOP_WON);
            if (s.TotalWon > topWon)
            {
                Storage.Put(ctx, PREFIX_TOP_ADDR, g.Player);
                Storage.Put(ctx, PREFIX_TOP_WON, s.TotalWon);
            }

            ClearActive(ctx, g.Player, gameId);
            g.Status = 2;
            g.Payout = payout;
            g.SolveMs = elapsedMs;
            g.Undos = undos;
            g.AnswerHash = answerHash;
            Storage.Put(ctx, GameKey(gameId), StdLib.Serialize(g));

            OnSolved(gameId, g.Player, g.Difficulty, elapsedMs, undos, payout, s.TotalWon);
            return payout;
        }
        #endregion

        #region Digest helpers
        private static ECPoint TeeSignerStored(StorageContext ctx)
        {
            ByteString raw = Storage.Get(ctx, PREFIX_TEE_PUB);
            ExecutionEngine.Assert(raw is not null, "tee signer not configured");
            return (ECPoint)(byte[])raw;
        }

        private static ByteString BuildBindDigest(BigInteger gameId, UInt160 player,
            BigInteger difficulty, ByteString commitment)
        {
            byte[] payload = Helper.Concat((byte[])(ByteString)DOMAIN_BIND, ToUInt256Bytes(gameId));
            payload = Helper.Concat(payload, (byte[])player);
            payload = Helper.Concat(payload, new byte[] { (byte)difficulty });
            payload = Helper.Concat(payload, (byte[])commitment);
            payload = Helper.Concat(payload, (byte[])(ByteString)Runtime.ExecutingScriptHash);
            payload = Helper.Concat(payload, NetworkMagicLe4());
            return CryptoLib.Sha256((ByteString)payload);
        }

        private static ByteString BuildSettleDigest(BigInteger gameId, UInt160 player, BigInteger difficulty,
            ByteString problemHash, ByteString answerHash, BigInteger elapsedMs, BigInteger undos)
        {
            byte[] payload = Helper.Concat((byte[])(ByteString)DOMAIN_SETTLE, ToUInt256Bytes(gameId));
            payload = Helper.Concat(payload, (byte[])player);
            payload = Helper.Concat(payload, new byte[] { (byte)difficulty });
            payload = Helper.Concat(payload, (byte[])problemHash);
            payload = Helper.Concat(payload, (byte[])answerHash);
            payload = Helper.Concat(payload, ToUInt256Bytes(elapsedMs));
            payload = Helper.Concat(payload, new byte[] { (byte)undos });
            payload = Helper.Concat(payload, (byte[])(ByteString)Runtime.ExecutingScriptHash);
            payload = Helper.Concat(payload, NetworkMagicLe4());
            return CryptoLib.Sha256((ByteString)payload);
        }

        private static byte[] ToUInt256Bytes(BigInteger value)
        {
            ExecutionEngine.Assert(value >= 0, "invalid uint256");
            byte[] raw = value.ToByteArray();
            int length = raw.Length;
            if (length > 32)
            {
                ExecutionEngine.Assert(length == 33 && raw[32] == 0, "uint256 overflow");
                length = 32;
            }
            byte[] output = new byte[32];
            for (int index = 0; index < length; index++)
            {
                output[31 - index] = raw[index];
            }
            return output;
        }

        private static byte[] NetworkMagicLe4()
        {
            BigInteger net = (BigInteger)Runtime.GetNetwork();
            return new byte[]
            {
                (byte)(net & 0xFF),
                (byte)((net / 256) & 0xFF),
                (byte)((net / 65536) & 0xFF),
                (byte)((net / 16777216) & 0xFF),
            };
        }

        private static byte[] HexToBytes(string hex, int expectedBytes)
        {
            ExecutionEngine.Assert(hex is not null && ((ByteString)hex).Length == expectedBytes * 2, "invalid hex argument");
            byte[] chars = (byte[])(ByteString)hex;
            byte[] result = new byte[expectedBytes];
            for (int i = 0; i < expectedBytes; i++)
            {
                result[i] = (byte)(HexNibble(chars[i * 2]) * 16 + HexNibble(chars[i * 2 + 1]));
            }
            return result;
        }

        private static int HexNibble(int c)
        {
            if (c >= 48 && c <= 57) return c - 48;
            ExecutionEngine.Assert(c >= 97 && c <= 102, "invalid hex argument");
            return c - 87;
        }
        #endregion
    }
}