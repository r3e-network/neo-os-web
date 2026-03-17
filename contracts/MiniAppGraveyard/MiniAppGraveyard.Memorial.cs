using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        #region Memorial Methods

        /// <summary>
        /// Create a public memorial for tributes.
        /// </summary>
        public static BigInteger CreateMemorial(UInt160 creator, string title, string description)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(title.Length > 0 && title.Length <= MAX_TITLE_LENGTH, "invalid title");

            ValidateUserOrAbstractAccount(creator);

            ConsumeDirectGasCredit(creator, MEMORIAL_FEE);

            UserStats stats = GetUserStatsData(creator);
            bool isNewUser = stats.JoinTime == 0;

            BigInteger memorialId = TotalMemorials() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_MEMORIAL_ID, memorialId);

            Memorial memorial = new Memorial
            {
                Creator = creator,
                Title = title,
                Description = description,
                CreatedTime = Runtime.Time,
                TotalTributes = 0,
                TributeCount = 0,
                Active = true
            };
            StoreMemorial(memorialId, memorial);

            UpdateUserStatsOnMemorial(creator, MEMORIAL_FEE, isNewUser);

            OnMemorialCreated(memorialId, creator, title);
            return memorialId;
        }

        /// <summary>
        /// Add a tribute to a memorial.
        /// </summary>
        public static void AddTribute(BigInteger memorialId, UInt160 sender, BigInteger amount)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(amount >= MIN_TRIBUTE, "min 0.1 GAS");

            Memorial memorial = GetMemorial(memorialId);
            ExecutionEngine.Assert(memorial.Active, "memorial not active");

            ValidateUserOrAbstractAccount(sender);

            ConsumeDirectGasCredit(sender, amount);

            memorial.TotalTributes += amount;
            memorial.TributeCount += 1;
            StoreMemorial(memorialId, memorial);

            BigInteger totalTributes = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_TRIBUTES);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_TRIBUTES, totalTributes + amount);

            UpdateUserStatsOnTribute(sender, amount);
            UpdateCreatorTributesReceived(memorial.Creator, amount);

            OnTributeAdded(memorialId, sender, amount);
        }

        #endregion

        #region Admin Methods

        public static void WithdrawFees(UInt160 recipient, BigInteger amount)
        {
            ValidateAdmin();
            ValidateAddress(recipient);
            ExecutionEngine.Assert(amount > 0, "amount must be positive");

            BigInteger balance = GAS.BalanceOf(Runtime.ExecutingScriptHash);
            ExecutionEngine.Assert(balance >= amount, "insufficient balance");

            bool transferred = GAS.Transfer(Runtime.ExecutingScriptHash, recipient, amount);
            ExecutionEngine.Assert(transferred, "withdraw failed");
        }

        public static void CloseMemorial(BigInteger memorialId)
        {
            ValidateAdmin();
            Memorial memorial = GetMemorial(memorialId);
            ExecutionEngine.Assert(memorial.Active, "already closed");
            memorial.Active = false;
            StoreMemorial(memorialId, memorial);
        }

        #endregion

        #region Automation

        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");
        }

        #endregion
    }
}
