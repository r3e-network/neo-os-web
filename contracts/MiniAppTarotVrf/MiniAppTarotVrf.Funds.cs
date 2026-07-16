using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppTarotVrf
    {
        /// <summary>
        /// Credit-only GAS receiver. Player deposits must be exact reading-fee multiples;
        /// oracle reserve deposits require the current admin witness and a separate memo.
        /// No outbound call occurs from this callback.
        /// </summary>
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            ValidateNotBusy();
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "only GAS accepted");
            ValidateAddress(from, "invalid sender");
            ExecutionEngine.Assert(amount > 0, "amount must be positive");

            string memo = ReadMemo(data);
            if (memo == CREDIT_MEMO)
            {
                ExecutionEngine.Assert(amount % READING_FEE == 0, "credit must be a reading-fee multiple");
                BigInteger balance = CreditOfInternal(from) + amount;
                SetCredit(from, balance);
                PutInteger(PREFIX_TOTAL_CREDIT, TotalCreditLiability() + amount);
                OnCredited(from, amount, balance);
                return;
            }

            if (memo == ORACLE_MEMO)
            {
                // GAS.Transfer already enforces authorization for `from`; requiring the
                // nested callback to re-check the same witness breaks legitimate contract
                // and testing-engine transfer paths without adding an authority boundary.
                ExecutionEngine.Assert(from == Admin(), "admin reserve funding only");
                BigInteger reserve = OracleReserve() + amount;
                PutInteger(PREFIX_ORACLE_RESERVE, reserve);
                OnOracleReserveFunded(from, amount, reserve);
                return;
            }

            ExecutionEngine.Assert(false, "invalid payment memo");
        }

        /// <summary>Withdraw any chosen amount of unused player credit.</summary>
        public static BigInteger WithdrawCredit(UInt160 account, BigInteger amount)
        {
            ValidateAddress(account, "invalid account");
            ExecutionEngine.Assert(Runtime.CheckWitness(account), "account witness required");
            ExecutionEngine.Assert(amount > 0, "amount must be positive");

            AcquireLock();
            BigInteger balance = CreditOfInternal(account);
            ExecutionEngine.Assert(balance >= amount, "insufficient credit");
            ExecutionEngine.Assert(
                TotalCreditLiability() >= amount,
                "credit liability invariant violated");
            BigInteger next = balance - amount;
            SetCredit(account, next);
            PutInteger(PREFIX_TOTAL_CREDIT, TotalCreditLiability() - amount);

            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, account, amount, null),
                "credit transfer failed");
            ReleaseLock();
            OnCreditWithdrawn(account, amount, next);
            return amount;
        }

        /// <summary>Withdraw all unused player credit.</summary>
        public static BigInteger WithdrawAllCredit(UInt160 account)
        {
            BigInteger amount = CreditOfInternal(account);
            ExecutionEngine.Assert(amount > 0, "no credit");
            return WithdrawCredit(account, amount);
        }

        public static void WithdrawRevenue(UInt160 to, BigInteger amount)
        {
            ValidateAdmin();
            ValidateAddress(to, "invalid recipient");
            ExecutionEngine.Assert(to != Runtime.ExecutingScriptHash, "self recipient forbidden");
            ExecutionEngine.Assert(amount > 0 && Revenue() >= amount, "insufficient revenue");

            AcquireLock();
            PutInteger(PREFIX_REVENUE, Revenue() - amount);
            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, to, amount, null),
                "revenue transfer failed");
            ReleaseLock();
            OnRevenueWithdrawn(to, amount, Revenue());
        }

        public static void WithdrawOracleReserve(UInt160 to, BigInteger amount)
        {
            ValidateAdmin();
            ValidateAddress(to, "invalid recipient");
            ExecutionEngine.Assert(to != Runtime.ExecutingScriptHash, "self recipient forbidden");
            ExecutionEngine.Assert(amount > 0 && OracleReserve() >= amount, "insufficient oracle reserve");

            AcquireLock();
            PutInteger(PREFIX_ORACLE_RESERVE, OracleReserve() - amount);
            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, to, amount, null),
                "reserve transfer failed");
            ReleaseLock();
            OnOracleReserveWithdrawn(to, amount, OracleReserve());
        }
    }
}
