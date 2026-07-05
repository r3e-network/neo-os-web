using System;
using System.Numerics;
using System.Security.Cryptography;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    /// <summary>
    /// Test-side twin of the skill games' finalize RESULT CODEC (MiniApp*.Oracle.cs
    /// ParseResult). The worker builds this byte-for-byte, the kernel signs
    /// SHA256(result), and the contract parses it by offset:
    ///
    ///   byte[0]        = 0x02                       // finalize tag
    ///   bytes[1..33]   = commitment (32)            // sha256 of the TEE problem canonical
    ///   bytes[33..65]  = answerHash (32)            // sha256 of the enclave-derived answer
    ///   bytes[65..73]  = elapsedMs  (uint64 BE, 8)  // enclave-clock solve time
    ///   byte[73]       = undos      (uint8)         // 0..3
    ///   bytes[74..78]  = score      (uint32 BE, 4)
    ///   byte[78]       = difficulty (uint8)         // 0..2
    ///   total 79 bytes
    /// </summary>
    internal static class GameResultCodec
    {
        public const byte FinalizeTag = 0x02;

        public static byte[] Build(byte[] commitment, byte[] answerHash,
            ulong elapsedMs, byte undos, uint score, byte difficulty)
        {
            if (commitment.Length != 32) throw new ArgumentException("commitment must be 32 bytes");
            if (answerHash.Length != 32) throw new ArgumentException("answerHash must be 32 bytes");

            byte[] r = new byte[79];
            r[0] = FinalizeTag;
            Buffer.BlockCopy(commitment, 0, r, 1, 32);
            Buffer.BlockCopy(answerHash, 0, r, 33, 32);
            WriteBe(r, 65, elapsedMs, 8);
            r[73] = undos;
            WriteBe(r, 74, score, 4);
            r[78] = difficulty;
            return r;
        }

        /// <summary>The kernel signs SHA256(result); the golden vector cross-pins it.</summary>
        public static byte[] Sha256(byte[] result) => SHA256.HashData(result);

        public static string Hex(byte[] bytes) => Convert.ToHexString(bytes).ToLowerInvariant();

        private static void WriteBe(byte[] buffer, int offset, ulong value, int length)
        {
            for (int i = length - 1; i >= 0; i--)
            {
                buffer[offset + i] = (byte)(value & 0xFF);
                value >>= 8;
            }
        }
    }
}
