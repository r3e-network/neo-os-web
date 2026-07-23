using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class PlatformRegistry
    {
        public static void ProposeAbstractAccountCore(UInt160 core)
        {
            ValidateAdmin();
            if (core != UInt160.Zero)
            {
                ValidateAddress(core);
                ExecutionEngine.Assert(ContractManagement.GetContract(core) != null, "abstract account core not deployed");
            }
            ExecutionEngine.Assert(core != AbstractAccountCore(), "abstract account core unchanged");
            BigInteger executeAfter = Runtime.Time + TIMELOCK_DELAY_MS;
            Storage.Put(Storage.CurrentContext, PREFIX_PENDING_ABSTRACT_ACCOUNT_CORE, core);
            Storage.Put(Storage.CurrentContext, PREFIX_ABSTRACT_ACCOUNT_CORE_ETA, executeAfter);
            OnAbstractAccountCoreProposed(core, executeAfter);
        }

        public static void SetAbstractAccountCore()
        {
            ValidateAdmin();
            ByteString pending = Storage.Get(Storage.CurrentContext, PREFIX_PENDING_ABSTRACT_ACCOUNT_CORE);
            ExecutionEngine.Assert(pending != null, "no pending abstract account core");
            ByteString eta = Storage.Get(Storage.CurrentContext, PREFIX_ABSTRACT_ACCOUNT_CORE_ETA);
            ExecutionEngine.Assert(eta != null, "no abstract account core timelock");
            ExecutionEngine.Assert(Runtime.Time >= (BigInteger)eta, "timelock active");
            UInt160 previous = AbstractAccountCore();
            UInt160 core = (UInt160)pending;
            if (core == UInt160.Zero)
                Storage.Delete(Storage.CurrentContext, PREFIX_ABSTRACT_ACCOUNT_CORE);
            else
                Storage.Put(Storage.CurrentContext, PREFIX_ABSTRACT_ACCOUNT_CORE, core);
            Storage.Delete(Storage.CurrentContext, PREFIX_PENDING_ABSTRACT_ACCOUNT_CORE);
            Storage.Delete(Storage.CurrentContext, PREFIX_ABSTRACT_ACCOUNT_CORE_ETA);
            OnAbstractAccountCoreChanged(previous, core);
        }

        public static void CancelAbstractAccountCore()
        {
            ValidateAdmin();
            Storage.Delete(Storage.CurrentContext, PREFIX_PENDING_ABSTRACT_ACCOUNT_CORE);
            Storage.Delete(Storage.CurrentContext, PREFIX_ABSTRACT_ACCOUNT_CORE_ETA);
        }

        [Safe]
        public static UInt160 AbstractAccountCore()
        {
            ByteString value = Storage.Get(Storage.CurrentContext, PREFIX_ABSTRACT_ACCOUNT_CORE);
            return value == null ? UInt160.Zero : (UInt160)value;
        }

        [Safe]
        public static UInt160 PendingAbstractAccountCore()
        {
            ByteString value = Storage.Get(Storage.CurrentContext, PREFIX_PENDING_ABSTRACT_ACCOUNT_CORE);
            return value == null ? UInt160.Zero : (UInt160)value;
        }

        [Safe]
        public static BigInteger AbstractAccountCoreAvailableAt()
        {
            ByteString value = Storage.Get(Storage.CurrentContext, PREFIX_ABSTRACT_ACCOUNT_CORE_ETA);
            return value == null ? 0 : (BigInteger)value;
        }

        public static UInt160 MaterializeAbstractAccount(string appId)
        {
            RequireNotGloballyPaused();
            RequireRegistered(appId);
            RequireAppNotPaused(appId);
            RequireAppAdminOrPlatformAdmin(appId);
            UInt160 accountId = AbstractAccountIdOf(appId);
            if (accountId != UInt160.Zero) return accountId;
            UInt160 core = AbstractAccountCore();
            ExecutionEngine.Assert(core != UInt160.Zero, "abstract account core not set");
            return CreateAbstractAccount(appId, AppAdminOf(appId), core);
        }

        [Safe]
        public static object[] GetAppAbstractAccount(string appId)
        {
            RequireRegistered(appId);
            UInt160 core = AbstractAccountCoreOf(appId);
            UInt160 accountId = AbstractAccountIdOf(appId);
            return new object[] { core, accountId, core != UInt160.Zero && accountId != UInt160.Zero };
        }

        [Safe]
        public static string AppIdOfAbstractAccount(UInt160 core, UInt160 accountId)
        {
            ByteString value = Storage.Get(
                Storage.CurrentContext,
                AbstractAccountKey(PREFIX_APP_ID_BY_ABSTRACT_ACCOUNT, core, accountId));
            return value == null ? "" : (string)value;
        }

        private static UInt160 EnsureAbstractAccount(string appId, UInt160 appAdmin)
        {
            UInt160 existing = AbstractAccountIdOf(appId);
            if (existing != UInt160.Zero) return existing;
            UInt160 core = AbstractAccountCore();
            if (core == UInt160.Zero) return UInt160.Zero;
            return CreateAbstractAccount(appId, appAdmin, core);
        }

        private static UInt160 CreateAbstractAccount(string appId, UInt160 appAdmin, UInt160 core)
        {
            ByteString appBinding = Helper.Concat((ByteString)Runtime.ExecutingScriptHash, (ByteString)appId);
            UInt160 accountId = (UInt160)Contract.Call(
                core,
                "computePlatformAccountId",
                CallFlags.ReadOnly,
                appBinding,
                appAdmin,
                DEFAULT_ABSTRACT_ACCOUNT_TIMELOCK_SECONDS);
            ExecutionEngine.Assert(accountId != UInt160.Zero, "invalid abstract account id");
            Contract.Call(
                core,
                "registerPlatformAccount",
                CallFlags.All,
                accountId,
                appBinding,
                appAdmin,
                DEFAULT_ABSTRACT_ACCOUNT_TIMELOCK_SECONDS);
            Storage.Put(Storage.CurrentContext, AppKey(PREFIX_APP_ABSTRACT_ACCOUNT_ID, appId), accountId);
            Storage.Put(Storage.CurrentContext, AppKey(PREFIX_APP_ABSTRACT_ACCOUNT_CORE, appId), core);
            Storage.Put(
                Storage.CurrentContext,
                AbstractAccountKey(PREFIX_APP_ID_BY_ABSTRACT_ACCOUNT, core, accountId),
                appId);
            OnAppAbstractAccountCreated(appId, core, accountId, appAdmin);
            return accountId;
        }

        private static UInt160 AbstractAccountIdOf(string appId)
        {
            ByteString value = Storage.Get(Storage.CurrentContext, AppKey(PREFIX_APP_ABSTRACT_ACCOUNT_ID, appId));
            return value == null ? UInt160.Zero : (UInt160)value;
        }

        private static UInt160 AbstractAccountCoreOf(string appId)
        {
            ByteString value = Storage.Get(Storage.CurrentContext, AppKey(PREFIX_APP_ABSTRACT_ACCOUNT_CORE, appId));
            return value == null ? UInt160.Zero : (UInt160)value;
        }

        private static ByteString AbstractAccountKey(byte[] prefix, UInt160 core, UInt160 accountId) =>
            Helper.Concat(Helper.Concat((ByteString)prefix, (ByteString)core), (ByteString)accountId);
    }
}
