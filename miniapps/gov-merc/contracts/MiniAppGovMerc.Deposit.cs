using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGovMerc
    {
        #region Deposit Methods

        /// <summary>
        /// Deposit NEO to contribute voting power to the pool.
        /// </summary>
        public static void DepositNeo(UInt160 depositor, BigInteger amount)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(amount >= MIN_DEPOSIT, "min 1 NEO");
            ExecutionEngine.Assert(Runtime.CheckWitness(depositor), "unauthorized");

            bool transferred = NEO.Transfer(depositor, Runtime.ExecutingScriptHash, amount);
            ExecutionEngine.Assert(transferred, "transfer failed");

            Deposit deposit = GetDeposit(depositor);
            BigInteger currentEpoch = GetCurrentEpochId();

            bool isNewDepositor = deposit.Amount == 0;

            deposit.Amount += amount;
            if (deposit.DepositTime == 0) deposit.DepositTime = Runtime.Time;
            if (deposit.LastClaimEpoch == 0) deposit.LastClaimEpoch = currentEpoch;
            StoreDeposit(depositor, deposit);

            BigInteger total = TotalPool();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_POOL, total + amount);

            UpdateDepositorStatsOnDeposit(depositor, amount, isNewDepositor);

            OnMercDeposit(depositor, amount, deposit.Amount);
        }

        /// <summary>
        /// Withdraw NEO from the pool (claims pending rewards first).
        /// </summary>
        public static void WithdrawNeo(UInt160 depositor, BigInteger amount)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(depositor), "unauthorized");
            ExecutionEngine.Assert(amount > 0, "invalid amount");

            Deposit deposit = GetDeposit(depositor);
            ExecutionEngine.Assert(deposit.Amount >= amount, "insufficient");

            BigInteger rewards = GetPendingRewards(depositor);

            deposit.Amount -= amount;
            StoreDeposit(depositor, deposit);

            BigInteger total = TotalPool();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_POOL, total - amount);

            if (rewards > 0)
            {
                byte[] rewardKey = Helper.Concat(PREFIX_USER_REWARDS, depositor);
                Storage.Put(Storage.CurrentContext, rewardKey, 0);
                GAS.Transfer(Runtime.ExecutingScriptHash, depositor, rewards);
            }

            NEO.Transfer(Runtime.ExecutingScriptHash, depositor, amount);

            UpdateDepositorStatsOnWithdraw(depositor, amount, rewards);

            OnMercWithdraw(depositor, amount, rewards);
        }

        #endregion
    }
}
