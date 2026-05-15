using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public partial class PlatformDeFiContract
    {
        /// <summary>
        /// Configure the ProfitAnchor app that supplies the operator-selected
        /// candidate for SelfLoan collateral voting. This does not transfer
        /// collateral to ProfitAnchor.
        /// </summary>
        public static void SetProfitAnchor(string appId, UInt160 profitAnchorContract, string profitAnchorAppId)
        {
            ValidateApp(appId, ProductType_Lending);
            ValidateAppAuthority(appId);
            ValidateAddress(profitAnchorContract);
            ExecutionEngine.Assert(profitAnchorAppId != null && profitAnchorAppId.Length > 0, "profit appId required");

            PutAddress(AppKey(appId, PREFIX_PROFIT_ANCHOR_CONTRACT), profitAnchorContract);
            Put(AppKey(appId, PREFIX_PROFIT_ANCHOR_APP_ID), (ByteString)profitAnchorAppId!);

            OnProfitAnchorConfigured(appId, profitAnchorContract, profitAnchorAppId!);
        }

        /// <summary>
        /// Vote the SelfLoan contract's own NEO balance according to the
        /// ProfitAnchor selected-candidate view. User collateral remains in
        /// SelfLoan custody and is still withdrawable only through loan close.
        /// </summary>
        public static void SyncProfitAnchorVote(string appId)
        {
            ValidateApp(appId, ProductType_Lending);
            ValidateAppAuthority(appId);

            UInt160 profitAnchorContract = GetProfitAnchorContract(appId);
            string profitAnchorAppId = GetProfitAnchorAppId(appId);
            ValidateAddress(profitAnchorContract);
            ExecutionEngine.Assert(profitAnchorAppId != null && profitAnchorAppId.Length > 0, "profit anchor not configured");

            ByteString candidate = (ByteString)Contract.Call(
                profitAnchorContract,
                "getSelectedCandidate",
                CallFlags.ReadStates,
                new object[] { profitAnchorAppId! })!;
            ExecutionEngine.Assert(candidate != null && candidate.Length == 33, "profit candidate missing");
            ExecutionEngine.Assert(NEO.Vote(Runtime.ExecutingScriptHash, (ECPoint)candidate!), "collateral vote failed");

            OnProfitAnchorVoteSynced(appId, profitAnchorContract, profitAnchorAppId!, candidate!);
        }

        [Safe]
        public static UInt160 GetProfitAnchorContract(string appId) =>
            ReadAddress(AppKey(appId, PREFIX_PROFIT_ANCHOR_CONTRACT));

        [Safe]
        public static string GetProfitAnchorAppId(string appId)
        {
            ByteString data = GetRaw(AppKey(appId, PREFIX_PROFIT_ANCHOR_APP_ID));
            return data == null ? "" : (string)data;
        }

        [Safe]
        public static Map<string, object> GetProfitAnchor(string appId)
        {
            Map<string, object> result = new Map<string, object>();
            UInt160 contractHash = GetProfitAnchorContract(appId);
            string profitAnchorAppId = GetProfitAnchorAppId(appId);
            result["contract"] = contractHash;
            result["appId"] = profitAnchorAppId;
            result["enabled"] = contractHash != UInt160.Zero && profitAnchorAppId.Length > 0;
            return result;
        }

        [Safe]
        public static Loan GetLoan(string appId, BigInteger loanId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                AppKey(appId, PREFIX_LOANS, loanId));
            if (data == null) return new Loan();
            return (Loan)StdLib.Deserialize(data);
        }

        [Safe]
        public static BigInteger GetHealthFactor(string appId, BigInteger loanId)
        {
            Loan loan = GetLoan(appId, loanId);
            if (loan.Debt == 0) return 10000;
            return loan.Collateral * GAS_FIXED8 * 100 / loan.Debt;
        }

        [Safe]
        public static Map<string, object> GetLendingStats(string appId)
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalLoans"] = GetBigInteger(AppKey(appId, PREFIX_LOAN_ID));
            stats["totalCollateral"] = GetBigInteger(AppKey(appId, PREFIX_TOTAL_COLLATERAL));
            stats["totalDebt"] = GetBigInteger(AppKey(appId, PREFIX_TOTAL_DEBT));
            stats["totalRepaid"] = GetBigInteger(AppKey(appId, PREFIX_TOTAL_REPAID));
            stats["totalBorrowers"] = GetBigInteger(AppKey(appId, PREFIX_TOTAL_BORROWERS));
            stats["ltvTier1Bps"] = LTV_TIER1_BPS;
            stats["ltvTier2Bps"] = LTV_TIER2_BPS;
            stats["ltvTier3Bps"] = LTV_TIER3_BPS;
            stats["liquidationThresholdBps"] = LIQUIDATION_THRESHOLD_BPS;
            stats["minHealthFactor"] = MIN_HEALTH_FACTOR;
            stats["minCollateral"] = MIN_COLLATERAL;
            stats["lendingFeeBps"] = LENDING_FEE_BPS;
            stats["profitAnchor"] = GetProfitAnchor(appId);
            return stats;
        }
    }
}
