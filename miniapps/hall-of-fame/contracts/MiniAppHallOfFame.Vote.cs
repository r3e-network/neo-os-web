using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHallOfFame
    {
        #region Vote Method

        /// <summary>
        /// Cast a vote for a nominee in the current season.
        /// 
        /// REQUIREMENTS:
        /// - Platform not globally paused
        /// - Minimum vote: 0.1 GAS
        /// - Active season must be running
        /// - Season must not have ended
        /// - Voter must be authenticated (CheckWitness or Gateway)
        /// - Nominee must exist in category
        /// - Valid payment receipt for vote amount
        /// 
        /// EFFECTS:
        /// - Updates nominee vote totals
        /// - Updates season totals
        /// - Updates user statistics
        /// - Increases total pool
        /// - Emits VoteRecorded event
        /// 
        /// PLATFORM FEE: 5% deducted from vote amount
        /// VOTER REWARD: 10% of season pool distributed to voters
        /// </summary>
        /// <param name="voter">Address of the voter</param>
        /// <param name="category">Category being voted in</param>
        /// <param name="nominee">Name of nominee being voted for</param>
        /// <param name="amount">Vote amount in GAS (neo-atomic units)</param>
        /// <param name="receiptId">Payment receipt ID for validation</param>
        /// <exception cref="Exception">If validation fails or unauthorized</exception>
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
