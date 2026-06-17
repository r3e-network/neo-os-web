using System;
using System.IO;
using System.Numerics;
using Neo;
using Neo.Network.P2P.Payloads;
using Neo.SmartContract;
using Neo.SmartContract.Manifest;
using Neo.SmartContract.Testing;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    // ABI binding for MiniAppQuadraticFunding, covering the stranded-funds reclaim
    // paths added for finalized rounds whose project owners never claim.
    public abstract class QuadraticFundingFullContract : SmartContract
    {
        protected QuadraticFundingFullContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract BigInteger? createRound(
            UInt160 creator, UInt160 asset, BigInteger matchingPool,
            BigInteger startTime, BigInteger endTime, string title, string description);
        public abstract BigInteger? registerProject(
            UInt160 owner, BigInteger roundId, string name, string description, string link);
        public abstract void contribute(
            UInt160 contributor, BigInteger roundId, BigInteger projectId, BigInteger amount, string memo);
        public abstract void finalizeRound(
            UInt160 operatorAddress, BigInteger roundId, object[] projectIds, object[] matchedAmounts);
        public abstract void claimProject(UInt160 owner, BigInteger projectId);
        public abstract void reclaimContribution(UInt160 contributor, BigInteger roundId, BigInteger projectId);
        public abstract void reclaimUnclaimedMatch(UInt160 creator, BigInteger projectId);
        public abstract BigInteger? getContribution(UInt160 contributor, BigInteger roundId, BigInteger projectId);
        public abstract Neo.VM.Types.Map getProjectDetails(BigInteger projectId);
        public abstract Neo.VM.Types.Map getRoundDetails(BigInteger roundId);
    }

    public class MiniAppQuadraticFundingTests
    {
        private const long GAS = 100000000; // 1 GAS base units
        private const long DAY_MS = 86400000L;
        private const long CLAIM_GRACE_MS = 90L * DAY_MS; // mirrors MiniAppQuadraticFunding.CLAIM_GRACE

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

        // Fund an account with GAS from the genesis validators multisig.
        private static void FundGas(TestEngine engine, UInt160 to, BigInteger gas)
        {
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            engine.Native.GAS.Transfer(engine.ValidatorsAddress, to, gas, null);
        }

        // Contract asserts surface as "ABORTMSG is executed. Reason: <text>".
        private static void AssertRevert(string reason, Action act)
        {
            var ex = Assert.ThrowsAny<Exception>(act);
            Assert.Equal($"ABORTMSG is executed. Reason: {reason}", ex.Message);
        }

        private static long NowMs(TestEngine engine) =>
            (long)engine.PersistingBlock.Timestamp.TotalMilliseconds;

        // Deploy with the validators address as signer so it becomes Admin via _deploy.
        // finalizeRound is admin-gated, so the validators signer satisfies its witness.
        private static QuadraticFundingFullContract DeployAsAdmin(TestEngine engine, out UInt160 admin)
        {
            admin = engine.ValidatorsAddress;
            engine.SetTransactionSigners(admin);
            var (nef, manifest) = Load("MiniAppQuadraticFunding");
            return engine.Deploy<QuadraticFundingFullContract>(nef, manifest);
        }

        // ---------------------------------------------------------------------
        // Builds a GAS round with one project funded by two contributors, runs
        // it to its end, finalizes it with a matched amount, but never claims the
        // project. Returns the ids needed by the reclaim assertions.
        // ---------------------------------------------------------------------
        private static QuadraticFundingFullContract BuildFinalizedUnclaimed(
            TestEngine engine, out UInt160 admin, out UInt160 creator, out UInt160 owner,
            out UInt160 c1, out UInt160 c2, out BigInteger roundId, out BigInteger projectId,
            BigInteger matchingPool, BigInteger contrib1, BigInteger contrib2, BigInteger matched)
        {
            var contract = DeployAsAdmin(engine, out admin);

            creator = TestEngine.GetNewSigner().Account;
            owner = TestEngine.GetNewSigner().Account;
            c1 = TestEngine.GetNewSigner().Account;
            c2 = TestEngine.GetNewSigner().Account;

            FundGas(engine, creator, matchingPool + 5 * GAS);
            FundGas(engine, c1, contrib1 + 5 * GAS);
            FundGas(engine, c2, contrib2 + 5 * GAS);

            BigInteger startTime = BigInteger.One;
            BigInteger endTime = NowMs(engine) + DAY_MS; // round ends one day from genesis-era block

            // Creator funds + opens the round (GAS asset).
            engine.SetTransactionSigners(creator);
            engine.Native.GAS.Transfer(creator, contract.Hash, matchingPool, "miniapp-quadratic-funding:matching");
            roundId = contract.createRound(creator, engine.Native.GAS.Hash, matchingPool,
                startTime, endTime, "Round", "desc") ?? 0;
            Assert.Equal(BigInteger.One, roundId);

            // Owner registers the project.
            engine.SetTransactionSigners(owner);
            projectId = contract.registerProject(owner, roundId, "Proj", "pdesc", "https://x") ?? 0;
            Assert.Equal(BigInteger.One, projectId);

            // Two independent contributors fund the project (owner/creator are barred).
            engine.SetTransactionSigners(c1);
            engine.Native.GAS.Transfer(c1, contract.Hash, contrib1, "miniapp-quadratic-funding:contribute");
            contract.contribute(c1, roundId, projectId, contrib1, "first");
            engine.SetTransactionSigners(c2);
            engine.Native.GAS.Transfer(c2, contract.Hash, contrib2, "miniapp-quadratic-funding:contribute");
            contract.contribute(c2, roundId, projectId, contrib2, "second");

            // Move past the round end so finalize is allowed, then finalize with a
            // matched amount but leave the project unclaimed.
            engine.PersistingBlock.Advance(TimeSpan.FromMilliseconds(DAY_MS + 1));
            engine.SetTransactionSigners(admin);
            contract.finalizeRound(admin, roundId,
                new object[] { projectId }, new object[] { matched });

            var details = contract.getRoundDetails(roundId);
            Assert.Equal("finalized", details[(Neo.VM.Types.PrimitiveType)"status"].GetString());
            return contract;
        }

        // ---------------------------------------------------------------------
        // After the grace period a contributor recovers exactly their own
        // contribution; the per-contributor ledger and the project total both drop
        // by that amount, leaving the other contributor + the match untouched.
        // ---------------------------------------------------------------------
        [Fact]
        public void Reclaim_ContributorRecoversOwnContributionAndZeroesLedger()
        {
            var engine = new TestEngine(true);
            var contract = BuildFinalizedUnclaimed(engine, out _, out _, out _,
                out var c1, out var c2, out var roundId, out var projectId,
                matchingPool: 10 * GAS, contrib1: 3 * GAS, contrib2: 2 * GAS, matched: 4 * GAS);

            // Before the grace window the reclaim is rejected.
            engine.SetTransactionSigners(c1);
            AssertRevert("grace period not elapsed",
                () => contract.reclaimContribution(c1, roundId, projectId));

            // Cross the grace boundary (finalize already advanced one day past end).
            engine.PersistingBlock.Advance(TimeSpan.FromMilliseconds(CLAIM_GRACE_MS));

            BigInteger c1Before = engine.Native.GAS.BalanceOf(c1) ?? 0;
            BigInteger contractBefore = engine.Native.GAS.BalanceOf(contract.Hash) ?? 0;

            engine.SetTransactionSigners(c1);
            contract.reclaimContribution(c1, roundId, projectId);

            // c1 got exactly their 3 GAS back; their ledger entry is zeroed.
            Assert.Equal(c1Before + 3 * GAS, engine.Native.GAS.BalanceOf(c1));
            Assert.Equal(contractBefore - 3 * GAS, engine.Native.GAS.BalanceOf(contract.Hash));
            Assert.Equal(BigInteger.Zero, contract.getContribution(c1, roundId, projectId));

            // c2's contribution is still recorded; the project total dropped by 3 GAS only.
            Assert.Equal(new BigInteger(2 * GAS), contract.getContribution(c2, roundId, projectId));
            var pd = contract.getProjectDetails(projectId);
            Assert.Equal(new BigInteger(2 * GAS), pd[(Neo.VM.Types.PrimitiveType)"totalContributed"].GetInteger());
            Assert.Equal(new BigInteger(4 * GAS), pd[(Neo.VM.Types.PrimitiveType)"matchedAmount"].GetInteger());

            // A second reclaim by the same contributor has nothing left to pay out.
            AssertRevert("nothing to reclaim",
                () => contract.reclaimContribution(c1, roundId, projectId));
        }

        // ---------------------------------------------------------------------
        // The round creator sweeps the matched amount of an unclaimed project,
        // which marks the project Claimed so it can never be paid out again.
        // ---------------------------------------------------------------------
        [Fact]
        public void Reclaim_CreatorSweepsMatchFirstAndContributorsStillReclaim()
        {
            var engine = new TestEngine(true);
            var contract = BuildFinalizedUnclaimed(engine, out _, out var creator, out _,
                out var c1, out var c2, out var roundId, out var projectId,
                matchingPool: 10 * GAS, contrib1: 3 * GAS, contrib2: 2 * GAS, matched: 4 * GAS);

            // Before grace the creator cannot sweep.
            engine.SetTransactionSigners(creator);
            AssertRevert("grace period not elapsed",
                () => contract.reclaimUnclaimedMatch(creator, projectId));

            engine.PersistingBlock.Advance(TimeSpan.FromMilliseconds(CLAIM_GRACE_MS));

            // Adversarial ordering: the creator sweeps the match BEFORE any contributor
            // has reclaimed. This must NOT strand the contributors' principals.
            BigInteger creatorBefore = engine.Native.GAS.BalanceOf(creator) ?? 0;
            engine.SetTransactionSigners(creator);
            contract.reclaimUnclaimedMatch(creator, projectId);

            // Creator received the 4 GAS match; the match is swept but the project is
            // NOT fully Claimed (contributions are still owed to the contributors).
            Assert.Equal(creatorBefore + 4 * GAS, engine.Native.GAS.BalanceOf(creator));
            var pd = contract.getProjectDetails(projectId);
            Assert.Equal(BigInteger.Zero, pd[(Neo.VM.Types.PrimitiveType)"matchedAmount"].GetInteger());
            Assert.False(pd[(Neo.VM.Types.PrimitiveType)"claimed"].GetBoolean());

            // A second sweep is blocked by MatchClaimed.
            AssertRevert("match already claimed",
                () => contract.reclaimUnclaimedMatch(creator, projectId));

            // The fix: each contributor can STILL reclaim their own contribution.
            BigInteger c1Before = engine.Native.GAS.BalanceOf(c1) ?? 0;
            engine.SetTransactionSigners(c1);
            contract.reclaimContribution(c1, roundId, projectId);
            Assert.Equal(c1Before + 3 * GAS, engine.Native.GAS.BalanceOf(c1));

            BigInteger c2Before = engine.Native.GAS.BalanceOf(c2) ?? 0;
            engine.SetTransactionSigners(c2);
            contract.reclaimContribution(c2, roundId, projectId);
            Assert.Equal(c2Before + 2 * GAS, engine.Native.GAS.BalanceOf(c2));

            // A contributor cannot double-reclaim (ledger is now zero).
            engine.SetTransactionSigners(c1);
            AssertRevert("nothing to reclaim",
                () => contract.reclaimContribution(c1, roundId, projectId));
        }

        // ---------------------------------------------------------------------
        // The happy path still works before the grace window: the owner claims the
        // full TotalContributed + MatchedAmount and the project becomes Claimed, so
        // no reclaim path can double-pay afterwards.
        // ---------------------------------------------------------------------
        [Fact]
        public void Reclaim_ClaimProjectWorksPreGraceAndCannotDoublePay()
        {
            var engine = new TestEngine(true);
            var contract = BuildFinalizedUnclaimed(engine, out _, out var creator, out var owner,
                out var c1, out var c2, out var roundId, out var projectId,
                matchingPool: 10 * GAS, contrib1: 3 * GAS, contrib2: 2 * GAS, matched: 4 * GAS);

            // We are past endTime but well within the grace window: the owner claims.
            BigInteger ownerBefore = engine.Native.GAS.BalanceOf(owner) ?? 0;
            engine.SetTransactionSigners(owner);
            contract.claimProject(owner, projectId);

            // Owner received TotalContributed (5 GAS) + MatchedAmount (4 GAS) = 9 GAS.
            Assert.Equal(ownerBefore + 9 * GAS, engine.Native.GAS.BalanceOf(owner));
            var pd = contract.getProjectDetails(projectId);
            Assert.True(pd[(Neo.VM.Types.PrimitiveType)"claimed"].GetBoolean());

            // After the claim the project is settled: even past the grace window no
            // reclaim path can pull funds again.
            engine.PersistingBlock.Advance(TimeSpan.FromMilliseconds(CLAIM_GRACE_MS));
            engine.SetTransactionSigners(c1);
            AssertRevert("already claimed",
                () => contract.reclaimContribution(c1, roundId, projectId));
            engine.SetTransactionSigners(c2);
            AssertRevert("already claimed",
                () => contract.reclaimContribution(c2, roundId, projectId));
            engine.SetTransactionSigners(creator);
            AssertRevert("already claimed",
                () => contract.reclaimUnclaimedMatch(creator, projectId));
        }

        // ---------------------------------------------------------------------
        // Invariant: across every payout path, total funds leaving the contract on
        // behalf of a project never exceed its original TotalContributed +
        // MatchedAmount. Both contributors reclaim their contributions and the
        // creator sweeps the match — the sum equals exactly the project's funds and
        // not a base unit more, and the contract cannot be drained further.
        // ---------------------------------------------------------------------
        [Fact]
        public void Reclaim_TotalRefundsNeverExceedProjectFunds()
        {
            var engine = new TestEngine(true);
            var contract = BuildFinalizedUnclaimed(engine, out _, out var creator, out _,
                out var c1, out var c2, out var roundId, out var projectId,
                matchingPool: 10 * GAS, contrib1: 3 * GAS, contrib2: 2 * GAS, matched: 4 * GAS);

            // Project funds available for payout = contributions (5 GAS) + match (4 GAS).
            BigInteger projectFunds = 5 * GAS + 4 * GAS;

            engine.PersistingBlock.Advance(TimeSpan.FromMilliseconds(CLAIM_GRACE_MS));

            BigInteger paidOut = 0;
            BigInteger c1Before = engine.Native.GAS.BalanceOf(c1) ?? 0;
            BigInteger c2Before = engine.Native.GAS.BalanceOf(c2) ?? 0;
            BigInteger creatorBefore = engine.Native.GAS.BalanceOf(creator) ?? 0;

            engine.SetTransactionSigners(c1);
            contract.reclaimContribution(c1, roundId, projectId);
            paidOut += (engine.Native.GAS.BalanceOf(c1) ?? 0) - c1Before;

            engine.SetTransactionSigners(c2);
            contract.reclaimContribution(c2, roundId, projectId);
            paidOut += (engine.Native.GAS.BalanceOf(c2) ?? 0) - c2Before;

            engine.SetTransactionSigners(creator);
            contract.reclaimUnclaimedMatch(creator, projectId);
            paidOut += (engine.Native.GAS.BalanceOf(creator) ?? 0) - creatorBefore;

            // Total paid out equals exactly the project's funds — never more.
            Assert.Equal(projectFunds, paidOut);

            // The project is drained for these payout paths: no further reclaim works.
            // A contributor's ledger is now zero; the match is MatchClaimed.
            engine.SetTransactionSigners(c1);
            AssertRevert("nothing to reclaim",
                () => contract.reclaimContribution(c1, roundId, projectId));
            engine.SetTransactionSigners(creator);
            AssertRevert("match already claimed",
                () => contract.reclaimUnclaimedMatch(creator, projectId));
        }

        // ---------------------------------------------------------------------
        // Guard rails: reclaim is rejected on rounds that are not finalized, and a
        // project with no matched amount cannot be swept.
        // ---------------------------------------------------------------------
        [Fact]
        public void Reclaim_RejectsNonFinalizedRoundAndZeroMatch()
        {
            var engine = new TestEngine(true);
            var contract = DeployAsAdmin(engine, out var admin);

            var creator = TestEngine.GetNewSigner().Account;
            var owner = TestEngine.GetNewSigner().Account;
            var c1 = TestEngine.GetNewSigner().Account;
            FundGas(engine, creator, 15 * GAS);
            FundGas(engine, c1, 10 * GAS);

            BigInteger startTime = BigInteger.One;
            BigInteger endTime = NowMs(engine) + DAY_MS;

            engine.SetTransactionSigners(creator);
            engine.Native.GAS.Transfer(creator, contract.Hash, 10 * GAS, "miniapp-quadratic-funding:matching");
            BigInteger roundId = contract.createRound(creator, engine.Native.GAS.Hash, 10 * GAS,
                startTime, endTime, "Round", "desc") ?? 0;

            engine.SetTransactionSigners(owner);
            BigInteger projectId = contract.registerProject(owner, roundId, "Proj", "d", "l") ?? 0;

            engine.SetTransactionSigners(c1);
            engine.Native.GAS.Transfer(c1, contract.Hash, 3 * GAS, "miniapp-quadratic-funding:contribute");
            contract.contribute(c1, roundId, projectId, 3 * GAS, "memo");

            // Round is still open (not finalized): both reclaim paths revert, even
            // far in the future.
            engine.PersistingBlock.Advance(TimeSpan.FromMilliseconds(DAY_MS + CLAIM_GRACE_MS + 1));
            engine.SetTransactionSigners(c1);
            AssertRevert("round not finalized",
                () => contract.reclaimContribution(c1, roundId, projectId));
            engine.SetTransactionSigners(creator);
            AssertRevert("round not finalized",
                () => contract.reclaimUnclaimedMatch(creator, projectId));

            // Finalize with a ZERO match: the creator has nothing to sweep.
            engine.SetTransactionSigners(admin);
            contract.finalizeRound(admin, roundId,
                new object[] { projectId }, new object[] { BigInteger.Zero });
            engine.SetTransactionSigners(creator);
            AssertRevert("no unclaimed match",
                () => contract.reclaimUnclaimedMatch(creator, projectId));

            // The contributor can still reclaim (grace already elapsed in this future).
            BigInteger c1Before = engine.Native.GAS.BalanceOf(c1) ?? 0;
            engine.SetTransactionSigners(c1);
            contract.reclaimContribution(c1, roundId, projectId);
            Assert.Equal(c1Before + 3 * GAS, engine.Native.GAS.BalanceOf(c1));
        }
    }
}
