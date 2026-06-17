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
    public partial class MiniAppCoinFlipV2 : SmartContract
    {
        #region Owner (bankroll withdrawal)
        /// <summary>
        /// Owner-only bankroll withdrawal. Never withdraws funds reserved against pending
        /// bets, so every committed-but-unsettled win stays fully payable.
        /// </summary>
        public static void WithdrawBankroll(UInt160 to, BigInteger amount)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            ExecutionEngine.Assert(to is not null && to.IsValid && !to.IsZero, "invalid recipient");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            StorageContext ctx = Storage.CurrentContext;
            BigInteger bankroll = (BigInteger)Storage.Get(ctx, PREFIX_BANKROLL);
            BigInteger reserved = (BigInteger)Storage.Get(ctx, PREFIX_RESERVED);
            BigInteger free = bankroll - reserved;
            ExecutionEngine.Assert(free >= amount, "insufficient free bankroll");
            Storage.Put(ctx, PREFIX_BANKROLL, bankroll - amount);
            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, to, amount, "" });
            ExecutionEngine.Assert(ok, "bankroll transfer failed");
            OnBankrollWithdrawn(to, amount);
        }

        /// <summary>
        /// Owner-only contract upgrade. Replaces the running NEF and manifest in place via
        /// ContractManagement.Update with no timelock. The ContractManagement "update"
        /// permission is auto-inferred from this call.
        /// </summary>
        public static void Update(ByteString nef, string manifest)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "unauthorized");
            ContractManagement.Update(nef, manifest, new object[0]);
        }
        #endregion

        #region Withdraw credit
        /// <summary>Reclaim any unused prepaid bet-credit back to the sender. Does NOT touch
        /// escrowed pending wagers — those are settled via settle().</summary>
        public static BigInteger Withdraw(UInt160 account)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(account), "account witness required");
            StorageContext ctx = Storage.CurrentContext;
            byte[] key = Helper.Concat(PREFIX_CREDIT, (byte[])account);
            BigInteger credit = (BigInteger)Storage.Get(ctx, key);
            ExecutionEngine.Assert(credit > 0, "no credit");
            Storage.Delete(ctx, key);
            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, account, credit, "" });
            ExecutionEngine.Assert(ok, "withdraw transfer failed");
            OnCreditWithdrawn(account, credit);
            return credit;
        }
        #endregion

        #region Read-only
        [Safe]
        public static UInt160 GetOwner() => Owner;

        [Safe]
        public static BigInteger Bankroll() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_BANKROLL);

        [Safe]
        public static BigInteger ReservedBankroll() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_RESERVED);

        [Safe]
        public static BigInteger FreeBankroll()
        {
            StorageContext ctx = Storage.CurrentContext;
            return (BigInteger)Storage.Get(ctx, PREFIX_BANKROLL) - (BigInteger)Storage.Get(ctx, PREFIX_RESERVED);
        }

        [Safe]
        public static BigInteger CreditOf(UInt160 player) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_CREDIT, (byte[])player));

        [Safe]
        public static BigInteger LastBetId() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_BET_ID);

        [Safe]
        public static BigInteger PendingBetCount() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PENDING_CNT);

        [Safe]
        public static Map<string, object> GetStats(UInt160 player)
        {
            Stats s = LoadStats(Storage.CurrentContext, player);
            Map<string, object> r = new Map<string, object>();
            r["wins"] = s.Wins; r["losses"] = s.Losses; r["totalWon"] = s.TotalWon;
            return r;
        }

        [Safe]
        public static Map<string, object> GetPendingBet(BigInteger betId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, BetKey(betId));
            ExecutionEngine.Assert(raw is not null, "bet not found");
            Bet b = (Bet)StdLib.Deserialize(raw);
            Map<string, object> r = new Map<string, object>();
            r["id"] = betId; r["player"] = b.Player; r["choice"] = b.Choice;
            r["wager"] = b.Wager; r["exposure"] = b.Exposure;
            r["commitIndex"] = b.CommitIndex; r["commitTime"] = b.CommitTime;
            r["settled"] = b.Settled; r["outcome"] = b.Outcome; r["won"] = b.Won;
            r["payout"] = b.Payout; r["settleTime"] = b.SettleTime;
            return r;
        }

        [Safe]
        public static BigInteger PlayerBetCount(UInt160 player) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_PLAYER_CNT, (byte[])player));

        [Safe]
        public static BigInteger[] GetPlayerBets(UInt160 player, BigInteger offset, BigInteger limit)
        {
            StorageContext ctx = Storage.CurrentContext;
            BigInteger n = (BigInteger)Storage.Get(ctx, Helper.Concat(PREFIX_PLAYER_CNT, (byte[])player));
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
                result[(int)idx] = (BigInteger)Storage.Get(ctx, Helper.Concat(Helper.Concat(PREFIX_PLAYER_ITEM, (byte[])player), (byte[])(ByteString)i));
                idx += 1;
            }
            return result;
        }
        #endregion

        #region Internal
        private static Stats LoadStats(StorageContext ctx, UInt160 player)
        {
            ByteString raw = Storage.Get(ctx, StatsKey(player));
            if (raw is null) return new Stats { Wins = 0, Losses = 0, TotalWon = 0 };
            return (Stats)StdLib.Deserialize(raw);
        }
        private static byte[] StatsKey(UInt160 player) => Helper.Concat(PREFIX_STATS, (byte[])player);
        private static byte[] BetKey(BigInteger id) => Helper.Concat(PREFIX_BET, (byte[])(ByteString)id);
        private static void IndexAppend(StorageContext ctx, UInt160 player, BigInteger betId)
        {
            byte[] cntKey = Helper.Concat(PREFIX_PLAYER_CNT, (byte[])player);
            BigInteger n = (BigInteger)Storage.Get(ctx, cntKey) + 1;
            Storage.Put(ctx, cntKey, n);
            Storage.Put(ctx, Helper.Concat(Helper.Concat(PREFIX_PLAYER_ITEM, (byte[])player), (byte[])(ByteString)n), betId);
        }
        #endregion
    }
}
