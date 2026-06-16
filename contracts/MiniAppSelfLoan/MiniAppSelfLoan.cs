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
    /// <summary>
    /// MiniAppSelfLoan — self-contained on-chain collateralized loan desk (NO live oracle).
    ///
    /// WHY: the app previously locked NEO collateral and disbursed GAS via OS
    /// escrow/payment edge functions that no contract enforced, and valued collateral
    /// with a "council price" read from OS storage. This contract makes the collateral
    /// lock, the GAS disbursement, the debt, and the repayment authoritative on-chain.
    ///
    /// MODEL: collateral is NEO (integer), debt is GAS. The owner funds a GAS lending
    /// pool and sets the NEO price (GAS per NEO) — a configured price, not a live oracle,
    /// matching the app's static council price. A borrower:
    ///   1. sends NEO with memo "selfloan:collateral" (credits their collateral), then
    ///   2. borrow(borrower, tier) locks that NEO and disburses GAS up to the tier LTV of
    ///      the collateral's GAS value, minus a one-time origination fee. The DEBT is the
    ///      gross amount; the fee stays in the pool as revenue (so the pool is
    ///      sustainable). addCollateral adds more NEO to an open loan.
    ///   3. repay by sending GAS with memo "selfloan:repay"; a repayment that clears the
    ///      debt releases the full NEO collateral back to the borrower.
    ///
    /// No liquidation and no interest (matching the app; the health factor is a UI signal).
    /// Every party keeps a recovery path — the borrower repays to reclaim collateral, the
    /// owner withdraws unlent pool GAS, an un-borrowed collateral deposit is reclaimable
    /// via Withdraw — so nothing is strandable by the contract. The pool bears default
    /// risk, bounded by the conservative tier LTVs (20–40%).
    /// </summary>
    [DisplayName("MiniAppSelfLoan")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Self-contained on-chain collateralized loan: lock NEO, borrow GAS up to an LTV tier of its configured value — no live oracle.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")] // GAS
    [ContractPermission("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", "transfer")] // NEO
    public partial class MiniAppSelfLoan : SmartContract
    {
        #region Constants
        private const int LTV_TIER1_BPS = 2000; // 20%
        private const int LTV_TIER2_BPS = 3000; // 30%
        private const int LTV_TIER3_BPS = 4000; // 40%
        private const int FEE_BPS = 50;         // 0.5% origination fee
        private const string COLLATERAL_MEMO = "selfloan:collateral";
        private const string FUND_MEMO = "selfloan:fund";
        private const string REPAY_MEMO = "selfloan:repay";

        [InitialValue("NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32", ContractParameterType.Hash160)]
        private static readonly UInt160 Owner = default;
        #endregion

        #region Storage prefixes
        private static readonly byte[] PREFIX_NEO_PRICE = new byte[] { 0x10 };       // GAS base units per 1 NEO
        private static readonly byte[] PREFIX_POOL = new byte[] { 0x11 };            // lendable GAS balance
        private static readonly byte[] PREFIX_COLLATERAL_CREDIT = new byte[] { 0x12 }; // + borrower -> NEO credit
        private static readonly byte[] PREFIX_LOAN = new byte[] { 0x13 };            // + borrower -> Loan
        private static readonly byte[] PREFIX_TOTAL_LOANS = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_TOTAL_BORROWED = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_TOTAL_REPAID = new byte[] { 0x16 };
        private static readonly byte[] PREFIX_REPAY_CREDIT = new byte[] { 0x17 };    // + borrower -> GAS repay credit
        #endregion

        #region Events
        [DisplayName("CollateralCredited")]
        public static event Action<UInt160, BigInteger, BigInteger> OnCollateralCredited; // borrower, amount, credit
        [DisplayName("PoolFunded")]
        public static event Action<UInt160, BigInteger, BigInteger> OnPoolFunded; // from, amount, pool
        [DisplayName("RepayCredited")]
        public static event Action<UInt160, BigInteger, BigInteger> OnRepayCredited; // borrower, amount, credit
        [DisplayName("PriceSet")]
        public static event Action<BigInteger> OnPriceSet; // gas per neo
        [DisplayName("LoanTaken")]
        public static event Action<UInt160, BigInteger, BigInteger, BigInteger> OnLoanTaken; // borrower, collateral, debt, disbursed
        [DisplayName("CollateralAdded")]
        public static event Action<UInt160, BigInteger, BigInteger> OnCollateralAdded; // borrower, added, collateral
        [DisplayName("Repaid")]
        public static event Action<UInt160, BigInteger, BigInteger> OnRepaid; // borrower, amount, remaining
        [DisplayName("LoanClosed")]
        public static event Action<UInt160, BigInteger> OnLoanClosed; // borrower, collateralReleased
        [DisplayName("PoolWithdrawn")]
        public static event Action<UInt160, BigInteger> OnPoolWithdrawn; // to, amount
        [DisplayName("CollateralWithdrawn")]
        public static event Action<UInt160, BigInteger> OnCollateralWithdrawn; // borrower, amount (NEO)
        [DisplayName("RepayCreditWithdrawn")]
        public static event Action<UInt160, BigInteger> OnRepayCreditWithdrawn; // account, amount (GAS)
        #endregion

        #region Types
        public struct Loan
        {
            public BigInteger Collateral; // NEO locked
            public BigInteger Borrowed;   // outstanding GAS debt (gross)
            public BigInteger LtvBps;     // tier LTV at origination
            public bool Active;
        }
        #endregion

        #region Deposits (NEO collateral / GAS fund / GAS repay)
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(data is not null, "memo required");
            UInt160 caller = Runtime.CallingScriptHash;
            StorageContext ctx = Storage.CurrentContext;
            string memo = (string)data;

            if (caller == NEO.Hash)
            {
                ExecutionEngine.Assert(memo == COLLATERAL_MEMO, "invalid memo");
                byte[] key = Helper.Concat(PREFIX_COLLATERAL_CREDIT, (byte[])from);
                BigInteger credit = (BigInteger)Storage.Get(ctx, key) + amount;
                Storage.Put(ctx, key, credit);
                OnCollateralCredited(from, amount, credit);
            }
            else if (caller == GAS.Hash)
            {
                if (memo == FUND_MEMO)
                {
                    BigInteger pool = (BigInteger)Storage.Get(ctx, PREFIX_POOL) + amount;
                    Storage.Put(ctx, PREFIX_POOL, pool);
                    OnPoolFunded(from, amount, pool);
                }
                else if (memo == REPAY_MEMO)
                {
                    // Only credit here — the repay logic + any transfers run in the
                    // direct Repay() call, never inside this payment callback.
                    byte[] key = Helper.Concat(PREFIX_REPAY_CREDIT, (byte[])from);
                    BigInteger credit = (BigInteger)Storage.Get(ctx, key) + amount;
                    Storage.Put(ctx, key, credit);
                    OnRepayCredited(from, amount, credit);
                }
                else
                {
                    ExecutionEngine.Assert(false, "invalid memo");
                }
            }
            else
            {
                ExecutionEngine.Assert(false, "only NEO collateral or GAS accepted");
            }
        }
        #endregion

        #region Owner config
        public static void SetNeoPrice(BigInteger gasPerNeo)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            ExecutionEngine.Assert(gasPerNeo > 0, "price must be > 0");
            Storage.Put(Storage.CurrentContext, PREFIX_NEO_PRICE, gasPerNeo);
            OnPriceSet(gasPerNeo);
        }

        /// <summary>Owner withdraws unlent pool GAS (capital + accrued origination fees).</summary>
        public static void WithdrawPool(UInt160 to, BigInteger amount)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            ExecutionEngine.Assert(to is not null && to.IsValid && !to.IsZero, "invalid recipient");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            StorageContext ctx = Storage.CurrentContext;
            BigInteger pool = (BigInteger)Storage.Get(ctx, PREFIX_POOL);
            ExecutionEngine.Assert(pool >= amount, "insufficient pool");
            Storage.Put(ctx, PREFIX_POOL, pool - amount);
            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, to, amount, "" });
            ExecutionEngine.Assert(ok, "pool transfer failed");
            OnPoolWithdrawn(to, amount);
        }
        #endregion

        #region Borrow
        /// <summary>
        /// Lock the caller's credited NEO collateral and disburse GAS up to the tier LTV
        /// of its configured value, minus the origination fee. Returns the disbursed GAS.
        /// </summary>
        public static BigInteger Borrow(UInt160 borrower, BigInteger tier)
        {
            ExecutionEngine.Assert(borrower is not null && borrower.IsValid && !borrower.IsZero, "invalid borrower");
            ExecutionEngine.Assert(Runtime.CheckWitness(borrower), "borrower witness required");

            StorageContext ctx = Storage.CurrentContext;
            ExecutionEngine.Assert(!LoadLoan(ctx, borrower).Active, "loan already active");

            BigInteger ltvBps = TierBps(tier);
            BigInteger price = (BigInteger)Storage.Get(ctx, PREFIX_NEO_PRICE);
            ExecutionEngine.Assert(price > 0, "price not set");

            byte[] creditKey = Helper.Concat(PREFIX_COLLATERAL_CREDIT, (byte[])borrower);
            BigInteger collateral = (BigInteger)Storage.Get(ctx, creditKey);
            ExecutionEngine.Assert(collateral > 0, "no collateral");

            BigInteger collateralValue = collateral * price;       // GAS base units
            BigInteger gross = collateralValue * ltvBps / 10000;   // debt
            ExecutionEngine.Assert(gross > 0, "borrow amount too small");
            BigInteger fee = gross * FEE_BPS / 10000;
            BigInteger disbursed = gross - fee;

            BigInteger pool = (BigInteger)Storage.Get(ctx, PREFIX_POOL);
            ExecutionEngine.Assert(pool >= disbursed, "insufficient pool liquidity");

            // Effects before interaction (CEI).
            Storage.Delete(ctx, creditKey);
            Loan loan = new Loan { Collateral = collateral, Borrowed = gross, LtvBps = ltvBps, Active = true };
            Storage.Put(ctx, LoanKey(borrower), StdLib.Serialize(loan));
            Storage.Put(ctx, PREFIX_POOL, pool - disbursed);
            Storage.Put(ctx, PREFIX_TOTAL_LOANS, (BigInteger)Storage.Get(ctx, PREFIX_TOTAL_LOANS) + 1);
            Storage.Put(ctx, PREFIX_TOTAL_BORROWED, (BigInteger)Storage.Get(ctx, PREFIX_TOTAL_BORROWED) + gross);

            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, borrower, disbursed, "" });
            ExecutionEngine.Assert(ok, "disbursement failed");

            OnLoanTaken(borrower, collateral, gross, disbursed);
            return disbursed;
        }

        /// <summary>Move the caller's credited NEO into their active loan as extra collateral.</summary>
        public static void AddCollateral(UInt160 borrower)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(borrower), "borrower witness required");
            StorageContext ctx = Storage.CurrentContext;
            Loan loan = LoadLoan(ctx, borrower);
            ExecutionEngine.Assert(loan.Active, "no active loan");

            byte[] creditKey = Helper.Concat(PREFIX_COLLATERAL_CREDIT, (byte[])borrower);
            BigInteger add = (BigInteger)Storage.Get(ctx, creditKey);
            ExecutionEngine.Assert(add > 0, "no collateral to add");
            Storage.Delete(ctx, creditKey);
            loan.Collateral += add;
            Storage.Put(ctx, LoanKey(borrower), StdLib.Serialize(loan));
            OnCollateralAdded(borrower, add, loan.Collateral);
        }
        #endregion

        #region Repay
        /// <summary>
        /// Apply the borrower's prepaid GAS repay-credit to their loan. Caps at the
        /// outstanding debt (any excess credit is refunded), and on full repayment closes
        /// the loan and releases the NEO collateral. Returns the amount applied to the debt.
        /// </summary>
        public static BigInteger Repay(UInt160 borrower)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(borrower), "borrower witness required");
            StorageContext ctx = Storage.CurrentContext;
            Loan loan = LoadLoan(ctx, borrower);
            ExecutionEngine.Assert(loan.Active, "no active loan");

            byte[] creditKey = Helper.Concat(PREFIX_REPAY_CREDIT, (byte[])borrower);
            BigInteger credit = (BigInteger)Storage.Get(ctx, creditKey);
            ExecutionEngine.Assert(credit > 0, "no repay credit");

            BigInteger applied = credit > loan.Borrowed ? loan.Borrowed : credit;
            BigInteger excess = credit - applied;

            // Effects before interaction (CEI).
            Storage.Delete(ctx, creditKey);
            loan.Borrowed -= applied;
            Storage.Put(ctx, PREFIX_POOL, (BigInteger)Storage.Get(ctx, PREFIX_POOL) + applied);
            Storage.Put(ctx, PREFIX_TOTAL_REPAID, (BigInteger)Storage.Get(ctx, PREFIX_TOTAL_REPAID) + applied);

            BigInteger collateral = 0;
            bool closed = loan.Borrowed == 0;
            if (closed)
            {
                collateral = loan.Collateral;
                Storage.Delete(ctx, LoanKey(borrower));
            }
            else
            {
                Storage.Put(ctx, LoanKey(borrower), StdLib.Serialize(loan));
            }

            OnRepaid(borrower, applied, loan.Borrowed);

            // Interactions last: release collateral on full repay, then refund any excess.
            if (closed)
            {
                bool ok = (bool)Contract.Call(NEO.Hash, "transfer", CallFlags.All,
                    new object[] { Runtime.ExecutingScriptHash, borrower, collateral, "" });
                ExecutionEngine.Assert(ok, "collateral release failed");
                OnLoanClosed(borrower, collateral);
            }
            if (excess > 0)
            {
                bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                    new object[] { Runtime.ExecutingScriptHash, borrower, excess, "" });
                ExecutionEngine.Assert(ok, "excess refund failed");
            }
            return applied;
        }
        #endregion
    }
}
