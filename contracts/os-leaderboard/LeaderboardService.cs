using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.OS
{
    public delegate void ScoreUpdatedHandler(string appId, UInt160 user, BigInteger newScore, BigInteger previousScore);
    public delegate void LeaderboardResetHandler(string appId, UInt160 resetBy);
    public delegate void LeaderboardConfiguredHandler(string appId, byte scoringMode, int capacity);
    public delegate void LeaderboardAdminChangedHandler(UInt160 oldAdmin, UInt160 newAdmin);

    [DisplayName("LeaderboardService")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "OS LeaderboardService — app-scoped on-chain leaderboard with configurable scoring")]
    [ContractPermission("*", "*")]
    public class LeaderboardService : SmartContract
    {
        // ── Storage Prefixes ──────────────────────────────────────────────
        private static readonly byte[] PREFIX_ADMIN             = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_SCRIPT_ENGINE     = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_APP_CONFIG        = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_USER_SCORE        = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_LEADERBOARD       = new byte[] { 0x30 };
        private static readonly byte[] PREFIX_LEADERBOARD_COUNT = new byte[] { 0x31 };

        // ── Constants ─────────────────────────────────────────────────────
        public const byte SCORING_ADDITIVE = 0;
        public const byte SCORING_MAXIMUM  = 1;
        public const byte SCORING_REPLACE  = 2;

        private const int DEFAULT_CAPACITY = 100;
        private const int MAX_CAPACITY     = 500;

        // ── Structs ───────────────────────────────────────────────────────

        public struct AppConfig
        {
            public string AppId;
            public byte ScoringMode;
            public int Capacity;
            public bool Active;
            public BigInteger UpdatedAt;
        }

        public struct LeaderboardEntry
        {
            public UInt160 User;
            public BigInteger Score;
        }

        // ── Events ────────────────────────────────────────────────────────
        [DisplayName("ScoreUpdated")]
        public static event ScoreUpdatedHandler OnScoreUpdated = delegate { };

        [DisplayName("LeaderboardReset")]
        public static event LeaderboardResetHandler OnLeaderboardReset = delegate { };

        [DisplayName("LeaderboardConfigured")]
        public static event LeaderboardConfiguredHandler OnLeaderboardConfigured = delegate { };

        [DisplayName("AdminChanged")]
        public static event LeaderboardAdminChangedHandler OnAdminChanged = delegate { };

        // ── Lifecycle ─────────────────────────────────────────────────────

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Transaction tx = Runtime.Transaction;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, tx.Sender);
        }

        public static void Update(ByteString nefFile, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nefFile, manifest, new object[0]);
        }

        // ── Admin Management ──────────────────────────────────────────────

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != UInt160.Zero && newAdmin.IsValid, "invalid admin");
            UInt160 oldAdmin = GetAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, (ByteString)newAdmin);
            OnAdminChanged(oldAdmin, newAdmin);
        }

        [Safe]
        public static UInt160 GetAdmin()
        {
            return ReadAddress(PREFIX_ADMIN);
        }

        public static void SetScriptEngine(UInt160 engine)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(engine != UInt160.Zero && engine.IsValid, "invalid engine");
            Storage.Put(Storage.CurrentContext, PREFIX_SCRIPT_ENGINE, (ByteString)engine);
        }

        // ── Configuration ─────────────────────────────────────────────────

        public static void Configure(string appId, byte scoringMode, int capacity)
        {
            ValidateAppId(appId);
            ValidateAdmin();
            ExecutionEngine.Assert(scoringMode <= SCORING_REPLACE, "invalid scoring mode");

            int normalizedCapacity = capacity > 0 ? capacity : DEFAULT_CAPACITY;
            ExecutionEngine.Assert(normalizedCapacity <= MAX_CAPACITY, "capacity exceeds maximum");

            AppConfig config = new AppConfig
            {
                AppId = appId,
                ScoringMode = scoringMode,
                Capacity = normalizedCapacity,
                Active = true,
                UpdatedAt = Runtime.Time
            };

            Storage.Put(Storage.CurrentContext, AppConfigKey(appId), StdLib.Serialize(config));
            OnLeaderboardConfigured(appId, scoringMode, normalizedCapacity);
        }

        // ── Score Operations ──────────────────────────────────────────────

        public static void SubmitScore(string appId, UInt160 user, BigInteger scoreDelta)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(user != UInt160.Zero && user.IsValid, "invalid user");
            ExecutionEngine.Assert(scoreDelta >= 0, "score delta cannot be negative");
            ValidateAdmin();

            AppConfig config = GetConfigInternal(appId);
            ExecutionEngine.Assert(config.AppId.Length > 0, "app not configured");
            ExecutionEngine.Assert(config.Active, "app inactive");

            byte[] scoreKey = UserScoreKey(appId, user);
            BigInteger currentScore = ReadBigInteger(scoreKey);
            BigInteger newScore = ComputeNewScore(config.ScoringMode, currentScore, scoreDelta);

            // Persist user score
            Storage.Put(Storage.CurrentContext, scoreKey, newScore);

            // Update the on-chain top-N leaderboard
            UpdateTopN(appId, config.Capacity, user, newScore);

            OnScoreUpdated(appId, user, newScore, currentScore);
        }

        public static void ResetLeaderboard(string appId)
        {
            ValidateAppId(appId);
            ValidateAdmin();

            AppConfig config = GetConfigInternal(appId);
            ExecutionEngine.Assert(config.AppId.Length > 0, "app not configured");

            WriteLeaderboard(appId, new LeaderboardEntry[0]);
            OnLeaderboardReset(appId, Runtime.Transaction.Sender);
        }

        // ── Safe Queries ──────────────────────────────────────────────────

        [Safe]
        public static LeaderboardEntry[] GetLeaderboard(string appId, int count)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(count > 0, "count must be > 0");

            LeaderboardEntry[] board = ReadLeaderboard(appId);
            if (count >= board.Length) return board;

            LeaderboardEntry[] result = new LeaderboardEntry[count];
            for (int i = 0; i < count; i++)
            {
                result[i] = board[i];
            }
            return result;
        }

        [Safe]
        public static BigInteger GetUserScore(string appId, UInt160 user)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(user != UInt160.Zero && user.IsValid, "invalid user");
            return ReadBigInteger(UserScoreKey(appId, user));
        }

        [Safe]
        public static BigInteger GetUserRank(string appId, UInt160 user)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(user != UInt160.Zero && user.IsValid, "invalid user");

            LeaderboardEntry[] board = ReadLeaderboard(appId);
            for (int i = 0; i < board.Length; i++)
            {
                if (board[i].User == user)
                {
                    return i + 1;
                }
            }
            return 0;
        }

        [Safe]
        public static AppConfig GetConfig(string appId)
        {
            ValidateAppId(appId);
            return GetConfigInternal(appId);
        }

        // ── Internal Helpers ──────────────────────────────────────────────

        private static void ValidateAdmin()
        {
            UInt160 admin = GetAdmin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        private static void ValidateAppId(string appId)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "appId required");
        }

        private static UInt160 ReadAddress(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? UInt160.Zero : (UInt160)value;
        }

        private static BigInteger ReadBigInteger(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? 0 : (BigInteger)value;
        }

        private static void WriteBigInteger(byte[] key, BigInteger value)
        {
            if (value == 0)
                Storage.Delete(Storage.CurrentContext, key);
            else
                Storage.Put(Storage.CurrentContext, key, value);
        }

        // ── Key Builders ──────────────────────────────────────────────────

        private static byte[] AppConfigKey(string appId)
        {
            return Helper.Concat(PREFIX_APP_CONFIG, (ByteString)(appId ?? ""));
        }

        private static byte[] UserScoreKey(string appId, UInt160 user)
        {
            return Helper.Concat(PREFIX_USER_SCORE,
                (ByteString)((appId ?? "") + "|" + (string)(ByteString)(byte[])user));
        }

        private static byte[] LeaderboardKey(string appId)
        {
            return Helper.Concat(PREFIX_LEADERBOARD, (ByteString)(appId ?? ""));
        }

        private static byte[] LeaderboardCountKey(string appId)
        {
            return Helper.Concat(PREFIX_LEADERBOARD_COUNT, (ByteString)(appId ?? ""));
        }

        // ── Config Read ───────────────────────────────────────────────────

        private static AppConfig GetConfigInternal(string appId)
        {
            ByteString? raw = Storage.Get(Storage.CurrentContext, AppConfigKey(appId));
            if (raw == null)
            {
                return new AppConfig
                {
                    AppId = "",
                    ScoringMode = SCORING_ADDITIVE,
                    Capacity = DEFAULT_CAPACITY,
                    Active = false,
                    UpdatedAt = 0
                };
            }
            return (AppConfig)StdLib.Deserialize(raw);
        }

        // ── Scoring ───────────────────────────────────────────────────────

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

        // ── Top-N Leaderboard ─────────────────────────────────────────────

        private static LeaderboardEntry[] ReadLeaderboard(string appId)
        {
            ByteString? raw = Storage.Get(Storage.CurrentContext, LeaderboardKey(appId));
            if (raw == null || raw.Length == 0)
            {
                return new LeaderboardEntry[0];
            }
            return (LeaderboardEntry[])StdLib.Deserialize(raw);
        }

        private static void WriteLeaderboard(string appId, LeaderboardEntry[] entries)
        {
            byte[] key = LeaderboardKey(appId);
            if (entries.Length == 0)
            {
                Storage.Delete(Storage.CurrentContext, key);
                Storage.Delete(Storage.CurrentContext, LeaderboardCountKey(appId));
            }
            else
            {
                Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(entries));
                Storage.Put(Storage.CurrentContext, LeaderboardCountKey(appId), entries.Length);
            }
        }

        private static void UpdateTopN(string appId, int capacity, UInt160 user, BigInteger newScore)
        {
            LeaderboardEntry[] current = ReadLeaderboard(appId);

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
                WriteLeaderboard(appId, current);
                return;
            }

            // User not in leaderboard -- check if they qualify
            if (current.Length < capacity)
            {
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
                WriteLeaderboard(appId, expanded);
            }
            else if (current.Length > 0 && newScore > current[current.Length - 1].Score)
            {
                current[current.Length - 1] = new LeaderboardEntry { User = user, Score = newScore };

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
                WriteLeaderboard(appId, current);
            }
        }
    }
}
