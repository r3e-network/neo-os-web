using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    [DisplayName("MiniAppFlashLoanHarness")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Test harness for MiniAppFlashLoan end-to-end callback validation.")]
    [ContractPermission("*", "*")]
    public class MiniAppFlashLoanHarness : SmartContract
    {
        private static readonly byte[] PREFIX_LAST = new byte[] { 0x01 };

        public struct LastExecution
        {
            public UInt160 Lender;
            public UInt160 Borrower;
            public BigInteger LoanId;
            public BigInteger Amount;
            public BigInteger Fee;
            public BigInteger CallbackBalance;
            public BigInteger Timestamp;
        }

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "only GAS accepted");
        }

        public static void Execute(UInt160 borrower, BigInteger amount, BigInteger fee, BigInteger loanId)
        {
            UInt160 lender = Runtime.CallingScriptHash;
            ExecutionEngine.Assert(lender != null && lender.IsValid, "invalid lender");

            BigInteger balance = GAS.BalanceOf(Runtime.ExecutingScriptHash);
            ExecutionEngine.Assert(balance >= amount + fee, "insufficient callback balance");

            LastExecution record = new LastExecution
            {
                Lender = lender,
                Borrower = borrower,
                LoanId = loanId,
                Amount = amount,
                Fee = fee,
                CallbackBalance = balance,
                Timestamp = Runtime.Time
            };
            Storage.Put(Storage.CurrentContext, PREFIX_LAST, StdLib.Serialize(record));

            bool repaid = GAS.Transfer(Runtime.ExecutingScriptHash, lender, amount + fee, null);
            ExecutionEngine.Assert(repaid, "repay failed");
        }

        [Safe]
        public static LastExecution GetLastExecution()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_LAST);
            if (raw == null) return new LastExecution();
            return (LastExecution)StdLib.Deserialize(raw);
        }
    }
}
