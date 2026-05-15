using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public partial class PlatformDeFiContract
    {
        #region NEP-17 Payment Handler

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            if (from == null || from == UInt160.Zero) return;
            if (from == Runtime.ExecutingScriptHash) return;
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            if (Runtime.CallingScriptHash == NEO.Hash)
            {
                ValidateAddress(from);
                // Credit NEO for the sender; appId resolved at consume-time
                StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_NEO_CREDIT);
                ByteString key = (ByteString)(byte[])from;
                ByteString existing = credits.Get(key);
                BigInteger balance = existing == null ? 0 : (BigInteger)existing;
                credits.Put(key, balance + amount);
                return;
            }

            if (Runtime.CallingScriptHash == GAS.Hash)
            {
                ValidateAddress(from);
                StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_GAS_CREDIT);
                ByteString key = (ByteString)(byte[])from;
                ByteString existing = credits.Get(key);
                BigInteger balance = existing == null ? 0 : (BigInteger)existing;
                credits.Put(key, balance + amount);
                return;
            }

            ExecutionEngine.Assert(false, "unsupported asset");
        }

        #endregion

        #region Credit Consumption Helpers

        private static void ConsumeNeoCredit(UInt160 payer, BigInteger amount)
        {
            ValidateAddress(payer);
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_NEO_CREDIT);
            ByteString key = (ByteString)(byte[])payer;
            ByteString existing = credits.Get(key);
            BigInteger balance = existing == null ? 0 : (BigInteger)existing;
            ExecutionEngine.Assert(balance >= amount, "insufficient prepaid NEO");

            BigInteger next = balance - amount;
            if (next == 0) credits.Delete(key);
            else credits.Put(key, next);
        }

        private static void ConsumeGasCredit(UInt160 payer, BigInteger amount)
        {
            ValidateAddress(payer);
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_GAS_CREDIT);
            ByteString key = (ByteString)(byte[])payer;
            ByteString existing = credits.Get(key);
            BigInteger balance = existing == null ? 0 : (BigInteger)existing;
            ExecutionEngine.Assert(balance >= amount, "insufficient prepaid GAS");

            BigInteger next = balance - amount;
            if (next == 0) credits.Delete(key);
            else credits.Put(key, next);
        }

        #endregion
    }
}
