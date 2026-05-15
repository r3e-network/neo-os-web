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
    public partial class PlatformGameContract
    {
        #region Validation helpers

        /// <summary>Assert that the caller is the platform admin.</summary>
        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        /// <summary>Assert that the caller is the configured oracle.</summary>
        private static void ValidateOracle()
        {
            UInt160 oracle = Oracle();
            ExecutionEngine.Assert(oracle != UInt160.Zero && oracle.IsValid, "oracle not set");
            ExecutionEngine.Assert(Runtime.CallingScriptHash == oracle, "only oracle");
        }

        /// <summary>Assert that an address is non-zero and valid.</summary>
        private static void ValidateAddress(UInt160 addr)
        {
            ExecutionEngine.Assert(addr != UInt160.Zero && addr.IsValid, "invalid address");
        }

        /// <summary>
        /// Validate that the caller is the user or the abstract account
        /// acting on the user's behalf.
        /// </summary>
        private static void ValidateUserOrAbstractAccount(UInt160 user)
        {
            ValidateAddress(user);

            // Direct witness check
            if (Runtime.CheckWitness(user)) return;

            // Abstract account delegation check
            UInt160 aa = AbstractAccount();
            ExecutionEngine.Assert(
                aa != UInt160.Zero && aa.IsValid && Runtime.CallingScriptHash == aa,
                "unauthorized");
        }

        #endregion

        // ===================================================================
        //  Internal helpers
        // ===================================================================

        /// <summary>
        /// Assert that the given appId has been registered.
        /// Every mutating method must call this before touching state.
        /// </summary>
        private static void RequireRegistered(string appId)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "appId required");
            ByteString val = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_GAME_TYPE, (ByteString)appId));
            ExecutionEngine.Assert(val != null, "appId not registered");
        }

        /// <summary>Assert that the app is not paused.</summary>
        private static void RequireNotPaused(string appId)
        {
            ExecutionEngine.Assert(!IsPaused(appId), "app paused");
        }

        /// <summary>
        /// Validate that the caller is the app's admin or the platform admin.
        /// </summary>
        private static void RequireAppAdminOrPlatformAdmin(string appId)
        {
            UInt160 platformAdmin = Admin();
            if (platformAdmin != UInt160.Zero && Runtime.CheckWitness(platformAdmin))
                return;

            UInt160 appAdmin = GetGameAdmin(appId);
            ExecutionEngine.Assert(
                appAdmin != UInt160.Zero && Runtime.CheckWitness(appAdmin),
                "unauthorized: not app or platform admin");
        }

        /// <summary>
        /// Validate that the caller is the specific app's admin.
        /// </summary>
        private static void RequireAppAdmin(string appId)
        {
            UInt160 appAdmin = GetGameAdmin(appId);
            ExecutionEngine.Assert(
                appAdmin != UInt160.Zero && Runtime.CheckWitness(appAdmin),
                "unauthorized: not app admin");
        }

        /// <summary>
        /// Require that the game type matches expectation.
        /// Prevents calling countdown methods on a CoinFlip app, etc.
        /// </summary>
        private static void RequireGameType(string appId, int expectedType)
        {
            BigInteger actual = GetGameType(appId);
            ExecutionEngine.Assert(actual == expectedType, "wrong game type for appId");
        }

        /// <summary>
        /// Extract appId from a "appId:..." memo string.
        /// </summary>
        private static string ExtractAppId(string memo)
        {
            int colonPos = -1;
            for (int i = 0; i < memo.Length; i++)
            {
                if (memo[i] == ':')
                {
                    colonPos = i;
                    break;
                }
            }
            if (colonPos <= 0) return memo;
            return memo.Substring(0, colonPos);
        }

        /// <summary>
        /// Reentrancy guard: acquire lock for an appId operation.
        /// </summary>
        private static void AcquireReentrancyLock(string appId)
        {
            byte[] key = (byte[])Helper.Concat((ByteString)PREFIX_REENTRANCY, (ByteString)appId);
            ByteString val = Storage.Get(Storage.CurrentContext, key);
            ExecutionEngine.Assert(val == null || (BigInteger)val == 0, "reentrancy");
            Storage.Put(Storage.CurrentContext, key, 1);
        }

        /// <summary>
        /// Reentrancy guard: release lock for an appId operation.
        /// </summary>
        private static void ReleaseReentrancyLock(string appId)
        {
            byte[] key = (byte[])Helper.Concat((ByteString)PREFIX_REENTRANCY, (ByteString)appId);
            Storage.Delete(Storage.CurrentContext, key);
        }

        /// <summary>Check if an address is valid and non-zero.</summary>
        private static bool IsValidAddress(UInt160 addr)
        {
            return addr != UInt160.Zero && addr.IsValid;
        }
    }
}
