using System;
using System.IO;
using System.Linq;
using System.Numerics;
using System.Reflection;
using Neo;
using Neo.Network.P2P.Payloads;
using Neo.SmartContract;
using Neo.SmartContract.Manifest;
using Neo.SmartContract.Testing;
using Neo.VM.Types;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public abstract class TarotVrfContract : SmartContract
    {
        protected TarotVrfContract(SmartContractInitialize initialize) : base(initialize) { }

        public abstract BigInteger? requestReading(UInt160 player, BigInteger maxOracleFee);
        public abstract BigInteger? refundExpiredReading(BigInteger readingId);
        public abstract BigInteger? cancelExpiredReading(BigInteger readingId);
        public abstract BigInteger? withdrawAllCredit(UInt160 account);
        public abstract void proposeAdmin(UInt160 account);
        public abstract void acceptAdmin();
        public abstract void setPaused(bool paused);
        public abstract void proposeOracle(UInt160 oracle);
        public abstract void activateOracle();
        public abstract UInt160? admin();
        public abstract UInt160? oracle();
        public abstract bool? isPaused();
        public abstract BigInteger? creditOf(UInt160 account);
        public abstract BigInteger? totalCreditLiability();
        public abstract BigInteger? oracleReserve();
        public abstract BigInteger? revenue();
        public abstract BigInteger? pendingCount();
        public abstract BigInteger? pendingFees();
        public abstract BigInteger? readingsCount();
        public abstract BigInteger? completedReadingsCount();
        public abstract BigInteger? playerCompletedReadingCount(UInt160 player);
        public abstract BigInteger? activeReadingOf(UInt160 player);
        public abstract BigInteger? readingIdForRequest(BigInteger requestId);
        public abstract bool? requestIdSeen(BigInteger requestId);
        public abstract Map? getReading(BigInteger readingId);
        public abstract Map? accounting();
        public abstract Map? integrationConfig();
    }

    public abstract class TarotOracleMockContract : SmartContract
    {
        protected TarotOracleMockContract(SmartContractInitialize initialize) : base(initialize) { }

        public abstract void setAllowedCallback(UInt160 callback, bool allowed);
        public abstract void setRequestFee(BigInteger fee);
        public abstract BigInteger? requestFee();
        public abstract BigInteger? feeCreditOf(UInt160 account);
        public abstract ByteString? payloadHashOf(BigInteger requestId);
        public abstract string? callbackMethodOf(BigInteger requestId);
        public abstract void setNextRequestId(BigInteger requestId);
        public abstract void setReenterAdminDuringRequest(bool enabled);
        public abstract void deliverRich(UInt160 consumer, BigInteger requestId,
            bool success, byte[] result, string error);
        public abstract void deliverRichCustom(UInt160 consumer, BigInteger requestId,
            string appId, string moduleId, string operation, UInt160 requester,
            bool success, byte[] result, string error);
        public abstract void deliverLegacy(UInt160 consumer, BigInteger requestId,
            bool success, byte[] result, string error);
    }

    public class MiniAppTarotVrfTests
    {
        private const long GAS = 100_000_000;
        private const long READING_FEE = 10_000_000;
        private const long ORACLE_FEE = 1_000_000;
        private const long EXPIRY_MS = 7_200_000;
        private const long CHANGE_DELAY_MS = 86_400_000;
        private const int STATUS_PENDING = 1;
        private const int STATUS_DRAWN = 2;
        private const string CREDIT_MEMO = "miniapp-tarot-vrf:credit";
        private const string ORACLE_MEMO = "miniapp-tarot-vrf:oracle";
        private static readonly UInt160 CanonicalTestnetOracle = UInt160.Parse(
            "0x4b882e94ed766807c4fd728768f972e13008ad52");

        private sealed record Harness(
            TestEngine Engine,
            UInt160 Admin,
            UInt160 Player,
            TarotVrfContract Tarot,
            TarotOracleMockContract Oracle);

        private static readonly string BuildDir = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "build"));

        private static (NefFile nef, ContractManifest manifest) Load(string name)
        {
            string nefPath = Path.Combine(BuildDir, name + ".nef");
            string manifestPath = Path.Combine(BuildDir, name + ".manifest.json");
            Assert.True(File.Exists(nefPath), $"NEF missing: {nefPath}");
            Assert.True(File.Exists(manifestPath), $"manifest missing: {manifestPath}");
            return (
                NefFile.Parse(File.ReadAllBytes(nefPath)),
                ContractManifest.Parse(File.ReadAllText(manifestPath)));
        }

        private static Harness Deploy(bool allowCallback = true, BigInteger? reserve = null,
            BigInteger? playerCredit = null, bool playerIsAdmin = false)
        {
            var engine = new TestEngine(true);
            engine.Fee = 10_000 * GAS;
            UInt160 admin = engine.Sender;
            engine.SetTransactionSigners(admin);

            var (oracleNef, oracleManifest) = Load("TarotOracleMockFixture");
            TarotOracleMockContract oracle = engine.Deploy<TarotOracleMockContract>(
                oracleNef, oracleManifest, null);

            var (tarotNef, tarotManifest) = Load("MiniAppTarotVrf");
            TarotVrfContract tarot = engine.Deploy<TarotVrfContract>(
                tarotNef, tarotManifest, oracle.Hash);
            Assert.Equal(oracle.Hash, tarot.oracle());
            Assert.Equal(admin, tarot.admin());
            Map integration = tarot.integrationConfig()!;
            Assert.Equal(
                CanonicalTestnetOracle,
                new UInt160(integration[(PrimitiveType)"legacyTestnetOracle"].GetSpan()));
            Assert.False(integration[(PrimitiveType)"legacyAdapterEnabled"].GetBoolean());

            UInt160 player = playerIsAdmin ? admin : TestEngine.GetNewSigner().Account;
            Fund(engine, admin, 20 * GAS);
            Fund(engine, player, 20 * GAS);

            if (reserve.GetValueOrDefault(GAS) > 0)
            {
                engine.SetTransactionSigners(admin);
                Assert.True(engine.Native.GAS.Transfer(
                    admin, tarot.Hash, reserve.GetValueOrDefault(GAS), ORACLE_MEMO) == true);
            }

            if (playerCredit.GetValueOrDefault(2 * READING_FEE) > 0)
            {
                engine.SetTransactionSigners(player);
                Assert.True(engine.Native.GAS.Transfer(
                    player, tarot.Hash, playerCredit.GetValueOrDefault(2 * READING_FEE), CREDIT_MEMO) == true);
            }

            if (allowCallback)
            {
                engine.SetTransactionSigners(admin);
                oracle.setAllowedCallback(tarot.Hash, true);
            }

            return new Harness(engine, admin, player, tarot, oracle);
        }

        private static void Fund(TestEngine engine, UInt160 account, BigInteger amount)
        {
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            Assert.True(engine.Native.GAS.Transfer(
                engine.ValidatorsAddress, account, amount, null) == true);
        }

        private static BigInteger FieldInteger(Map map, string key) =>
            map[(PrimitiveType)key].GetInteger();

        private static byte[] FieldBytes(Map map, string key) =>
            map[(PrimitiveType)key].GetSpan().ToArray();

        private static BigInteger[] Cards(Map map) =>
            ((Neo.VM.Types.Array)map[(PrimitiveType)"cards"])
                .Select(item => item.GetInteger())
                .ToArray();

        private static void AssertSolvent(Harness h)
        {
            Map accounting = h.Tarot.accounting()!;
            BigInteger accounted = FieldInteger(accounting, "creditLiability")
                + FieldInteger(accounting, "pendingFees")
                + FieldInteger(accounting, "revenue")
                + FieldInteger(accounting, "oracleReserve");
            Assert.Equal(accounted, FieldInteger(accounting, "accounted"));
            Assert.Equal(FieldInteger(accounting, "gasBalance"), accounted);
            Assert.Equal(BigInteger.Zero, FieldInteger(accounting, "surplus"));
            Assert.Equal(BigInteger.One, FieldInteger(accounting, "solvent"));
        }

        private static ulong BlockTimeMs(TestEngine engine) =>
            (ulong)engine.PersistingBlock.Timestamp.TotalMilliseconds;

        private static void SetBlockTimeMs(TestEngine engine, ulong milliseconds)
        {
            object persistingBlock = engine.PersistingBlock;
            Block block = (Block)persistingBlock.GetType()
                .GetField("UnderlyingBlock", BindingFlags.NonPublic | BindingFlags.Instance)!
                .GetValue(persistingBlock)!;
            block.Header.Timestamp = milliseconds;
        }

        [Fact]
        public void Request_FailsClosedUntilAllowlisted_AndRollsBackEveryLedger()
        {
            Harness h = Deploy(allowCallback: false);
            h.Engine.SetTransactionSigners(h.Player);

            Assert.ThrowsAny<Exception>(() => h.Tarot.requestReading(h.Player, ORACLE_FEE));
            Assert.Equal(new BigInteger(2 * READING_FEE), h.Tarot.creditOf(h.Player));
            Assert.Equal(new BigInteger(GAS), h.Tarot.oracleReserve());
            Assert.Equal(BigInteger.Zero, h.Tarot.pendingCount());
            Assert.Equal(BigInteger.Zero, h.Tarot.readingsCount());
            Assert.Equal(BigInteger.Zero, h.Oracle.feeCreditOf(h.Tarot.Hash));

            h.Engine.SetTransactionSigners(h.Admin);
            h.Oracle.setAllowedCallback(h.Tarot.Hash, true);
            h.Engine.SetTransactionSigners(h.Player);
            BigInteger readingId = h.Tarot.requestReading(h.Player, ORACLE_FEE)!.Value;

            Assert.Equal(BigInteger.One, readingId);
            Assert.Equal(new BigInteger(READING_FEE), h.Tarot.creditOf(h.Player));
            Assert.Equal(BigInteger.One, h.Tarot.pendingCount());
            Assert.Equal(new BigInteger(READING_FEE), h.Tarot.pendingFees());
            Assert.Equal(new BigInteger(GAS - ORACLE_FEE), h.Tarot.oracleReserve());
            Assert.Equal(BigInteger.Zero, h.Oracle.feeCreditOf(h.Tarot.Hash));

            Map reading = h.Tarot.getReading(readingId)!;
            BigInteger requestId = FieldInteger(reading, "requestId");
            Assert.True(requestId > 0);
            Assert.Equal(readingId, h.Tarot.readingIdForRequest(requestId));
            Assert.True(h.Tarot.requestIdSeen(requestId));
            Assert.Equal("onMiniAppResult", h.Oracle.callbackMethodOf(requestId));
            Assert.Equal("onMiniAppResult", reading[(PrimitiveType)"callbackMethod"].GetString());
            Assert.Equal(FieldBytes(reading, "payloadHash"), h.Oracle.payloadHashOf(requestId)!.GetSpan().ToArray());
        }

        [Fact]
        public void RichCallback_DrawsThreeDistinctCards_AndReplayCannotSettleTwice()
        {
            Harness h = Deploy();
            h.Engine.SetTransactionSigners(h.Player);
            BigInteger readingId = h.Tarot.requestReading(h.Player, ORACLE_FEE)!.Value;
            BigInteger requestId = FieldInteger(h.Tarot.getReading(readingId)!, "requestId");

            byte[] randomness = Enumerable.Range(0, 32).Select(i => (byte)i).ToArray();
            h.Engine.SetTransactionSigners(h.Admin);
            h.Oracle.deliverRich(h.Tarot.Hash, requestId, true, randomness, "");

            Map reading = h.Tarot.getReading(readingId)!;
            BigInteger[] cards = Cards(reading);
            Assert.Equal(new BigInteger(2), FieldInteger(reading, "status"));
            Assert.Equal(3, cards.Length);
            Assert.Equal(3, cards.Distinct().Count());
            Assert.All(cards, card => Assert.InRange(card, BigInteger.Zero, new BigInteger(77)));
            Assert.Equal(BigInteger.Zero, h.Tarot.pendingCount());
            Assert.Equal(BigInteger.Zero, h.Tarot.pendingFees());
            Assert.Equal(BigInteger.Zero, h.Tarot.activeReadingOf(h.Player));
            Assert.Equal(BigInteger.Zero, h.Tarot.readingIdForRequest(requestId));
            Assert.True(h.Tarot.requestIdSeen(requestId));
            Assert.Equal(new BigInteger(READING_FEE - ORACLE_FEE), h.Tarot.revenue());
            Assert.Equal(new BigInteger(GAS), h.Tarot.oracleReserve());
            Assert.Equal(BigInteger.One, h.Tarot.completedReadingsCount());
            Assert.Equal(BigInteger.One, h.Tarot.playerCompletedReadingCount(h.Player));
            AssertSolvent(h);

            BigInteger revenue = h.Tarot.revenue()!.Value;
            Assert.ThrowsAny<Exception>(() =>
                h.Oracle.deliverRich(h.Tarot.Hash, requestId, true, randomness, ""));
            Assert.Equal(revenue, h.Tarot.revenue());
            Assert.Equal(new BigInteger(2), FieldInteger(h.Tarot.getReading(readingId)!, "status"));
        }

        [Fact]
        public void RichCallback_RejectsEveryMetadataAndCallerBindingBeforeSettlement()
        {
            Harness h = Deploy();
            h.Engine.SetTransactionSigners(h.Player);
            BigInteger readingId = h.Tarot.requestReading(h.Player, ORACLE_FEE)!.Value;
            BigInteger requestId = FieldInteger(h.Tarot.getReading(readingId)!, "requestId");
            byte[] randomness = Enumerable.Repeat((byte)0x5a, 32).ToArray();
            UInt160 stranger = TestEngine.GetNewSigner().Account;

            h.Engine.SetTransactionSigners(h.Admin);
            Assert.ThrowsAny<Exception>(() => h.Oracle.deliverRichCustom(
                h.Tarot.Hash, requestId, "wrong-app", "vrf_random", "vrf_random",
                h.Player, true, randomness, ""));
            Assert.ThrowsAny<Exception>(() => h.Oracle.deliverRichCustom(
                h.Tarot.Hash, requestId, "on-chain-tarot-vrf", "wrong-module", "vrf_random",
                h.Player, true, randomness, ""));
            Assert.ThrowsAny<Exception>(() => h.Oracle.deliverRichCustom(
                h.Tarot.Hash, requestId, "on-chain-tarot-vrf", "vrf_random", "wrong-operation",
                h.Player, true, randomness, ""));
            Assert.ThrowsAny<Exception>(() => h.Oracle.deliverRichCustom(
                h.Tarot.Hash, requestId, "on-chain-tarot-vrf", "vrf_random", "vrf_random",
                stranger, true, randomness, ""));
            Assert.ThrowsAny<Exception>(() => h.Oracle.deliverRichCustom(
                h.Tarot.Hash, requestId + 100, "on-chain-tarot-vrf", "vrf_random", "vrf_random",
                h.Player, true, randomness, ""));

            Assert.Equal(BigInteger.One, h.Tarot.pendingCount());
            Assert.Equal(new BigInteger(STATUS_PENDING), FieldInteger(h.Tarot.getReading(readingId)!, "status"));
            h.Oracle.deliverRich(h.Tarot.Hash, requestId, true, randomness, "");
            Assert.Equal(new BigInteger(STATUS_DRAWN), FieldInteger(h.Tarot.getReading(readingId)!, "status"));
        }

        [Fact]
        public void LegacyCallback_IsRejectedOutsidePinnedTestnetWithoutDowngradingTheReading()
        {
            Harness h = Deploy();
            h.Engine.SetTransactionSigners(h.Player);
            BigInteger readingId = h.Tarot.requestReading(h.Player, ORACLE_FEE)!.Value;
            BigInteger requestId = FieldInteger(h.Tarot.getReading(readingId)!, "requestId");
            byte[] randomness = Enumerable.Range(1, 32).Select(i => (byte)i).ToArray();

            h.Engine.SetTransactionSigners(h.Admin);
            Assert.ThrowsAny<Exception>(() =>
                h.Oracle.deliverLegacy(h.Tarot.Hash, requestId, true, randomness, ""));
            Assert.Equal(BigInteger.One, h.Tarot.pendingCount());
            Assert.Equal(new BigInteger(STATUS_PENDING), FieldInteger(h.Tarot.getReading(readingId)!, "status"));

            h.Oracle.deliverRich(h.Tarot.Hash, requestId, true, randomness, "");
            Assert.Equal(new BigInteger(STATUS_DRAWN), FieldInteger(h.Tarot.getReading(readingId)!, "status"));
        }

        [Fact]
        public void SettledRequestIdsRemainTombstonedAndCannotBeRecycled()
        {
            Harness h = Deploy(playerCredit: 2 * READING_FEE);
            h.Engine.SetTransactionSigners(h.Player);
            BigInteger firstReading = h.Tarot.requestReading(h.Player, ORACLE_FEE)!.Value;
            BigInteger firstRequest = FieldInteger(h.Tarot.getReading(firstReading)!, "requestId");

            h.Engine.SetTransactionSigners(h.Admin);
            h.Oracle.deliverRich(h.Tarot.Hash, firstRequest, true, new byte[32], "");
            Assert.True(h.Tarot.requestIdSeen(firstRequest));
            Assert.Equal(BigInteger.Zero, h.Tarot.readingIdForRequest(firstRequest));
            h.Oracle.setNextRequestId(firstRequest);

            BigInteger creditBefore = h.Tarot.creditOf(h.Player)!.Value;
            BigInteger reserveBefore = h.Tarot.oracleReserve()!.Value;
            BigInteger readingsBefore = h.Tarot.readingsCount()!.Value;
            h.Engine.SetTransactionSigners(h.Player);
            Assert.ThrowsAny<Exception>(() => h.Tarot.requestReading(h.Player, ORACLE_FEE));

            Assert.Equal(creditBefore, h.Tarot.creditOf(h.Player));
            Assert.Equal(reserveBefore, h.Tarot.oracleReserve());
            Assert.Equal(readingsBefore, h.Tarot.readingsCount());
            Assert.Equal(BigInteger.Zero, h.Tarot.pendingCount());
            Assert.Equal(BigInteger.Zero, h.Tarot.pendingFees());
            Assert.Equal(BigInteger.Zero, h.Tarot.activeReadingOf(h.Player));
            Assert.Equal(BigInteger.Zero, h.Oracle.feeCreditOf(h.Tarot.Hash));
            Assert.True(h.Tarot.requestIdSeen(firstRequest));
            AssertSolvent(h);
        }

        [Fact]
        public void OracleFailureAndMalformedEntropy_RestoreCreditExactlyOnce()
        {
            Harness h = Deploy(playerCredit: 2 * READING_FEE);
            h.Engine.SetTransactionSigners(h.Player);
            BigInteger first = h.Tarot.requestReading(h.Player, ORACLE_FEE)!.Value;
            BigInteger firstRequest = FieldInteger(h.Tarot.getReading(first)!, "requestId");

            h.Engine.SetTransactionSigners(h.Admin);
            h.Oracle.deliverRich(h.Tarot.Hash, firstRequest, false, System.Array.Empty<byte>(), "worker unavailable");
            Assert.Equal(new BigInteger(3), FieldInteger(h.Tarot.getReading(first)!, "status"));
            Assert.Equal(new BigInteger(2 * READING_FEE), h.Tarot.creditOf(h.Player));
            Assert.Equal(new BigInteger(GAS - ORACLE_FEE), h.Tarot.oracleReserve());
            AssertSolvent(h);
            Assert.ThrowsAny<Exception>(() =>
                h.Oracle.deliverRich(h.Tarot.Hash, firstRequest, false, System.Array.Empty<byte>(), "again"));
            Assert.Equal(new BigInteger(2 * READING_FEE), h.Tarot.creditOf(h.Player));

            h.Engine.SetTransactionSigners(h.Player);
            BigInteger second = h.Tarot.requestReading(h.Player, ORACLE_FEE)!.Value;
            BigInteger secondRequest = FieldInteger(h.Tarot.getReading(second)!, "requestId");
            h.Engine.SetTransactionSigners(h.Admin);
            h.Oracle.deliverRich(h.Tarot.Hash, secondRequest, true, new byte[31], "");

            Assert.Equal(new BigInteger(3), FieldInteger(h.Tarot.getReading(second)!, "status"));
            Assert.Equal(new BigInteger(2 * READING_FEE), h.Tarot.creditOf(h.Player));
            Assert.Equal(new BigInteger(GAS - 2 * ORACLE_FEE), h.Tarot.oracleReserve());
            Assert.Equal(BigInteger.Zero, h.Tarot.revenue());
            Assert.Equal(BigInteger.Zero, h.Tarot.completedReadingsCount());
            Assert.Equal(BigInteger.Zero, h.Tarot.playerCompletedReadingCount(h.Player));
            AssertSolvent(h);
        }

        [Fact]
        public void PrecreditedOracleFeePreservesSolvencyOnSuccessAndFailure()
        {
            Harness h = Deploy(playerCredit: 2 * READING_FEE);
            h.Engine.SetTransactionSigners(h.Admin);
            Assert.True(h.Engine.Native.GAS.Transfer(
                h.Admin,
                h.Oracle.Hash,
                ORACLE_FEE,
                h.Tarot.Hash.GetSpan().ToArray()) == true);
            Assert.Equal(new BigInteger(ORACLE_FEE), h.Oracle.feeCreditOf(h.Tarot.Hash));

            BigInteger reserveBefore = h.Tarot.oracleReserve()!.Value;
            h.Engine.SetTransactionSigners(h.Player);
            BigInteger readingId = h.Tarot.requestReading(h.Player, ORACLE_FEE)!.Value;
            BigInteger requestId = FieldInteger(h.Tarot.getReading(readingId)!, "requestId");
            Assert.Equal(reserveBefore, h.Tarot.oracleReserve());
            Assert.Equal(BigInteger.Zero, h.Oracle.feeCreditOf(h.Tarot.Hash));
            AssertSolvent(h);

            h.Engine.SetTransactionSigners(h.Admin);
            h.Oracle.deliverRich(h.Tarot.Hash, requestId, true, new byte[32], "");
            Assert.Equal(reserveBefore + ORACLE_FEE, h.Tarot.oracleReserve());
            Assert.Equal(new BigInteger(READING_FEE - ORACLE_FEE), h.Tarot.revenue());
            Assert.Equal(BigInteger.One, h.Tarot.completedReadingsCount());
            Assert.Equal(BigInteger.One, h.Tarot.playerCompletedReadingCount(h.Player));
            AssertSolvent(h);

            BigInteger reserveAfterSuccess = h.Tarot.oracleReserve()!.Value;
            BigInteger revenueAfterSuccess = h.Tarot.revenue()!.Value;
            Assert.True(h.Engine.Native.GAS.Transfer(
                h.Admin,
                h.Oracle.Hash,
                ORACLE_FEE,
                h.Tarot.Hash.GetSpan().ToArray()) == true);
            h.Engine.SetTransactionSigners(h.Player);
            BigInteger failedReading = h.Tarot.requestReading(h.Player, ORACLE_FEE)!.Value;
            BigInteger failedRequest = FieldInteger(h.Tarot.getReading(failedReading)!, "requestId");
            Assert.Equal(reserveAfterSuccess, h.Tarot.oracleReserve());

            h.Engine.SetTransactionSigners(h.Admin);
            h.Oracle.deliverRich(
                h.Tarot.Hash,
                failedRequest,
                false,
                System.Array.Empty<byte>(),
                "worker unavailable");
            Assert.Equal(new BigInteger(READING_FEE), h.Tarot.creditOf(h.Player));
            Assert.Equal(reserveAfterSuccess, h.Tarot.oracleReserve());
            Assert.Equal(revenueAfterSuccess, h.Tarot.revenue());
            Assert.Equal(BigInteger.One, h.Tarot.completedReadingsCount());
            Assert.Equal(BigInteger.One, h.Tarot.playerCompletedReadingCount(h.Player));
            AssertSolvent(h);
        }

        [Fact]
        public void OracleCannotReenterAdminMutationsWhileRequestLockIsHeld()
        {
            Harness h = Deploy(playerCredit: 2 * READING_FEE, playerIsAdmin: true);
            h.Engine.SetTransactionSigners(h.Admin);
            h.Oracle.setReenterAdminDuringRequest(true);

            BigInteger creditBefore = h.Tarot.creditOf(h.Admin)!.Value;
            BigInteger reserveBefore = h.Tarot.oracleReserve()!.Value;
            Assert.ThrowsAny<Exception>(() => h.Tarot.requestReading(h.Admin, ORACLE_FEE));
            Assert.Equal(creditBefore, h.Tarot.creditOf(h.Admin));
            Assert.Equal(reserveBefore, h.Tarot.oracleReserve());
            Assert.Equal(BigInteger.Zero, h.Tarot.pendingCount());
            Assert.Equal(BigInteger.Zero, h.Tarot.completedReadingsCount());
            Assert.Equal(BigInteger.Zero, h.Tarot.playerCompletedReadingCount(h.Player));
            Assert.Equal(BigInteger.Zero, h.Tarot.readingsCount());
            Assert.False(h.Tarot.isPaused());
            AssertSolvent(h);
        }

        [Fact]
        public void PermissionlessExpiry_RefundsStoredPlayer_AndLateCallbackIsRejected()
        {
            Harness h = Deploy();
            h.Engine.SetTransactionSigners(h.Player);
            BigInteger readingId = h.Tarot.requestReading(h.Player, ORACLE_FEE)!.Value;
            BigInteger requestId = FieldInteger(h.Tarot.getReading(readingId)!, "requestId");

            SetBlockTimeMs(h.Engine, BlockTimeMs(h.Engine) + EXPIRY_MS + 1);
            UInt160 keeper = TestEngine.GetNewSigner().Account;
            h.Engine.SetTransactionSigners(keeper);
            Assert.Equal(new BigInteger(READING_FEE), h.Tarot.refundExpiredReading(readingId));
            Assert.Equal(new BigInteger(4), FieldInteger(h.Tarot.getReading(readingId)!, "status"));
            Assert.Equal(new BigInteger(2 * READING_FEE), h.Tarot.creditOf(h.Player));
            Assert.Equal(BigInteger.Zero, h.Tarot.pendingCount());
            Assert.Equal(BigInteger.Zero, h.Tarot.completedReadingsCount());
            Assert.Equal(BigInteger.Zero, h.Tarot.playerCompletedReadingCount(h.Player));

            Assert.ThrowsAny<Exception>(() => h.Tarot.cancelExpiredReading(readingId));
            Assert.Equal(new BigInteger(2 * READING_FEE), h.Tarot.creditOf(h.Player));

            h.Engine.SetTransactionSigners(h.Admin);
            Assert.ThrowsAny<Exception>(() =>
                h.Oracle.deliverRich(h.Tarot.Hash, requestId, true, new byte[32], ""));
            Assert.Equal(new BigInteger(4), FieldInteger(h.Tarot.getReading(readingId)!, "status"));
        }

        [Fact]
        public void LateCallbackAfterExpiry_RefundsInsteadOfDrawing()
        {
            Harness h = Deploy();
            h.Engine.SetTransactionSigners(h.Player);
            BigInteger readingId = h.Tarot.requestReading(h.Player, ORACLE_FEE)!.Value;
            BigInteger requestId = FieldInteger(h.Tarot.getReading(readingId)!, "requestId");
            BigInteger reserveAfterRequest = h.Tarot.oracleReserve()!.Value;

            SetBlockTimeMs(h.Engine, BlockTimeMs(h.Engine) + EXPIRY_MS + 1);
            h.Engine.SetTransactionSigners(h.Admin);
            h.Oracle.deliverRich(h.Tarot.Hash, requestId, true, new byte[32], "");

            Assert.Equal(new BigInteger(4), FieldInteger(h.Tarot.getReading(readingId)!, "status"));
            Assert.Equal(new BigInteger(2 * READING_FEE), h.Tarot.creditOf(h.Player));
            Assert.Equal(BigInteger.Zero, h.Tarot.pendingCount());
            Assert.Equal(BigInteger.Zero, h.Tarot.pendingFees());
            Assert.Equal(BigInteger.Zero, h.Tarot.revenue());
            Assert.Equal(BigInteger.Zero, h.Tarot.completedReadingsCount());
            Assert.Equal(BigInteger.Zero, h.Tarot.playerCompletedReadingCount(h.Player));
            Assert.Equal(reserveAfterRequest, h.Tarot.oracleReserve());
            Assert.Equal(BigInteger.Zero, h.Tarot.readingIdForRequest(requestId));

            Assert.ThrowsAny<Exception>(() =>
                h.Oracle.deliverRich(h.Tarot.Hash, requestId, true, new byte[32], ""));
            Assert.ThrowsAny<Exception>(() => h.Tarot.refundExpiredReading(readingId));
            AssertSolvent(h);
        }

        [Fact]
        public void FeeCapsReserveAndOracleChangesRemainFailClosed()
        {
            Harness h = Deploy(reserve: ORACLE_FEE, playerCredit: READING_FEE);
            h.Engine.SetTransactionSigners(h.Player);
            Assert.ThrowsAny<Exception>(() => h.Tarot.requestReading(h.Player, ORACLE_FEE - 1));
            Assert.Equal(new BigInteger(READING_FEE), h.Tarot.creditOf(h.Player));

            h.Engine.SetTransactionSigners(h.Admin);
            h.Oracle.setRequestFee(READING_FEE + 1);
            h.Engine.SetTransactionSigners(h.Player);
            Assert.ThrowsAny<Exception>(() => h.Tarot.requestReading(h.Player, READING_FEE + 1));
            Assert.Equal(new BigInteger(READING_FEE), h.Tarot.creditOf(h.Player));

            h.Engine.SetTransactionSigners(h.Admin);
            h.Oracle.setRequestFee(ORACLE_FEE);
            h.Engine.SetTransactionSigners(h.Player);
            BigInteger readingId = h.Tarot.requestReading(h.Player, ORACLE_FEE)!.Value;
            BigInteger requestId = FieldInteger(h.Tarot.getReading(readingId)!, "requestId");

            var (nef, manifest) = Load("TarotOracleMockFixture");
            UInt160 replacementDeployer = TestEngine.GetNewSigner().Account;
            h.Engine.SetTransactionSigners(replacementDeployer);
            TarotOracleMockContract replacement = h.Engine.Deploy<TarotOracleMockContract>(nef, manifest, null);
            h.Engine.SetTransactionSigners(h.Admin);
            h.Tarot.proposeOracle(replacement.Hash);
            h.Tarot.setPaused(true);
            SetBlockTimeMs(h.Engine, BlockTimeMs(h.Engine) + CHANGE_DELAY_MS + 1);
            Assert.ThrowsAny<Exception>(() => h.Tarot.activateOracle());
            Assert.Equal(h.Oracle.Hash, h.Tarot.oracle());

            h.Oracle.deliverRich(h.Tarot.Hash, requestId, false, System.Array.Empty<byte>(), "cancel");
            h.Tarot.activateOracle();
            Assert.Equal(replacement.Hash, h.Tarot.oracle());
        }

        [Fact]
        public void AdminHandoverRequiresProposedWitnessAndOldAdminLosesAuthority()
        {
            Harness h = Deploy();
            UInt160 nextAdmin = TestEngine.GetNewSigner().Account;
            UInt160 stranger = TestEngine.GetNewSigner().Account;

            h.Engine.SetTransactionSigners(stranger);
            Assert.ThrowsAny<Exception>(() => h.Tarot.setPaused(true));

            h.Engine.SetTransactionSigners(h.Admin);
            h.Tarot.proposeAdmin(nextAdmin);
            Assert.ThrowsAny<Exception>(() => h.Tarot.acceptAdmin());
            Assert.Equal(h.Admin, h.Tarot.admin());

            h.Engine.SetTransactionSigners(stranger);
            Assert.ThrowsAny<Exception>(() => h.Tarot.acceptAdmin());
            Assert.Equal(h.Admin, h.Tarot.admin());

            h.Engine.SetTransactionSigners(nextAdmin);
            h.Tarot.acceptAdmin();
            Assert.Equal(nextAdmin, h.Tarot.admin());

            h.Engine.SetTransactionSigners(h.Admin);
            Assert.ThrowsAny<Exception>(() => h.Tarot.setPaused(true));
            h.Engine.SetTransactionSigners(nextAdmin);
            h.Tarot.setPaused(true);

            h.Engine.SetTransactionSigners(h.Player);
            Assert.ThrowsAny<Exception>(() => h.Tarot.requestReading(h.Player, ORACLE_FEE));
            Assert.Equal(new BigInteger(2 * READING_FEE), h.Tarot.creditOf(h.Player));
            Assert.Equal(BigInteger.Zero, h.Tarot.pendingCount());
        }

        [Fact]
        public void CreditWithdrawalUsesPullPaymentAndPreservesAccountingSolvency()
        {
            Harness h = Deploy(playerCredit: READING_FEE);
            BigInteger before = h.Engine.Native.GAS.BalanceOf(h.Player)!.Value;
            h.Engine.SetTransactionSigners(h.Player);
            Assert.Equal(new BigInteger(READING_FEE), h.Tarot.withdrawAllCredit(h.Player));
            Assert.Equal(before + READING_FEE, h.Engine.Native.GAS.BalanceOf(h.Player));
            Assert.Equal(BigInteger.Zero, h.Tarot.creditOf(h.Player));
            Assert.Equal(BigInteger.Zero, h.Tarot.totalCreditLiability());
            AssertSolvent(h);
        }
    }
}
