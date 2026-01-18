using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHallOfFame
    {
        #region Vote Method

        public static void Vote(UInt160 voter, string category, string nominee, BigInteger amount, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(amount >= MIN_VOTE, "min 0.1 GAS");

            BigInteger seasonId = CurrentSeasonId();
            Season season = GetSeason(seasonId);
            ExecutionEngine.Assert(season.Active, "no active season");
            ExecutionEngine.Assert(Runtime.Time < season.EndTime, "season ended");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(voter), "unauthorized");

            Nominee nom = GetNominee(category, nominee);
            ExecutionEngine.Assert(nom.AddedBy != UInt160.Zero, "invalid nominee");

            ValidatePaymentReceipt(APP_ID, voter, amount, receiptId);

            nom.TotalVotes += amount;
            nom.VoteCount += 1;
            StoreNominee(category, nominee, nom);

            season.TotalVotes += amount;
            StoreSeason(seasonId, season);

            UpdateUserStats(voter, amount, seasonId);

            BigInteger totalPool = TotalPool();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_POOL, totalPool + amount);

            OnVoteRecorded(voter, category, nominee, amount, seasonId);
        }

        #endregion
    }
}
