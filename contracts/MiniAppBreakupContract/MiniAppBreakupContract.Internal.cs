using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppBreakupContract
    {
        #region Internal Helpers

        private static void StoreContract(BigInteger contractId, RelationshipContract contract)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_CONTRACTS, (ByteString)contractId.ToByteArray()),
                StdLib.Serialize(contract));
        }

        private static void StoreMutualBreakupRequest(BigInteger contractId, MutualBreakupRequest request)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_MUTUAL_BREAKUP, (ByteString)contractId.ToByteArray()),
                StdLib.Serialize(request));
        }

        private static void DeleteMutualBreakupRequest(BigInteger contractId)
        {
            Storage.Delete(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_MUTUAL_BREAKUP, (ByteString)contractId.ToByteArray()));
        }

        private static void AddUserContract(UInt160 user, BigInteger contractId)
        {
            // Increment user contract count
            byte[] countKey = Helper.Concat(PREFIX_USER_CONTRACT_COUNT, user);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            // Store contract reference
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_CONTRACTS, user),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, contractId);
        }

        private static void DistributeFunds(BigInteger contractId, UInt160 recipient, BigInteger amount)
        {
            if (amount <= 0) return;

            // Transfer GAS to recipient
            bool success = GAS.Transfer(Runtime.ExecutingScriptHash, recipient, amount);
            ExecutionEngine.Assert(success, "transfer failed");

            OnFundsDistributed(contractId, recipient, amount);
        }

        #endregion
    }
}
