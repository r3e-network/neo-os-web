using System;
using System.IO;
using System.Linq;
using System.Numerics;
using System.Text;
using Neo;
using Neo.Extensions;
using Neo.SmartContract;
using Neo.SmartContract.Manifest;
using Neo.SmartContract.Testing;
using Neo.VM;
using Neo.VM.Types;
using Xunit;
using VMArray = Neo.VM.Types.Array;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    // NEP-11 conformance tests for the two NFT miniapp contracts
    // (tri-repo review MP-D-02 + the SBT tokens() enumeration fault).
    //
    // The deployed SoulboundCertificate bytecode calls System.Storage.Find with
    // conflicting FindOptions (ValuesOnly | RemovePrefix), which the NeoVM
    // rejects, so tokens()/tokensOf() FAULT on-chain. These tests drive the
    // iterator through a real script (mint one token, enumerate it) so any
    // invalid FindOptions combination faults the test, and pin the NEP-11
    // supportedStandards declaration + standard transfer/Transfer ABI shapes
    // that were previously missing from both manifests.

    public abstract class SoulboundNep11Contract : SmartContract
    {
        protected SoulboundNep11Contract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract BigInteger? createTemplate(
            UInt160 issuer, string name, string issuerName, string category,
            BigInteger maxSupply, string description);
        public abstract string issueCertificate(
            UInt160 issuer, UInt160 recipient, BigInteger templateId,
            string recipientName, string achievement, string memo);
        public abstract BigInteger? totalSupply();
        public abstract BigInteger? balanceOf(UInt160 owner);
        public abstract UInt160 ownerOf(string tokenId);
        public abstract bool? transfer(UInt160 to, string tokenId, object data);
    }

    public abstract class EventTicketNep11Contract : SmartContract
    {
        protected EventTicketNep11Contract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract BigInteger? createEvent(
            UInt160 creator, string name, string venue, BigInteger startTime,
            BigInteger endTime, BigInteger maxSupply, string notes);
        public abstract string issueTicket(
            UInt160 creator, UInt160 recipient, BigInteger eventId, string seat, string memo);
        public abstract BigInteger? balanceOf(UInt160 owner);
        public abstract UInt160 ownerOf(string tokenId);
        public abstract bool? transfer(UInt160 to, string tokenId, object data);
    }

    public class MiniAppNep11StandardTests
    {
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

        // Contract asserts surface as "ABORTMSG is executed. Reason: <text>".
        private static void AssertRevert(string reason, Action act)
        {
            var ex = Assert.ThrowsAny<Exception>(act);
            Assert.Equal($"ABORTMSG is executed. Reason: {reason}", ex.Message);
        }

        // Drive a NEP-11 iterator method through a real script: call it, then pull
        // the first element and probe for a second one via the iterator syscalls.
        // Returns (hasFirst, firstValue, hasSecond). Faults (e.g. the deployed
        // SBT bytecode's conflicting FindOptions) surface as a thrown exception.
        private static (bool hasFirst, byte[] firstValue, bool hasSecond) EnumerateOne(
            TestEngine engine, UInt160 hash, string operation, params object[] args)
        {
            using var sb = new ScriptBuilder();
            sb.EmitDynamicCall(hash, operation, args);                    // [it]
            sb.Emit(OpCode.DUP);                                          // [it, it]
            sb.EmitSysCall(ApplicationEngine.System_Iterator_Next.Hash);  // [it, hasFirst]
            sb.Emit(OpCode.SWAP);                                         // [hasFirst, it]
            sb.Emit(OpCode.DUP);                                          // [hasFirst, it, it]
            sb.EmitSysCall(ApplicationEngine.System_Iterator_Value.Hash); // [hasFirst, it, value]
            sb.Emit(OpCode.SWAP);                                         // [hasFirst, value, it]
            sb.EmitSysCall(ApplicationEngine.System_Iterator_Next.Hash);  // [hasFirst, value, hasSecond]
            sb.Emit(OpCode.PUSH3);
            sb.Emit(OpCode.PACK);

            StackItem result = engine.Execute(sb.ToArray());
            VMArray array = Assert.IsAssignableFrom<VMArray>(result);
            Assert.Equal(3, array.Count);

            // PACK ordering is an implementation detail; the middle element is the
            // iterator value either way, and the two booleans are (first, second)
            // probes in some order. Exactly-one-element iterators must yield
            // {true,false}; faulting/never-yielding/over-yielding ones cannot.
            bool a = array[0].GetBoolean();
            byte[] value = array[1].GetSpan().ToArray();
            bool b = array[2].GetBoolean();
            return (a || b, value, a && b);
        }

        private static void FundGas(TestEngine engine, UInt160 to, BigInteger gas)
        {
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            engine.Native.GAS.Transfer(engine.ValidatorsAddress, to, gas, null);
        }

        // -----------------------------------------------------------------
        // MiniAppSoulboundCertificate
        // -----------------------------------------------------------------

        [Fact]
        public void Soulbound_TokensEnumerationYieldsMintedToken()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppSoulboundCertificate");
            var cert = engine.Deploy<SoulboundNep11Contract>(nef, manifest);

            var issuer = TestEngine.GetNewSigner().Account;
            var holder = TestEngine.GetNewSigner().Account;
            FundGas(engine, issuer, 10_0000_0000);

            engine.SetTransactionSigners(issuer);
            Assert.Equal(BigInteger.One, cert.createTemplate(
                issuer, "Graduation 2026", "R3E Academy", "education", 100, "Class of 2026"));
            string tokenId = cert.issueCertificate(
                issuer, holder, 1, "Alice", "Graduated with honors", "");
            Assert.Equal("1-1", tokenId);
            Assert.Equal(BigInteger.One, cert.totalSupply());
            Assert.Equal(BigInteger.One, cert.balanceOf(holder));
            Assert.Equal(holder, cert.ownerOf(tokenId));

            // tokens(): the deployed bytecode FAULTs here (conflicting
            // FindOptions); the fixed enumeration must yield exactly the
            // minted token id.
            var (hasFirst, firstValue, hasSecond) = EnumerateOne(engine, cert.Hash, "tokens");
            Assert.True(hasFirst, "tokens() should yield the minted token");
            Assert.Equal(Encoding.UTF8.GetBytes("1-1"), firstValue);
            Assert.False(hasSecond, "tokens() should yield exactly one token");

            // tokensOf(holder) used the same conflicting options on-chain.
            var ownerScan = EnumerateOne(engine, cert.Hash, "tokensOf", holder);
            Assert.True(ownerScan.hasFirst, "tokensOf(owner) should yield the minted token");
            Assert.Equal(Encoding.UTF8.GetBytes("1-1"), ownerScan.firstValue);
            Assert.False(ownerScan.hasSecond);
        }

        [Fact]
        public void Soulbound_DeclaresNep11AndStaysNonTransferable()
        {
            var (nef, manifest) = Load("MiniAppSoulboundCertificate");
            Assert.Contains("NEP-11", manifest.SupportedStandards);

            // Standard non-divisible shapes: transfer(to, tokenId, data) and
            // Transfer(from, to, amount, tokenId).
            Assert.NotNull(manifest.Abi.GetMethod("transfer", 3));
            var transferEvent = manifest.Abi.Events.Single(e => e.Name == "Transfer");
            Assert.Equal(4, transferEvent.Parameters.Length);
            Assert.Equal("amount", transferEvent.Parameters[2].Name);

            // Audit fix NEW-M-2 must survive the signature change: probing
            // transfers still observably fail.
            var engine = new TestEngine(true);
            var cert = engine.Deploy<SoulboundNep11Contract>(nef, manifest);
            var issuer = TestEngine.GetNewSigner().Account;
            var holder = TestEngine.GetNewSigner().Account;
            var other = TestEngine.GetNewSigner().Account;

            engine.SetTransactionSigners(issuer);
            cert.createTemplate(issuer, "Badge", "R3E", "honor", 10, "");
            string tokenId = cert.issueCertificate(issuer, holder, 1, "Bob", "Won", "");

            engine.SetTransactionSigners(holder);
            AssertRevert("soulbound: non-transferable", () => cert.transfer(other, tokenId, null));
            Assert.Equal(holder, cert.ownerOf(tokenId));
        }

        // -----------------------------------------------------------------
        // MiniAppEventTicketPass
        // -----------------------------------------------------------------

        [Fact]
        public void EventTicket_DeclaresNep11AndStandardTransferMovesTicket()
        {
            var (nef, manifest) = Load("MiniAppEventTicketPass");
            Assert.Contains("NEP-11", manifest.SupportedStandards);
            Assert.NotNull(manifest.Abi.GetMethod("transfer", 3));
            var transferEvent = manifest.Abi.Events.Single(e => e.Name == "Transfer");
            Assert.Equal(4, transferEvent.Parameters.Length);
            Assert.Equal("amount", transferEvent.Parameters[2].Name);

            var engine = new TestEngine(true);
            var pass = engine.Deploy<EventTicketNep11Contract>(nef, manifest);
            var creator = TestEngine.GetNewSigner().Account;
            var fan = TestEngine.GetNewSigner().Account;
            var buyer = TestEngine.GetNewSigner().Account;

            engine.SetTransactionSigners(creator);
            Assert.Equal(BigInteger.One, pass.createEvent(
                creator, "Neo Meetup", "Shanghai", 1, 2_000_000_000_000, 100, ""));
            string tokenId = pass.issueTicket(creator, fan, 1, "A1", "");
            Assert.Equal("1-1", tokenId);
            Assert.Equal(fan, pass.ownerOf(tokenId));

            // The standard signature resolves the owner on-chain and requires
            // the OWNER's witness, not the recipient's.
            engine.SetTransactionSigners(buyer);
            AssertRevert("unauthorized", () => pass.transfer(buyer, tokenId, null));

            engine.SetTransactionSigners(fan);
            Assert.True(pass.transfer(buyer, tokenId, null) == true);
            Assert.Equal(buyer, pass.ownerOf(tokenId));
            Assert.Equal(BigInteger.Zero, pass.balanceOf(fan));
            Assert.Equal(BigInteger.One, pass.balanceOf(buyer));

            // tokens()/tokensOf enumerate the moved ticket (ETP stores
            // tokenId keys under PREFIX_TOKENS with KeysOnly|RemovePrefix).
            var scan = EnumerateOne(engine, pass.Hash, "tokens");
            Assert.True(scan.hasFirst);
            Assert.Equal(Encoding.UTF8.GetBytes("1-1"), scan.firstValue);
            Assert.False(scan.hasSecond);

            var ownerScan = EnumerateOne(engine, pass.Hash, "tokensOf", buyer);
            Assert.True(ownerScan.hasFirst);
            Assert.Equal(Encoding.UTF8.GetBytes("1-1"), ownerScan.firstValue);
            Assert.False(ownerScan.hasSecond);
        }
    }
}
