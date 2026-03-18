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

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            if (Runtime.CallingScriptHash != GAS.Hash)
            {
                ExecutionEngine.Assert(false, "unsupported asset");
            }

            if (from == Runtime.ExecutingScriptHash || amount <= 0) return;

            string memo = ReadPaymentMemo(data);
            if (memo.StartsWith(APP_ID + ":"))
            {
                CreditDirectGasPayment(APP_ID, from, amount, data);
            }
        }

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
            ValidateUserOrAbstractAccount(creator);
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
            ValidateUserOrAbstractAccount(member);

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
            ValidateUserOrAbstractAccount(member);

            CircleData circle = GetCircle(circleId);
            ExecutionEngine.Assert(circle.Creator != null, "circle not found");
            ExecutionEngine.Assert(circle.Active, "circle not active");
            ExecutionEngine.Assert(IsCircleMember(circleId, member), "not circle member");
            ConsumeDirectGasCredit(member, circle.DailyAmount);

            // Check member is part of circle and hasn't deposited today
            ByteString depositKey = GetDepositKey(circleId, circle.CurrentDay, member);
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
                IsUserOrAbstractAccountAuthorized(circle.Creator) || Runtime.CheckWitness(Admin()),
                "unauthorized"
            );
            ExecutionEngine.Assert(AllMembersDeposited(circleId, circle.CurrentDay, circle.MemberCount), "pending member deposits");

            // Request automation to verify all deposits and process payout
            BigInteger requestId = RequestAutomation(circle.Creator, circleId, circle.CurrentDay);
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

        private static BigInteger RequestAutomation(UInt160 requester, BigInteger circleId, BigInteger day)
        {
            ByteString payload = StdLib.Serialize(new object[] { circleId, day });
            return RequestOracleForCallback(requester, "automation_register", payload);
        }

        public static void OnOracleResult(
            BigInteger requestId, string requestType,
            bool success, ByteString result, string error)
        {
            ValidateOracle();

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

            if (!AllMembersDeposited(circleId, circle.CurrentDay, circle.MemberCount))
            {
                return;
            }

            ProcessPayout(circleId, circle);
        }

        #endregion

        #region Internal Helpers

        private static void StoreCircle(BigInteger circleId, CircleData circle)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_CIRCLES, (ByteString)circleId.ToByteArray()),
                StdLib.Serialize(circle));
        }

        private static ByteString GetDepositKey(BigInteger circleId, BigInteger day, UInt160 member) =>
            Helper.Concat(
                Helper.Concat((ByteString)PREFIX_DEPOSITS, (ByteString)circleId.ToByteArray()),
                Helper.Concat((ByteString)day.ToByteArray(), (ByteString)member));

        private static bool IsCircleMember(BigInteger circleId, UInt160 member)
        {
            CircleData circle = GetCircle(circleId);
            for (BigInteger slot = 1; slot <= circle.MemberCount; slot++)
            {
                if (GetMember(circleId, slot) == member)
                {
                    return true;
                }
            }

            return false;
        }

        private static bool AllMembersDeposited(BigInteger circleId, BigInteger day, BigInteger memberCount)
        {
            for (BigInteger slot = 1; slot <= memberCount; slot++)
            {
                UInt160 member = GetMember(circleId, slot);
                if (member == UInt160.Zero)
                {
                    return false;
                }

                if (Storage.Get(Storage.CurrentContext, GetDepositKey(circleId, day, member)) == null)
                {
                    return false;
                }
            }

            return true;
        }

        private static void ProcessPayout(BigInteger circleId, CircleData circle)
        {
            UInt160 recipient = GetMember(circleId, circle.CurrentDay);
            ExecutionEngine.Assert(recipient != UInt160.Zero, "invalid recipient");

            BigInteger payoutDay = circle.CurrentDay;
            BigInteger payoutAmount = circle.DailyAmount * circle.MemberCount;
            ExecutionEngine.Assert(GAS.BalanceOf(Runtime.ExecutingScriptHash) >= payoutAmount, "insufficient pool liquidity");
            ExecutionEngine.Assert(GAS.Transfer(Runtime.ExecutingScriptHash, recipient, payoutAmount, "circle-payout"));

            circle.CurrentDay = circle.CurrentDay + 1;
            if (circle.CurrentDay > circle.MaxMembers)
            {
                circle.Active = false;
            }

            StoreCircle(circleId, circle);
            OnPayoutCompleted(circleId, recipient, payoutDay, payoutAmount);
        }

        #endregion

        #region Periodic Automation

        /// <summary>
        /// Returns the AutomationAnchor contract address.
        /// </summary>
        public static UInt160 AutomationAnchor()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR);
            return data == null ? UInt160.Zero : (UInt160)data;
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

            BigInteger totalCircles = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_CIRCLE_ID);
            BigInteger processed = 0;

            for (BigInteger circleId = 1; circleId <= totalCircles && processed < 10; circleId++)
            {
                CircleData circle = GetCircle(circleId);
                if (circle.Creator == null || !circle.Active || circle.CurrentDay > circle.MaxMembers)
                {
                    continue;
                }

                if (!AllMembersDeposited(circleId, circle.CurrentDay, circle.MemberCount))
                {
                    continue;
                }

                ProcessPayout(circleId, circle);
                processed += 1;
            }
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

            if (!AllMembersDeposited(circleId, circle.CurrentDay, circle.MemberCount))
            {
                return;
            }

            ProcessPayout(circleId, circle);
        }

        #endregion
    }
}
