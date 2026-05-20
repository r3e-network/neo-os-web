using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    // Audit fix C-1: per-LP read accessors and the one-time admin reconciliation
    // hook, extracted from PlatformDeFi.FlashLoan.cs to keep that partial under
    // the 300-line reviewability budget (ContractProjectConventionsTest).
    public partial class PlatformDeFiContract
    {
        [Safe]
        public static BigInteger GetFlashProviderBalance(string appId, UInt160 provider) =>
            GetBigInteger(AppKey(appId, PREFIX_FLASH_PROVIDER_BAL, provider));

        [Safe]
        public static BigInteger GetFlashTotalLpDeposits(string appId) =>
            GetBigInteger(AppKey(appId, PREFIX_FLASH_TOTAL_LP_DEPOSITS));

        /// <summary>
        /// One-time admin reconciliation hook for FlashLoan pools that already
        /// held LP deposits before the C-1 fix shipped. Credits a specific
        /// provider's recorded balance without moving any GAS.
        ///
        /// SAFETY MODEL:
        /// - Platform admin only (ValidateAdmin).
        /// - Only fires when the provider has no recorded balance yet (delta-only,
        ///   never replaces a non-zero balance — prevents inflating an existing LP).
        /// - Bounded by the on-chain pool: caller cannot credit more total than the
        ///   contract currently holds minus what's already credited. So the sum of
        ///   migrated balances can never exceed the actual GAS sitting in the pool.
        ///
        /// The admin is responsible for sourcing the off-chain record of who
        /// deposited what before the fix. After every legitimate LP is migrated,
        /// the admin should stop calling this method; the audit recommends a
        /// later upgrade that strips it once migration is complete.
        /// </summary>
        public static void MigrateFlashProviderBalance(string appId, UInt160 provider, BigInteger amount)
        {
            ValidateAdmin();
            ValidateApp(appId, ProductType_FlashLoan);
            ValidateAddress(provider);
            ExecutionEngine.Assert(amount > 0, "amount required");

            ByteString providerKey = AppKey(appId, PREFIX_FLASH_PROVIDER_BAL, provider);
            ExecutionEngine.Assert(GetRaw(providerKey) == null, "provider already migrated");

            ByteString totalLpKey = AppKey(appId, PREFIX_FLASH_TOTAL_LP_DEPOSITS);
            BigInteger currentTotal = GetBigInteger(totalLpKey);
            BigInteger poolBalance = GetBigInteger(AppKey(appId, PREFIX_POOL_BALANCE));
            ExecutionEngine.Assert(currentTotal + amount <= poolBalance, "exceeds pool balance");

            Put(providerKey, amount);
            Put(totalLpKey, currentTotal + amount);
        }
    }
}
