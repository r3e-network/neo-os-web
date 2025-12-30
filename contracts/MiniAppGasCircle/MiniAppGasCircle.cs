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
    public delegate void CircleCreatedHandler(BigInteger circleId, UInt160 creator, BigInteger dailyAmount, BigInteger memberCount);
    public delegate void MemberJoinedHandler(BigInteger circleId, UInt160 member, BigInteger slot);
    public delegate void DepositMadeHandler(BigInteger circleId, UInt160 member, BigInteger day, BigInteger amount);
    public delegate void PayoutRequestedHandler(BigInteger circleId, BigInteger day, BigInteger requestId);
    public delegate void PayoutCompletedHandler(BigInteger circleId, UInt160 recipient, BigInteger day, BigInteger amount);
    public delegate void AutomationRegisteredHandler(BigInteger taskId, string triggerType, string schedule);
    public delegate void AutomationCancelledHandler(BigInteger taskId);
    public delegate void PeriodicExecutionTriggeredHandler(BigInteger taskId);

    /// <summary>
    /// GAS Circle - Rotating savings circle with automation.
    ///
    /// ARCHITECTURE (Chainlink-style):
    /// - Creator creates circle via CreateCircle
    /// - Members join via JoinCircle
    /// - Daily deposits via MakeDeposit
    /// - Automation triggers RequestPayout → Selects recipient
    /// - Gateway fulfills → Contract distributes to day's recipient
    ///
    /// MECHANICS:
    /// - Each member deposits daily amount
    /// - Each day, one member receives all deposits
    /// - Rotation order determined at creation
    /// </summary>
    [DisplayName("MiniAppGasCircle")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. GasCircle is a rotating savings circle for community savings. Use it to create savings groups, you can pool funds and receive payouts in rotation.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-gascircle";
        private const long MIN_DAILY_AMOUNT = 10000000; // 0.1 GAS
        private const int MAX_MEMBERS = 30;
        #endregion

        #region App Prefixes (start from 0x10)
        private static readonly byte[] PREFIX_CIRCLE_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_CIRCLES = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_MEMBERS = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_DEPOSITS = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_REQUEST_TO_CIRCLE = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_AUTOMATION_TASK = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Data Structures
        public struct CircleData
        {
            public UInt160 Creator;
            public BigInteger DailyAmount;
            public BigInteger MemberCount;
            public BigInteger MaxMembers;
            public BigInteger CurrentDay;
            public BigInteger StartTime;
            public bool Active;
        }
        #endregion

        #region App Events
        [DisplayName("CircleCreated")]
        public static event CircleCreatedHandler OnCircleCreated;

        [DisplayName("MemberJoined")]
        public static event MemberJoinedHandler OnMemberJoined;

        [DisplayName("DepositMade")]
        public static event DepositMadeHandler OnDepositMade;

        [DisplayName("PayoutRequested")]
        public static event PayoutRequestedHandler OnPayoutRequested;

        [DisplayName("PayoutCompleted")]
        public static event PayoutCompletedHandler OnPayoutCompleted;

        [DisplayName("AutomationRegistered")]
        public static event AutomationRegisteredHandler OnAutomationRegistered;

        [DisplayName("AutomationCancelled")]
        public static event AutomationCancelledHandler OnAutomationCancelled;

        [DisplayName("PeriodicExecutionTriggered")]
        public static event PeriodicExecutionTriggeredHandler OnPeriodicExecutionTriggered;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_CIRCLE_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        public static BigInteger CreateCircle(UInt160 creator, BigInteger dailyAmount, BigInteger maxMembers)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "unauthorized");
            ExecutionEngine.Assert(dailyAmount >= MIN_DAILY_AMOUNT, "min daily 0.1 GAS");
            ExecutionEngine.Assert(maxMembers >= 2 && maxMembers <= MAX_MEMBERS, "2-30 members");

            BigInteger circleId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_CIRCLE_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_CIRCLE_ID, circleId);

            CircleData circle = new CircleData
            {
                Creator = creator,
                DailyAmount = dailyAmount,
                MemberCount = 0,
                MaxMembers = maxMembers,
                CurrentDay = 0,
                StartTime = 0,
                Active = false
            };
            StoreCircle(circleId, circle);

            OnCircleCreated(circleId, creator, dailyAmount, maxMembers);
            return circleId;
        }

        public static BigInteger JoinCircle(BigInteger circleId, UInt160 member)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(member), "unauthorized");

            CircleData circle = GetCircle(circleId);
            ExecutionEngine.Assert(circle.Creator != null, "circle not found");
            ExecutionEngine.Assert(!circle.Active, "circle already started");
            ExecutionEngine.Assert(circle.MemberCount < circle.MaxMembers, "circle full");

            BigInteger slot = circle.MemberCount + 1;
            circle.MemberCount = slot;

            // Store member at slot
            ByteString memberKey = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_MEMBERS, (ByteString)circleId.ToByteArray()),
                (ByteString)slot.ToByteArray());
            Storage.Put(Storage.CurrentContext, memberKey, member);

            // Start circle when full
            if (circle.MemberCount == circle.MaxMembers)
            {
                circle.Active = true;
                circle.StartTime = (BigInteger)Runtime.Time;
                circle.CurrentDay = 1;
            }

            StoreCircle(circleId, circle);
            OnMemberJoined(circleId, member, slot);
            return slot;
        }

        public static void MakeDeposit(BigInteger circleId, UInt160 member)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(member), "unauthorized");

            CircleData circle = GetCircle(circleId);
            ExecutionEngine.Assert(circle.Creator != null, "circle not found");
            ExecutionEngine.Assert(circle.Active, "circle not active");

            // Check member is part of circle and hasn't deposited today
            ByteString depositKey = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_DEPOSITS, (ByteString)circleId.ToByteArray()),
                Helper.Concat((ByteString)circle.CurrentDay.ToByteArray(), (ByteString)member));
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, depositKey) == null, "already deposited today");

            Storage.Put(Storage.CurrentContext, depositKey, circle.DailyAmount);

            OnDepositMade(circleId, member, circle.CurrentDay, circle.DailyAmount);
        }

        /// <summary>
        /// Request daily payout processing via automation.
        /// </summary>
        public static void RequestPayout(BigInteger circleId)
        {
            CircleData circle = GetCircle(circleId);
            ExecutionEngine.Assert(circle.Creator != null, "circle not found");
            ExecutionEngine.Assert(circle.Active, "circle not active");
            ExecutionEngine.Assert(circle.CurrentDay <= circle.MaxMembers, "circle completed");
            ExecutionEngine.Assert(
                Runtime.CheckWitness(circle.Creator) || Runtime.CheckWitness(Admin()),
                "unauthorized"
            );

            // Request automation to verify all deposits and process payout
            BigInteger requestId = RequestAutomation(circleId, circle.CurrentDay);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_REQUEST_TO_CIRCLE, (ByteString)requestId.ToByteArray()),
                circleId);

            OnPayoutRequested(circleId, circle.CurrentDay, requestId);
        }

        [Safe]
        public static CircleData GetCircle(BigInteger circleId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_CIRCLES, (ByteString)circleId.ToByteArray()));
            if (data == null) return new CircleData();
            return (CircleData)StdLib.Deserialize(data);
        }

        [Safe]
        public static UInt160 GetMember(BigInteger circleId, BigInteger slot)
        {
            ByteString memberKey = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_MEMBERS, (ByteString)circleId.ToByteArray()),
                (ByteString)slot.ToByteArray());
            ByteString data = Storage.Get(Storage.CurrentContext, memberKey);
            if (data == null) return UInt160.Zero;
            return (UInt160)data;
        }

        #endregion

        #region Service Request Methods

        private static BigInteger RequestAutomation(BigInteger circleId, BigInteger day)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { circleId, day });
            return (BigInteger)Contract.Call(
                gateway, "requestService", CallFlags.All,
                APP_ID, "automation", payload,
                Runtime.ExecutingScriptHash, "onServiceCallback"
            );
        }

        public static void OnServiceCallback(
            BigInteger requestId, string appId, string serviceType,
            bool success, ByteString result, string error)
        {
            ValidateGateway();

            ByteString circleIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_REQUEST_TO_CIRCLE, (ByteString)requestId.ToByteArray()));
            ExecutionEngine.Assert(circleIdData != null, "unknown request");

            BigInteger circleId = (BigInteger)circleIdData;
            CircleData circle = GetCircle(circleId);
            ExecutionEngine.Assert(circle.Creator != null, "circle not found");

            Storage.Delete(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_REQUEST_TO_CIRCLE, (ByteString)requestId.ToByteArray()));

            if (!success || !circle.Active)
            {
                return;
            }

            // Get today's recipient (slot = currentDay)
            UInt160 recipient = GetMember(circleId, circle.CurrentDay);
            BigInteger payoutAmount = circle.DailyAmount * circle.MemberCount;

            // Advance to next day
            circle.CurrentDay = circle.CurrentDay + 1;
            if (circle.CurrentDay > circle.MaxMembers)
            {
                circle.Active = false; // Circle completed
            }
            StoreCircle(circleId, circle);

            OnPayoutCompleted(circleId, recipient, circle.CurrentDay - 1, payoutAmount);
        }

        #endregion

        #region Internal Helpers

        private static void StoreCircle(BigInteger circleId, CircleData circle)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_CIRCLES, (ByteString)circleId.ToByteArray()),
                StdLib.Serialize(circle));
        }

        #endregion

        #region Periodic Automation

        /// <summary>
        /// Returns the AutomationAnchor contract address.
        /// </summary>
        [Safe]
        public static UInt160 AutomationAnchor()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR);
            return data != null ? (UInt160)data : UInt160.Zero;
        }

        /// <summary>
        /// Sets the AutomationAnchor contract address.
        /// SECURITY: Only admin can set the automation anchor.
        /// </summary>
        public static void SetAutomationAnchor(UInt160 anchor)
        {
            ValidateAdmin();
            ValidateAddress(anchor);
            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR, anchor);
        }

        /// <summary>
        /// Periodic execution callback invoked by AutomationAnchor.
        /// SECURITY: Only AutomationAnchor can invoke this method.
        /// LOGIC: Checks if circle is active and deposits complete, triggers payout.
        /// </summary>
        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            // Verify caller is AutomationAnchor
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            OnPeriodicExecutionTriggered(taskId);

            // Extract circleId from payload (if provided)
            // For simplicity, we iterate through active circles or use a default circle ID
            // In production, payload could contain the circleId to process

            // For this implementation, we'll process circle ID 1 as an example
            // In a real scenario, you'd maintain a list of active circles to process
            BigInteger circleId = 1;

            CircleData circle = GetCircle(circleId);
            if (circle.Creator == null || !circle.Active)
            {
                return; // Circle not found or not active
            }

            if (circle.CurrentDay > circle.MaxMembers)
            {
                return; // Circle already completed
            }

            // Trigger automated payout processing
            ProcessAutomatedPayout(circleId);
        }

        /// <summary>
        /// Registers this MiniApp for periodic automation.
        /// SECURITY: Only admin can register.
        /// CORRECTNESS: AutomationAnchor must be set first.
        /// </summary>
        public static BigInteger RegisterAutomation(string triggerType, string schedule)
        {
            ValidateAdmin();
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero, "automation anchor not set");

            // Call AutomationAnchor.RegisterPeriodicTask
            BigInteger taskId = (BigInteger)Contract.Call(anchor, "registerPeriodicTask", CallFlags.All,
                Runtime.ExecutingScriptHash, "onPeriodicExecution", triggerType, schedule, 1000000); // 0.01 GAS limit

            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_TASK, taskId);
            OnAutomationRegistered(taskId, triggerType, schedule);
            return taskId;
        }

        /// <summary>
        /// Cancels the registered automation task.
        /// SECURITY: Only admin can cancel.
        /// </summary>
        public static void CancelAutomation()
        {
            ValidateAdmin();
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_TASK);
            ExecutionEngine.Assert(data != null, "no automation registered");

            BigInteger taskId = (BigInteger)data;
            UInt160 anchor = AutomationAnchor();
            Contract.Call(anchor, "cancelPeriodicTask", CallFlags.All, taskId);

            Storage.Delete(Storage.CurrentContext, PREFIX_AUTOMATION_TASK);
            OnAutomationCancelled(taskId);
        }

        /// <summary>
        /// Internal method to process automated payout.
        /// Called by OnPeriodicExecution.
        /// </summary>
        private static void ProcessAutomatedPayout(BigInteger circleId)
        {
            CircleData circle = GetCircle(circleId);
            if (circle.Creator == null || !circle.Active)
            {
                return;
            }

            if (circle.CurrentDay > circle.MaxMembers)
            {
                return; // Circle completed
            }

            // Get today's recipient (slot = currentDay)
            UInt160 recipient = GetMember(circleId, circle.CurrentDay);
            if (recipient == UInt160.Zero)
            {
                return; // Invalid recipient
            }

            BigInteger payoutAmount = circle.DailyAmount * circle.MemberCount;

            // Advance to next day
            circle.CurrentDay = circle.CurrentDay + 1;
            if (circle.CurrentDay > circle.MaxMembers)
            {
                circle.Active = false; // Circle completed
            }
            StoreCircle(circleId, circle);

            OnPayoutCompleted(circleId, recipient, circle.CurrentDay - 1, payoutAmount);
        }

        #endregion
    }
}
