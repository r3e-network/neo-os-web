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
    public partial class MiniAppSelfLoan : SmartContract
    {
        #region Withdraw unused collateral credit
        /// <summary>Reclaim NEO that was credited as collateral but never borrowed against.</summary>
        public static BigInteger Withdraw(UInt160 account)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(account), "account witness required");
            StorageContext ctx = Storage.CurrentContext;
            byte[] key = Helper.Concat(PREFIX_COLLATERAL_CREDIT, (byte[])account);
            BigInteger credit = (BigInteger)Storage.Get(ctx, key);
            ExecutionEngine.Assert(credit > 0, "no collateral credit");
            Storage.Delete(ctx, key);
            bool ok = (bool)Contract.Call(NEO.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, account, credit, "" });
            ExecutionEngine.Assert(ok, "withdraw transfer failed");
            OnCollateralWithdrawn(account, credit);
            return credit;
        }

        /// <summary>Reclaim GAS that was deposited as repay-credit but never applied.</summary>
        public static BigInteger WithdrawRepayCredit(UInt160 account)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(account), "account witness required");
            StorageContext ctx = Storage.CurrentContext;
            byte[] key = Helper.Concat(PREFIX_REPAY_CREDIT, (byte[])account);
            BigInteger credit = (BigInteger)Storage.Get(ctx, key);
            ExecutionEngine.Assert(credit > 0, "no repay credit");
            Storage.Delete(ctx, key);
            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, account, credit, "" });
            ExecutionEngine.Assert(ok, "withdraw transfer failed");
            OnRepayCreditWithdrawn(account, credit);
            return credit;
        }
        #endregion

        #region Upgrade
        /// <summary>
        /// Owner-gated, instant (no timelock) contract upgrade. Replaces the contract's
        /// NEF and manifest in place via ContractManagement.Update; storage is preserved.
        /// nccs infers the ContractManagement 'update' permission from this call.
        /// </summary>
        public static void Update(ByteString nef, string manifest)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            ContractManagement.Update(nef, manifest, new object[0]);
        }
        #endregion

        #region Read-only
        [Safe]
        public static BigInteger NeoPrice() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_NEO_PRICE);

        [Safe]
        public static BigInteger Pool() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_POOL);

        [Safe]
        public static BigInteger CollateralCreditOf(UInt160 borrower) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_COLLATERAL_CREDIT, (byte[])borrower));

        [Safe]
        public static BigInteger RepayCreditOf(UInt160 borrower) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_REPAY_CREDIT, (byte[])borrower));

        [Safe]
        public static Map<string, object> GetLoan(UInt160 borrower)
        {
            Loan loan = LoadLoan(Storage.CurrentContext, borrower);
            Map<string, object> m = new Map<string, object>();
            m["collateral"] = loan.Collateral;
            m["borrowed"] = loan.Borrowed;
            m["ltvBps"] = loan.LtvBps;
            m["active"] = loan.Active;
            return m;
        }

        [Safe]
        public static BigInteger LtvTierBps(BigInteger tier) => TierBps(tier);

        [Safe]
        public static BigInteger FeeBps() => FEE_BPS;

        [Safe]
        public static BigInteger TotalLoans() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_LOANS);

        [Safe]
        public static BigInteger TotalBorrowed() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_BORROWED);

        [Safe]
        public static BigInteger TotalRepaid() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_REPAID);

        [Safe]
        public static UInt160 GetOwner() => Owner;
        #endregion

        #region Internal
        private static BigInteger TierBps(BigInteger tier)
        {
            if (tier == 1) return LTV_TIER1_BPS;
            if (tier == 2) return LTV_TIER2_BPS;
            if (tier == 3) return LTV_TIER3_BPS;
            ExecutionEngine.Assert(false, "invalid tier");
            return 0;
        }

        private static byte[] LoanKey(UInt160 borrower) => Helper.Concat(PREFIX_LOAN, (byte[])borrower);

        private static Loan LoadLoan(StorageContext ctx, UInt160 borrower)
        {
            ByteString raw = Storage.Get(ctx, LoanKey(borrower));
            if (raw is null) return new Loan { Collateral = 0, Borrowed = 0, LtvBps = 0, Active = false };
            return (Loan)StdLib.Deserialize(raw);
        }
        #endregion
    }
}
