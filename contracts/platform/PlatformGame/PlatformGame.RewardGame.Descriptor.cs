using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // ===================================================================
    //  PlatformGame — RewardGame descriptor lane + registry ABI
    //
    //  Economics are DESCRIPTOR DATA (design section 3.3): the registry
    //  pushes per-app keys ("<engineId>:entry0", ":reward1", ":dailyCap",
    //  ...) through activateApp at attachment time and
    //  validateAndApplyDescriptor afterwards. Both assert caller == the
    //  stored registry hash and range-validate every value engine-side —
    //  descriptor-driven economics turn config bugs into exploits unless
    //  the bounds live here, not in the registry. Unset keys fall back to
    //  the clone fleet's production constants (DefaultEconomics).
    // ===================================================================
    public partial class PlatformGameContract
    {
        // Descriptor value bounds (base units / ms / bps).
        private const long RG_MAX_ENTRY = 100_000_000_000;     // 1000 GAS
        private const long RG_MAX_REWARD = 100_000_000_000;    // 1000 GAS
        private const long RG_MIN_LIMIT_MS = 1_000;            // 1s
        private const long RG_MAX_LIMIT_MS = 3_600_000;        // 1h
        private const long RG_MAX_MIN_SOLVE_MS = 3_600_000;    // 1h
        private const long RG_MAX_TARGET_SCORE = 1_000_000;
        private const long RG_MAX_DAILY_CAP = 100;             // the clone SetDailyCap bound
        private const long RG_MAX_UNDO_PENALTY_BPS = 3333;     // x RG_MAX_UNDOS stays under 10000
        private const long RG_MIN_SETTLE_GRACE_MS = 60_000;    // 1min
        private const long RG_MAX_SETTLE_GRACE_MS = 86_400_000;// 24h

        #region Economics row
        public struct RewardEconomics
        {
            public BigInteger Entry0;
            public BigInteger Entry1;
            public BigInteger Entry2;
            public BigInteger Reward0;
            public BigInteger Reward1;
            public BigInteger Reward2;
            public BigInteger LimitMs0;
            public BigInteger LimitMs1;
            public BigInteger LimitMs2;
            public BigInteger MinSolveMs0;
            public BigInteger MinSolveMs1;
            public BigInteger MinSolveMs2;
            public BigInteger TargetScore0;
            public BigInteger TargetScore1;
            public BigInteger TargetScore2;
            public BigInteger DailyCap;
            public BigInteger UndoPenaltyBps;
            public BigInteger SettleGraceMs;
        }

        // The clone fleet's production constants, one canonical copy.
        private static RewardEconomics DefaultEconomics() => new RewardEconomics
        {
            Entry0 = 2_000_000, Entry1 = 10_000_000, Entry2 = 20_000_000,
            Reward0 = 10_000_000, Reward1 = 50_000_000, Reward2 = 100_000_000,
            LimitMs0 = 60_000, LimitMs1 = 90_000, LimitMs2 = 120_000,
            MinSolveMs0 = 10_000, MinSolveMs1 = 20_000, MinSolveMs2 = 30_000,
            TargetScore0 = 3, TargetScore1 = 5, TargetScore2 = 7,
            DailyCap = 8, UndoPenaltyBps = 3000, SettleGraceMs = 600_000,
        };

        private static RewardEconomics LoadEconomics(string appId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AppKey(appId, RG_PREFIX_ECONOMICS));
            if (raw is null) return DefaultEconomics();
            return (RewardEconomics)StdLib.Deserialize(raw);
        }

        private static BigInteger RewardEntryOf(RewardEconomics econ, BigInteger d)
        {
            if (d == 0) return econ.Entry0;
            if (d == 1) return econ.Entry1;
            return econ.Entry2;
        }

        private static BigInteger RewardBaseOf(RewardEconomics econ, BigInteger d)
        {
            if (d == 0) return econ.Reward0;
            if (d == 1) return econ.Reward1;
            return econ.Reward2;
        }

        private static BigInteger RewardLimitMsOf(RewardEconomics econ, BigInteger d)
        {
            if (d == 0) return econ.LimitMs0;
            if (d == 1) return econ.LimitMs1;
            return econ.LimitMs2;
        }

        private static BigInteger RewardMinSolveMsOf(RewardEconomics econ, BigInteger d)
        {
            if (d == 0) return econ.MinSolveMs0;
            if (d == 1) return econ.MinSolveMs1;
            return econ.MinSolveMs2;
        }

        private static BigInteger RewardTargetScoreOf(RewardEconomics econ, BigInteger d)
        {
            if (d == 0) return econ.TargetScore0;
            if (d == 1) return econ.TargetScore1;
            return econ.TargetScore2;
        }
        #endregion

        #region Registry ABI — activateApp / validateAndApplyDescriptor
        /// <summary>
        /// Registry push: attach (or re-attach) a RewardGame tenant. Only
        /// the stored PlatformRegistry may call this; re-activation refreshes
        /// the app admin and descriptor economics (the schema-upgrade path).
        /// A tenant row of another module is never hijacked.
        /// </summary>
        public static void ActivateApp(string appId, UInt160 appAdmin, Map<string, object> descriptor)
        {
            RequireRegistryCaller();
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "appId required");
            ExecutionEngine.Assert(appId.Length <= 64, "appId too long");
            ValidateAddress(appAdmin);

            BigInteger existing = GetGameType(appId);
            ExecutionEngine.Assert(existing == 0 || existing == GameType_RewardGame,
                "appId registered to another module");
            if (existing == 0)
            {
                Storage.Put(Storage.CurrentContext,
                    Helper.Concat((ByteString)PREFIX_GAME_TYPE, (ByteString)appId), GameType_RewardGame);
                Storage.Put(Storage.CurrentContext,
                    Helper.Concat((ByteString)PREFIX_GAME_ACTIVE, (ByteString)appId), 1);
            }
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_GAME_ADMIN, (ByteString)appId), appAdmin);

            if (descriptor != null)
            {
                string[] keys = descriptor.Keys;
                for (int i = 0; i < keys.Length; i++)
                {
                    ApplyRewardDescriptor(appId, keys[i], descriptor[keys[i]]);
                }
            }

            if (existing == 0) OnGameRegistered(appId, GameType_RewardGame, appAdmin);
        }

        /// <summary>
        /// Registry-forwarded descriptor write: range-validated engine-side,
        /// then applied to the app's economics row (the registry keeps its
        /// own directory copy, persisted before forwarding).
        /// </summary>
        public static void ValidateAndApplyDescriptor(string appId, string key, object value)
        {
            RequireRegistryCaller();
            RequireRegistered(appId);
            RequireGameType(appId, GameType_RewardGame);
            ApplyRewardDescriptor(appId, key, value);
        }

        private static new void RequireRegistryCaller()
        {
            UInt160 registry = Registry();
            ExecutionEngine.Assert(registry != UInt160.Zero && registry.IsValid, "registry not set");
            ExecutionEngine.Assert(Runtime.CallingScriptHash == registry, "registry only");
        }

        // The registry's pause view of this appId (global OR per-app) gates
        // new game starts; exits never consult it. No-op while unbound.
        private static new void RequireRegistryNotPaused(string appId)
        {
            UInt160 registry = Registry();
            if (registry == UInt160.Zero || !registry.IsValid) return;
            bool paused = (bool)Contract.Call(registry, "isPaused", CallFlags.ReadOnly, appId);
            ExecutionEngine.Assert(!paused, "registry paused");
        }
        #endregion

        #region Descriptor application + range validation
        private static void ApplyRewardDescriptor(string appId, string key, object value)
        {
            string param = RewardDescriptorParam(key);
            BigInteger v = (BigInteger)value;
            RewardEconomics econ = LoadEconomics(appId);

            int d;
            if ((d = DifficultyKeyOf(param, "entry")) >= 0)
            {
                ExecutionEngine.Assert(v >= 0 && v <= RG_MAX_ENTRY, "entry out of range");
                if (d == 0) econ.Entry0 = v; else if (d == 1) econ.Entry1 = v; else econ.Entry2 = v;
            }
            else if ((d = DifficultyKeyOf(param, "reward")) >= 0)
            {
                ExecutionEngine.Assert(v >= 0 && v <= RG_MAX_REWARD, "reward out of range");
                if (d == 0) econ.Reward0 = v; else if (d == 1) econ.Reward1 = v; else econ.Reward2 = v;
            }
            else if ((d = DifficultyKeyOf(param, "limitMs")) >= 0)
            {
                ExecutionEngine.Assert(v >= RG_MIN_LIMIT_MS && v <= RG_MAX_LIMIT_MS, "limitMs out of range");
                if (d == 0) econ.LimitMs0 = v; else if (d == 1) econ.LimitMs1 = v; else econ.LimitMs2 = v;
            }
            else if ((d = DifficultyKeyOf(param, "minSolveMs")) >= 0)
            {
                ExecutionEngine.Assert(v >= 0 && v <= RG_MAX_MIN_SOLVE_MS, "minSolveMs out of range");
                if (d == 0) econ.MinSolveMs0 = v; else if (d == 1) econ.MinSolveMs1 = v; else econ.MinSolveMs2 = v;
            }
            else if ((d = DifficultyKeyOf(param, "targetScore")) >= 0)
            {
                ExecutionEngine.Assert(v >= 1 && v <= RG_MAX_TARGET_SCORE, "targetScore out of range");
                if (d == 0) econ.TargetScore0 = v; else if (d == 1) econ.TargetScore1 = v; else econ.TargetScore2 = v;
            }
            else if (ParamEquals(param, "dailyCap"))
            {
                ExecutionEngine.Assert(v >= 1 && v <= RG_MAX_DAILY_CAP, "dailyCap out of range");
                econ.DailyCap = v;
            }
            else if (ParamEquals(param, "undoPenaltyBps"))
            {
                ExecutionEngine.Assert(v >= 0 && v <= RG_MAX_UNDO_PENALTY_BPS, "undoPenaltyBps out of range");
                econ.UndoPenaltyBps = v;
            }
            else if (ParamEquals(param, "settleGraceMs"))
            {
                ExecutionEngine.Assert(v >= RG_MIN_SETTLE_GRACE_MS && v <= RG_MAX_SETTLE_GRACE_MS,
                    "settleGraceMs out of range");
                econ.SettleGraceMs = v;
            }
            else
            {
                ExecutionEngine.Assert(false, "unknown descriptor key");
            }

            // Cross-field consistency: a game must remain winnable, so the
            // solve floor never exceeds the time limit on any difficulty.
            ExecutionEngine.Assert(econ.MinSolveMs0 <= econ.LimitMs0
                && econ.MinSolveMs1 <= econ.LimitMs1
                && econ.MinSolveMs2 <= econ.LimitMs2,
                "minSolveMs above limitMs");
            Storage.Put(Storage.CurrentContext, AppKey(appId, RG_PREFIX_ECONOMICS), StdLib.Serialize(econ));
        }

        // Descriptor-key matching is done CHAR BY CHAR: string == against a
        // literal silently mis-compares on Substring-derived values under
        // nccs --optimize=All (caught by the descriptor suites). The char
        // primitives are the ones the registry's memo parsing relies on.

        /// <summary>param is "stem" + one digit 0..2; returns the digit or -1.</summary>
        private static int DifficultyKeyOf(string param, string stem)
        {
            if (param.Length != stem.Length + 1) return -1;
            for (int i = 0; i < stem.Length; i++)
            {
                if (param[i] != stem[i]) return -1;
            }
            int d = param[param.Length - 1] - '0';
            return d >= 0 && d <= 2 ? d : -1;
        }

        /// <summary>Ordinal content equality, compared character by character.</summary>
        private static bool ParamEquals(string param, string literal)
        {
            if (param.Length != literal.Length) return false;
            for (int i = 0; i < literal.Length; i++)
            {
                if (param[i] != literal[i]) return false;
            }
            return true;
        }

        // Descriptor keys arrive namespaced ("<engineId>:param"); the
        // engine validates the param half — the namespace half is the
        // registry's grammar, enforced before it forwards.
        private static string RewardDescriptorParam(string key)
        {
            ExecutionEngine.Assert(key != null && key.Length > 0, "invalid descriptor key");
            for (int i = 0; i < key.Length; i++)
            {
                if (key[i] == ':')
                {
                    string param = key.Substring(i + 1, key.Length - i - 1);
                    ExecutionEngine.Assert(param.Length > 0, "invalid descriptor key");
                    return param;
                }
            }
            ExecutionEngine.Assert(false, "invalid descriptor key");
            return "";
        }
        #endregion
    }
}
