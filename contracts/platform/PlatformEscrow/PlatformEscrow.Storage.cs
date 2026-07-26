using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class PlatformEscrowContract
    {
        private static byte[] EscrowKey(string appId, BigInteger escrowId) => AppKey(appId, PREFIX_ESCROW, escrowId);

        private static byte[] MilestoneKey(string appId, BigInteger escrowId, BigInteger milestoneIndex) =>
            (byte[])Helper.Concat(
                (ByteString)AppKey(appId, PREFIX_MILESTONE, escrowId),
                (ByteString)milestoneIndex.ToByteArray());

        private static byte[] ApprovalKey(string appId, BigInteger escrowId, BigInteger milestoneIndex, UInt160 approver) =>
            (byte[])Helper.Concat(
                (ByteString)MilestoneKey(appId, escrowId, milestoneIndex),
                (ByteString)(byte[])approver);

        private static byte[] AccountKey(string appId, byte[] prefix, UInt160 account) =>
            (byte[])Helper.Concat((ByteString)AppKey(appId, prefix), (ByteString)(byte[])account);

        private static byte[] IndexKey(string appId, byte[] prefix, UInt160 account, BigInteger index) =>
            (byte[])Helper.Concat((ByteString)AccountKey(appId, prefix, account), (ByteString)index.ToByteArray());

        private static void StoreEscrow(string appId, BigInteger escrowId, object[] escrow) =>
            Storage.Put(Storage.CurrentContext, EscrowKey(appId, escrowId), StdLib.Serialize(escrow));

        private static object[] ReadEscrow(string appId, BigInteger escrowId)
        {
            ExecutionEngine.Assert(escrowId > 0, "invalid escrow id");
            ByteString raw = Storage.Get(Storage.CurrentContext, EscrowKey(appId, escrowId));
            ExecutionEngine.Assert(raw != null, "escrow not found");
            return (object[])StdLib.Deserialize(raw);
        }

        private static void StoreMilestone(string appId, BigInteger escrowId, BigInteger milestoneIndex, object[] milestone) =>
            Storage.Put(Storage.CurrentContext, MilestoneKey(appId, escrowId, milestoneIndex), StdLib.Serialize(milestone));

        private static object[] ReadMilestone(string appId, BigInteger escrowId, BigInteger milestoneIndex)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, MilestoneKey(appId, escrowId, milestoneIndex));
            ExecutionEngine.Assert(raw != null, "milestone not found");
            return (object[])StdLib.Deserialize(raw);
        }

        private static object[] ToObjectArray(UInt160[] values)
        {
            object[] result = new object[values.Length];
            for (int i = 0; i < values.Length; i++) result[i] = values[i];
            return result;
        }

        private static BigInteger ApprovalThreshold(object[] escrow) =>
            escrow.Length > 12 ? (BigInteger)escrow[12] : 1;

        private static BigInteger ApprovalCount(object[] milestone) =>
            milestone.Length > 5 ? (BigInteger)milestone[5] : ((bool)milestone[1] ? 1 : 0);

        private static bool IsApprover(object[] escrow, UInt160 approver)
        {
            if (escrow.Length <= 11) return (UInt160)escrow[1] == approver;
            object[] approvers = (object[])escrow[11];
            for (int i = 0; i < approvers.Length; i++)
            {
                if ((UInt160)approvers[i] == approver) return true;
            }
            return false;
        }

        private static BigInteger ReadAccountCount(string appId, byte[] prefix, UInt160 account) =>
            ReadInteger(AccountKey(appId, prefix, account));

        private static void AddIndex(string appId, byte[] countPrefix, byte[] indexPrefix, UInt160 account, BigInteger escrowId, string limitMessage)
        {
            byte[] countKey = AccountKey(appId, countPrefix, account);
            BigInteger count = ReadInteger(countKey);
            ExecutionEngine.Assert(count < MAX_INDEX_ENTRIES, limitMessage);
            Storage.Put(Storage.CurrentContext, IndexKey(appId, indexPrefix, account, count), escrowId);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);
        }
    }
}
