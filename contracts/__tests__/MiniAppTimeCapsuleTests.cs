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
    public abstract class TimeCapsuleContract : SmartContract
    {
        protected TimeCapsuleContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract BigInteger? bury(UInt160 owner, byte[] contentHash, BigInteger durationSeconds, bool isPublic, BigInteger category, BigInteger amount);
        public abstract BigInteger? reveal(UInt160 owner, BigInteger capsuleId);
        public abstract BigInteger? withdraw(UInt160 account);
        public abstract BigInteger? creditOf(UInt160 owner);
        public abstract BigInteger? lastCapsuleId();
        public abstract BigInteger? ownerCapsuleCount(UInt160 owner);
    }

    public class MiniAppTimeCapsuleTests
    {
        private const long GAS = 100000000; // 1 GAS base units
        private const string BURY_MEMO = "miniapp-timecapsule:bury";
        private const string FISH_MEMO_PREFIX = "miniapp-timecapsule:fish:";
        private static readonly byte[] ContentHash = new byte[] { 0xAA, 0xBB, 0xCC, 0xDD };

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

        [Fact]
        public void TimeCapsule_BuryLocksDepositAndRevealRefundsAfterUnlock()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppTimeCapsule");
            var vault = engine.Deploy<TimeCapsuleContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 5 * GAS);

            engine.SetTransactionSigners(alice);
            bool? ok = engine.Native.GAS.Transfer(alice, vault.Hash, 2 * GAS, BURY_MEMO);
            Assert.True(ok == true, "deposit transfer should succeed");
            Assert.Equal(new BigInteger(2 * GAS), vault.creditOf(alice));

            BigInteger lockAmount = 3 * GAS / 2; // 1.5 GAS
            Assert.Equal(BigInteger.One, vault.bury(alice, ContentHash, 3600, false, 1, lockAmount));
            Assert.Equal(new BigInteger(GAS / 2), vault.creditOf(alice));
            Assert.Equal(BigInteger.One, vault.lastCapsuleId());
            Assert.Equal(BigInteger.One, vault.ownerCapsuleCount(alice));

            // The time lock holds before the unlock time...
            Assert.ThrowsAny<Exception>(() => vault.reveal(alice, 1));
            // ...and a stranger can never reveal someone else's capsule.
            var mallory = TestEngine.GetNewSigner().Account;
            engine.SetTransactionSigners(mallory);
            Assert.ThrowsAny<Exception>(() => vault.reveal(mallory, 1));

            engine.PersistingBlock.Advance(TimeSpan.FromSeconds(3601));

            engine.SetTransactionSigners(alice);
            BigInteger before = engine.Native.GAS.BalanceOf(alice) ?? 0;
            Assert.Equal(lockAmount, vault.reveal(alice, 1));
            Assert.Equal(before + lockAmount, engine.Native.GAS.BalanceOf(alice));

            // The Revealed flag blocks a second withdrawal of the same deposit.
            Assert.ThrowsAny<Exception>(() => vault.reveal(alice, 1));

            // Solvency: only Alice's unburied credit remains in the contract.
            Assert.Equal(new BigInteger(GAS / 2), engine.Native.GAS.BalanceOf(vault.Hash));
        }

        [Fact]
        public void TimeCapsule_BuryGuards()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppTimeCapsule");
            var vault = engine.Deploy<TimeCapsuleContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 2 * GAS);
            engine.SetTransactionSigners(alice);
            engine.Native.GAS.Transfer(alice, vault.Hash, 1 * GAS, BURY_MEMO);

            // More than the prepaid credit.
            Assert.ThrowsAny<Exception>(() => vault.bury(alice, ContentHash, 3600, false, 1, 2 * GAS));
            // Duration out of range (0 and > 10 years).
            Assert.ThrowsAny<Exception>(() => vault.bury(alice, ContentHash, 0, false, 1, GAS));
            Assert.ThrowsAny<Exception>(() => vault.bury(alice, ContentHash, 3651L * 86400, false, 1, GAS));
            // Empty content hash.
            Assert.ThrowsAny<Exception>(() => vault.bury(alice, new byte[0], 3600, false, 1, GAS));
            // Zero amount.
            Assert.ThrowsAny<Exception>(() => vault.bury(alice, ContentHash, 3600, false, 1, 0));

            // A stranger cannot bury on Alice's behalf (witness check).
            var mallory = TestEngine.GetNewSigner().Account;
            engine.SetTransactionSigners(mallory);
            Assert.ThrowsAny<Exception>(() => vault.bury(alice, ContentHash, 3600, false, 1, GAS));

            Assert.Equal(BigInteger.Zero, vault.lastCapsuleId());
            Assert.Equal(new BigInteger(1 * GAS), vault.creditOf(alice));
        }

        [Fact]
        public void TimeCapsule_FishForwardsFeeToOwner()
        {
            // NOTE: fish rejections (private capsule, double fish, below-minimum fee,
            // self-fish) FAULT inside the OnNEP17Payment callback of a native GAS
            // transfer, which hangs the TestEngine host — they are exercised live
            // instead (deploy/scripts/live_validate_timecapsule.mjs). The success
            // path below is the contract's one in-callback transfer and must keep
            // working on a real NeoVM.
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppTimeCapsule");
            var vault = engine.Deploy<TimeCapsuleContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            var bob = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 2 * GAS);
            Fund(engine, bob, 2 * GAS);

            // Alice buries a PUBLIC capsule.
            engine.SetTransactionSigners(alice);
            engine.Native.GAS.Transfer(alice, vault.Hash, 1 * GAS, BURY_MEMO);
            vault.bury(alice, ContentHash, 3600, true, 1, 1 * GAS);

            // Bob's discovery fee is forwarded to Alice in the same transaction.
            BigInteger aliceBefore = engine.Native.GAS.BalanceOf(alice) ?? 0;
            engine.SetTransactionSigners(bob);
            bool? ok = engine.Native.GAS.Transfer(bob, vault.Hash, GAS / 10, FISH_MEMO_PREFIX + "1");
            Assert.True(ok == true, "fish transfer should succeed");
            Assert.Equal(aliceBefore + GAS / 10, engine.Native.GAS.BalanceOf(alice));

            // Solvency: the fee passed through; only the locked capsule deposit remains.
            Assert.Equal(new BigInteger(1 * GAS), engine.Native.GAS.BalanceOf(vault.Hash));
        }

        [Fact]
        public void TimeCapsule_WithdrawRefundsUnusedCredit()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppTimeCapsule");
            var vault = engine.Deploy<TimeCapsuleContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 3 * GAS);
            engine.SetTransactionSigners(alice);
            engine.Native.GAS.Transfer(alice, vault.Hash, 2 * GAS, BURY_MEMO);
            vault.bury(alice, ContentHash, 3600, false, 1, GAS / 2);

            BigInteger refund = 2 * GAS - GAS / 2;
            BigInteger before = engine.Native.GAS.BalanceOf(alice) ?? 0;
            Assert.Equal(refund, vault.withdraw(alice));
            Assert.Equal(before + refund, engine.Native.GAS.BalanceOf(alice));
            Assert.Equal(BigInteger.Zero, vault.creditOf(alice));

            // Solvency: only the buried amount stays locked.
            Assert.Equal(new BigInteger(GAS / 2), engine.Native.GAS.BalanceOf(vault.Hash));

            Assert.ThrowsAny<Exception>(() => vault.withdraw(alice));
        }
    }
}
