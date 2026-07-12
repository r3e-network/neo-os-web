using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCredits : SmartContract
    {
        #region Reads (all pause-independent)
        /// <summary>The contract owner (deployer). Admin + upgrade authority.</summary>
        [Safe]
        public static UInt160 GetOwner()
        {
            ByteString v = Storage.Get(Storage.CurrentContext, PREFIX_OWNER);
            return v is null ? UInt160.Zero : (UInt160)v;
        }

        /// <summary>The designated settlement operator key (Zero when unset).</summary>
        [Safe]
        public static UInt160 Settler()
        {
            ByteString v = Storage.Get(Storage.CurrentContext, PREFIX_SETTLER);
            return v is null ? UInt160.Zero : (UInt160)v;
        }

        /// <summary>True while purchases and settlements are blocked.</summary>
        [Safe]
        public static bool IsPaused() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PAUSED) == 1;

        /// <summary>
        /// The user's LAST SETTLED credit balance: purchases in real time, minus
        /// spends up to the latest settlement epoch. The interactive balance
        /// lives in the platform DB and is lower by any unsettled recent spends.
        /// </summary>
        [Safe]
        public static BigInteger SettledBalanceOf(UInt160 user) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, BalanceKey(user));

        /// <summary>The latest settled epoch (0 before the first settlement).</summary>
        [Safe]
        public static BigInteger CurrentEpoch() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_EPOCH);

        /// <summary>Runtime.Time (ms) of the latest settlement; 0 if none yet.</summary>
        [Safe]
        public static BigInteger LastSettlementAt() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_LAST_SETTLED_AT);

        /// <summary>Lifetime GAS received through credit purchases (monotonic).</summary>
        [Safe]
        public static BigInteger TotalGasCollected() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_GAS);

        /// <summary>Sum of every settled balance — the outstanding exit liability in credits.</summary>
        [Safe]
        public static BigInteger TotalSettledCredits() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_CREDITS);

        /// <summary>GAS currently held: purchases minus exits minus owner withdrawals.</summary>
        [Safe]
        public static BigInteger HeldGas() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_HELD_GAS);

        /// <summary>GAS that must stay in the contract to back every settled credit.</summary>
        [Safe]
        public static BigInteger ExitLiabilityGas() => TotalSettledCredits() * GAS_PER_CREDIT;

        /// <summary>Credits a purchase of gasAmount base units would mint (0 = dust, rejected).</summary>
        [Safe]
        public static BigInteger CreditsForGas(BigInteger gasAmount) =>
            gasAmount <= 0 ? 0 : gasAmount / GAS_PER_CREDIT;

        /// <summary>The fixed purchase/exit rate: credits minted per 1 GAS.</summary>
        [Safe]
        public static BigInteger CreditsPerGas() => CREDITS_PER_GAS;

        /// <summary>GAS base units backing one credit (2_000_000 = 0.02 GAS).</summary>
        [Safe]
        public static BigInteger GasPerCredit() => GAS_PER_CREDIT;

        /// <summary>Max (user, delta) pairs one settlement call accepts.</summary>
        [Safe]
        public static BigInteger MaxSettlementBatch() => MAX_BATCH;
        #endregion
    }
}
