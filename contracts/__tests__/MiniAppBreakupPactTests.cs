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
    public abstract class BreakupPactContract : SmartContract
    {
        protected BreakupPactContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract void onNEP17Payment(UInt160 from, BigInteger amount, object? data);
        public abstract BigInteger? createPact(UInt160 party1, UInt160 party2, BigInteger stake, BigInteger durationSeconds);
        public abstract void signPact(BigInteger pactId, UInt160 party2);
        public abstract void breakPact(BigInteger pactId, UInt160 breaker);
        public abstract void settlePact(BigInteger pactId);
        public abstract BigInteger? withdraw(UInt160 account);
        public abstract BigInteger? creditOf(UInt160 who);
        public abstract BigInteger? lastPactId();
        public abstract BigInteger? partyPactCount(UInt160 who);
    }

    // A minimal contract whose onNEP17Payment FAULTS on the payout-push shape (a
    // transfer carrying any data other than the stake memo — exactly what a pushed
    // GAS payout, GAS.Transfer(self, recipient, amount, ""), would send), yet can
    // still become party2 of a pact by depositing its matching stake (a memo-tagged
    // transfer it accepts) and signing. Used to prove break/settle no longer push
    // GAS to a party: a push to a party whose onNEP17Payment faults would brick
    // BreakPact/SettlePact and strand BOTH stakes. With the pull-payment fix the
    // resolution credits the party's withdrawable ledger instead, so it always
    // completes for such a party.
    public abstract class GasRejectingPartyMock : SmartContract
    {
        protected GasRejectingPartyMock(SmartContractInitialize initialize) : base(initialize) { }
        public abstract void becomeParty2(BigInteger pactId);
    }

    public class MiniAppBreakupPactTests
    {
        private const long GAS = 100000000;       // 1 GAS base units
        private const long MIN_STAKE = 1 * GAS;   // contract minimum stake
        private const string STAKE_MEMO = "miniapp-breakup:stake";

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

        private static void Fund(TestEngine engine, UInt160 to, BigInteger gas)
        {
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            engine.Native.GAS.Transfer(engine.ValidatorsAddress, to, gas, null);
        }

        // Fund a contract that only accepts memo-tagged transfers (the GAS-rejecting
        // party mock asserts data == the stake memo), so funding it with null data would
        // fault. Carry the memo the mock accepts.
        private static void FundWithMemo(TestEngine engine, UInt160 to, BigInteger gas, string memo)
        {
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            engine.Native.GAS.Transfer(engine.ValidatorsAddress, to, gas, memo);
        }

        private static void DepositStake(TestEngine engine, BreakupPactContract pact, UInt160 who, BigInteger amount)
        {
            engine.SetTransactionSigners(who);
            bool? ok = engine.Native.GAS.Transfer(who, pact.Hash, amount, STAKE_MEMO);
            Assert.True(ok == true, "stake deposit should succeed");
        }

        private static BigInteger CreateActivePact(TestEngine engine, BreakupPactContract pact, UInt160 a, UInt160 b, BigInteger stake, BigInteger durationSeconds)
        {
            DepositStake(engine, pact, a, stake);
            engine.SetTransactionSigners(a);
            BigInteger pactId = pact.createPact(a, b, stake, durationSeconds) ?? 0;
            DepositStake(engine, pact, b, stake);
            engine.SetTransactionSigners(b);
            pact.signPact(pactId, b);
            return pactId;
        }

        [Fact]
        public void BreakupPact_BreakerForfeitsBothStakesToPartner()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppBreakupPact");
            var pact = engine.Deploy<BreakupPactContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            var bob = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 3 * GAS);
            Fund(engine, bob, 3 * GAS);

            BigInteger pactId = CreateActivePact(engine, pact, alice, bob, MIN_STAKE, 3600);
            Assert.Equal(BigInteger.One, pactId);
            Assert.Equal(BigInteger.One, pact.lastPactId());
            Assert.Equal(BigInteger.One, pact.partyPactCount(alice));
            Assert.Equal(BigInteger.One, pact.partyPactCount(bob));
            Assert.Equal(new BigInteger(2 * MIN_STAKE), engine.Native.GAS.BalanceOf(pact.Hash));

            // An outsider cannot break someone else's pact.
            var mallory = TestEngine.GetNewSigner().Account;
            engine.SetTransactionSigners(mallory);
            Assert.ThrowsAny<Exception>(() => pact.breakPact(pactId, mallory));

            // Alice breaks: Bob is CREDITED both stakes (pull-payment), not paid directly,
            // so a GAS-rejecting partner could never brick the break.
            BigInteger bobBefore = engine.Native.GAS.BalanceOf(bob) ?? 0;
            engine.SetTransactionSigners(alice);
            pact.breakPact(pactId, alice);
            Assert.Equal(new BigInteger(2 * MIN_STAKE), pact.creditOf(bob));
            Assert.Equal(bobBefore, engine.Native.GAS.BalanceOf(bob)); // not paid until claimed
            // Both stakes remain held by the contract until Bob pulls them.
            Assert.Equal(new BigInteger(2 * MIN_STAKE), engine.Native.GAS.BalanceOf(pact.Hash));

            // Bob pulls his winnings via Withdraw; the contract is then empty.
            engine.SetTransactionSigners(bob);
            Assert.Equal(new BigInteger(2 * MIN_STAKE), pact.withdraw(bob));
            Assert.Equal(bobBefore + 2 * MIN_STAKE, engine.Native.GAS.BalanceOf(bob));
            Assert.Equal(BigInteger.Zero, engine.Native.GAS.BalanceOf(pact.Hash));

            // A broken pact is terminal: no second break, no settle.
            engine.SetTransactionSigners(alice);
            Assert.ThrowsAny<Exception>(() => pact.breakPact(pactId, alice));
            Assert.ThrowsAny<Exception>(() => pact.settlePact(pactId));
        }

        [Fact]
        public void BreakupPact_HonoredPactRefundsBothAfterExpiry()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppBreakupPact");
            var pact = engine.Deploy<BreakupPactContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            var bob = TestEngine.GetNewSigner().Account;
            var carol = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 3 * GAS);
            Fund(engine, bob, 3 * GAS);
            Fund(engine, carol, 1 * GAS);

            BigInteger pactId = CreateActivePact(engine, pact, alice, bob, MIN_STAKE, 3600);

            // Still active: settle must wait for expiry.
            engine.SetTransactionSigners(carol);
            Assert.ThrowsAny<Exception>(() => pact.settlePact(pactId));

            engine.PersistingBlock.Advance(TimeSpan.FromSeconds(3601));

            // Permissionless settle (Carol is not a party) CREDITS each side its stake
            // (pull-payment); neither is paid until they pull it via Withdraw, so a
            // GAS-rejecting party can never brick the settle and strand BOTH stakes.
            BigInteger aliceBefore = engine.Native.GAS.BalanceOf(alice) ?? 0;
            BigInteger bobBefore = engine.Native.GAS.BalanceOf(bob) ?? 0;
            pact.settlePact(pactId);
            Assert.Equal(new BigInteger(MIN_STAKE), pact.creditOf(alice));
            Assert.Equal(new BigInteger(MIN_STAKE), pact.creditOf(bob));
            Assert.Equal(aliceBefore, engine.Native.GAS.BalanceOf(alice)); // not paid until claimed
            Assert.Equal(bobBefore, engine.Native.GAS.BalanceOf(bob));
            Assert.Equal(new BigInteger(2 * MIN_STAKE), engine.Native.GAS.BalanceOf(pact.Hash));

            // Each party pulls its own refund; the contract empties out exactly.
            engine.SetTransactionSigners(alice);
            Assert.Equal(new BigInteger(MIN_STAKE), pact.withdraw(alice));
            engine.SetTransactionSigners(bob);
            Assert.Equal(new BigInteger(MIN_STAKE), pact.withdraw(bob));
            Assert.Equal(aliceBefore + MIN_STAKE, engine.Native.GAS.BalanceOf(alice));
            Assert.Equal(bobBefore + MIN_STAKE, engine.Native.GAS.BalanceOf(bob));
            Assert.Equal(BigInteger.Zero, engine.Native.GAS.BalanceOf(pact.Hash));

            // A settled pact is terminal.
            Assert.ThrowsAny<Exception>(() => pact.settlePact(pactId));
            engine.SetTransactionSigners(alice);
            Assert.ThrowsAny<Exception>(() => pact.breakPact(pactId, alice));
        }

        [Fact]
        public void BreakupPact_PendingPactOnlyParty1CanCancelForRefund()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppBreakupPact");
            var pact = engine.Deploy<BreakupPactContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            var bob = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 3 * GAS);
            Fund(engine, bob, 3 * GAS);

            DepositStake(engine, pact, alice, MIN_STAKE);
            engine.SetTransactionSigners(alice);
            BigInteger pactId = pact.createPact(alice, bob, MIN_STAKE, 3600) ?? 0;

            // Bob never staked, so he cannot cancel the pending pact.
            engine.SetTransactionSigners(bob);
            Assert.ThrowsAny<Exception>(() => pact.breakPact(pactId, bob));

            // Alice cancels: her lone stake is CREDITED back (pull-payment), reclaimed
            // via Withdraw — the contract holds it until she pulls it.
            BigInteger aliceBefore = engine.Native.GAS.BalanceOf(alice) ?? 0;
            engine.SetTransactionSigners(alice);
            pact.breakPact(pactId, alice);
            Assert.Equal(new BigInteger(MIN_STAKE), pact.creditOf(alice));
            Assert.Equal(aliceBefore, engine.Native.GAS.BalanceOf(alice)); // not paid until claimed
            Assert.Equal(new BigInteger(MIN_STAKE), engine.Native.GAS.BalanceOf(pact.Hash));

            Assert.Equal(new BigInteger(MIN_STAKE), pact.withdraw(alice));
            Assert.Equal(aliceBefore + MIN_STAKE, engine.Native.GAS.BalanceOf(alice));
            Assert.Equal(BigInteger.Zero, engine.Native.GAS.BalanceOf(pact.Hash));

            // The cancelled pact cannot be signed afterwards.
            DepositStake(engine, pact, bob, MIN_STAKE);
            engine.SetTransactionSigners(bob);
            Assert.ThrowsAny<Exception>(() => pact.signPact(pactId, bob));
        }

        [Fact]
        public void BreakupPact_CreateAndSignGuards()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppBreakupPact");
            var pact = engine.Deploy<BreakupPactContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            var bob = TestEngine.GetNewSigner().Account;
            var carol = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 3 * GAS);
            Fund(engine, bob, 3 * GAS);
            Fund(engine, carol, 3 * GAS);

            engine.SetTransactionSigners(alice);
            // No stake credit deposited yet.
            Assert.ThrowsAny<Exception>(() => pact.createPact(alice, bob, MIN_STAKE, 3600));

            DepositStake(engine, pact, alice, 2 * MIN_STAKE);
            engine.SetTransactionSigners(alice);
            // Below the 1 GAS minimum stake.
            Assert.ThrowsAny<Exception>(() => pact.createPact(alice, bob, MIN_STAKE - 1, 3600));
            // The two parties must differ.
            Assert.ThrowsAny<Exception>(() => pact.createPact(alice, alice, MIN_STAKE, 3600));
            // Duration out of range.
            Assert.ThrowsAny<Exception>(() => pact.createPact(alice, bob, MIN_STAKE, 0));
            Assert.ThrowsAny<Exception>(() => pact.createPact(alice, bob, MIN_STAKE, 3651L * 86400));

            BigInteger pactId = pact.createPact(alice, bob, MIN_STAKE, 3600) ?? 0;

            // Only the NAMED partner may sign, with their own stake credit in place.
            DepositStake(engine, pact, carol, MIN_STAKE);
            engine.SetTransactionSigners(carol);
            Assert.ThrowsAny<Exception>(() => pact.signPact(pactId, carol));

            // Bob cannot sign without having deposited his matching stake.
            engine.SetTransactionSigners(bob);
            Assert.ThrowsAny<Exception>(() => pact.signPact(pactId, bob));

            DepositStake(engine, pact, bob, MIN_STAKE);
            engine.SetTransactionSigners(bob);
            pact.signPact(pactId, bob);

            // An active pact cannot be signed twice.
            Assert.ThrowsAny<Exception>(() => pact.signPact(pactId, bob));
        }

        [Fact]
        public void BreakupPact_OnPaymentRejectsDirectNonGasCallers()
        {
            // NOTE: a transfer whose OnNEP17Payment callback FAULTs (wrong memo /
            // wrong asset) hangs the TestEngine host, so those rejections are only
            // exercised live (deploy/scripts/live_validate_breakuppact.mjs). What
            // CAN run here is the same guard's first line of defense: a direct
            // invocation is not a GAS callback and must revert before crediting.
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppBreakupPact");
            var pact = engine.Deploy<BreakupPactContract>(nef, manifest);

            var bob = TestEngine.GetNewSigner().Account;
            Fund(engine, bob, 1 * GAS);
            engine.SetTransactionSigners(bob);
            Assert.ThrowsAny<Exception>(() => pact.onNEP17Payment(bob, MIN_STAKE, STAKE_MEMO));
            Assert.Equal(BigInteger.Zero, pact.creditOf(bob));
        }

        [Fact]
        public void BreakupPact_WithdrawRefundsUnusedCredit()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppBreakupPact");
            var pact = engine.Deploy<BreakupPactContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            var bob = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 5 * GAS);
            Fund(engine, bob, 3 * GAS);

            // Alice over-deposits, then locks one stake into a pact.
            DepositStake(engine, pact, alice, 3 * MIN_STAKE);
            engine.SetTransactionSigners(alice);
            pact.createPact(alice, bob, MIN_STAKE, 3600);
            Assert.Equal(new BigInteger(2 * MIN_STAKE), pact.creditOf(alice));

            BigInteger before = engine.Native.GAS.BalanceOf(alice) ?? 0;
            Assert.Equal(new BigInteger(2 * MIN_STAKE), pact.withdraw(alice));
            Assert.Equal(before + 2 * MIN_STAKE, engine.Native.GAS.BalanceOf(alice));
            Assert.Equal(BigInteger.Zero, pact.creditOf(alice));

            // Solvency: only the pact's locked stake remains.
            Assert.Equal(new BigInteger(MIN_STAKE), engine.Native.GAS.BalanceOf(pact.Hash));

            Assert.ThrowsAny<Exception>(() => pact.withdraw(alice));
        }

        // Hand-build a tiny contract whose only behaviours are:
        //   onNEP17Payment(from, amount, data) -> ABORT when data != the stake memo. A
        //                                         pushed GAS payout (the old
        //                                         GAS.Transfer(self, party, amount, "")
        //                                         shape) carries empty data and so would
        //                                         fault here, modelling a party whose
        //                                         payout receive faults; the memo-tagged
        //                                         stake deposit it accepts.
        //   becomeParty2(pactId)               -> deposit the matching stake into the
        //                                         pact, then signPact so this contract
        //                                         is party2.
        // The pact hash, GAS hash, stake and memo are baked in as constants (all known
        // after the pact is deployed and the pending pact is created), so becomeParty2
        // takes only the pactId.
        private static (NefFile nef, ContractManifest manifest) BuildGasRejectingParty(
            UInt160 gasHash, UInt160 pactHash, BigInteger stake, string memo)
        {
            using var sb = new ScriptBuilder();

            // offset 0: onNEP17Payment(from, amount, data). Accept only the memo-tagged
            // stake deposit; abort on every other shape (the payout-push shape).
            sb.Emit(OpCode.INITSLOT, new byte[] { 0, 3 }); // 0 locals, 3 args
            sb.Emit(OpCode.LDARG2);                        // data
            sb.EmitPush(memo);                             // expected stake memo
            sb.Emit(OpCode.EQUAL);                         // data == memo ?
            sb.Emit(OpCode.ASSERT);                        // abort unless it is the stake deposit
            sb.Emit(OpCode.RET);

            int becomeParty2Offset = sb.Length;

            // becomeParty2(pactId).
            sb.Emit(OpCode.INITSLOT, new byte[] { 0, 1 }); // 0 locals, 1 arg (pactId)

            // deposit: GAS.transfer(self, pactHash, stake, memo)
            // PACK builds the array with array[0] = first item popped (top of stack),
            // so push memo, stake, pactHash, self (self ends on top).
            sb.EmitPush(memo);                                                            // arg3 (data)
            sb.EmitPush(stake);                                                           // arg2 (amount)
            sb.EmitPush(pactHash.ToArray());                                              // arg1 (to)
            sb.EmitSysCall(ApplicationEngine.System_Runtime_GetExecutingScriptHash.Hash); // arg0 = self (from)
            sb.EmitPush(4);
            sb.Emit(OpCode.PACK);                                                         // [self, pactHash, stake, memo]
            sb.EmitPush((BigInteger)(int)CallFlags.All);
            sb.EmitPush("transfer");
            sb.EmitPush(gasHash.ToArray());
            sb.EmitSysCall(ApplicationEngine.System_Contract_Call.Hash);
            sb.Emit(OpCode.DROP);                                                         // drop the bool result

            // sign: pact.signPact(pactId, self)
            sb.EmitSysCall(ApplicationEngine.System_Runtime_GetExecutingScriptHash.Hash); // self (party2)
            sb.Emit(OpCode.LDARG0);                                                       // pactId
            sb.EmitPush(2);
            sb.Emit(OpCode.PACK);                                                         // [pactId, self]
            sb.EmitPush((BigInteger)(int)CallFlags.All);
            sb.EmitPush("signPact");
            sb.EmitPush(pactHash.ToArray());
            sb.EmitSysCall(ApplicationEngine.System_Contract_Call.Hash);
            sb.Emit(OpCode.DROP);                                                         // signPact is void -> drop the Null result
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
                "{\"name\":\"GasRejectingPartyMock\",\"groups\":[],\"features\":{}," +
                "\"supportedstandards\":[],\"abi\":{\"methods\":[" +
                "{\"name\":\"onNEP17Payment\",\"parameters\":[" +
                "{\"name\":\"from\",\"type\":\"Hash160\"}," +
                "{\"name\":\"amount\",\"type\":\"Integer\"}," +
                "{\"name\":\"data\",\"type\":\"Any\"}]," +
                "\"returntype\":\"Void\",\"offset\":0,\"safe\":false}," +
                "{\"name\":\"becomeParty2\",\"parameters\":[" +
                "{\"name\":\"pactId\",\"type\":\"Integer\"}]," +
                "\"returntype\":\"Void\",\"offset\":" + becomeParty2Offset + ",\"safe\":false}]," +
                "\"events\":[]},\"permissions\":[{\"contract\":\"*\",\"methods\":\"*\"}]," +
                "\"trusts\":[],\"extra\":null}";

            return (nef, ContractManifest.Parse(manifestJson));
        }

        [Fact]
        public void BreakupPact_GasRejectingPartyDoesNotBrickSettleAndIsClaimable()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppBreakupPact");
            var pact = engine.Deploy<BreakupPactContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 3 * GAS);

            // Alice (an EOA) creates a pending pact naming the GAS-rejecting contract
            // as party2.
            var (mockNef, mockManifest) = BuildGasRejectingParty(
                engine.Native.GAS.Hash, pact.Hash, MIN_STAKE, STAKE_MEMO);
            var mock = engine.Deploy<GasRejectingPartyMock>(mockNef, mockManifest);

            DepositStake(engine, pact, alice, MIN_STAKE);
            engine.SetTransactionSigners(alice);
            BigInteger pactId = pact.createPact(alice, mock.Hash, MIN_STAKE, 3600) ?? 0;

            // Fund the mock so it can deposit its matching stake, then let it sign:
            // the funding/deposit transfers carry the stake memo, the only data the
            // mock's onNEP17Payment accepts.
            FundWithMemo(engine, mock.Hash, 3 * GAS, STAKE_MEMO);
            engine.SetTransactionSigners(alice); // mock signs from its own context inside becomeParty2
            mock.becomeParty2(pactId);

            // The pact is now active and fully backed by both stakes.
            Assert.Equal(new BigInteger(2 * MIN_STAKE), engine.Native.GAS.BalanceOf(pact.Hash));

            // Honor the pact to expiry, then settle permissionlessly. Under push-payment
            // this would brick: settle pushes GAS to the contract party, whose
            // onNEP17Payment faults on the empty-data payout, reverting the whole settle
            // and stranding BOTH stakes. Under pull-payment it MUST succeed.
            engine.PersistingBlock.Advance(TimeSpan.FromSeconds(3601));
            engine.SetTransactionSigners(alice); // anyone may settle
            pact.settlePact(pactId);

            // Pull-payment: each party is CREDITED its own stake, never pushed.
            Assert.Equal(new BigInteger(MIN_STAKE), pact.creditOf(alice));
            Assert.Equal(new BigInteger(MIN_STAKE), pact.creditOf(mock.Hash));
            // The contract still holds both stakes, owed to the credit ledger.
            Assert.Equal(new BigInteger(2 * MIN_STAKE), engine.Native.GAS.BalanceOf(pact.Hash));

            // The credited stake is genuinely claimable via Withdraw: Alice (who CAN
            // receive GAS) pulls hers. (The contract party cannot pull because it
            // rejects the GAS transfer — that is its own limitation, not a strand: its
            // balance stays safely escrowed in the credit ledger, claimable the instant
            // it can accept GAS, e.g. after a contract upgrade.)
            BigInteger aliceBefore = engine.Native.GAS.BalanceOf(alice) ?? 0;
            engine.SetTransactionSigners(alice);
            Assert.Equal(new BigInteger(MIN_STAKE), pact.withdraw(alice));
            Assert.Equal(aliceBefore + MIN_STAKE, engine.Native.GAS.BalanceOf(alice));
            Assert.Equal(BigInteger.Zero, pact.creditOf(alice));

            // The mock's credit is untouched and still recorded.
            Assert.Equal(new BigInteger(MIN_STAKE), pact.creditOf(mock.Hash));
            Assert.Equal(new BigInteger(MIN_STAKE), engine.Native.GAS.BalanceOf(pact.Hash));
        }
    }
}
