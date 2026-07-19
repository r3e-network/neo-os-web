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
    // ABI binding for the PlatformRegistry spine (design section 3.1).
    public abstract class PlatformRegistryContract : SmartContract
    {
        protected PlatformRegistryContract(SmartContractInitialize initialize) : base(initialize) { }
        // governance
        public abstract UInt160? admin();
        public abstract void proposeAdmin(UInt160 newAdmin);
        public abstract void executeAdminChange();
        public abstract void cancelAdminChange();
        public abstract void scheduleUpdate(byte[] nefFile, string manifest);
        public abstract void update(byte[] nefFile, string manifest);
        public abstract void cancelUpdate();
        public abstract void setGlobalPaused(bool paused);
        public abstract object[]? getGlobalPause();
        public abstract void setAppPaused(string appId, bool paused);
        public abstract bool? isPaused(string appId);
        public abstract void proposeAppAdmin(string appId, UInt160 newAdmin);
        public abstract void executeAppAdminChange(string appId);
        public abstract void cancelAppAdminChange(string appId);
        // registration
        public abstract void registerApp(string appId, string engineId, UInt160 appAdmin, object? descriptor);
        public abstract void registerAppByPlatform(string appId, string engineId, UInt160 appAdmin, object? descriptor);
        public abstract void attachEngine(string appId, string engineId);
        // engine table
        public abstract void proposeEngine(string engineId, UInt160 engineHash, BigInteger schemaVersion);
        public abstract void registerEngine(string engineId);
        public abstract void proposeRetireEngine(string engineId);
        public abstract void retireEngine(string engineId);
        public abstract void cancelEnginePending(string engineId);
        public abstract object[]? getEngine(string engineId);
        public abstract string? engineIdOfHash(UInt160 engineHash);
        // accounts
        public abstract void proposeAppAccountArtifact(byte[] nef, string manifestFirstHalf, string manifestSecondHalf);
        public abstract void setAppAccountArtifact();
        public abstract void cancelAppAccountArtifact();
        public abstract UInt160? mintAccount(string appId);
        public abstract void setShimUpgradeConsent(string appId, bool consented);
        public abstract bool? shimUpgradeConsentOf(string appId);
        public abstract void upgradeAppAccount(string appId);
        public abstract BigInteger? artifactVersion();
        public abstract BigInteger? artifactChecksum();
        public abstract UInt160? predictedAccountHash(UInt160 deployerSender, string appId);
        // descriptor
        public abstract void setDescriptor(string appId, string key, object? value);
        public abstract void executeSpendThresholdRaise(string appId);
        public abstract void cancelSpendThresholdRaise(string appId);
        public abstract object? getDescriptor(string appId, string key);
        // credit + treasury
        public abstract void onNEP17Payment(UInt160? from, BigInteger amount, object? data);
        public abstract void withdrawCredit(string appId, BigInteger amount);
        public abstract BigInteger? creditOf(string appId, UInt160 payer);
        public abstract BigInteger? totalCreditLiability();
        public abstract BigInteger? accruedFees();
        public abstract void withdrawPlatformFees(BigInteger amount);
        public abstract void spendToPayout(string appId, UInt160 asset, BigInteger amount);
        public abstract void proposeSpend(string appId, UInt160 asset, BigInteger amount);
        public abstract void executeSpend(string appId);
        public abstract void cancelSpend(string appId);
        public abstract void fundEnginePool(string appId, BigInteger amount);
        public abstract void proposePayoutAddress(string appId, UInt160 value);
        public abstract void executePayoutAddress(string appId);
        public abstract void cancelPayoutAddress(string appId);
        public abstract UInt160? payoutAddressOf(string appId);
        public abstract BigInteger? spendThresholdOf(string appId);
        public abstract BigInteger? spentInWindow(string appId);
        public abstract bool? transitHopInProgress();
        // shim upgrade (version-bound consent + per-upgrade timelock)
        public abstract void proposeUpgradeAppAccount(string appId);
        public abstract void cancelUpgradeAppAccount(string appId);
        // directory
        public abstract object[]? getApp(string appId);
        public abstract UInt160? appAccountOf(string appId);
        public abstract string? appIdOfAccount(UInt160 account);
        public abstract string? engineOf(string appId);
        public abstract UInt160? appAdminOf(string appId);
    }

    // ABI binding for the in-engine engine counterparty fixture.
    public abstract class EngineMockContract : SmartContract
    {
        protected EngineMockContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract void setRegistry(UInt160 registry);
        public abstract void setRejectDescriptors(bool reject);
        public abstract BigInteger? activationCountOf(string appId);
        public abstract BigInteger? activationDescriptorKeysOf(string appId);
        public abstract UInt160? activatedAdminOf(string appId);
        public abstract object? appliedDescriptorOf(string appId, string key);
        public abstract BigInteger? poolCreditOf(string appId);
        public abstract string? lastPoolMemoOf(string appId);
        public abstract UInt160? lastPoolPayerOf(string appId);
    }

    // ABI binding for the hostile reentrant engine counterparty (finding 3).
    public abstract class ReentrantEngineMockContract : SmartContract
    {
        protected ReentrantEngineMockContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract void arm(UInt160 registry);
        public abstract BigInteger? observedHopInProgress();
        public abstract BigInteger? poolReceived();
    }

    // Shared deploy/setup helpers for the PlatformRegistry suites.
    internal static class RegistryHarness
    {
        public const long GAS_UNIT = 100_000_000;
        public const long TIMELOCK_MS = 86_400_000;
        public const long FEE_LITE = 1 * GAS_UNIT;
        public const long FEE_MINT = 10 * GAS_UNIT;
        public const string EngineId = "mock-engine";

        public static readonly string BuildDir = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "build"));

        public sealed class Ctx
        {
            public TestEngine Engine = null!;
            public PlatformRegistryContract Registry = null!;
            public EngineMockContract EngineMock = null!;
            public UInt160 PlatformAdmin = null!;
        }

        public static (NefFile nef, ContractManifest manifest) Load(string name)
        {
            string nefPath = Path.Combine(BuildDir, name + ".nef");
            string manifestPath = Path.Combine(BuildDir, name + ".manifest.json");
            Assert.True(File.Exists(nefPath), $"NEF missing: {nefPath}");
            return (NefFile.Parse(File.ReadAllBytes(nefPath)),
                    ContractManifest.Parse(File.ReadAllText(manifestPath)));
        }

        public static Ctx Deploy()
        {
            var engine = new TestEngine(true);
            // The registry NEF (~11KB) plus the stored AppAccount artifact and
            // in-engine account mints exceed the default per-invocation gas
            // budget; raise it so real ContractManagement.Deploy runs land.
            engine.Fee = 1_000L * GAS_UNIT;
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            var (regNef, regManifest) = Load("PlatformRegistry");
            var registry = engine.Deploy<PlatformRegistryContract>(regNef, regManifest);
            var (mockNef, mockManifest) = Load("EngineMockFixture");
            var engineMock = engine.Deploy<EngineMockContract>(mockNef, mockManifest);
            // The mock's activateApp / validateAndApplyDescriptor plumbing
            // (MiniAppEngineBase) asserts caller == the bound registry.
            engineMock.setRegistry(registry.Hash);
            return new Ctx
            {
                Engine = engine,
                Registry = registry,
                EngineMock = engineMock,
                PlatformAdmin = engine.ValidatorsAddress,
            };
        }

        public static void AdvanceMs(Ctx ctx, long ms) =>
            ctx.Engine.PersistingBlock.Advance(TimeSpan.FromMilliseconds(ms));

        public static void AsAdmin(Ctx ctx) =>
            ctx.Engine.SetTransactionSigners(ctx.PlatformAdmin);

        public static void As(Ctx ctx, UInt160 signer) =>
            ctx.Engine.SetTransactionSigners(signer);

        public static void FundGas(Ctx ctx, UInt160 to, BigInteger amount)
        {
            AsAdmin(ctx);
            bool? ok = ctx.Engine.Native.GAS.Transfer(ctx.Engine.ValidatorsAddress, to, amount, null);
            Assert.True(ok == true, "GAS funding transfer should succeed");
        }

        // Memo-routed prepaid credit deposit: 'appId:credit'.
        public static void DepositCredit(Ctx ctx, UInt160 payer, string appId, BigInteger amount)
        {
            As(ctx, payer);
            bool? ok = ctx.Engine.Native.GAS.Transfer(payer, ctx.Registry.Hash, amount, appId + ":credit");
            Assert.True(ok == true, "credit deposit transfer should succeed");
        }

        // Timelocked engine registration: propose -> advance -> execute.
        public static void RegisterEngine(Ctx ctx, string engineId, UInt160 engineHash, long schemaVersion = 1)
        {
            AsAdmin(ctx);
            ctx.Registry.proposeEngine(engineId, engineHash, schemaVersion);
            AdvanceMs(ctx, TIMELOCK_MS + 1_000);
            ctx.Registry.registerEngine(engineId);
        }

        // Split the committed AppAccount manifest into the two splice halves:
        // head ends with "name":" and tail opens with the closing quote.
        public static (byte[] nef, string head, string tail, uint checksum) LoadAccountArtifact()
        {
            string nefPath = Path.Combine(BuildDir, "AppAccount.nef");
            string manifestPath = Path.Combine(BuildDir, "AppAccount.manifest.json");
            Assert.True(File.Exists(nefPath), $"NEF missing: {nefPath}");
            byte[] nefBytes = File.ReadAllBytes(nefPath);
            uint checksum = NefFile.Parse(nefBytes).CheckSum;
            string json = ContractManifest.Parse(File.ReadAllText(manifestPath)).ToJson().ToString();
            const string marker = "\"name\":\"AppAccount\"";
            int i = json.IndexOf(marker, StringComparison.Ordinal);
            Assert.True(i >= 0, "AppAccount manifest name marker not found");
            string head = json.Substring(0, i + 8);
            string tail = json.Substring(i + 8 + "AppAccount".Length);
            return (nefBytes, head, tail, checksum);
        }

        // Timelocked artifact seeding: propose -> advance -> activate.
        public static void SetArtifact(Ctx ctx)
        {
            var (nef, head, tail, _) = LoadAccountArtifact();
            AsAdmin(ctx);
            ctx.Registry.proposeAppAccountArtifact(nef, head, tail);
            AdvanceMs(ctx, TIMELOCK_MS + 1_000);
            ctx.Registry.setAppAccountArtifact();
        }

        // Build a Map argument for Map<string,object> contract parameters:
        // the Testing arg emitter only understands ContractParameter for maps.
        public static ContractParameter VmMap(params (string Key, long Value)[] entries)
        {
            var pairs = new System.Collections.Generic.List<
                System.Collections.Generic.KeyValuePair<ContractParameter, ContractParameter>>();
            foreach (var (key, value) in entries)
            {
                pairs.Add(new(
                    new ContractParameter(ContractParameterType.String) { Value = key },
                    new ContractParameter(ContractParameterType.Integer) { Value = new BigInteger(value) }));
            }
            return new ContractParameter(ContractParameterType.Map) { Value = pairs };
        }

        public static void AssertRevert(string reason, Action act)
        {
            var ex = Assert.ThrowsAny<Exception>(act);
            Assert.Equal($"ABORTMSG is executed. Reason: {reason}", ex.Message);
        }

        // Members of a returned object[] arrive as raw VM stack items; these
        // converters accept both those and plain .NET values.
        public static string AsString(object? value) => value switch
        {
            null => "",
            string s => s,
            byte[] b => System.Text.Encoding.UTF8.GetString(b),
            Neo.VM.Types.Null => "",
            Neo.VM.Types.ByteString bs => bs.GetString() ?? "",
            _ => value.ToString() ?? "",
        };

        public static UInt160 AsHash(object? value) => value switch
        {
            UInt160 u => u,
            byte[] b when b.Length == 20 => new UInt160(b),
            Neo.VM.Types.ByteString bs when bs.Size == 20 => new UInt160(bs.GetSpan()),
            _ => UInt160.Zero,
        };

        public static bool AsBool(object? value) => value switch
        {
            bool b => b,
            BigInteger i => !i.IsZero,
            Neo.VM.Types.Boolean vb => vb.GetBoolean(),
            Neo.VM.Types.Integer vi => !vi.GetInteger().IsZero,
            _ => throw new InvalidOperationException($"not a bool: {value}"),
        };

        public static BigInteger AsInt(object? value) => value switch
        {
            BigInteger i => i,
            byte[] b => new BigInteger(b),
            bool b => b ? 1 : 0,
            Neo.VM.Types.Integer vi => vi.GetInteger(),
            Neo.VM.Types.Boolean vb => vb.GetBoolean() ? 1 : 0,
            Neo.VM.Types.ByteString bs => new BigInteger(bs.GetSpan()),
            _ => throw new InvalidOperationException($"not an integer: {value}"),
        };
    }
}
