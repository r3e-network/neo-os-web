using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDevTipping
    {
        #region Withdraw Methods

        /// <summary>
        /// Withdraw entire balance to developer wallet.
        /// 
        /// REQUIREMENTS:
        /// - Platform not paused
        /// - Developer must exist
        /// - Caller must be the developer
        /// - Balance must be positive
        /// 
        /// EFFECTS:
        /// - Resets balance to zero
        /// - Increments withdraw count
        /// - Updates total withdrawn
        /// - Transfers GAS to developer wallet
        /// - Emits TipWithdrawn event
        /// </summary>
        /// <param name="devId">Developer ID</param>
        public static void Withdraw(BigInteger devId)
        {
            ValidateNotGloballyPaused(APP_ID);

            DeveloperData dev = GetDeveloper(devId);
            ExecutionEngine.Assert(dev.Wallet != UInt160.Zero, "dev not found");
            ExecutionEngine.Assert(Runtime.CheckWitness(dev.Wallet), "not developer");
            ExecutionEngine.Assert(dev.Balance > 0, "no balance");

            BigInteger withdrawAmount = dev.Balance;

            dev.Balance = 0;
            dev.WithdrawCount += 1;
            dev.TotalWithdrawn += withdrawAmount;
            StoreDeveloper(devId, dev);

            bool transferred = GAS.Transfer(Runtime.ExecutingScriptHash, dev.Wallet, withdrawAmount);
            ExecutionEngine.Assert(transferred, "transfer failed");

            OnTipWithdrawn(devId, dev.Wallet, withdrawAmount);
        }

        /// <summary>
        /// Withdraw partial balance to developer wallet.
        /// 
        /// REQUIREMENTS:
        /// - Platform not paused
        /// - Developer must exist
        /// - Caller must be the developer
        /// - Amount must be positive and <= balance
        /// 
        /// EFFECTS:
        /// - Deducts amount from balance
        /// - Increments withdraw count
        /// - Updates total withdrawn
        /// - Transfers GAS to developer wallet
        /// - Emits TipWithdrawn event
        /// </summary>
        /// <param name="devId">Developer ID</param>
        /// <param name="amount">Amount to withdraw</param>
        public static void WithdrawPartial(BigInteger devId, BigInteger amount)
        {
            ValidateNotGloballyPaused(APP_ID);

            DeveloperData dev = GetDeveloper(devId);
            ExecutionEngine.Assert(dev.Wallet != UInt160.Zero, "dev not found");
            ExecutionEngine.Assert(Runtime.CheckWitness(dev.Wallet), "not developer");
            ExecutionEngine.Assert(amount > 0, "invalid amount");
            ExecutionEngine.Assert(dev.Balance >= amount, "insufficient balance");

            dev.Balance -= amount;
            dev.WithdrawCount += 1;
            dev.TotalWithdrawn += amount;
            StoreDeveloper(devId, dev);

            bool transferred = GAS.Transfer(Runtime.ExecutingScriptHash, dev.Wallet, amount);
            ExecutionEngine.Assert(transferred, "transfer failed");

            OnTipWithdrawn(devId, dev.Wallet, amount);
        }

        #endregion
    }
}
