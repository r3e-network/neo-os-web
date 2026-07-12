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
    public abstract class RedEnvelopeContract : SmartContract
    {
        protected RedEnvelopeContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract BigInteger? createEnvelope(UInt160 creator, BigInteger totalAmount, BigInteger packetCount, BigInteger durationSeconds);
        public abstract BigInteger? claim(BigInteger envelopeId, UInt160 claimer);
        public abstract BigInteger? reclaim(BigInteger envelopeId, UInt160 creator);
        public abstract BigInteger? withdraw(UInt160 account);
        public abstract BigInteger? lastEnvelopeId();
        public abstract BigInteger? creditOf(UInt160 creator);
        public abstract BigInteger? claimedAmount(BigInteger envelopeId, UInt160 claimer);
        public abstract bool? hasClaimed(BigInteger envelopeId, UInt160 claimer);
    }

    public class MiniAppRedEnvelopeTests
    {
        private const long GAS = 100000000; // 1 GAS base units

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

        // Contract asserts surface as "ABORTMSG is executed. Reason: <text>".
        private static void AssertRevert(string reason, Action act)
        {
            var ex = Assert.ThrowsAny<Exception>(act);
            Assert.Equal($"ABORTMSG is executed. Reason: {reason}", ex.Message);
        }

        [Fact]
        public void RedEnvelope_ClaimAll_SharesSumExactlyToTotal()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppRedEnvelope");
            var env = engine.Deploy<RedEnvelopeContract>(nef, manifest);

            var creator = TestEngine.GetNewSigner().Account;
            FundGas(engine, creator, 10L * GAS);

            // Deposit-then-create: 5 GAS credit, 3 GAS locked into envelope #1.
            engine.SetTransactionSigners(creator);
            engine.Native.GAS.Transfer(creator, env.Hash, 5L * GAS, "miniapp-redenvelope:create");
            Assert.Equal(new BigInteger(5L * GAS), env.creditOf(creator));
            Assert.Equal(BigInteger.One, env.createEnvelope(creator, 3L * GAS, 3, 3600));
            Assert.Equal(BigInteger.One, env.lastEnvelopeId());
            Assert.Equal(new BigInteger(2L * GAS), env.creditOf(creator));

            // Three claimers each draw one random packet; the splits are
            // seed-dependent, so assert the invariants: every share is paid out
            // atomically, recorded, and the shares sum EXACTLY to the total.
            BigInteger sum = 0;
            for (int i = 0; i < 3; i++)
            {
                var claimer = TestEngine.GetNewSigner().Account;
                engine.SetTransactionSigners(claimer);
                BigInteger before = engine.Native.GAS.BalanceOf(claimer) ?? 0;
                BigInteger share = env.claim(1, claimer) ?? 0;
                Assert.True(share >= 1, $"share must be >= 1 base unit, got {share}");
                Assert.Equal(before + share, engine.Native.GAS.BalanceOf(claimer));
                Assert.True(env.hasClaimed(1, claimer));
                Assert.Equal(share, env.claimedAmount(1, claimer));
                // Double-claims revert: "already claimed" while the envelope is
                // still live; the final claim deactivates the envelope, so the
                // earlier "envelope not active" guard fires for that claimer.
                AssertRevert(i < 2 ? "already claimed" : "envelope not active",
                    () => env.claim(1, claimer));
                sum += share;
            }
            Assert.Equal(new BigInteger(3L * GAS), sum);

            // Depleted envelope refuses further claims.
            var late = TestEngine.GetNewSigner().Account;
            engine.SetTransactionSigners(late);
            AssertRevert("envelope not active", () => env.claim(1, late));

            // Solvency: only the creator's unused 2 GAS credit remains custodied,
            // and Withdraw refunds it in full.
            Assert.Equal(new BigInteger(2L * GAS), engine.Native.GAS.BalanceOf(env.Hash));
            engine.SetTransactionSigners(creator);
            Assert.Equal(new BigInteger(2L * GAS), env.withdraw(creator));
            Assert.Equal(BigInteger.Zero, engine.Native.GAS.BalanceOf(env.Hash));
        }

        [Fact]
        public void RedEnvelope_ReclaimAfterExpiry_ReturnsExactRemainder()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppRedEnvelope");
            var env = engine.Deploy<RedEnvelopeContract>(nef, manifest);

            var creator = TestEngine.GetNewSigner().Account;
            var claimer = TestEngine.GetNewSigner().Account;
            var stranger = TestEngine.GetNewSigner().Account;
            FundGas(engine, creator, 5L * GAS);

            engine.SetTransactionSigners(creator);
            engine.Native.GAS.Transfer(creator, env.Hash, 2L * GAS, "miniapp-redenvelope:create");
            env.createEnvelope(creator, 2L * GAS, 2, 60);

            // One of the two packets is claimed before expiry.
            engine.SetTransactionSigners(claimer);
            BigInteger share = env.claim(1, claimer) ?? 0;
            Assert.True(share >= 1 && share < 2L * GAS, $"partial share expected, got {share}");

            // The remainder is locked until the envelope expires.
            engine.SetTransactionSigners(creator);
            AssertRevert("not yet expired", () => env.reclaim(1, creator));

            engine.PersistingBlock.Advance(TimeSpan.FromSeconds(61));

            // Expired: claims stop, only the creator may reclaim, and the refund
            // is exactly the unclaimed remainder.
            engine.SetTransactionSigners(stranger);
            AssertRevert("envelope expired", () => env.claim(1, stranger));
            AssertRevert("only creator", () => env.reclaim(1, stranger));

            engine.SetTransactionSigners(creator);
            BigInteger before = engine.Native.GAS.BalanceOf(creator) ?? 0;
            Assert.Equal(new BigInteger(2L * GAS) - share, env.reclaim(1, creator));
            Assert.Equal(before + 2L * GAS - share, engine.Native.GAS.BalanceOf(creator));
            Assert.Equal(BigInteger.Zero, engine.Native.GAS.BalanceOf(env.Hash));

            AssertRevert("nothing to reclaim", () => env.reclaim(1, creator));
        }

        [Fact]
        public void RedEnvelope_GuardsRejectInvalidCreation()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppRedEnvelope");
            var env = engine.Deploy<RedEnvelopeContract>(nef, manifest);

            var creator = TestEngine.GetNewSigner().Account;
            FundGas(engine, creator, 5L * GAS);
            engine.SetTransactionSigners(creator);

            // NOTE: the "invalid memo" deposit guard ABORTs inside OnNEP17Payment
            // mid-GAS.Transfer, which the TestEngine host cannot unwind (it hangs
            // natively), so that path is covered by the live testnet harness
            // (deploy/scripts/live_validate_redenvelope.mjs) instead of here.

            // An envelope can never be created beyond the escrowed credit.
            AssertRevert("insufficient deposit credit", () =>
                env.createEnvelope(creator, 1L * GAS, 2, 3600));

            engine.Native.GAS.Transfer(creator, env.Hash, 1L * GAS, "miniapp-redenvelope:create");
            AssertRevert("packet count 1..100", () => env.createEnvelope(creator, 1L * GAS, 0, 3600));
            AssertRevert("packet count 1..100", () => env.createEnvelope(creator, 1L * GAS, 101, 3600));
            AssertRevert("total amount must be > 0", () => env.createEnvelope(creator, 0, 1, 3600));
            AssertRevert("total amount exceeds 20 GAS", () => env.createEnvelope(creator, 21L * GAS, 2, 3600));
            AssertRevert("total must cover one base unit per packet", () =>
                env.createEnvelope(creator, 5, 10, 3600));
            AssertRevert("duration 60..604800 seconds", () => env.createEnvelope(creator, 1L * GAS, 2, 59));
            AssertRevert("duration 60..604800 seconds", () => env.createEnvelope(creator, 1L * GAS, 2, 604801));

            // The failed attempts consumed nothing.
            Assert.Equal(new BigInteger(1L * GAS), env.creditOf(creator));

            var broke = TestEngine.GetNewSigner().Account;
            engine.SetTransactionSigners(broke);
            AssertRevert("no credit", () => env.withdraw(broke));
        }
    }
}
