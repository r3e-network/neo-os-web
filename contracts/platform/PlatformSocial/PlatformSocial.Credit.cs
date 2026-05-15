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
    public partial class PlatformSocialContract
    {
        // -----------------------------------------------------------------------
        // NEP-17 payment handler -- routes GAS/NEO deposits by appId in memo
        // -----------------------------------------------------------------------

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            if (from == Runtime.ExecutingScriptHash || amount <= 0) return;

            UInt160 caller = Runtime.CallingScriptHash;

            if (caller == GAS.Hash)
            {
                CreditGas(from, amount);
                return;
            }

            if (caller == NEO.Hash)
            {
                CreditNeo(from, amount);
                return;
            }

            ExecutionEngine.Assert(false, "unsupported asset");
        }

        // -----------------------------------------------------------------------
        // Direct credit management
        // -----------------------------------------------------------------------

        [Safe]
        public static BigInteger GetDirectGasCredit(UInt160 payer)
        {
            if (payer == UInt160.Zero || !payer.IsValid) return 0;
            return GetGasCreditBalance(payer);
        }

        public static BigInteger WithdrawGasCredit(UInt160 user, BigInteger amount)
        {
            ExecutionEngine.Assert(user != UInt160.Zero && user.IsValid, "invalid user");
            ExecutionEngine.Assert(Runtime.CheckWitness(user), "unauthorized");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_DIRECT_GAS_CREDIT);
            ByteString key = (ByteString)(byte[])user;
            BigInteger balance = GetGasCreditBalance(user);
            ExecutionEngine.Assert(balance >= amount, "insufficient GAS credit");

            BigInteger next = balance - amount;
            if (next == 0) credits.Delete(key);
            else credits.Put(key, next);

            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, user, amount),
                "GAS credit withdrawal failed");

            OnGasCreditWithdrawn(user, amount);
            return amount;
        }

        private static void CreditGas(UInt160 from, BigInteger amount)
        {
            StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_DIRECT_GAS_CREDIT);
            ByteString key = (ByteString)(byte[])from;
            ByteString existing = credits.Get(key);
            BigInteger balance = existing == null ? 0 : (BigInteger)existing;
            credits.Put(key, balance + amount);
        }

        private static void ConsumeGasCredit(UInt160 payer, BigInteger amount)
        {
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_DIRECT_GAS_CREDIT);
            ByteString key = (ByteString)(byte[])payer;
            ByteString existing = credits.Get(key);
            BigInteger balance = existing == null ? 0 : (BigInteger)existing;
            ExecutionEngine.Assert(balance >= amount, "insufficient GAS credit");
            BigInteger next = balance - amount;
            if (next == 0) credits.Delete(key);
            else credits.Put(key, next);
        }

        private static BigInteger GetGasCreditBalance(UInt160 payer)
        {
            StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_DIRECT_GAS_CREDIT);
            ByteString key = (ByteString)(byte[])payer;
            ByteString existing = credits.Get(key);
            return existing == null ? 0 : (BigInteger)existing;
        }

        private static void CreditNeo(UInt160 from, BigInteger amount)
        {
            StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_DIRECT_ASSET_CREDIT);
            ByteString key = (ByteString)(byte[])from;
            ByteString existing = credits.Get(key);
            BigInteger balance = existing == null ? 0 : (BigInteger)existing;
            credits.Put(key, balance + amount);
        }

        private static void ConsumeNeoCredit(UInt160 payer, BigInteger amount)
        {
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_DIRECT_ASSET_CREDIT);
            ByteString key = (ByteString)(byte[])payer;
            ByteString existing = credits.Get(key);
            BigInteger balance = existing == null ? 0 : (BigInteger)existing;
            ExecutionEngine.Assert(balance >= amount, "insufficient NEO credit");
            BigInteger next = balance - amount;
            if (next == 0) credits.Delete(key);
            else credits.Put(key, next);
        }
    }
}
