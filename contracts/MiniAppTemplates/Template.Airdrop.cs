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
    [DisplayName("MiniAppTemplate.Airdrop")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Multi-Chain Airdrop & Faucet Template")]
    [ContractPermission("*", "*")]
    public class TemplateAirdrop : MiniAppTemplate
    {
        private static readonly byte[] PREFIX_AIRDROP_PARAMS = new byte[] { 0x50 };
        private static readonly byte[] PREFIX_CLAIMED = new byte[] { 0x51 };

        public struct AirdropParams
        {
            public UInt160 TokenAddress;
            public BigInteger AmountPerClaim;
            public ulong EndTimestamp;
        }

        public static void InitializeAirdrop(UInt160 tokenAddress, BigInteger amountPerClaim, ulong endTimestamp)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Admin()), "unauthorized");
            AirdropParams p = new AirdropParams
            {
                TokenAddress = tokenAddress,
                AmountPerClaim = amountPerClaim,
                EndTimestamp = endTimestamp
            };
            Storage.Put(Storage.CurrentContext, PREFIX_AIRDROP_PARAMS, StdLib.Serialize(p));
        }

        public static bool Claim()
        {
            UInt160 caller = Runtime.CallingScriptHash;
            ByteString paramsBytes = Storage.Get(Storage.CurrentContext, PREFIX_AIRDROP_PARAMS) ?? (ByteString)"";
            if (paramsBytes.Length == 0) throw new Exception("Airdrop not initialized");
            
            AirdropParams p = (AirdropParams)StdLib.Deserialize(paramsBytes);
            if (Runtime.Time >= p.EndTimestamp) throw new Exception("Airdrop has ended");

            byte[] callerKey = PREFIX_CLAIMED.Concat(caller);
            if (Storage.Get(Storage.CurrentContext, callerKey) != null) throw new Exception("Already claimed");

            // Transfer token
            object[] args = new object[] { Runtime.ExecutingScriptHash, caller, p.AmountPerClaim, null! };
            bool success = (bool)Contract.Call(p.TokenAddress, "transfer", CallFlags.All, args);
            if (!success) throw new Exception("Token transfer failed");

            // Mark as claimed
            Storage.Put(Storage.CurrentContext, callerKey, new byte[] { 0x01 });
            return true;
        }

        public static bool HasClaimed(UInt160 user)
        {
            return Storage.Get(Storage.CurrentContext, PREFIX_CLAIMED.Concat(user)) != null;
        }
    }
}