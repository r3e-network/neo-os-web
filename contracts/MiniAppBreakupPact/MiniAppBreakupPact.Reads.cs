using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppBreakupPact
    {
        #region Read-only
        [Safe]
        public static BigInteger LastPactId() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PACT_ID);

        [Safe]
        public static BigInteger CreditOf(UInt160 who) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_CREDIT, (byte[])who));

        [Safe]
        public static Map<string, object> GetPact(BigInteger pactId)
        {
            Pact p = LoadPact(Storage.CurrentContext, pactId);
            Map<string, object> r = new Map<string, object>();
            r["id"] = pactId; r["party1"] = p.Party1; r["party2"] = p.Party2; r["stake"] = p.Stake;
            r["endTime"] = p.EndTime; r["party1Staked"] = p.Party1Staked; r["party2Staked"] = p.Party2Staked;
            r["status"] = p.Status; r["breaker"] = p.Breaker;
            return r;
        }

        [Safe]
        public static BigInteger PartyPactCount(UInt160 who) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_PARTY_CNT, (byte[])who));

        [Safe]
        public static BigInteger[] GetPartyPacts(UInt160 who, BigInteger offset, BigInteger limit)
        {
            StorageContext ctx = Storage.CurrentContext;
            BigInteger n = (BigInteger)Storage.Get(ctx, Helper.Concat(PREFIX_PARTY_CNT, (byte[])who));
            if (offset < 0) offset = 0;
            if (limit <= 0 || limit > 100) limit = 100;
            BigInteger start = offset + 1;
            BigInteger end = start + limit - 1;
            if (end > n) end = n;
            if (start > end) return new BigInteger[0];
            BigInteger count = end - start + 1;
            BigInteger[] result = new BigInteger[(int)count];
            BigInteger idx = 0;
            for (BigInteger i = start; i <= end; i++)
            {
                result[(int)idx] = (BigInteger)Storage.Get(ctx, Helper.Concat(Helper.Concat(PREFIX_PARTY_ITEM, (byte[])who), (byte[])(ByteString)i));
                idx += 1;
            }
            return result;
        }
        #endregion
    }
}
