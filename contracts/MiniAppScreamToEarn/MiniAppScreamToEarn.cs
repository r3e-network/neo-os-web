using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public delegate void ScreamSubmittedHandler(BigInteger screamId, UInt160 user, BigInteger decibels);
    public delegate void RewardClaimedHandler(UInt160 user, BigInteger amount);
    public delegate void LeaderboardUpdatedHandler(UInt160 topScreamer, BigInteger topDecibels);

    /// <summary>
    /// ScreamToEarn MiniApp - Earn GAS by screaming into your microphone.
    /// TEE verifies audio input and measures decibel levels.
    /// </summary>
    [DisplayName("MiniAppScreamToEarn")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Scream to Earn - Voice-powered mining")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-screamtoearn";
        private const long MIN_DECIBELS = 70;
        private const long REWARD_PER_DECIBEL = 10000; // 0.0001 GAS per dB
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_SCREAM_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_SCREAMS = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_USER_TOTAL = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_TOP_SCREAMER = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Data Structures
        public struct ScreamData
        {
            public UInt160 User;
            public BigInteger Decibels;
            public BigInteger Reward;
            public BigInteger Timestamp;
        }
        #endregion

        #region App Events
        [DisplayName("ScreamSubmitted")]
        public static event ScreamSubmittedHandler OnScreamSubmitted;

        [DisplayName("RewardClaimed")]
        public static event RewardClaimedHandler OnRewardClaimed;

        [DisplayName("LeaderboardUpdated")]
        public static event LeaderboardUpdatedHandler OnLeaderboardUpdated;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_SCREAM_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        public static BigInteger SubmitScream(UInt160 user, BigInteger decibels, ByteString attestation)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(decibels >= MIN_DECIBELS, "scream louder!");
            ExecutionEngine.Assert(decibels <= 150, "invalid reading");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(user), "unauthorized");

            BigInteger screamId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_SCREAM_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_SCREAM_ID, screamId);

            BigInteger reward = (decibels - MIN_DECIBELS) * REWARD_PER_DECIBEL;

            ScreamData scream = new ScreamData
            {
                User = user,
                Decibels = decibels,
                Reward = reward,
                Timestamp = Runtime.Time
            };
            StoreScream(screamId, scream);

            // Update user total
            ByteString userKey = Helper.Concat((ByteString)PREFIX_USER_TOTAL, (ByteString)(byte[])user);
            BigInteger currentTotal = (BigInteger)Storage.Get(Storage.CurrentContext, userKey);
            Storage.Put(Storage.CurrentContext, userKey, currentTotal + reward);

            // Check leaderboard
            UpdateLeaderboard(user, decibels);

            OnScreamSubmitted(screamId, user, decibels);
            return reward;
        }

        [Safe]
        public static BigInteger GetUserRewards(UInt160 user)
        {
            ByteString userKey = Helper.Concat((ByteString)PREFIX_USER_TOTAL, (ByteString)(byte[])user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, userKey);
        }

        [Safe]
        public static ScreamData GetScream(BigInteger screamId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_SCREAMS, (ByteString)screamId.ToByteArray()));
            if (data == null) return new ScreamData();
            return (ScreamData)StdLib.Deserialize(data);
        }

        #endregion

        #region Internal Helpers

        private static void StoreScream(BigInteger screamId, ScreamData scream)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_SCREAMS, (ByteString)screamId.ToByteArray()),
                StdLib.Serialize(scream));
        }

        private static void UpdateLeaderboard(UInt160 user, BigInteger decibels)
        {
            ByteString topData = Storage.Get(Storage.CurrentContext, PREFIX_TOP_SCREAMER);
            if (topData != null)
            {
                object[] top = (object[])StdLib.Deserialize(topData);
                BigInteger topDecibels = (BigInteger)top[1];
                if (decibels > topDecibels)
                {
                    Storage.Put(Storage.CurrentContext, PREFIX_TOP_SCREAMER,
                        StdLib.Serialize(new object[] { user, decibels }));
                    OnLeaderboardUpdated(user, decibels);
                }
            }
            else
            {
                Storage.Put(Storage.CurrentContext, PREFIX_TOP_SCREAMER,
                    StdLib.Serialize(new object[] { user, decibels }));
                OnLeaderboardUpdated(user, decibels);
            }
        }

        #endregion

        #region Automation
        [Safe]
        public static UInt160 AutomationAnchor()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR);
            return data != null ? (UInt160)data : UInt160.Zero;
        }

        public static void SetAutomationAnchor(UInt160 anchor)
        {
            ValidateAdmin();
            ValidateAddress(anchor);
            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR, anchor);
        }

        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");
        }
        #endregion
    }
}
