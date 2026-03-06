using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// Highly abstract and customizable Prediction Market Contract Template.
    /// Driven entirely by instantiation parameters, enabling "No-Code" deployment.
    /// </summary>
    [DisplayName("MiniAppTemplate.Prediction")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Parameter-driven prediction market template")]
    [ContractPermission("*", "*")]
    public class TemplatePrediction : MiniAppTemplate
    {
        private static readonly byte[] PREFIX_MARKET_STATE = new byte[] { 0x40 };
        private static readonly byte[] PREFIX_BETS = new byte[] { 0x41 };

        public struct MarketParams
        {
            public UInt160 OracleAddress;
            public ulong SettlementTimestamp;
            public BigInteger MinBetAmount;
            public BigInteger MaxBetAmount;
            public ulong FeeBps;
            public string Question;
            public string[] Options;
        }

        public struct MarketState
        {
            public bool IsResolved;
            public string WinningOption;
            public BigInteger TotalPool;
            public BigInteger FeeCollected;
            public Map<string, BigInteger> OptionPools;
        }

        public struct BetRecord
        {
            public UInt160 User;
            public string Option;
            public BigInteger Amount;
            public bool Claimed;
        }

#pragma warning disable CS8618
        [DisplayName("MarketDeployed")]
        public static event Action<UInt160, string> OnMarketDeployed;

        [DisplayName("BetPlaced")]
        public static event Action<UInt160, string, BigInteger> OnBetPlaced;

        [DisplayName("MarketResolved")]
        public static event Action<string> OnMarketResolved;

        [DisplayName("WinningsClaimed")]
        public static event Action<UInt160, BigInteger> OnWinningsClaimed;
#pragma warning restore CS8618

        public static void _deploy(object data, bool update)
        {
            if (update) return;

            // Initialize base template config
            InitializeTemplate(data);

            if (data == null) return;

            object[] initArgs = (object[])data;
            if (initArgs.Length > 1 && initArgs[1] != null)
            {
                ByteString marketParamsRaw = (ByteString)initArgs[1];
                if (marketParamsRaw != null && marketParamsRaw.Length > 0)
                {
                    MarketParams paramsObj = (MarketParams)StdLib.Deserialize(marketParamsRaw);
                    SetMetadata("marketParams", marketParamsRaw);

                    MarketState state = new MarketState
                    {
                        IsResolved = false,
                        WinningOption = "",
                        TotalPool = 0,
                        FeeCollected = 0,
                        OptionPools = new Map<string, BigInteger>()
                    };
                    for (int i = 0; i < paramsObj.Options.Length; i++)
                    {
                        state.OptionPools[paramsObj.Options[i]] = 0;
                    }
                    Storage.Put(Storage.CurrentContext, PREFIX_MARKET_STATE, StdLib.Serialize(state));
                    OnMarketDeployed(Runtime.Transaction.Sender, paramsObj.Question);
                }
            }
        }

        [Safe]
        public static MarketParams GetMarketParams()
        {
            ByteString raw = GetMetadata("marketParams");
            if (raw == null || raw.Length == 0) return new MarketParams();
            return (MarketParams)StdLib.Deserialize(raw);
        }

        [Safe]
        public static MarketState GetMarketState()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_MARKET_STATE) ?? (ByteString)"";
            if (raw.Length == 0) return new MarketState();
            return (MarketState)StdLib.Deserialize(raw);
        }

        public static void PlaceBet(string option, BigInteger amount)
        {
            UInt160 caller = Runtime.Transaction.Sender;
            ExecutionEngine.Assert(Runtime.CheckWitness(caller), "Unauthorized");

            MarketParams config = GetMarketParams();
            MarketState state = GetMarketState();

            ExecutionEngine.Assert(!state.IsResolved, "Market already resolved");
            ExecutionEngine.Assert(Runtime.Time < config.SettlementTimestamp, "Betting period ended");
            ValidateAndGetAmount(amount, config.MinBetAmount, config.MaxBetAmount);

            bool validOption = false;
            for (int i = 0; i < config.Options.Length; i++)
            {
                if (config.Options[i] == option)
                {
                    validOption = true;
                    break;
                }
            }
            ExecutionEngine.Assert(validOption, "Invalid option");

            // Transfer GAS (Assuming GAS for simplicity, or we can use generic token transfer)
            bool success = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All, new object[] { caller, Runtime.ExecutingScriptHash, amount, null! });
            ExecutionEngine.Assert(success, "Transfer failed");

            // Deduct fee
            BigInteger fee = amount * config.FeeBps / 10000;
            BigInteger netAmount = amount - fee;

            state.TotalPool += netAmount;
            state.FeeCollected += fee;
            state.OptionPools[option] += netAmount;

            Storage.Put(Storage.CurrentContext, PREFIX_MARKET_STATE, StdLib.Serialize(state));

            // Record bet
            byte[] betKey = Helper.Concat(PREFIX_BETS, caller);
            BetRecord record = new BetRecord
            {
                User = caller,
                Option = option,
                Amount = netAmount,
                Claimed = false
            };
            SetPlayerData(caller, PREFIX_BETS, StdLib.Serialize(record)); // Use base method

            OnBetPlaced(caller, option, amount);
        }

        public static void ResolveMarket(string winningOption)
        {
            MarketParams config = GetMarketParams();
            ExecutionEngine.Assert(Runtime.CheckWitness(config.OracleAddress), "Only oracle can resolve");

            MarketState state = GetMarketState();
            ExecutionEngine.Assert(!state.IsResolved, "Already resolved");
            ExecutionEngine.Assert(Runtime.Time >= config.SettlementTimestamp, "Too early to resolve");

            bool validOption = false;
            for (int i = 0; i < config.Options.Length; i++)
            {
                if (config.Options[i] == winningOption)
                {
                    validOption = true;
                    break;
                }
            }
            ExecutionEngine.Assert(validOption, "Invalid winning option");

            state.IsResolved = true;
            state.WinningOption = winningOption;
            Storage.Put(Storage.CurrentContext, PREFIX_MARKET_STATE, StdLib.Serialize(state));

            OnMarketResolved(winningOption);
        }

        public static void ClaimWinnings()
        {
            UInt160 caller = Runtime.Transaction.Sender;
            ExecutionEngine.Assert(Runtime.CheckWitness(caller), "Unauthorized");

            MarketState state = GetMarketState();
            ExecutionEngine.Assert(state.IsResolved, "Market not resolved");

            ByteString betRaw = GetPlayerData(caller, PREFIX_BETS) ?? (ByteString)"";
            ExecutionEngine.Assert(betRaw.Length > 0, "No bet found");

            BetRecord record = (BetRecord)StdLib.Deserialize(betRaw!);
            ExecutionEngine.Assert(!record.Claimed, "Already claimed");
            ExecutionEngine.Assert(record.Option == state.WinningOption, "Did not win");

            BigInteger winningPool = state.OptionPools[state.WinningOption];
            ExecutionEngine.Assert(winningPool > 0, "Winning pool is zero");

            BigInteger reward = (record.Amount * state.TotalPool) / winningPool;

            record.Claimed = true;
            SetPlayerData(caller, PREFIX_BETS, StdLib.Serialize(record));

            bool success = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All, new object[] { Runtime.ExecutingScriptHash, caller, reward, null! });
            ExecutionEngine.Assert(success, "Transfer failed");

            OnWinningsClaimed(caller, reward);
        }
    }
}