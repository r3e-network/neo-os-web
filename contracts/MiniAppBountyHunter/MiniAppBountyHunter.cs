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
    public delegate void BountyCreatedHandler(BigInteger bountyId, UInt160 creator, BigInteger reward);
    public delegate void BountyClaimedHandler(BigInteger bountyId, UInt160 hunter, ByteString proof);
    public delegate void BountyCompletedHandler(BigInteger bountyId, UInt160 winner);

    /// <summary>
    /// BountyHunter MiniApp - Post and claim on-chain bounties.
    /// TEE verifies proof submissions for task completion.
    /// </summary>
    [DisplayName("MiniAppBountyHunter")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Bounty Hunter - On-chain task marketplace")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-bountyhunter";
        private const long MIN_BOUNTY = 100000000; // 1 GAS
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_BOUNTY_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_BOUNTIES = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_CLAIMS = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Data Structures
        public struct BountyData
        {
            public UInt160 Creator;
            public string Description;
            public BigInteger Reward;
            public BigInteger Deadline;
            public bool Active;
            public UInt160 Winner;
        }
        #endregion

        #region App Events
        [DisplayName("BountyCreated")]
        public static event BountyCreatedHandler OnBountyCreated;

        [DisplayName("BountyClaimed")]
        public static event BountyClaimedHandler OnBountyClaimed;

        [DisplayName("BountyCompleted")]
        public static event BountyCompletedHandler OnBountyCompleted;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_BOUNTY_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        public static BigInteger CreateBounty(UInt160 creator, string description, BigInteger reward, BigInteger deadlineDays, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(reward >= MIN_BOUNTY, "min 1 GAS");
            ExecutionEngine.Assert(description.Length <= 500, "description too long");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            ValidatePaymentReceipt(APP_ID, creator, reward, receiptId);

            BigInteger bountyId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_BOUNTY_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_BOUNTY_ID, bountyId);

            BountyData bounty = new BountyData
            {
                Creator = creator,
                Description = description,
                Reward = reward,
                Deadline = Runtime.Time + deadlineDays * 86400000,
                Active = true,
                Winner = UInt160.Zero
            };
            StoreBounty(bountyId, bounty);

            OnBountyCreated(bountyId, creator, reward);
            return bountyId;
        }

        public static void SubmitClaim(BigInteger bountyId, UInt160 hunter, ByteString proof)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(hunter), "unauthorized");

            BountyData bounty = GetBounty(bountyId);
            ExecutionEngine.Assert(bounty.Active, "bounty not active");
            ExecutionEngine.Assert(Runtime.Time <= (ulong)bounty.Deadline, "deadline passed");

            ByteString claimKey = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_CLAIMS, (ByteString)bountyId.ToByteArray()),
                (ByteString)(byte[])hunter);
            Storage.Put(Storage.CurrentContext, claimKey, proof);

            OnBountyClaimed(bountyId, hunter, proof);
        }

        public static void ApproveClaim(BigInteger bountyId, UInt160 hunter)
        {
            ValidateNotGloballyPaused(APP_ID);

            BountyData bounty = GetBounty(bountyId);
            ExecutionEngine.Assert(Runtime.CheckWitness(bounty.Creator), "not creator");
            ExecutionEngine.Assert(bounty.Active, "bounty not active");

            bounty.Active = false;
            bounty.Winner = hunter;
            StoreBounty(bountyId, bounty);

            OnBountyCompleted(bountyId, hunter);
        }

        [Safe]
        public static BountyData GetBounty(BigInteger bountyId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_BOUNTIES, (ByteString)bountyId.ToByteArray()));
            if (data == null) return new BountyData();
            return (BountyData)StdLib.Deserialize(data);
        }

        #endregion

        #region Internal Helpers

        private static void StoreBounty(BigInteger bountyId, BountyData bounty)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_BOUNTIES, (ByteString)bountyId.ToByteArray()),
                StdLib.Serialize(bounty));
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
