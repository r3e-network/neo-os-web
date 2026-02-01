using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppTurtleMatch
    {
        #region Session Storage
        private static void SaveSession(GameSession session)
        {
            byte[] key = Helper.Concat(PREFIX_SESSION, (ByteString)session.SessionId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(session));
        }

        [Safe]
        public static GameSession GetSession(BigInteger sessionId)
        {
            byte[] key = Helper.Concat(PREFIX_SESSION, (ByteString)sessionId.ToByteArray());
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            if (data == null) return new GameSession();
            return (GameSession)StdLib.Deserialize(data);
        }

        private static void AddPlayerSession(UInt160 player, BigInteger sessionId)
        {
            byte[] countKey = Helper.Concat(PREFIX_PLAYER_SESSION_COUNT, (ByteString)player);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);

            byte[] indexKey = Helper.Concat(
                Helper.Concat(PREFIX_PLAYER_SESSIONS, (ByteString)player),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, indexKey, sessionId);

            Storage.Put(Storage.CurrentContext, countKey, count + 1);
        }
        #endregion

        #region Payment
        private static void PayReward(UInt160 player, BigInteger amount)
        {
            UInt160 gateway = Gateway();
            if (gateway != null && gateway.IsValid)
            {
                Contract.Call(gateway, "payout", CallFlags.All, player, amount);
            }
        }
        #endregion

        #region Verification Logic
        private static (BigInteger matches, BigInteger reward) CalculateGameResult(BigInteger boxCount, ByteString seed)
        {
            BigInteger totalMatches = 0;
            BigInteger totalReward = 0;
            ByteString currentSeed = seed;

            for (int i = 0; i < (int)boxCount; i++)
            {
                // Generate 9 colors per box
                int[] counts = new int[COLOR_COUNT];
                for (int j = 0; j < GRID_SIZE; j++)
                {
                    // Chain hash for next random value
                    currentSeed = CryptoLib.Sha256(currentSeed);
                    byte[] seedBytes = (byte[])currentSeed;
                    
                    // Convert to 0-99
                    BigInteger randNum = new BigInteger(seedBytes) % 100;
                    if (randNum < 0) randNum = -randNum;
                    
                    int color = GetColorFromOdds(randNum);
                    counts[color]++;
                }

                // Check matches (3 of a kind wins)
                for (int c = 0; c < COLOR_COUNT; c++)
                {
                     if (counts[c] >= 3) {
                         totalMatches++;
                         totalReward += COLOR_REWARDS[c];
                     }
                }
            }
            return (totalMatches, totalReward);
        }
        
        private static int GetColorFromOdds(BigInteger rand)
        {
            // COLOR_ODDS = { 20, 40, 58, 73, 85, 93, 98, 100 }
            if (rand < COLOR_ODDS[0]) return 0;
            if (rand < COLOR_ODDS[1]) return 1;
            if (rand < COLOR_ODDS[2]) return 2;
            if (rand < COLOR_ODDS[3]) return 3;
            if (rand < COLOR_ODDS[4]) return 4;
            if (rand < COLOR_ODDS[5]) return 5;
            if (rand < COLOR_ODDS[6]) return 6;
            return 7;
        }
        #endregion
    }
}
