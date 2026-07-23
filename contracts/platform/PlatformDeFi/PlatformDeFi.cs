using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    // Event delegates
    public delegate void ProductRegisteredHandler(string appId, BigInteger productType, UInt160 appAdmin);
    public delegate void AppPausedHandler(string appId, bool paused);

    // Lending events
    public delegate void LoanCreatedHandler(string appId, BigInteger loanId, UInt160 borrower, BigInteger collateral, BigInteger borrowed);
    public delegate void LoanRepaidHandler(string appId, BigInteger loanId, BigInteger repaid, BigInteger remaining);
    public delegate void LoanClosedHandler(string appId, BigInteger loanId, UInt160 borrower);
    public delegate void CollateralAddedHandler(string appId, BigInteger loanId, BigInteger amount, BigInteger newTotal);
    public delegate void LoanLiquidatedHandler(string appId, BigInteger loanId, UInt160 borrower, UInt160 liquidator, BigInteger debtRepaid, BigInteger collateralSeized);
    public delegate void NeoGasPriceUpdatedHandler(string appId, BigInteger price);
    // Audit fix FixV: emitted when a price update lowers the stored NEO/GAS price, marking
    // the start of the liquidation grace window. (oldPrice, newPrice, dropTime)
    public delegate void PriceDropRecordedHandler(string appId, BigInteger oldPrice, BigInteger newPrice, BigInteger dropTime);
    // Audit fix FixV: emitted when liquidation returns surplus collateral to the borrower.
    public delegate void LiquidationSurplusReturnedHandler(string appId, BigInteger loanId, UInt160 borrower, BigInteger surplus);
    public delegate void ProfitAnchorConfiguredHandler(string appId, UInt160 profitAnchorContract, string profitAnchorAppId);
    public delegate void ProfitAnchorVoteSyncedHandler(string appId, UInt160 profitAnchorContract, string profitAnchorAppId, ByteString candidate);

    // FlashLoan events
    public delegate void FlashLoanExecutedHandler(string appId, BigInteger loanId, UInt160 borrower, BigInteger amount, BigInteger fee, bool success);
    public delegate void FlashLiquidityDepositedHandler(string appId, UInt160 provider, BigInteger amount);
    public delegate void FlashLiquidityWithdrawnHandler(string appId, UInt160 provider, BigInteger amount);

    // Capsule events
    public delegate void CapsuleCreatedHandler(string appId, BigInteger capsuleId, UInt160 owner, BigInteger amount, BigInteger unlockTime);
    public delegate void CapsuleUnlockedHandler(string appId, BigInteger capsuleId, UInt160 owner, BigInteger payout);
    public delegate void CompoundAddedHandler(string appId, BigInteger capsuleId, BigInteger yieldAmount, BigInteger totalCompound);
    public delegate void EarlyWithdrawHandler(string appId, BigInteger capsuleId, UInt160 owner, BigInteger penalty);

    /// <summary>
    /// PlatformDeFi - Multi-tenant DeFi engine consolidating SelfLoan,
    /// FlashLoan, and CompoundCapsule into one reusable contract.
    ///
    /// Each registered app (appId) gets its own isolated storage namespace
    /// via AppKey(appId, PREFIX_*). Product types: Lending(1), FlashLoan(2), Capsule(3).
    /// </summary>
    [DisplayName("PlatformDeFi")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.1.0")]
    [ManifestExtra("Description", "Multi-tenant DeFi engine for Neo N3. Consolidates SelfLoan, FlashLoan, and CompoundCapsule products into a single reusable contract with per-app isolation.")]
    [ContractPermission("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", "transfer", "vote")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "balanceOf", "transfer")]
    [ContractPermission("*", "getSelectedCandidate", "onFlashLoan")]
    public partial class PlatformDeFiContract : SmartContract
    {
        #region Product Type Enum
        private const int ProductType_Lending = 1;
        private const int ProductType_FlashLoan = 2;
        private const int ProductType_Capsule = 3;
        #endregion

        #region Global Prefixes (0x01-0x0F reserved for platform admin)
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_PAUSED = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_TOTAL_NEO_CREDIT_LIABILITY = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_TOTAL_GAS_CREDIT_LIABILITY = new byte[] { 0x04 };

        // Per-app registration
        private static readonly byte[] PREFIX_APP_TYPE = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_APP_ADMIN = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_APP_CONFIG = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_APP_PAUSED = new byte[] { 0x13 };

        // Per-app NEO collateral credit (for Lending + Capsule)
        private static readonly byte[] PREFIX_NEO_CREDIT = new byte[] { 0x14 };
        // Per-app GAS credit (for Lending repay + FlashLoan deposit)
        private static readonly byte[] PREFIX_GAS_CREDIT = new byte[] { 0x15 };

        // Audit fix A10 (per-product GAS segregation): one deployed contract hosts
        // several products that all hold GAS in the SAME native GAS balance. Without
        // per-product accounting, a lending disbursement or capsule compound payout
        // could draw the contract's GAS below what is owed to FlashLoan LPs (their
        // principal becomes strandable). Each product now tracks its OWN GAS pool and
        // may only ever spend from its own counter:
        //
        //   * PREFIX_LENDING_GAS_LIQUIDITY - GAS available to disburse lending loans.
        //     Funded by LendingDeposit, drawn down on CreateLoan, refilled on repay /
        //     liquidation. CreateLoan asserts netLoan <= this counter (audit fix A12).
        //   * PREFIX_CAPSULE_GAS_RESERVE - GAS reserve that funds capsule compound
        //     yield. Funded by FundCapsuleYieldReserve, drawn down at unlock. Compound
        //     payout asserts the reserve covers it (audit fix A9) so yield is never
        //     paid from FlashLoan LP principal or lending liquidity.
        //   * FlashLoan LP principal already lives in PREFIX_FLASH_TOTAL_LP_DEPOSITS
        //     and the pool balance, so it is the third segregated GAS pool.
        private static readonly byte[] PREFIX_LENDING_GAS_LIQUIDITY = new byte[] { 0x16 };
        private static readonly byte[] PREFIX_CAPSULE_GAS_RESERVE = new byte[] { 0x17 };
        private static readonly byte[] PREFIX_APP_NEO_CREDIT_LIABILITY = new byte[] { 0x18 };
        private static readonly byte[] PREFIX_APP_GAS_CREDIT_LIABILITY = new byte[] { 0x19 };
        #endregion

        #region Lending Prefixes (0x20-0x2F)
        private static readonly byte[] PREFIX_LOAN_ID = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_LOANS = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_USER_LOANS = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_USER_LOAN_COUNT = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_TOTAL_COLLATERAL = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_TOTAL_DEBT = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_TOTAL_REPAID = new byte[] { 0x26 };
        private static readonly byte[] PREFIX_TOTAL_BORROWERS = new byte[] { 0x27 };
        private static readonly byte[] PREFIX_PROFIT_ANCHOR_CONTRACT = new byte[] { 0x28 };
        private static readonly byte[] PREFIX_PROFIT_ANCHOR_APP_ID = new byte[] { 0x29 };
        // Running total of NEO forfeited via AbandonLoan, awaiting admin sweep
        // through WithdrawAbandonedCollateral. Abandoned loans are identified by
        // `loan.Active == false && loan.Debt > 0` so no extra per-loan flag is needed.
        private static readonly byte[] PREFIX_TOTAL_ABANDONED_COLLATERAL = new byte[] { 0x2A };
        // Origination fees retained on CreateLoan (LENDING_FEE_BPS portion of
        // loanAmount). Without an accumulator + sweep these GAS units would
        // accumulate untracked in the contract balance forever.
        private static readonly byte[] PREFIX_TOTAL_LENDING_FEES = new byte[] { 0x2B };
        // Audit fix H-3: per-app NEO price expressed as GAS (FIXED8) per 1 NEO, used to value
        // collateral for loan sizing, health factor, and liquidation. A keeper/oracle updater
        // pushes the live price; unset defaults to 1 NEO = 1 GAS to preserve legacy behavior.
        private static readonly byte[] PREFIX_NEO_GAS_PRICE = new byte[] { 0x2C };
        // Audit fix FixV (liquidation manipulation): last NEO/GAS price-update timestamp,
        // used to enforce a minimum update interval so an admin cannot ladder many small
        // updates within one block/window to bypass the per-update deviation cap.
        private static readonly byte[] PREFIX_NEO_GAS_PRICE_TIME = new byte[] { 0x2D };
        // Audit fix FixV: timestamp of the most recent PRICE DECREASE. Loans only become
        // liquidatable against the lowered valuation once LIQUIDATION_GRACE_MS has elapsed
        // since this time, giving borrowers a window to top up collateral or repay.
        private static readonly byte[] PREFIX_PRICE_DROP_TIME = new byte[] { 0x2E };
        #endregion

        #region FlashLoan Prefixes (0x30-0x3F)
        private static readonly byte[] PREFIX_FLASH_LOAN_ID = new byte[] { 0x30 };
        private static readonly byte[] PREFIX_FLASH_LOANS = new byte[] { 0x31 };
        private static readonly byte[] PREFIX_POOL_BALANCE = new byte[] { 0x32 };
        private static readonly byte[] PREFIX_BORROWER_LAST_LOAN = new byte[] { 0x33 };
        private static readonly byte[] PREFIX_BORROWER_DAILY_COUNT = new byte[] { 0x34 };
        private static readonly byte[] PREFIX_FLASH_TOTAL_BORROWED = new byte[] { 0x35 };
        private static readonly byte[] PREFIX_FLASH_TOTAL_FEES = new byte[] { 0x36 };
        private static readonly byte[] PREFIX_FLASH_REENTRANCY = new byte[] { 0x3E };
        // Per-LP deposit balance for FlashLoan pool. Maps (appId, provider) -> deposited amount.
        // Without this, FlashWithdraw had no way to constrain a caller to their own deposit and
        // any caller could drain the entire pool (audit finding C-1).
        private static readonly byte[] PREFIX_FLASH_PROVIDER_BAL = new byte[] { 0x3F };
        // Sum of all per-LP deposits for an app's FlashLoan pool. Mirrors the pool
        // balance MINUS accumulated fees, giving an observable invariant:
        //   PREFIX_POOL_BALANCE = PREFIX_FLASH_TOTAL_LP_DEPOSITS + cumulative fees
        // so off-chain monitors can compute fee revenue without iterating per-LP keys.
        private static readonly byte[] PREFIX_FLASH_TOTAL_LP_DEPOSITS = new byte[] { 0x37 };
        #endregion

        #region Capsule Prefixes (0x40-0x4F)
        private static readonly byte[] PREFIX_CAPSULE_ID = new byte[] { 0x40 };
        private static readonly byte[] PREFIX_CAPSULES = new byte[] { 0x41 };
        private static readonly byte[] PREFIX_USER_CAPSULES = new byte[] { 0x42 };
        private static readonly byte[] PREFIX_USER_CAPSULE_COUNT = new byte[] { 0x43 };
        private static readonly byte[] PREFIX_TOTAL_LOCKED = new byte[] { 0x44 };
        private static readonly byte[] PREFIX_TOTAL_COMPOUND = new byte[] { 0x45 };
        private static readonly byte[] PREFIX_TOTAL_CAPSULE_USERS = new byte[] { 0x46 };
        private static readonly byte[] PREFIX_TOTAL_WITHDRAWN = new byte[] { 0x47 };
        private static readonly byte[] PREFIX_TOTAL_PENALTIES = new byte[] { 0x48 };
        // Unlock fee (CAPSULE_FEE_BPS portion of compound) retained at unlock.
        // Same trapped-funds pattern as the lending fee — accumulator + sweep.
        private static readonly byte[] PREFIX_TOTAL_CAPSULE_FEES = new byte[] { 0x49 };
        #endregion

        #region Lending Constants
        private const long GAS_FIXED8 = 100_000_000;
        private const int LTV_TIER1_BPS = 2000;  // 20%
        private const int LTV_TIER2_BPS = 3000;  // 30%
        private const int LTV_TIER3_BPS = 4000;  // 40%
        private const int LIQUIDATION_THRESHOLD_BPS = 8000;
        private const int MIN_HEALTH_FACTOR = 100; // 1.0 scaled by 100
        private const long MIN_COLLATERAL = 1;     // 1 NEO
        private const int LENDING_FEE_BPS = 50;    // 0.5% origination
        // Audit fix FixV (price-manipulation liquidation): a single SetNeoGasPrice update
        // may move the stored price by at most +/- MAX_PRICE_DEVIATION_BPS (20%). This caps
        // how far an admin (or a compromised keeper) can crash the price in one step, so a
        // collateral confiscation requires many throttled updates rather than one swing.
        private const int MAX_PRICE_DEVIATION_BPS = 2000; // +/-20% per update
        // Minimum wall-clock gap between two price updates for the same app. Combined with
        // the deviation cap, this rate-limits how fast the valuation can be driven down.
        private const ulong MIN_PRICE_UPDATE_INTERVAL_MS = 3_600_000UL; // 1 hour
        // Grace period after a price DECREASE before loans may be liquidated against the
        // lowered valuation, giving borrowers time to add collateral or repay.
        private const ulong LIQUIDATION_GRACE_MS = 3_600_000UL; // 1 hour
        // Liquidation bonus: the liquidator keeps collateral worth debt + this bonus; any
        // remaining collateral surplus is returned to the borrower's NEO credit. This both
        // incentivizes keepers and stops a healthy-but-underwater loan from being fully
        // confiscated when collateral value far exceeds the debt.
        private const int LIQUIDATION_BONUS_BPS = 1000; // 10% bonus over debt value
        #endregion

        #region FlashLoan Constants
        private const long FLASH_MIN_LOAN = 100_000_000;       // 1 GAS
        private const long FLASH_MAX_LOAN = 10_000_000_000_000; // 100,000 GAS
        private const int FLASH_FEE_BPS = 9;                    // 0.09%
        // Audit fix NEW-L-2: store the cooldown directly in milliseconds so the
        // use site no longer has to multiply by 1000. Constant name reflects
        // the unit. (Runtime.Time on Neo N3 is ms.)
        private const ulong FLASH_COOLDOWN_MS = 300_000UL;       // 5 min
        private const int FLASH_MAX_DAILY = 10;
        #endregion

        #region Capsule Constants
        private const int CAPSULE_FEE_BPS = 100;              // 1%
        private const int CAPSULE_EARLY_PENALTY_BPS = 500;    // 5%
        // 20 NEO is the smallest deposit where the 5% early-withdrawal penalty
        // rounds to ≥1 NEO under integer math (20 * 500 / 10000 = 1). Anything
        // smaller would silently waive the penalty; bumping the floor here keeps
        // CAPSULE_EARLY_PENALTY_BPS economically meaningful.
        private const long CAPSULE_MIN_DEPOSIT = 20;          // 20 NEO (whole units)
        private const int CAPSULE_MIN_LOCK_DAYS = 7;
        private const int CAPSULE_MAX_LOCK_DAYS = 365;
        private const int TIER1_DAYS = 7;
        private const int TIER1_APY_BPS = 300;   // 3%
        private const int TIER2_DAYS = 30;
        private const int TIER2_APY_BPS = 500;   // 5%
        private const int TIER3_DAYS = 90;
        private const int TIER3_APY_BPS = 800;   // 8%
        private const int TIER4_DAYS = 180;
        private const int TIER4_APY_BPS = 1200;  // 12%
        #endregion

        #region Data Structures

        public struct Loan
        {
            public UInt160 Borrower;
            public BigInteger Collateral;
            public BigInteger Debt;
            // Reserved-for-future-use fields, audit finding NEW-H-7.
            // SelfLoan currently ships as a flat-fee, no-interest loan. The
            // fields below are written at CreateLoan but never updated after,
            // so reading them is meaningless except for the creation snapshot.
            // They remain in the struct because existing on-chain Loan records
            // already include them; deleting would break deserialization of
            // any live loan on mainnet (contract `0x942da5...`). If/when an
            // interest-accrual implementation lands, write a helper that
            // updates LastYieldTime/YieldAccrued on every state-mutating call
            // (RepayLoan, AddCollateral, CloseLoan) and document the yield
            // source (NEO voting rewards, anchor profits, etc.).
            public BigInteger OriginalDebt;
            public BigInteger CreatedTime;
            public BigInteger LastYieldTime;
            public BigInteger LtvBps;
            public BigInteger TotalRepaid;
            public BigInteger YieldAccrued;
            public bool Active;
        }

        public struct FlashLoanData
        {
            public UInt160 Borrower;
            public BigInteger Amount;
            public BigInteger Fee;
            public UInt160 CallbackContract;
            public string CallbackMethod;
            public BigInteger Timestamp;
            public bool Executed;
            public bool Success;
        }

        public struct Capsule
        {
            public UInt160 Owner;
            public BigInteger Principal;
            public BigInteger Compound;
            public BigInteger CreatedTime;
            public BigInteger UnlockTime;
            public BigInteger LastCompoundTime;
            public BigInteger LockDays;
            public BigInteger ApyBps;
            public bool Active;
            public bool EarlyWithdrawn;
        }

        #endregion
    }
}
