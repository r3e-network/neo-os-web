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
    public abstract class MultisigContract : SmartContract
    {
        protected MultisigContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract BigInteger? createVault(UInt160 creator, UInt160[] signers, BigInteger threshold);
        public abstract BigInteger? createRequest(BigInteger vaultId, UInt160 creator, UInt160 recipient, UInt160 asset, BigInteger amount, string memo);
        public abstract void approve(BigInteger requestId, UInt160 signer);
        public abstract void cancel(BigInteger requestId, UInt160 caller);
        public abstract BigInteger? lastVaultId();
        public abstract BigInteger? lastRequestId();
        public abstract BigInteger? balanceOf(BigInteger vaultId, UInt160 asset);
        public abstract bool? hasApproved(BigInteger requestId, UInt160 signer);
    }

    public class MiniAppMultisigTests
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

        private static void Fund(TestEngine engine, UInt160 to, BigInteger neo, BigInteger gas)
        {
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            if (neo > 0) engine.Native.NEO.Transfer(engine.ValidatorsAddress, to, neo, null);
            if (gas > 0) engine.Native.GAS.Transfer(engine.ValidatorsAddress, to, gas, null);
        }

        // Contract asserts surface as "ABORTMSG is executed. Reason: <text>".
        private static void AssertRevert(string reason, Action act)
        {
            var ex = Assert.ThrowsAny<Exception>(act);
            Assert.Equal($"ABORTMSG is executed. Reason: {reason}", ex.Message);
        }

        [Fact]
        public void Multisig_TwoOfThree_DepositApproveExecute()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppMultisig");
            var wallet = engine.Deploy<MultisigContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            var bob = TestEngine.GetNewSigner().Account;
            var carol = TestEngine.GetNewSigner().Account;
            var recipient = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 0, 10L * GAS);

            // 2-of-3 vault custodied by this contract.
            engine.SetTransactionSigners(alice);
            Assert.Equal(BigInteger.One, wallet.createVault(alice, new[] { alice, bob, carol }, 2));
            Assert.Equal(BigInteger.One, wallet.lastVaultId());

            // Deposit 5 GAS into vault #1 (vault id travels as the transfer data).
            engine.Native.GAS.Transfer(alice, wallet.Hash, 5L * GAS, (BigInteger)1);
            Assert.Equal(new BigInteger(5L * GAS), wallet.balanceOf(1, engine.Native.GAS.Hash));
            Assert.Equal(new BigInteger(5L * GAS), engine.Native.GAS.BalanceOf(wallet.Hash));

            // Spend request for 2 GAS; the first approval is below the threshold.
            Assert.Equal(BigInteger.One, wallet.createRequest(1, alice, recipient, engine.Native.GAS.Hash, 2L * GAS, "rent"));
            wallet.approve(1, alice);
            Assert.True(wallet.hasApproved(1, alice));
            Assert.Equal(BigInteger.Zero, engine.Native.GAS.BalanceOf(recipient)); // not yet executed
            AssertRevert("already approved", () => wallet.approve(1, alice));

            // The second approval reaches the threshold and the CONTRACT pays out.
            engine.SetTransactionSigners(bob);
            wallet.approve(1, bob);
            Assert.Equal(new BigInteger(2L * GAS), engine.Native.GAS.BalanceOf(recipient));
            Assert.Equal(new BigInteger(3L * GAS), wallet.balanceOf(1, engine.Native.GAS.Hash));
            // Solvency: the contract holds exactly the remaining vault balance.
            Assert.Equal(new BigInteger(3L * GAS), engine.Native.GAS.BalanceOf(wallet.Hash));

            // An executed request takes no further approvals.
            engine.SetTransactionSigners(carol);
            AssertRevert("request not pending", () => wallet.approve(1, carol));
        }

        [Fact]
        public void Multisig_NeoVault_ExecutesAtThreshold()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppMultisig");
            var wallet = engine.Deploy<MultisigContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            var bob = TestEngine.GetNewSigner().Account;
            var recipient = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 10, 0);

            engine.SetTransactionSigners(alice);
            wallet.createVault(alice, new[] { alice, bob }, 2);
            // NEO is indivisible: balances stay in whole units end-to-end.
            engine.Native.NEO.Transfer(alice, wallet.Hash, 10, (BigInteger)1);
            Assert.Equal(new BigInteger(10), wallet.balanceOf(1, engine.Native.NEO.Hash));

            wallet.createRequest(1, alice, recipient, engine.Native.NEO.Hash, 4, "neo payout");
            wallet.approve(1, alice);
            engine.SetTransactionSigners(bob);
            wallet.approve(1, bob);

            Assert.Equal(new BigInteger(4), engine.Native.NEO.BalanceOf(recipient));
            Assert.Equal(new BigInteger(6), wallet.balanceOf(1, engine.Native.NEO.Hash));
            Assert.Equal(new BigInteger(6), engine.Native.NEO.BalanceOf(wallet.Hash));
        }

        [Fact]
        public void Multisig_GuardsRejectUnauthorizedActions()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppMultisig");
            var wallet = engine.Deploy<MultisigContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            var bob = TestEngine.GetNewSigner().Account;
            var stranger = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 0, 10L * GAS);

            // Vault construction guards.
            engine.SetTransactionSigners(alice);
            AssertRevert("signer count out of range", () => wallet.createVault(alice, new[] { alice }, 1));
            AssertRevert("invalid threshold", () => wallet.createVault(alice, new[] { alice, bob }, 3));
            AssertRevert("duplicate signer", () => wallet.createVault(alice, new[] { alice, alice }, 2));

            wallet.createVault(alice, new[] { alice, bob }, 2);

            // NOTE: the "vault not found" deposit guard ABORTs inside OnNEP17Payment
            // mid-GAS.Transfer, which the TestEngine host cannot unwind (it hangs
            // natively), so transfer-time reverts are exercised on-chain rather
            // than here. Direct entrypoint reverts below are safely catchable.
            engine.Native.GAS.Transfer(alice, wallet.Hash, 3L * GAS, (BigInteger)1);

            // Requests: only vault signers, only up to the vault balance.
            AssertRevert("amount exceeds vault balance", () =>
                wallet.createRequest(1, alice, stranger, engine.Native.GAS.Hash, 4L * GAS, ""));
            engine.SetTransactionSigners(stranger);
            AssertRevert("creator not a vault signer", () =>
                wallet.createRequest(1, stranger, stranger, engine.Native.GAS.Hash, 1L * GAS, ""));

            engine.SetTransactionSigners(alice);
            wallet.createRequest(1, alice, stranger, engine.Native.GAS.Hash, 1L * GAS, "");

            // Approvals and cancels: vault signers only (MP-D-04 widened cancel
            // from creator-only to any signer; strangers stay locked out).
            engine.SetTransactionSigners(stranger);
            AssertRevert("not a signer", () => wallet.approve(1, stranger));
            AssertRevert("only a vault signer can cancel", () => wallet.cancel(1, stranger));

            engine.SetTransactionSigners(alice);
            wallet.cancel(1, alice);
            AssertRevert("request not pending", () => wallet.approve(1, alice));

            // The cancelled request released nothing: funds stay custodied.
            Assert.Equal(new BigInteger(3L * GAS), wallet.balanceOf(1, engine.Native.GAS.Hash));
            Assert.Equal(new BigInteger(3L * GAS), engine.Native.GAS.BalanceOf(wallet.Hash));
        }

        // MP-D-04: cancel was creator-only, so a stuck request could never be
        // cleared when the creator key was lost. Any vault signer may now cancel
        // a pending request.
        [Fact]
        public void Multisig_NonCreatorSignerCanCancelPendingRequest()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppMultisig");
            var wallet = engine.Deploy<MultisigContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            var bob = TestEngine.GetNewSigner().Account;
            var recipient = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 0, 10L * GAS);

            engine.SetTransactionSigners(alice);
            wallet.createVault(alice, new[] { alice, bob }, 2);
            engine.Native.GAS.Transfer(alice, wallet.Hash, 3L * GAS, (BigInteger)1);
            wallet.createRequest(1, alice, recipient, engine.Native.GAS.Hash, 1L * GAS, "alice's request");

            // Bob is a vault signer but NOT the creator — he can clear it now.
            engine.SetTransactionSigners(bob);
            wallet.cancel(1, bob);

            AssertRevert("request not pending", () => wallet.approve(1, bob));
            Assert.Equal(BigInteger.Zero, engine.Native.GAS.BalanceOf(recipient));
            Assert.Equal(new BigInteger(3L * GAS), wallet.balanceOf(1, engine.Native.GAS.Hash));
        }

        // MP-D-04: two pending requests can each be within balance at creation but
        // collectively exceed it. Once one executes, the other's threshold-reaching
        // approval used to ASSERT ("vault balance insufficient at execution"),
        // reverting every finalizing signer forever and pinning the request in
        // PENDING. It must instead mark the request CANCELLED gracefully.
        [Fact]
        public void Multisig_UnfundedExecutionCancelsGracefullyInsteadOfReverting()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppMultisig");
            var wallet = engine.Deploy<MultisigContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            var bob = TestEngine.GetNewSigner().Account;
            var recipient1 = TestEngine.GetNewSigner().Account;
            var recipient2 = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 0, 10L * GAS);

            engine.SetTransactionSigners(alice);
            wallet.createVault(alice, new[] { alice, bob }, 2);
            engine.Native.GAS.Transfer(alice, wallet.Hash, 3L * GAS, (BigInteger)1);

            // Both requests individually fit the 3 GAS balance; together they don't.
            wallet.createRequest(1, alice, recipient1, engine.Native.GAS.Hash, 3L * GAS, "first");
            wallet.createRequest(1, alice, recipient2, engine.Native.GAS.Hash, 3L * GAS, "second");
            wallet.approve(1, alice);
            wallet.approve(2, alice);

            // Request 1 executes at threshold and drains the vault.
            engine.SetTransactionSigners(bob);
            wallet.approve(1, bob);
            Assert.Equal(new BigInteger(3L * GAS), engine.Native.GAS.BalanceOf(recipient1));
            Assert.Equal(BigInteger.Zero, wallet.balanceOf(1, engine.Native.GAS.Hash));

            // Request 2's finalizing approval can no longer be funded. The old
            // code FAULTed here; it must now succeed and retire the request.
            wallet.approve(2, bob);
            Assert.True(wallet.hasApproved(2, bob));

            // Retired, not executed: nothing was paid out and the request takes
            // no further approvals. The vault stays exactly solvent.
            Assert.Equal(BigInteger.Zero, engine.Native.GAS.BalanceOf(recipient2));
            engine.SetTransactionSigners(alice);
            AssertRevert("request not pending", () => wallet.approve(2, alice));
            Assert.Equal(BigInteger.Zero, wallet.balanceOf(1, engine.Native.GAS.Hash));
            Assert.Equal(BigInteger.Zero, engine.Native.GAS.BalanceOf(wallet.Hash));
        }
    }
}
