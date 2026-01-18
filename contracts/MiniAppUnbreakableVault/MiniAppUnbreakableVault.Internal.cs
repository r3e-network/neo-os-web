using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppUnbreakableVault
    {
        #region Internal Helpers

        private static void StoreVault(BigInteger vaultId, VaultData vault)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_VAULTS, (ByteString)vaultId.ToByteArray()),
                StdLib.Serialize(vault));
        }

        private static BigInteger GetAttemptFee(BigInteger difficulty)
        {
            if (difficulty == 1) return ATTEMPT_FEE_EASY;
            if (difficulty == 2) return ATTEMPT_FEE_MEDIUM;
            return ATTEMPT_FEE_HARD;
        }

        private static void AddUserVault(UInt160 user, BigInteger vaultId)
        {
            byte[] countKey = Helper.Concat(PREFIX_USER_VAULT_COUNT, user);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_VAULTS, user),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, vaultId);
        }

        private static void UpdateTotalBounties(BigInteger amount, bool isIncrease)
        {
            BigInteger total = TotalBounties();
            if (isIncrease)
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BOUNTIES, total + amount);
            else
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BOUNTIES, total - amount);
        }

        private static void UpdateTotalBroken()
        {
            BigInteger total = TotalBroken();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BROKEN, total + 1);
        }

        #endregion
    }
}
