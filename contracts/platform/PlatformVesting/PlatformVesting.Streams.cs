using System;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class PlatformVestingContract
    {
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            UInt160 asset = Runtime.CallingScriptHash;
            ExecutionEngine.Assert(IsSupportedAsset(asset), "unsupported asset");
            ExecutionEngine.Assert(amount > 0, "invalid amount");
            string appId = MiniAppCreditLedger.RequireFundingAppId(data);
            RequireRegistered(appId);
            byte[] key = CreditKey(appId, asset, from);
            MiniAppCreditLedger.Credit(
                (ByteString)key,
                (ByteString)CreditLiabilityKey(appId, asset),
                (ByteString)(asset == GAS.Hash
                    ? PREFIX_TOTAL_GAS_CREDIT_LIABILITY
                    : PREFIX_TOTAL_NEO_CREDIT_LIABILITY),
                amount);
            if (asset == GAS.Hash) OnGasCredited(appId, from, amount);
            else OnNeoCredited(appId, from, amount);
        }

        public static BigInteger CreateStream(
            string appId,
            UInt160 creator,
            UInt160 beneficiary,
            UInt160 asset,
            BigInteger totalAmount,
            BigInteger rateAmount,
            BigInteger intervalSeconds,
            string title,
            string notes)
        {
            ValidateCreateLane(appId);
            ValidateAddress(creator);
            ValidateAddress(beneficiary);
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "creator witness required");
            ExecutionEngine.Assert(IsSupportedAsset(asset), "unsupported asset");
            ExecutionEngine.Assert(totalAmount > 0 && rateAmount > 0 && rateAmount <= totalAmount, "invalid stream amount");
            ExecutionEngine.Assert(intervalSeconds > 0 && intervalSeconds <= MaxIntervalOf(appId), "invalid stream interval");
            ExecutionEngine.Assert(title != null && title.Length <= MAX_TITLE_LENGTH, "invalid stream title");
            ExecutionEngine.Assert(notes != null && notes.Length <= MAX_NOTES_LENGTH, "invalid stream notes");
            BigInteger credit = ReadCredit(appId, asset, creator);
            ExecutionEngine.Assert(credit >= totalAmount, "insufficient funded credit");
            AddIndex(appId, PREFIX_CREATOR_COUNT, PREFIX_CREATOR_INDEX, creator, true);
            AddIndex(appId, PREFIX_BENEFICIARY_COUNT, PREFIX_BENEFICIARY_INDEX, beneficiary, false);
            Enter();
            ConsumeCredit(appId, asset, creator, totalAmount);
            BigInteger streamId = ReadInteger(AppKey(appId, PREFIX_NEXT_ID)) + 1;
            Storage.Put(Storage.CurrentContext, AppKey(appId, PREFIX_NEXT_ID), streamId);
            BigInteger count = ReadInteger(AppKey(appId, PREFIX_STREAM_COUNT)) + 1;
            Storage.Put(Storage.CurrentContext, AppKey(appId, PREFIX_STREAM_COUNT), count);
            object[] stream = new object[]
            {
                streamId, creator, beneficiary, asset, totalAmount, BigInteger.Zero,
                rateAmount, intervalSeconds, Runtime.Time, 1, title, notes
            };
            Storage.Put(Storage.CurrentContext, StreamKey(appId, streamId), StdLib.Serialize(stream));
            AdjustStreamLiability(appId, asset, totalAmount);
            Exit();
            OnStreamCreated(appId, streamId, creator, beneficiary, asset, totalAmount);
            return streamId;
        }

        public static BigInteger ClaimStream(string appId, UInt160 beneficiary, BigInteger streamId)
        {
            RequireRegistered(appId);
            ValidateAddress(beneficiary);
            ExecutionEngine.Assert(Runtime.CheckWitness(beneficiary), "beneficiary witness required");
            object[] stream = ReadStream(appId, streamId);
            ExecutionEngine.Assert((UInt160)stream[2] == beneficiary, "beneficiary mismatch");
            ExecutionEngine.Assert((BigInteger)stream[9] == 1, "stream finalized");
            BigInteger claimable = Claimable(stream);
            ExecutionEngine.Assert(claimable > 0, "nothing to claim");
            Enter();
            BigInteger released = (BigInteger)stream[5] + claimable;
            stream[5] = released;
            if (released == (BigInteger)stream[4]) stream[9] = 2;
            Storage.Put(Storage.CurrentContext, StreamKey(appId, streamId), StdLib.Serialize(stream));
            AdjustStreamLiability(appId, (UInt160)stream[3], -claimable);
            TransferAsset((UInt160)stream[3], beneficiary, claimable);
            Exit();
            OnStreamClaimed(appId, streamId, beneficiary, claimable, released);
            return claimable;
        }

        public static BigInteger CancelStream(string appId, UInt160 creator, BigInteger streamId)
        {
            RequireRegistered(appId);
            ValidateAddress(creator);
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "creator witness required");
            object[] stream = ReadStream(appId, streamId);
            ExecutionEngine.Assert((UInt160)stream[1] == creator, "creator mismatch");
            ExecutionEngine.Assert((BigInteger)stream[9] == 1, "stream finalized");
            BigInteger beneficiaryAmount = Claimable(stream);
            BigInteger refundAmount = (BigInteger)stream[4] - (BigInteger)stream[5] - beneficiaryAmount;
            Enter();
            stream[5] = (BigInteger)stream[4];
            stream[9] = 3;
            Storage.Put(Storage.CurrentContext, StreamKey(appId, streamId), StdLib.Serialize(stream));
            AdjustStreamLiability(appId, (UInt160)stream[3], -(beneficiaryAmount + refundAmount));
            TransferAsset((UInt160)stream[3], (UInt160)stream[2], beneficiaryAmount);
            TransferAsset((UInt160)stream[3], creator, refundAmount);
            Exit();
            OnStreamCancelled(appId, streamId, creator, beneficiaryAmount, refundAmount);
            return refundAmount;
        }

        public static BigInteger WithdrawCredit(string appId, UInt160 payer, UInt160 asset, BigInteger amount)
        {
            RequireRegistered(appId);
            ValidateAddress(payer);
            ExecutionEngine.Assert(Runtime.CheckWitness(payer), "payer witness required");
            ExecutionEngine.Assert(IsSupportedAsset(asset) && amount > 0, "invalid credit withdrawal");
            ExecutionEngine.Assert(ReadCredit(appId, asset, payer) >= amount, "insufficient credit");
            Enter();
            ConsumeCredit(appId, asset, payer, amount);
            TransferAsset(asset, payer, amount);
            Exit();
            OnCreditWithdrawn(appId, payer, asset, amount);
            return amount;
        }

        private static void ConsumeCredit(string appId, UInt160 asset, UInt160 payer, BigInteger amount)
        {
            byte[] key = CreditKey(appId, asset, payer);
            MiniAppCreditLedger.Debit(
                (ByteString)key,
                (ByteString)CreditLiabilityKey(appId, asset),
                (ByteString)(asset == GAS.Hash
                    ? PREFIX_TOTAL_GAS_CREDIT_LIABILITY
                    : PREFIX_TOTAL_NEO_CREDIT_LIABILITY),
                amount);
        }

        private static void AddIndex(string appId, byte[] countPrefix, byte[] indexPrefix, UInt160 account, bool creator)
        {
            byte[] countKey = AccountKey(appId, countPrefix, account);
            BigInteger count = ReadInteger(countKey);
            ExecutionEngine.Assert(count < MAX_INDEX_ENTRIES, creator ? "creator stream limit" : "beneficiary stream limit");
            Storage.Put(Storage.CurrentContext, IndexKey(appId, indexPrefix, account, count), ReadInteger(AppKey(appId, PREFIX_NEXT_ID)) + 1);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);
        }
    }
}
