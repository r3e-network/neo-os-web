using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCoinFlip
    {
        #region User Methods

        /// <summary>
        /// [DEPRECATED] Uses service callback - use InitiateBet/SettleBet instead.
        /// InitiateBet generates seed, frontend calculates result, SettleBet verifies.
        /// </summary>
        public static BigInteger PlaceBet(UInt160 player, BigInteger amount, bool choice, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            ExecutionEngine.Assert(amount >= MIN_BET, "bet too small");
            ExecutionEngine.Assert(amount <= MAX_BET, "bet too large");
            ValidateBetLimits(player, amount);
            ValidatePaymentReceipt(APP_ID, player, amount, receiptId);

            BigInteger betId = GetBetCount() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_BET_ID, betId);

            BetData bet = new BetData
            {
                Player = player,
                Amount = amount,
                Choice = choice,
                Timestamp = Runtime.Time,
                Resolved = false,
                Won = false,
                Payout = 0,
                StreakBonus = 0
            };
            StoreBet(betId, bet);

            AddUserBet(player, betId);

            BigInteger jackpotContribution = amount * JACKPOT_CONTRIBUTION_BPS / 10000;
            BigInteger currentJackpot = GetJackpotPool();
            Storage.Put(Storage.CurrentContext, PREFIX_JACKPOT_POOL, currentJackpot + jackpotContribution);

            BigInteger totalWagered = GetTotalWagered();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_WAGERED, totalWagered + amount);

            ByteString payload = StdLib.Serialize(new object[] { betId });
            BigInteger requestId = RequestRng(APP_ID, payload);
            StoreRequestData(requestId, (ByteString)betId.ToByteArray());

            OnBetPlaced(player, betId, amount, choice);

            return betId;
        }

        #endregion
    }
}
