using System;
using System.IO;
using System.Numerics;
using Neo;
using Neo.Extensions;
using Neo.SmartContract;
using Neo.SmartContract.Manifest;
using Neo.SmartContract.Testing;
using Neo.VM;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public abstract class PlatformGameCountdownContract : SmartContract
    {
        protected PlatformGameCountdownContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract void registerGame(string appId, BigInteger gameType, UInt160 appAdmin, byte[]? config);
        public abstract void checkAndEndCountdownRound(string appId);
        public abstract BigInteger? getDirectGasCredit(string appId, UInt160 payer);
        public abstract BigInteger? calculateCountdownKeyCost(BigInteger keyCount, BigInteger currentTotalKeys);
        public abstract Neo.VM.Types.Map getCountdownStatus(string appId);
    }

    // A minimal contract whose onNEP17Payment FAULTS on the settlement payout
    // shape (a transfer with no data, exactly what GAS.Transfer(self, winner,
    // prize) sends), yet can still become the Countdown LastBuyer by depositing
    // prepaid credit and buying a key from its own context. Used to prove that
    // settlement no longer pushes GAS to the winner: a push to a winner whose
    // onNEP17Payment faults would brick CheckAndEndCountdownRound (and the
    // auto-settle inside BuyCountdownKeys) and strand the whole pot. With the
    // pull-payment fix the prize is credited to the existing direct GAS credit
    // ledger instead, so settlement always completes for such a winner; the
    // winner reclaims the prize via WithdrawGasCredit.
    public abstract class GasRejectingBuyerMock : SmartContract
    {
        protected GasRejectingBuyerMock(SmartContractInitialize initialize) : base(initialize) { }
        public abstract void becomeWinner();
    }

    public class PlatformGameCountdownPullPayoutTests
    {
        private const long GAS = 100000000;               // 1 GAS base units
        private const int CD_PLATFORM_FEE_BPS = 500;      // mirrors PlatformGame.Countdown.cs
        private const int CD_NEXT_ROUND_SHARE_BPS = 1000; // mirrors PlatformGame.Countdown.cs
        private const long CD_INITIAL_DURATION_MS = 86400000L; // 24h round; advance past it
        private const long GameType_Countdown = 1;        // mirrors PlatformGame.cs
        private const string AppId = "countdown-pull";

        private static readonly string BuildDir = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "build"));

        private static (NefFile nef, ContractManifest manifest) Load(string name)
        {
            string nefPath = Path.Combine(BuildDir, name + ".nef");
            string manifestPath = Path.Combine(BuildDir, name + ".manifest.json");
            Assert.True(File.Exists(nefPath), $"NEF missing: {nefPath}");
            return (NefFile.Parse(File.ReadAllBytes(nefPath)),
                    ContractManifest.Parse(File.ReadAllText(manifestPath)));
        }

        private static void FundGas(TestEngine engine, UInt160 to, BigInteger gas)
        {
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            engine.Native.GAS.Transfer(engine.ValidatorsAddress, to, gas, null);
        }

        // Fund a contract that rejects null-data transfers: the memo keeps the mock's
        // onNEP17Payment off its faulting path so the TestEngine host does not crash.
        private static void FundGasWithMemo(TestEngine engine, UInt160 to, BigInteger gas, string memo)
        {
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            engine.Native.GAS.Transfer(engine.ValidatorsAddress, to, gas, memo);
        }

        private static BigInteger StatusInt(Neo.VM.Types.Map status, string key) =>
            status[(Neo.VM.Types.PrimitiveType)key].GetInteger();

        // Hand-build a tiny contract whose only behaviours are:
        //   onNEP17Payment(from, amount, data) -> ABORT when data is null, the exact
        //                                         shape of the settlement payout push
        //                                         (GAS.Transfer(self, winner, prize)
        //                                         passes no data). This models a
        //                                         winner whose payout receive faults.
        //                                         Funding transfers carry a memo so
        //                                         the mock can be funded without the
        //                                         faulting path crashing the host.
        //   becomeWinner()                     -> deposit prepaid credit into the
        //                                         platform, then buy 1 key so this
        //                                         contract becomes the LastBuyer.
        // The platform hash, GAS hash, appId, memo and key cost are baked in as
        // constants (all known after the platform is deployed and the app is
        // registered), so becomeWinner takes no arguments.
        private static (NefFile nef, ContractManifest manifest) BuildGasRejectingBuyer(
            UInt160 gasHash, UInt160 platformHash, string appId, string memo, BigInteger keyCost)
        {
            using var sb = new ScriptBuilder();

            // offset 0: onNEP17Payment(from, amount, data). Abort when data is null
            // (the payout-push shape); accept memo-tagged funding transfers.
            sb.Emit(OpCode.INITSLOT, new byte[] { 0, 3 }); // 0 locals, 3 args
            sb.Emit(OpCode.LDARG2);                        // data
            sb.Emit(OpCode.ISNULL);                        // data == null ?
            sb.Emit(OpCode.NOT);                           // data != null
            sb.Emit(OpCode.ASSERT);                        // abort if data was null
            sb.Emit(OpCode.RET);

            int becomeWinnerOffset = sb.Length;

            // deposit: GAS.transfer(self, platformHash, keyCost, memo)
            // PACK builds the array with array[0] = first item popped (top of stack),
            // so push memo, keyCost, platformHash, self (self ends on top).
            sb.EmitPush(memo);                                                  // arg3
            sb.EmitPush(keyCost);                                               // arg2
            sb.EmitPush(platformHash.ToArray());                                          // arg1
            sb.EmitSysCall(ApplicationEngine.System_Runtime_GetExecutingScriptHash.Hash); // arg0 = self
            sb.EmitPush(4);
            sb.Emit(OpCode.PACK);                                               // [self, platformHash, keyCost, memo]
            sb.EmitPush((BigInteger)(int)CallFlags.All);
            sb.EmitPush("transfer");
            sb.EmitPush(gasHash.ToArray());
            sb.EmitSysCall(ApplicationEngine.System_Contract_Call.Hash);
            sb.Emit(OpCode.DROP);                                               // drop the bool result

            // buy: platform.buyCountdownKeys(appId, self, 1)
            sb.EmitPush(1);                                                     // keyCount
            sb.EmitSysCall(ApplicationEngine.System_Runtime_GetExecutingScriptHash.Hash); // self (player)
            sb.EmitPush(appId);                                                 // appId
            sb.EmitPush(3);
            sb.Emit(OpCode.PACK);                                               // [appId, self, 1]
            sb.EmitPush((BigInteger)(int)CallFlags.All);
            sb.EmitPush("buyCountdownKeys");
            sb.EmitPush(platformHash.ToArray());
            sb.EmitSysCall(ApplicationEngine.System_Contract_Call.Hash);
            sb.Emit(OpCode.DROP);                                               // buyCountdownKeys is void -> drop the Null result
            sb.Emit(OpCode.RET);

            byte[] script = sb.ToArray();

            var nef = new NefFile
            {
                Compiler = "pull-payout-test",
                Source = "",
                Tokens = Array.Empty<MethodToken>(),
                Script = script
            };
            nef.CheckSum = NefFile.ComputeChecksum(nef);

            string manifestJson =
                "{\"name\":\"GasRejectingBuyerMock\",\"groups\":[],\"features\":{}," +
                "\"supportedstandards\":[],\"abi\":{\"methods\":[" +
                "{\"name\":\"onNEP17Payment\",\"parameters\":[" +
                "{\"name\":\"from\",\"type\":\"Hash160\"}," +
                "{\"name\":\"amount\",\"type\":\"Integer\"}," +
                "{\"name\":\"data\",\"type\":\"Any\"}]," +
                "\"returntype\":\"Void\",\"offset\":0,\"safe\":false}," +
                "{\"name\":\"becomeWinner\",\"parameters\":[]," +
                "\"returntype\":\"Void\",\"offset\":" + becomeWinnerOffset + ",\"safe\":false}]," +
                "\"events\":[]},\"permissions\":[{\"contract\":\"*\",\"methods\":\"*\"}]," +
                "\"trusts\":[],\"extra\":null}";

            return (nef, ContractManifest.Parse(manifestJson));
        }

        [Fact]
        public void Countdown_SettlementCreditsContractWinnerThatRejectsGasAndRollsRound()
        {
            var engine = new TestEngine(true);
            engine.Fee = 5000L * GAS; // PlatformGame is a large consolidated contract; raise the per-invoke gas budget.
            var (nef, manifest) = Load("PlatformGame");

            // Deploy as the committee, which (as the deploy tx sender) becomes the
            // platform admin (PREFIX_ADMIN = Runtime.Transaction.Sender) and holds the
            // deploy gas. RegisterGame's ValidateAdmin then accepts this signer.
            UInt160 admin = engine.ValidatorsAddress;
            engine.SetTransactionSigners(admin);
            var platform = engine.Deploy<PlatformGameCountdownContract>(nef, manifest);

            // Register a Countdown app as the platform admin.
            platform.registerGame(AppId, GameType_Countdown, admin, null);

            // The mock buys 1 key from an empty round (totalKeys == 0), so its cost
            // is the base key price. The settled pot, after the 5% platform fee and
            // the 10% next-round rollover, becomes the winner's prize.
            BigInteger keyCost = platform.calculateCountdownKeyCost(1, 0) ?? 0;
            Assert.True(keyCost > 0, "base key cost must be positive");
            BigInteger pot = keyCost * (10000 - CD_PLATFORM_FEE_BPS) / 10000;
            BigInteger nextRoundPot = pot * CD_NEXT_ROUND_SHARE_BPS / 10000;
            BigInteger winnerPrize = pot - nextRoundPot;

            // Build + deploy the GAS-rejecting buyer with all constants baked in.
            var (mockNef, mockManifest) = BuildGasRejectingBuyer(
                engine.Native.GAS.Hash, platform.Hash, AppId, AppId + ":buy", keyCost);
            var mock = engine.Deploy<GasRejectingBuyerMock>(mockNef, mockManifest);

            // Fund the mock with a memo-tagged transfer so it can deposit the key
            // cost into the platform. The mock rejects only null-data transfers (the
            // payout-push shape); a faulting onNEP17Payment crashes the TestEngine
            // host (see MiniAppLastSurvivorTests), so funding must avoid that path.
            FundGasWithMemo(engine, mock.Hash, 10L * GAS, "fund");

            // The mock deposits credit (into the platform, whose onNEP17Payment
            // succeeds) and buys a key -> it is now the LastBuyer / future winner.
            engine.SetTransactionSigners(admin);
            mock.becomeWinner();

            Neo.VM.Types.Map liveStatus = platform.getCountdownStatus(AppId);
            Assert.Equal(BigInteger.One, StatusInt(liveStatus, "roundId"));
            Assert.Equal(mock.Hash,
                new UInt160(liveStatus[(Neo.VM.Types.PrimitiveType)"lastBuyer"].GetSpan()));
            Assert.Equal(BigInteger.Zero, platform.getDirectGasCredit(AppId, mock.Hash));

            // Push the persisting block past the 24h round deadline.
            engine.PersistingBlock.Advance(TimeSpan.FromMilliseconds(CD_INITIAL_DURATION_MS + 60000));

            // Permissionless settlement must SUCCEED even though the winner is a
            // contract that rejects GAS (no push), and credit it the prize.
            engine.SetTransactionSigners(admin); // anyone may settle
            platform.checkAndEndCountdownRound(AppId);

            // Pull-payment: the winner is credited the exact prize into the existing
            // direct GAS credit ledger (claimed via WithdrawGasCredit), never paid.
            Assert.Equal(winnerPrize, platform.getDirectGasCredit(AppId, mock.Hash));

            // A fresh round (round 2) has started, seeded with the rolled-over pot.
            Neo.VM.Types.Map freshStatus = platform.getCountdownStatus(AppId);
            Assert.Equal(new BigInteger(2), StatusInt(freshStatus, "roundId"));
            Assert.Equal(nextRoundPot, StatusInt(freshStatus, "pot"));
        }
    }
}
