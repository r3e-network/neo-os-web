using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Modules
{
    /// <summary>
    /// Universal on-chain leaderboard module that any miniapp instance can use.
    ///
    /// MULTI-TENANCY:
    /// All scores are namespaced by instance ID. A single deployed contract
    /// serves every miniapp instance that needs score tracking and ranking.
    ///
    /// SCORING MODES:
    /// - Additive (0): scores are accumulated (new score = old score + delta)
    /// - Maximum  (1): only the highest score is kept (new score = max(old, submitted))
    /// - Replace  (2): last submitted score wins (new score = submitted)
    ///
    /// DESIGN NOTES:
    /// On-chain sorting of unbounded sets is infeasible in Neo N3 due to GAS limits.
    /// This contract stores per-user scores and maintains a bounded top-N list
    /// (default: top 100). The top-N list is updated on each score submission by
    /// performing a single-pass insertion sort step. This guarantees O(N) cost per
    /// update where N is the leaderboard capacity.
    ///
    /// For leaderboards with thousands of participants, off-chain indexers should
    /// consume ScoreUpdated events and build full rankings. The on-chain top-N
    /// serves as a trust anchor and is sufficient for reward distribution.
    ///
    /// AUTHORIZATION MODEL:
    /// - Platform admin: full control
    /// - Instance controller (owner, operator, or registry caller): submit scores, reset board
    /// - Users can query their own score and the leaderboard
    ///
    /// STORAGE LAYOUT:
    /// - 0x01       admin address
    /// - 0x02       instance registry address
    /// - 0x10       instance config (per instance)
    /// - 0x20       user score (per instance + user)
    /// - 0x30       leaderboard entries serialized array (per instance)
    /// - 0x31       leaderboard entry count (per instance)
    /// </summary>
    [DisplayName("LeaderboardModule")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Universal instance-scoped on-chain leaderboard with configurable scoring")]
    [ContractPermission("*", "*")]
    public class LeaderboardModule : SmartContract
    {
        #region Storage Prefixes

        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_INSTANCE_REGISTRY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_INSTANCE_CONFIG = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_USER_SCORE = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_LEADERBOARD = new byte[] { 0x30 };
        private static readonly byte[] PREFIX_LEADERBOARD_COUNT = new byte[] { 0x31 };

        #endregion

        #region Constants

        /// <summary>Scoring mode: scores are accumulated.</summary>
        public const byte SCORING_ADDITIVE = 0;

        /// <summary>Scoring mode: only the highest score is kept.</summary>
        public const byte SCORING_MAXIMUM = 1;

        /// <summary>Scoring mode: last submitted score wins.</summary>
        public const byte SCORING_REPLACE = 2;

        /// <summary>Default leaderboard capacity (top N entries stored on-chain).</summary>
        private const int DEFAULT_CAPACITY = 100;

        /// <summary>Maximum allowed leaderboard capacity.</summary>
        private const int MAX_CAPACITY = 500;

        #endregion

        #region Data Structures

        public struct InstanceConfig
        {
            public string InstanceId;
            public UInt160 Owner;
            public UInt160 Operator;
            /// <summary>Scoring mode: 0 = additive, 1 = maximum, 2 = replace.</summary>
            public byte ScoringMode;
            /// <summary>Maximum entries in the on-chain top-N leaderboard.</summary>
            public int Capacity;
            public bool Active;
            public BigInteger UpdatedAt;
        }

        /// <summary>
        /// A single leaderboard entry. Stored in the on-chain top-N array.
        /// </summary>
        public struct LeaderboardEntry
        {
            public UInt160 User;
            public BigInteger Score;
        }

        #endregion

        #region Events

        [DisplayName("ScoreUpdated")]
        public static event Action<string, UInt160, BigInteger, BigInteger> OnScoreUpdated = delegate { };

        [DisplayName("LeaderboardReset")]
        public static event Action<string, UInt160> OnLeaderboardReset = delegate { };

        [DisplayName("InstanceInitialized")]
        public static event Action<string, UInt160, byte, int> OnInstanceInitialized = delegate { };

        [DisplayName("InstanceStatusChanged")]
        public static event Action<string, bool> OnInstanceStatusChanged = delegate { };

        [DisplayName("AdminChanged")]
        public static event Action<UInt160, UInt160> OnAdminChanged = delegate { };

        #endregion

        #region Lifecycle

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }

        public static void Update(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nef, manifest, new object[0]);
        }

        #endregion

        #region Internal Helpers

        private static UInt160 ReadAddress(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? UInt160.Zero : (UInt160)value;
        }

        private static void ValidateIdentifier(string value, string label)
        {
            string normalized = value ?? "";
            ExecutionEngine.Assert(normalized.Length > 0, label + " required");
            ExecutionEngine.Assert(normalized.Length <= 128, label + " too long");
        }

        private static void ValidateAddress(UInt160 value, string label)
        {
            ExecutionEngine.Assert(value != UInt160.Zero && value.IsValid, "invalid " + label);
        }

        private static UInt160 NormalizeOptionalAddress(UInt160 value)
        {
            if (value == UInt160.Zero) return UInt160.Zero;
            ExecutionEngine.Assert(value.IsValid, "invalid address");
            return value;
        }

        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        private static bool IsAdminWitness()
        {
            UInt160 admin = Admin();
            return admin != UInt160.Zero && admin.IsValid && Runtime.CheckWitness(admin);
        }

        private static bool IsRegistryCaller()
        {
            UInt160 registry = InstanceRegistry();
            return registry != UInt160.Zero && registry.IsValid && Runtime.CallingScriptHash == registry;
        }

        private static bool IsOperatorCaller(InstanceConfig config)
        {
            UInt160 op = config.Operator;
            return op != UInt160.Zero && op.IsValid && Runtime.CallingScriptHash == op;
        }

        private static bool IsInstanceController(InstanceConfig config)
        {
            return IsAdminWitness() ||
                   IsRegistryCaller() ||
                   (config.Owner != UInt160.Zero && Runtime.CheckWitness(config.Owner)) ||
                   IsOperatorCaller(config);
        }

        private static void RequireActiveInstance(InstanceConfig config)
        {
            ExecutionEngine.Assert(config.InstanceId.Length > 0, "instance not found");
            ExecutionEngine.Assert(config.Active, "instance inactive");
        }

        private static InstanceConfig EmptyConfig()
        {
            return new InstanceConfig
            {
                InstanceId = "",
                Owner = UInt160.Zero,
                Operator = UInt160.Zero,
                ScoringMode = SCORING_ADDITIVE,
                Capacity = DEFAULT_CAPACITY,
                Active = false,
                UpdatedAt = 0
            };
        }

        private static byte[] ConfigKey(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            return Helper.Concat(PREFIX_INSTANCE_CONFIG, (ByteString)(instanceId ?? ""));
        }

        private static byte[] UserScoreKey(string instanceId, UInt160 user)
        {
            return Helper.Concat(PREFIX_USER_SCORE,
                (ByteString)((instanceId ?? "") + "|" + (string)(ByteString)(byte[])user));
        }

        private static byte[] LeaderboardKey(string instanceId)
        {
            return Helper.Concat(PREFIX_LEADERBOARD, (ByteString)(instanceId ?? ""));
        }

        private static byte[] LeaderboardCountKey(string instanceId)
        {
            return Helper.Concat(PREFIX_LEADERBOARD_COUNT, (ByteString)(instanceId ?? ""));
        }

        private static BigInteger ReadBigInteger(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? 0 : (BigInteger)value;
        }

        /// <summary>
        /// Read the on-chain leaderboard array for an instance.
        /// Returns an empty array if none exists.
        /// </summary>
        private static LeaderboardEntry[] ReadLeaderboard(string instanceId)
        {
            ByteString? raw = Storage.Get(Storage.CurrentContext, LeaderboardKey(instanceId));
            if (raw == null || raw.Length == 0)
            {
                return new LeaderboardEntry[0];
            }
            return (LeaderboardEntry[])StdLib.Deserialize(raw);
        }

        private static void WriteLeaderboard(string instanceId, LeaderboardEntry[] entries)
        {
            byte[] key = LeaderboardKey(instanceId);
            if (entries.Length == 0)
            {
                Storage.Delete(Storage.CurrentContext, key);
                Storage.Delete(Storage.CurrentContext, LeaderboardCountKey(instanceId));
            }
            else
            {
                Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(entries));
                Storage.Put(Storage.CurrentContext, LeaderboardCountKey(instanceId), entries.Length);
            }
        }

        /// <summary>
        /// Compute the effective new score based on the scoring mode.
        /// </summary>
        private static BigInteger ComputeNewScore(byte mode, BigInteger currentScore, BigInteger scoreDelta)
        {
            if (mode == SCORING_ADDITIVE)
            {
                return currentScore + scoreDelta;
            }
            else if (mode == SCORING_MAXIMUM)
            {
                return scoreDelta > currentScore ? scoreDelta : currentScore;
            }
            else // SCORING_REPLACE
            {
                return scoreDelta;
            }
        }

        /// <summary>
        /// Insert or update a user in the top-N leaderboard.
        /// Single-pass O(capacity) insertion sort step.
        /// </summary>
        private static void UpdateTopN(string instanceId, int capacity, UInt160 user, BigInteger newScore)
        {
            LeaderboardEntry[] current = ReadLeaderboard(instanceId);

            // Find if user already exists in leaderboard
            int existingIndex = -1;
            for (int i = 0; i < current.Length; i++)
            {
                if (current[i].User == user)
                {
                    existingIndex = i;
                    break;
                }
            }

            // If user exists, update their score
            if (existingIndex >= 0)
            {
                current[existingIndex].Score = newScore;
                // Re-sort: bubble the entry to its correct position
                // Bubble up (score increased)
                for (int i = existingIndex; i > 0; i--)
                {
                    if (current[i].Score > current[i - 1].Score)
                    {
                        LeaderboardEntry temp = current[i];
                        current[i] = current[i - 1];
                        current[i - 1] = temp;
                    }
                    else
                    {
                        break;
                    }
                }
                // Bubble down (score decreased, possible in replace mode)
                for (int i = existingIndex; i < current.Length - 1; i++)
                {
                    if (current[i].Score < current[i + 1].Score)
                    {
                        LeaderboardEntry temp = current[i];
                        current[i] = current[i + 1];
                        current[i + 1] = temp;
                    }
                    else
                    {
                        break;
                    }
                }
                WriteLeaderboard(instanceId, current);
                return;
            }

            // User not in leaderboard -- check if they qualify
            if (current.Length < capacity)
            {
                // Space available: append and sort into position
                LeaderboardEntry[] expanded = new LeaderboardEntry[current.Length + 1];
                for (int i = 0; i < current.Length; i++)
                {
                    expanded[i] = current[i];
                }
                expanded[current.Length] = new LeaderboardEntry { User = user, Score = newScore };

                // Bubble into position
                for (int i = expanded.Length - 1; i > 0; i--)
                {
                    if (expanded[i].Score > expanded[i - 1].Score)
                    {
                        LeaderboardEntry temp = expanded[i];
                        expanded[i] = expanded[i - 1];
                        expanded[i - 1] = temp;
                    }
                    else
                    {
                        break;
                    }
                }
                WriteLeaderboard(instanceId, expanded);
            }
            else if (current.Length > 0 && newScore > current[current.Length - 1].Score)
            {
                // Board full but new score beats the lowest entry: replace last
                current[current.Length - 1] = new LeaderboardEntry { User = user, Score = newScore };

                // Bubble into position
                for (int i = current.Length - 1; i > 0; i--)
                {
                    if (current[i].Score > current[i - 1].Score)
                    {
                        LeaderboardEntry temp = current[i];
                        current[i] = current[i - 1];
                        current[i - 1] = temp;
                    }
                    else
                    {
                        break;
                    }
                }
                WriteLeaderboard(instanceId, current);
            }
            // else: board full and score does not qualify -- no-op
        }

        #endregion

        #region Safe Queries

        [Safe]
        public static UInt160 Admin()
        {
            return ReadAddress(PREFIX_ADMIN);
        }

        [Safe]
        public static UInt160 InstanceRegistry()
        {
            return ReadAddress(PREFIX_INSTANCE_REGISTRY);
        }

        [Safe]
        public static InstanceConfig GetInstanceConfig(string instanceId)
        {
            ByteString? raw = Storage.Get(Storage.CurrentContext, ConfigKey(instanceId));
            return raw == null ? EmptyConfig() : (InstanceConfig)StdLib.Deserialize(raw);
        }

        /// <summary>
        /// Get the absolute score for a user within an instance.
        /// </summary>
        [Safe]
        public static BigInteger GetScore(string instanceId, UInt160 user)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(user, "user");
            return ReadBigInteger(UserScoreKey(instanceId, user));
        }

        /// <summary>
        /// Get the rank (1-based) of a user within the on-chain top-N leaderboard.
        /// Returns 0 if user is not in the top-N.
        /// </summary>
        [Safe]
        public static BigInteger GetRank(string instanceId, UInt160 user)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(user, "user");

            LeaderboardEntry[] board = ReadLeaderboard(instanceId);
            for (int i = 0; i < board.Length; i++)
            {
                if (board[i].User == user)
                {
                    return i + 1;
                }
            }
            return 0; // Not in top-N
        }

        /// <summary>
        /// Get the top N entries from the leaderboard.
        /// If count exceeds the stored entries, returns all available.
        /// </summary>
        [Safe]
        public static LeaderboardEntry[] GetTopN(string instanceId, int count)
        {
            ValidateIdentifier(instanceId, "instance id");
            ExecutionEngine.Assert(count > 0, "count must be > 0");

            LeaderboardEntry[] board = ReadLeaderboard(instanceId);
            if (count >= board.Length) return board;

            LeaderboardEntry[] result = new LeaderboardEntry[count];
            for (int i = 0; i < count; i++)
            {
                result[i] = board[i];
            }
            return result;
        }

        /// <summary>
        /// Get the total number of entries currently on the leaderboard.
        /// </summary>
        [Safe]
        public static int GetLeaderboardSize(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            return (int)ReadBigInteger(LeaderboardCountKey(instanceId));
        }

        #endregion

        #region Instance Management

        /// <summary>
        /// Initialize or reconfigure a leaderboard instance.
        /// </summary>
        public static void InitializeInstance(
            string instanceId,
            UInt160 owner,
            UInt160 operatorAddress,
            byte scoringMode,
            int capacity)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(owner, "owner");
            ExecutionEngine.Assert(scoringMode <= SCORING_REPLACE, "invalid scoring mode");

            int normalizedCapacity = capacity > 0 ? capacity : DEFAULT_CAPACITY;
            ExecutionEngine.Assert(normalizedCapacity <= MAX_CAPACITY, "capacity exceeds maximum");

            InstanceConfig existing = GetInstanceConfig(instanceId);
            bool canInitialize = IsAdminWitness() || IsRegistryCaller();
            if (!canInitialize && existing.InstanceId.Length > 0)
            {
                canInitialize = IsInstanceController(existing);
            }
            ExecutionEngine.Assert(canInitialize, "unauthorized");

            InstanceConfig config = new InstanceConfig
            {
                InstanceId = instanceId,
                Owner = owner,
                Operator = NormalizeOptionalAddress(operatorAddress),
                ScoringMode = scoringMode,
                Capacity = normalizedCapacity,
                Active = existing.InstanceId.Length == 0 || existing.Active,
                UpdatedAt = Runtime.Time
            };

            Storage.Put(Storage.CurrentContext, ConfigKey(instanceId), StdLib.Serialize(config));
            OnInstanceInitialized(instanceId, owner, scoringMode, normalizedCapacity);
        }

        /// <summary>
        /// Activate or deactivate an instance.
        /// </summary>
        public static void SetInstanceActive(string instanceId, bool active)
        {
            InstanceConfig config = GetInstanceConfig(instanceId);
            ExecutionEngine.Assert(config.InstanceId.Length > 0, "instance not found");
            ExecutionEngine.Assert(IsInstanceController(config), "unauthorized");

            config.Active = active;
            config.UpdatedAt = Runtime.Time;
            Storage.Put(Storage.CurrentContext, ConfigKey(instanceId), StdLib.Serialize(config));
            OnInstanceStatusChanged(instanceId, active);
        }

        #endregion

        #region Score Operations

        /// <summary>
        /// Submit a score for a user. Only instance controller may call.
        ///
        /// The score delta is applied according to the instance's scoring mode:
        /// - Additive: new = current + scoreDelta
        /// - Maximum:  new = max(current, scoreDelta)
        /// - Replace:  new = scoreDelta
        /// </summary>
        public static void SubmitScore(string instanceId, UInt160 user, BigInteger scoreDelta)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(user, "user");
            ExecutionEngine.Assert(scoreDelta >= 0, "score delta cannot be negative");

            InstanceConfig config = GetInstanceConfig(instanceId);
            RequireActiveInstance(config);
            ExecutionEngine.Assert(IsInstanceController(config), "unauthorized: not instance controller");

            byte[] scoreKey = UserScoreKey(instanceId, user);
            BigInteger currentScore = ReadBigInteger(scoreKey);
            BigInteger newScore = ComputeNewScore(config.ScoringMode, currentScore, scoreDelta);

            // Persist user score
            Storage.Put(Storage.CurrentContext, scoreKey, newScore);

            // Update the on-chain top-N leaderboard
            UpdateTopN(instanceId, config.Capacity, user, newScore);

            OnScoreUpdated(instanceId, user, newScore, currentScore);
        }

        /// <summary>
        /// Increment a user's score by a positive delta.
        /// Convenience wrapper for additive scoring called by instance controller.
        /// Works regardless of scoring mode by using the underlying SubmitScore logic.
        /// </summary>
        public static void IncrementScore(string instanceId, UInt160 user, BigInteger delta)
        {
            ExecutionEngine.Assert(delta > 0, "delta must be > 0");
            SubmitScore(instanceId, user, delta);
        }

        /// <summary>
        /// Reset the entire leaderboard for an instance.
        /// Clears the on-chain top-N array. Individual user scores remain
        /// in storage for historical queries. Only instance controller may call.
        /// </summary>
        public static void ResetLeaderboard(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");

            InstanceConfig config = GetInstanceConfig(instanceId);
            ExecutionEngine.Assert(config.InstanceId.Length > 0, "instance not found");
            ExecutionEngine.Assert(IsInstanceController(config), "unauthorized");

            WriteLeaderboard(instanceId, new LeaderboardEntry[0]);
            OnLeaderboardReset(instanceId, Runtime.Transaction.Sender);
        }

        #endregion

        #region Admin Management

        public static void SetInstanceRegistry(UInt160 registry)
        {
            ValidateAdmin();
            UInt160 normalized = NormalizeOptionalAddress(registry);
            Storage.Put(Storage.CurrentContext, PREFIX_INSTANCE_REGISTRY, normalized);
        }

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ValidateAddress(newAdmin, "admin");
            UInt160 oldAdmin = Admin();
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
            OnAdminChanged(oldAdmin, newAdmin);
        }

        #endregion
    }
}
