using System;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Manifest;
using Neo.SmartContract.Testing;
using Xunit;
using static NeoMiniAppPlatform.Contracts.Tests.RegistryHarness;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    // Account-minting suite: the timelocked canonical artifact, the REAL
    // in-engine ContractManagement.Deploy mint, the measured-hash agreement
    // (tx.Sender semantics, PlatformRegistryHashSemanticsTests), the
    // bindRegistry handshake + reverse index, the manifest-splice fuzz
    // rule, and the double-consent shim upgrade (design section 4.1).
    public class PlatformRegistryMintTests
    {
        [Fact]
        public void Artifact_TimelockedSeedWithChecksumPin()
        {
            var ctx = Deploy();
            var (nef, head, tail, checksum) = LoadAccountArtifact();

            // Admin-gated propose; execute only after the 24h timelock.
            var stranger = TestEngine.GetNewSigner().Account;
            As(ctx, stranger);
            AssertRevert("unauthorized", () => ctx.Registry.proposeAppAccountArtifact(nef, head, tail));
            AsAdmin(ctx);
            AssertRevert("no pending artifact", () => ctx.Registry.setAppAccountArtifact());
            ctx.Registry.proposeAppAccountArtifact(nef, head, tail);
            AssertRevert("timelock active", () => ctx.Registry.setAppAccountArtifact());
            AdvanceMs(ctx, TIMELOCK_MS + 1_000);
            ctx.Registry.setAppAccountArtifact();

            Assert.Equal(BigInteger.One, ctx.Registry.artifactVersion());
            // The stored checksum is pinned byte-exactly to the committed NEF.
            Assert.Equal(new BigInteger(checksum), ctx.Registry.artifactChecksum());
        }

        [Fact]
        public void Artifact_MalformedTemplatesRejectedAtProposeTime()
        {
            var ctx = Deploy();
            var (nef, head, tail, _) = LoadAccountArtifact();
            AsAdmin(ctx);

            // NEF gate: magic bytes checked before anything is stored.
            AssertRevert("invalid nef magic",
                () => ctx.Registry.proposeAppAccountArtifact(new byte[] { 1, 2, 3, 4, 5, 6, 7, 8 }, head, tail));

            // Halves that do not frame the manifest name are rejected.
            AssertRevert("first half must end at the manifest name",
                () => ctx.Registry.proposeAppAccountArtifact(nef, head.Substring(0, head.Length - 1), tail));
            AssertRevert("second half must open with the name-closing quote",
                () => ctx.Registry.proposeAppAccountArtifact(nef, head, tail.Substring(1)));

            // A structurally broken template FAULTs the trial splice: the
            // malformed artifact can never become active, so it can never
            // brick minting (section 4.1 fuzz rule).
            string brokenTail = tail.Substring(0, tail.Length - 1); // drop closing brace
            Assert.ThrowsAny<Exception>(() => ctx.Registry.proposeAppAccountArtifact(nef, head, brokenTail));
            string truncatedHead = "{\"garbage\":\"" + "\"name\":\"";
            Assert.ThrowsAny<Exception>(() => ctx.Registry.proposeAppAccountArtifact(nef, truncatedHead, tail));

            // Nothing leaked into the active slot.
            Assert.Equal(BigInteger.Zero, ctx.Registry.artifactVersion());
        }

        [Fact]
        public void ManifestSplice_FuzzedValidAppIdsAlwaysParse()
        {
            // C#-side fuzz of the same splice the contract performs at mint:
            // for every valid appId shape the spliced manifest must parse and
            // round-trip the name — so no registrable appId can produce an
            // artifact ContractManagement.Deploy would refuse.
            var (_, head, tail, _) = LoadAccountArtifact();
            var random = new Random(0x5EED);
            const string alphabet = "abcdefghijklmnopqrstuvwxyz0123456789-_.";
            for (int i = 0; i < 200; i++)
            {
                int length = random.Next(1, 65);
                char[] chars = new char[length];
                for (int j = 0; j < length; j++) chars[j] = alphabet[random.Next(alphabet.Length)];
                string appId = new string(chars);
                var manifest = ContractManifest.Parse(head + appId + tail);
                Assert.Equal(appId, manifest.Name);
            }
        }

        [Fact]
        public void MintAccount_RealDeploy_MeasuredHash_Handshake_ReverseIndex()
        {
            var ctx = Deploy();
            SetArtifact(ctx);
            var appAdmin = TestEngine.GetNewSigner().Account;
            FundGas(ctx, appAdmin, 20 * GAS_UNIT);
            DepositCredit(ctx, appAdmin, "mint-app", 12 * GAS_UNIT);

            As(ctx, appAdmin);
            ctx.Registry.registerApp("mint-app", "", appAdmin, null);
            ctx.Registry.mintAccount("mint-app");

            // Fees: 1 GAS lite + 10 GAS mint consumed from prepaid credit.
            Assert.Equal(new BigInteger(GAS_UNIT), ctx.Registry.creditOf("mint-app", appAdmin));
            Assert.Equal(new BigInteger(FEE_LITE + FEE_MINT), ctx.Registry.accruedFees());

            UInt160 account = ctx.Registry.appAccountOf("mint-app")!;
            Assert.NotEqual(UInt160.Zero, account);

            // MEASURED-HASH AGREEMENT: the deployed hash folds the TRANSACTION
            // SENDER (the minting app admin), never the registry contract.
            var (_, _, _, checksum) = LoadAccountArtifact();
            Assert.Equal(Neo.SmartContract.Helper.GetContractHash(appAdmin, checksum, "mint-app"), account);
            Assert.NotEqual(Neo.SmartContract.Helper.GetContractHash(ctx.Registry.Hash, checksum, "mint-app"), account);

            // Advisory on-chain prediction agrees with neo-core and reality.
            Assert.Equal(account, ctx.Registry.predictedAccountHash(appAdmin, "mint-app"));

            // Reverse index + directory row record the ACTUAL hash.
            Assert.Equal("mint-app", ctx.Registry.appIdOfAccount(account));
            var row = ctx.Registry.getApp("mint-app")!;
            Assert.Equal(account, AsHash(row[3]));
            Assert.True(AsBool(row[4]));

            // The minted shim carries the handshake-verified local identity.
            var shim = ctx.Engine.FromHash<AppAccountContract>(account, false);
            Assert.Equal("mint-app", shim.appIdOf());
            Assert.Equal(ctx.Registry.Hash, shim.registryOf());
            Assert.Equal(appAdmin, shim.adminOf());

            // One account per app: identity is unique.
            AssertRevert("account already minted", () => ctx.Registry.mintAccount("mint-app"));
        }

        [Fact]
        public void MintAccount_Gates()
        {
            var ctx = Deploy();
            var appAdmin = TestEngine.GetNewSigner().Account;
            AsAdmin(ctx);
            ctx.Registry.registerAppByPlatform("gate-mint", "", appAdmin, null);

            // No artifact yet: even the platform lane cannot mint.
            AssertRevert("account artifact not set", () => ctx.Registry.mintAccount("gate-mint"));
            SetArtifact(ctx);

            // Strangers cannot mint someone else's account.
            var stranger = TestEngine.GetNewSigner().Account;
            As(ctx, stranger);
            AssertRevert("app admin witness required", () => ctx.Registry.mintAccount("gate-mint"));

            // App-admin lane needs the 10 GAS mint fee prepaid.
            FundGas(ctx, appAdmin, 5 * GAS_UNIT);
            DepositCredit(ctx, appAdmin, "gate-mint", 2 * GAS_UNIT);
            As(ctx, appAdmin);
            AssertRevert("insufficient credit", () => ctx.Registry.mintAccount("gate-mint"));

            // Unregistered apps have nothing to mint.
            AsAdmin(ctx);
            AssertRevert("appId not registered", () => ctx.Registry.mintAccount("ghost-app"));

            // The global kill switch freezes minting (not an exit lane).
            ctx.Registry.setGlobalPaused(true);
            AssertRevert("registry paused", () => ctx.Registry.mintAccount("gate-mint"));
            ctx.Registry.setGlobalPaused(false);

            // Platform pipeline lane mints fee-exempt.
            ctx.Registry.mintAccount("gate-mint");
            Assert.Equal(new BigInteger(2 * GAS_UNIT), ctx.Registry.creditOf("gate-mint", appAdmin));
            Assert.Equal(BigInteger.Zero, ctx.Registry.accruedFees());
        }

        [Fact]
        public void MintAccount_EdgeAppIdsSpliceAndDeploy()
        {
            var ctx = Deploy();
            SetArtifact(ctx);
            AsAdmin(ctx);
            string[] edgeIds = { "a", "dot.dash-under_score9", new string('z', 64) };
            var (_, _, _, checksum) = LoadAccountArtifact();
            foreach (string appId in edgeIds)
            {
                var appAdmin = TestEngine.GetNewSigner().Account;
                ctx.Registry.registerAppByPlatform(appId, "", appAdmin, null);
                UInt160 account = ctx.Registry.mintAccount(appId)!;
                Assert.Equal(Neo.SmartContract.Helper.GetContractHash(ctx.PlatformAdmin, checksum, appId), account);
                Assert.Equal(appId, ctx.Registry.appIdOfAccount(account));
                var shim = ctx.Engine.FromHash<AppAccountContract>(account, false);
                Assert.Equal(appId, shim.appIdOf());
            }
        }

        [Fact]
        public void PredictedAccountHash_AgreesWithNeoCoreDerivation()
        {
            var ctx = Deploy();
            AsAdmin(ctx);
            AssertRevert("account artifact not set",
                () => ctx.Registry.predictedAccountHash(ctx.PlatformAdmin, "any-app"));
            SetArtifact(ctx);

            var (_, _, _, checksum) = LoadAccountArtifact();
            string[] names = { "a", "app-1", "dot.dash-under_score9", new string('q', 64) };
            UInt160[] senders = { ctx.PlatformAdmin, TestEngine.GetNewSigner().Account };
            foreach (var sender in senders)
            {
                foreach (var name in names)
                {
                    Assert.Equal(
                        Neo.SmartContract.Helper.GetContractHash(sender, checksum, name),
                        ctx.Registry.predictedAccountHash(sender, name));
                }
            }
        }

        [Fact]
        public void UpgradeAppAccount_RequiresDoubleConsent()
        {
            var ctx = Deploy();
            SetArtifact(ctx);                       // artifact version 1
            var appAdmin = TestEngine.GetNewSigner().Account;
            AsAdmin(ctx);
            ctx.Registry.registerAppByPlatform("upg-app", "", appAdmin, null);
            UInt160 account = ctx.Registry.mintAccount("upg-app")!;

            // Platform admin alone cannot propose the repave (objection 7):
            // the app's consent flag must be present first.
            AssertRevert("app consent required", () => ctx.Registry.proposeUpgradeAppAccount("upg-app"));

            // Consent is the app admin's own flag.
            AssertRevert("unauthorized: not app admin", () => ctx.Registry.setShimUpgradeConsent("upg-app", true));
            As(ctx, appAdmin);
            ctx.Registry.setShimUpgradeConsent("upg-app", true);
            Assert.True(ctx.Registry.shimUpgradeConsentOf("upg-app"));

            // The propose/execute lane is platform-admin gated and 24h-timelocked.
            AssertRevert("unauthorized", () => ctx.Registry.proposeUpgradeAppAccount("upg-app"));
            AsAdmin(ctx);
            ctx.Registry.proposeUpgradeAppAccount("upg-app");
            AssertRevert("timelock active", () => ctx.Registry.upgradeAppAccount("upg-app"));
            AdvanceMs(ctx, TIMELOCK_MS + 1_000);

            // The app admin alone cannot execute either — platform-admin gated.
            As(ctx, appAdmin);
            AssertRevert("unauthorized", () => ctx.Registry.upgradeAppAccount("upg-app"));

            // Both consents present + timelock matured: the relay updates the
            // shim in place and local identity survives (no re-init).
            AsAdmin(ctx);
            ctx.Registry.upgradeAppAccount("upg-app");
            var shim = ctx.Engine.FromHash<AppAccountContract>(account, false);
            Assert.Equal("upg-app", shim.appIdOf());
            Assert.Equal(appAdmin, shim.adminOf());

            // Consent is one-shot: the next upgrade needs a fresh flag.
            Assert.False(ctx.Registry.shimUpgradeConsentOf("upg-app"));
            AssertRevert("app consent required", () => ctx.Registry.proposeUpgradeAppAccount("upg-app"));
        }

        [Fact]
        public void ShimUpgradeConsent_StaleVersion_Faults()
        {
            // EXPLOIT (finding 2): consent was a version-unbound boolean. The
            // app admin consents while artifact v1 is active; the platform
            // activates a DIFFERENT artifact (v2); the upgrade then applies v2
            // on the stale consent (TOCTOU). The fix binds consent to the
            // artifact version, so the stale-consent upgrade faults.
            var ctx = Deploy();
            SetArtifact(ctx);                       // artifact version 1
            var appAdmin = TestEngine.GetNewSigner().Account;
            AsAdmin(ctx);
            ctx.Registry.registerAppByPlatform("stale-app", "", appAdmin, null);
            ctx.Registry.mintAccount("stale-app");

            // App admin consents while v1 is active.
            As(ctx, appAdmin);
            ctx.Registry.setShimUpgradeConsent("stale-app", true);

            // Platform activates a different artifact -> version 2.
            SetArtifact(ctx);
            Assert.Equal(new BigInteger(2), ctx.Registry.artifactVersion());

            // The stale consent (for v1) must not authorize a v2 upgrade.
            AsAdmin(ctx);
            AssertRevert("consent stale", () => ctx.Registry.upgradeAppAccount("stale-app"));
        }

        [Fact]
        public void UpgradeAppAccount_MidTimelockArtifactSwap_FaultsAtExecute()
        {
            // The TOCTOU variant: consent + propose happen while v1 is active,
            // then the platform activates v2 DURING the upgrade timelock. At
            // execute the applied version no longer matches the consent.
            var ctx = Deploy();
            SetArtifact(ctx);                       // artifact version 1
            var appAdmin = TestEngine.GetNewSigner().Account;
            AsAdmin(ctx);
            ctx.Registry.registerAppByPlatform("swap-app", "", appAdmin, null);
            ctx.Registry.mintAccount("swap-app");

            As(ctx, appAdmin);
            ctx.Registry.setShimUpgradeConsent("swap-app", true);   // consent for v1
            AsAdmin(ctx);
            ctx.Registry.proposeUpgradeAppAccount("swap-app");      // proposed while v1 active

            // Activating a new artifact bumps the version (and matures the
            // upgrade timelock); the stale-consent guard still fires at execute.
            SetArtifact(ctx);                       // artifact version 2
            AssertRevert("consent stale", () => ctx.Registry.upgradeAppAccount("swap-app"));
        }

        [Fact]
        public void AppAdminRotation_PushesOnAdminRotatedIntoMintedShim()
        {
            var ctx = Deploy();
            SetArtifact(ctx);
            var appAdmin = TestEngine.GetNewSigner().Account;
            var nextAdmin = TestEngine.GetNewSigner().Account;
            AsAdmin(ctx);
            ctx.Registry.registerAppByPlatform("push-app", "", appAdmin, null);
            UInt160 account = ctx.Registry.mintAccount("push-app")!;

            As(ctx, appAdmin);
            ctx.Registry.proposeAppAdmin("push-app", nextAdmin);
            AdvanceMs(ctx, TIMELOCK_MS + 1_000);
            ctx.Registry.executeAppAdminChange("push-app");

            // The execute path pushed the rotation into the shim atomically:
            // the cached escape key can never drift stale (objection 5).
            Assert.Equal(nextAdmin, ctx.Registry.appAdminOf("push-app"));
            var shim = ctx.Engine.FromHash<AppAccountContract>(account, false);
            Assert.Equal(nextAdmin, shim.adminOf());
        }
    }
}
