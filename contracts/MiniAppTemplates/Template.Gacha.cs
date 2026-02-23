using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    [DisplayName("MiniAppTemplate.Gacha")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "On-Chain Blind Box Gacha Template")]
    [ContractPermission("*", "*")]
    public class TemplateGacha : MiniAppTemplate
    {
        private static readonly byte[] PREFIX_GACHA_PARAMS = new byte[] { 0x60 };

        public struct GachaParams
        {
            public BigInteger CostPerDraw;
            public BigInteger JackpotAmount;
            public uint JackpotProbability; // e.g. 5 out of 100
        }

        public static void InitializeGacha(BigInteger costPerDraw, BigInteger jackpotAmount, uint jackpotProbability)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Admin()), "unauthorized");
            GachaParams p = new GachaParams
            {
                CostPerDraw = costPerDraw,
                JackpotAmount = jackpotAmount,
                JackpotProbability = jackpotProbability
            };
            Storage.Put(Storage.CurrentContext, PREFIX_GACHA_PARAMS, StdLib.Serialize(p));
        }

        public static bool Draw()
        {
            UInt160 caller = Runtime.CallingScriptHash;
            byte[] paramsBytes = (byte[])Storage.Get(Storage.CurrentContext, PREFIX_GACHA_PARAMS);
            if (paramsBytes == null) throw new Exception("Gacha not initialized");
            
            GachaParams p = (GachaParams)StdLib.Deserialize((ByteString)paramsBytes);
            
            // Generate Randomness (0-99)
            uint randomVal = (uint)(Runtime.GetRandom() % 100);
            bool wonJackpot = randomVal < p.JackpotProbability;

            if (wonJackpot)
            {
                // Transfer jackpot (GAS)
                object[] args = new object[] { Runtime.ExecutingScriptHash, caller, p.JackpotAmount, null };
                Contract.Call(GAS.Hash, "transfer", CallFlags.All, args);
            }

            return wonJackpot;
        }
    }
}