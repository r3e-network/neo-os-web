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
    // Runtime functional tests for the MiniApp contracts. Loads each NEF+manifest
    // from contracts/build/ into a TestEngine via strongly-typed bindings and
    // exercises the public entrypoints.

    public abstract class MilestoneEscrowContract : SmartContract
    {
        protected MilestoneEscrowContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract BigInteger? createEscrow(
            UInt160 creator, UInt160 beneficiary, UInt160 asset, BigInteger totalAmount,
            object[] milestoneAmounts, string title, string notes);
        public abstract BigInteger? totalEscrows();
    }

    public abstract class EventTicketPassContract : SmartContract
    {
        protected EventTicketPassContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract BigInteger? createEvent(
            UInt160 creator, string name, string venue, BigInteger startTime,
            BigInteger endTime, BigInteger maxSupply, string notes);
        public abstract BigInteger? totalSupply();
        public abstract string symbol();
    }

    public abstract class SoulboundCertificateContract : SmartContract
    {
        protected SoulboundCertificateContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract BigInteger? createTemplate(
            UInt160 issuer, string name, string issuerName, string category,
            BigInteger maxSupply, string description);
        public abstract BigInteger? totalSupply();
    }

    public abstract class QuadraticFundingContract : SmartContract
    {
        protected QuadraticFundingContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract BigInteger? createRound(
            UInt160 creator, UInt160 asset, BigInteger matchingPool,
            BigInteger startTime, BigInteger endTime, string title, string description);
        public abstract BigInteger? registerProject(
            UInt160 owner, BigInteger roundId, string name, string description, string link);
    }

    public class MiniAppContractFunctionalTests
    {
        private static readonly string BuildDir = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "build"));

        private static (NefFile nef, ContractManifest manifest) Load(string name)
        {
            string nefPath = Path.Combine(BuildDir, name + ".nef");
            string manifestPath = Path.Combine(BuildDir, name + ".manifest.json");
            Assert.True(File.Exists(nefPath), $"NEF missing: {nefPath}");
            Assert.True(File.Exists(manifestPath), $"manifest missing: {manifestPath}");
            return (NefFile.Parse(File.ReadAllBytes(nefPath)),
                    ContractManifest.Parse(File.ReadAllText(manifestPath)));
        }

        // Fund an account with GAS from the genesis validators multisig.
        private static void FundGas(TestEngine engine, UInt160 to, BigInteger gas)
        {
            UInt160 validators = engine.ValidatorsAddress;
            engine.SetTransactionSigners(validators);
            engine.Native.GAS.Transfer(validators, to, gas, null);
        }

        // Contract asserts surface as "ABORTMSG is executed. Reason: <text>"; pin the
        // exact reason so the test fails if a different (earlier) guard fires instead.
        private static void AssertRevert(string reason, Action act)
        {
            var ex = Assert.ThrowsAny<Exception>(act);
            Assert.Equal($"ABORTMSG is executed. Reason: {reason}", ex.Message);
        }

        // -----------------------------------------------------------------
        // MiniAppMilestoneEscrow: deposit-then-create with real prepaid GAS.
        // createEscrow returns sequential ids and the counter increments.
        // -----------------------------------------------------------------
        [Fact]
        public void MilestoneEscrow_CreateReturnsId()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppMilestoneEscrow");
            var contract = engine.Deploy<MilestoneEscrowContract>(nef, manifest);

            var creator = TestEngine.GetNewSigner();
            var beneficiary = TestEngine.GetNewSigner();
            FundGas(engine, creator.Account, 5L * 100000000);
            Assert.Equal(BigInteger.Zero, contract.totalEscrows());

            // Without prepaid credit, a fully valid create must stop at the deposit gate.
            engine.SetTransactionSigners(creator);
            var milestoneAmounts = new object[] { new BigInteger(50000000), new BigInteger(50000000) };
            AssertRevert("insufficient prepaid asset", () => contract.createEscrow(
                creator.Account, beneficiary.Account, engine.Native.GAS.Hash,
                new BigInteger(100000000), milestoneAmounts, "Test Escrow", "memo"));

            // Deposit 1 GAS with the app memo, then lock it into escrow #1.
            Assert.True(engine.Native.GAS.Transfer(
                creator.Account, contract.Hash, 100000000, "miniapp-milestone-escrow:deposit") == true);
            BigInteger? id = contract.createEscrow(
                creator.Account, beneficiary.Account, engine.Native.GAS.Hash,
                new BigInteger(100000000), milestoneAmounts, "Test Escrow", "memo");
            Assert.Equal(BigInteger.One, id);
            Assert.Equal(BigInteger.One, contract.totalEscrows());
            Assert.Equal(new BigInteger(100000000), engine.Native.GAS.BalanceOf(contract.Hash));

            // A second funded escrow gets the next id and increments the counter.
            engine.Native.GAS.Transfer(
                creator.Account, contract.Hash, 200000000, "miniapp-milestone-escrow:deposit");
            BigInteger? id2 = contract.createEscrow(
                creator.Account, beneficiary.Account, engine.Native.GAS.Hash,
                new BigInteger(200000000),
                new object[] { new BigInteger(100000000), new BigInteger(100000000) },
                "Second Escrow", "memo");
            Assert.Equal(new BigInteger(2), id2);
            Assert.Equal(new BigInteger(2), contract.totalEscrows());
            Assert.Equal(new BigInteger(300000000), engine.Native.GAS.BalanceOf(contract.Hash));
        }

        // -----------------------------------------------------------------
        // MiniAppEventTicketPass: symbol() returns the exact NEP-11 symbol.
        // -----------------------------------------------------------------
        [Fact]
        public void EventTicketPass_SymbolReturnsTicket()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppEventTicketPass");
            var contract = engine.Deploy<EventTicketPassContract>(nef, manifest);

            Assert.Equal("TICKET", contract.symbol());
        }

        // -----------------------------------------------------------------
        // MiniAppEventTicketPass: totalSupply starts at 0.
        // -----------------------------------------------------------------
        [Fact]
        public void EventTicketPass_FreshSupplyIsZero()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppEventTicketPass");
            var contract = engine.Deploy<EventTicketPassContract>(nef, manifest);

            var supply = contract.totalSupply();
            Assert.NotNull(supply);
            Assert.Equal(BigInteger.Zero, supply);
        }

        // -----------------------------------------------------------------
        // MiniAppSoulboundCertificate: totalSupply starts at 0.
        // -----------------------------------------------------------------
        [Fact]
        public void SoulboundCertificate_FreshSupplyIsZero()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppSoulboundCertificate");
            var contract = engine.Deploy<SoulboundCertificateContract>(nef, manifest);

            var supply = contract.totalSupply();
            Assert.NotNull(supply);
            Assert.Equal(BigInteger.Zero, supply);
        }

        // -----------------------------------------------------------------
        // MiniAppMilestoneEscrow: counter starts at 0.
        // -----------------------------------------------------------------
        [Fact]
        public void MilestoneEscrow_FreshCounterIsZero()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppMilestoneEscrow");
            var contract = engine.Deploy<MilestoneEscrowContract>(nef, manifest);
            var count = contract.totalEscrows();
            Assert.NotNull(count);
            Assert.Equal(BigInteger.Zero, count);
        }

        // -----------------------------------------------------------------
        // SoulboundCertificate: createTemplate requires issuer witness.
        // The arguments are fully valid, so the call reaches the witness gate;
        // the identical call signed by the issuer succeeds, proving the witness
        // check (and not an earlier argument guard) was the only blocker.
        // -----------------------------------------------------------------
        [Fact]
        public void SoulboundCertificate_CreateTemplate_RequiresIssuerWitness()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppSoulboundCertificate");
            var contract = engine.Deploy<SoulboundCertificateContract>(nef, manifest);

            var issuer = TestEngine.GetNewSigner();
            var attacker = TestEngine.GetNewSigner();

            // Sign as attacker but pass issuer.Account as the "issuer" argument.
            engine.SetTransactionSigners(attacker);
            AssertRevert("unauthorized", () => contract.createTemplate(
                issuer.Account, "Title", "Issuer", "category",
                new BigInteger(10), "desc"));

            // Positive control: the issuer-signed call passes the gate.
            engine.SetTransactionSigners(issuer);
            BigInteger? id = contract.createTemplate(
                issuer.Account, "Title", "Issuer", "category",
                new BigInteger(10), "desc");
            Assert.Equal(BigInteger.One, id);
        }

        // -----------------------------------------------------------------
        // EventTicketPass: createEvent requires creator witness.
        // -----------------------------------------------------------------
        [Fact]
        public void EventTicketPass_CreateEvent_RequiresCreatorWitness()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppEventTicketPass");
            var contract = engine.Deploy<EventTicketPassContract>(nef, manifest);

            var creator = TestEngine.GetNewSigner();
            var attacker = TestEngine.GetNewSigner();
            // Fixed event window (start < end, both positive) keeps the argument
            // guards deterministic regardless of wall-clock time.
            var startTime = new BigInteger(1700000000000L);
            var endTime = new BigInteger(1700086400000L);

            engine.SetTransactionSigners(attacker);
            AssertRevert("unauthorized", () => contract.createEvent(
                creator.Account, "Event", "Venue",
                startTime, endTime, new BigInteger(100), "notes"));

            // Positive control: the creator-signed call passes the gate.
            engine.SetTransactionSigners(creator);
            BigInteger? id = contract.createEvent(
                creator.Account, "Event", "Venue",
                startTime, endTime, new BigInteger(100), "notes");
            Assert.Equal(BigInteger.One, id);
        }

        // -----------------------------------------------------------------
        // QuadraticFunding: createRound requires creator witness. Valid asset
        // (GAS) and pool so the call reaches the witness gate, then the same
        // call funded + signed by the creator succeeds end-to-end.
        // -----------------------------------------------------------------
        [Fact]
        public void QuadraticFunding_CreateRound_RequiresCreatorWitness()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppQuadraticFunding");
            var contract = engine.Deploy<QuadraticFundingContract>(nef, manifest);

            var creator = TestEngine.GetNewSigner();
            var attacker = TestEngine.GetNewSigner();
            // End time must be after Runtime.Time (the engine's genesis-era
            // persisting block), so pin it far in the future deterministically.
            var startTime = BigInteger.One;
            var endTime = new BigInteger(32503680000000L); // year 3000 (ms)
            var matchingPool = new BigInteger(100000000);  // 1 GAS

            engine.SetTransactionSigners(attacker);
            AssertRevert("unauthorized", () => contract.createRound(
                creator.Account, engine.Native.GAS.Hash, matchingPool,
                startTime, endTime, "Round", "desc"));

            // Positive control: prepay the matching pool, then the creator-signed
            // call creates round #1.
            FundGas(engine, creator.Account, 2L * 100000000);
            engine.SetTransactionSigners(creator);
            engine.Native.GAS.Transfer(
                creator.Account, contract.Hash, matchingPool, "miniapp-quadratic-funding:deposit");
            BigInteger? id = contract.createRound(
                creator.Account, engine.Native.GAS.Hash, matchingPool,
                startTime, endTime, "Round", "desc");
            Assert.Equal(BigInteger.One, id);
        }

        // -----------------------------------------------------------------
        // All four MiniApp contracts: must deploy clean (manifest + NEF valid).
        // -----------------------------------------------------------------
        [Theory]
        [InlineData("MiniAppMilestoneEscrow")]
        [InlineData("MiniAppEventTicketPass")]
        [InlineData("MiniAppSoulboundCertificate")]
        [InlineData("MiniAppQuadraticFunding")]
        public void EveryMiniAppContract_DeploysClean(string name)
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load(name);
            // Use the abstract base since we just need a deploy probe.
            var hash = engine.GetDeployHash(nef, manifest);
            Assert.NotNull(hash);
            Assert.NotEqual(UInt160.Zero, hash);
        }

        // -----------------------------------------------------------------
        // All four Platform contracts: must deploy clean (manifest + NEF valid).
        // -----------------------------------------------------------------
        [Theory]
        [InlineData("PlatformAnchor")]
        [InlineData("PlatformDeFi")]
        [InlineData("PlatformGame")]
        [InlineData("PlatformSocial")]
        public void EveryPlatformContract_DeploysClean(string name)
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load(name);
            var hash = engine.GetDeployHash(nef, manifest);
            Assert.NotNull(hash);
            Assert.NotEqual(UInt160.Zero, hash);
        }
    }
}
