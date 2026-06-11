using System;
using System.IO;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Manifest;
using Neo.SmartContract.Testing;
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

            // Alice breaks: Bob receives BOTH stakes atomically.
            BigInteger bobBefore = engine.Native.GAS.BalanceOf(bob) ?? 0;
            engine.SetTransactionSigners(alice);
            pact.breakPact(pactId, alice);
            Assert.Equal(bobBefore + 2 * MIN_STAKE, engine.Native.GAS.BalanceOf(bob));

            // Solvency: nothing strands in the contract.
            Assert.Equal(BigInteger.Zero, engine.Native.GAS.BalanceOf(pact.Hash));

            // A broken pact is terminal: no second break, no settle.
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

            // Permissionless settle (Carol is not a party) refunds each side its stake.
            BigInteger aliceBefore = engine.Native.GAS.BalanceOf(alice) ?? 0;
            BigInteger bobBefore = engine.Native.GAS.BalanceOf(bob) ?? 0;
            pact.settlePact(pactId);
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

            // Alice cancels and reclaims her lone stake.
            BigInteger aliceBefore = engine.Native.GAS.BalanceOf(alice) ?? 0;
            engine.SetTransactionSigners(alice);
            pact.breakPact(pactId, alice);
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
    }
}
