using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public delegate void LegacyCreditRecoveryInitializedHandler(
        ByteString snapshotHash,
        BigInteger neoRows,
        BigInteger gasRows,
        BigInteger neoLiability,
        BigInteger gasLiability);
    public delegate void LegacyCreditRecoveryActivatedHandler(
        ByteString snapshotHash,
        BigInteger neoLiability,
        BigInteger gasLiability);
    public delegate void LegacyCreditTopUpHandler(
        UInt160 payer,
        UInt160 asset,
        BigInteger amount);
    public delegate void LegacyCreditWithdrawnHandler(
        UInt160 payer,
        UInt160 asset,
        BigInteger amount);

    public partial class PlatformDeFiContract
    {
        private const int LegacyRecoveryUninitialized = 0;
        private const int LegacyRecoverySnapshotRequired = 1;
        private const int LegacyRecoveryBackingRequired = 2;
        private const int LegacyRecoveryActive = 3;
        private const int LegacyRecoveryComplete = 4;
        private const int MaxLegacyCreditRowsPerAsset = 256;
        private const string LegacyCreditTopUpMemo =
            "platform-defi:legacy-credit-topup";

        [DisplayName("LegacyCreditRecoveryInitialized")]
        public static event LegacyCreditRecoveryInitializedHandler
            OnLegacyCreditRecoveryInitialized;

        [DisplayName("LegacyCreditRecoveryActivated")]
        public static event LegacyCreditRecoveryActivatedHandler
            OnLegacyCreditRecoveryActivated;

        [DisplayName("LegacyCreditTopUp")]
        public static event LegacyCreditTopUpHandler OnLegacyCreditTopUp;

        [DisplayName("LegacyCreditWithdrawn")]
        public static event LegacyCreditWithdrawnHandler
            OnLegacyCreditWithdrawn;

        [Safe]
        public static BigInteger LegacyCreditRecoveryState() =>
            GetBigInteger((ByteString)PREFIX_LEGACY_CREDIT_RECOVERY_STATE);

        [Safe]
        public static ByteString LegacyCreditSnapshotHash()
        {
            ByteString value = GetRaw(
                (ByteString)PREFIX_LEGACY_CREDIT_SNAPSHOT_HASH);
            return value == null ? (ByteString)"" : value;
        }

        [Safe]
        public static BigInteger LegacyNeoCreditLiability() =>
            GetBigInteger((ByteString)PREFIX_LEGACY_NEO_CREDIT_LIABILITY);

        [Safe]
        public static BigInteger LegacyGasCreditLiability() =>
            GetBigInteger((ByteString)PREFIX_LEGACY_GAS_CREDIT_LIABILITY);

        [Safe]
        public static BigInteger LegacyNeoCreditRows() =>
            GetBigInteger((ByteString)PREFIX_LEGACY_NEO_CREDIT_ROWS);

        [Safe]
        public static BigInteger LegacyGasCreditRows() =>
            GetBigInteger((ByteString)PREFIX_LEGACY_GAS_CREDIT_ROWS);

        [Safe]
        public static BigInteger GetLegacyNeoCredit(UInt160 payer)
        {
            if (payer == UInt160.Zero || !payer.IsValid) return 0;
            return GetBigInteger(LegacyCreditKey(PREFIX_NEO_CREDIT, payer));
        }

        [Safe]
        public static BigInteger GetLegacyGasCredit(UInt160 payer)
        {
            if (payer == UInt160.Zero || !payer.IsValid) return 0;
            return GetBigInteger(LegacyCreditKey(PREFIX_GAS_CREDIT, payer));
        }

        public static void InitializeLegacyCreditRecovery(
            UInt160[] neoPayers,
            UInt160[] gasPayers,
            ByteString snapshotHash)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(IsPaused(), "platform must stay paused");
            ExecutionEngine.Assert(
                LegacyCreditRecoveryState() == LegacyRecoverySnapshotRequired,
                "legacy recovery snapshot already initialized");
            ExecutionEngine.Assert(
                snapshotHash != null && snapshotHash.Length == 32,
                "snapshot hash must be 32 bytes");
            ExecutionEngine.Assert(
                neoPayers != null &&
                neoPayers.Length <= MaxLegacyCreditRowsPerAsset,
                "too many legacy NEO rows");
            ExecutionEngine.Assert(
                gasPayers != null &&
                gasPayers.Length <= MaxLegacyCreditRowsPerAsset,
                "too many legacy GAS rows");
            ExecutionEngine.Assert(
                TotalNeoCreditLiability() == 0 &&
                TotalGasCreditLiability() == 0,
                "new direct credits already exist");

            BigInteger neoLiability =
                SumLegacyCredits(PREFIX_NEO_CREDIT, neoPayers);
            BigInteger gasLiability =
                SumLegacyCredits(PREFIX_GAS_CREDIT, gasPayers);
            Put((ByteString)PREFIX_LEGACY_CREDIT_SNAPSHOT_HASH, snapshotHash);
            PutOrDelete((ByteString)PREFIX_LEGACY_NEO_CREDIT_LIABILITY,
                neoLiability);
            PutOrDelete((ByteString)PREFIX_LEGACY_GAS_CREDIT_LIABILITY,
                gasLiability);
            PutOrDelete((ByteString)PREFIX_LEGACY_NEO_CREDIT_ROWS,
                neoPayers.Length);
            PutOrDelete((ByteString)PREFIX_LEGACY_GAS_CREDIT_ROWS,
                gasPayers.Length);

            BigInteger nextState =
                neoLiability == 0 && gasLiability == 0
                    ? LegacyRecoveryComplete
                    : LegacyRecoveryBackingRequired;
            Put((ByteString)PREFIX_LEGACY_CREDIT_RECOVERY_STATE, nextState);
            OnLegacyCreditRecoveryInitialized(
                snapshotHash,
                neoPayers.Length,
                gasPayers.Length,
                neoLiability,
                gasLiability);
        }

        public static void ActivateLegacyCreditRecovery()
        {
            ValidateAdmin();
            ExecutionEngine.Assert(IsPaused(), "platform must stay paused");
            ExecutionEngine.Assert(
                LegacyCreditRecoveryState() == LegacyRecoveryBackingRequired,
                "legacy recovery not awaiting backing");
            EnsureNeoCreditSolvent();
            EnsureGasCreditSolvent();
            Put((ByteString)PREFIX_LEGACY_CREDIT_RECOVERY_STATE,
                LegacyRecoveryActive);
            OnLegacyCreditRecoveryActivated(
                LegacyCreditSnapshotHash(),
                LegacyNeoCreditLiability(),
                LegacyGasCreditLiability());
        }

        public static BigInteger WithdrawLegacyNeoCredit(
            UInt160 payer,
            BigInteger amount)
        {
            ValidateLegacyWithdrawal(payer, amount);
            DebitLegacyCredit(
                PREFIX_NEO_CREDIT,
                PREFIX_LEGACY_NEO_CREDIT_LIABILITY,
                payer,
                amount);
            ExecutionEngine.Assert(
                NEO.Transfer(Runtime.ExecutingScriptHash, payer, amount),
                "legacy NEO withdrawal failed");
            EnsureNeoCreditSolvent();
            CompleteLegacyRecoveryIfEmpty();
            OnLegacyCreditWithdrawn(payer, NEO.Hash, amount);
            return amount;
        }

        public static BigInteger WithdrawLegacyGasCredit(
            UInt160 payer,
            BigInteger amount)
        {
            ValidateLegacyWithdrawal(payer, amount);
            DebitLegacyCredit(
                PREFIX_GAS_CREDIT,
                PREFIX_LEGACY_GAS_CREDIT_LIABILITY,
                payer,
                amount);
            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, payer, amount),
                "legacy GAS withdrawal failed");
            EnsureGasCreditSolvent();
            CompleteLegacyRecoveryIfEmpty();
            OnLegacyCreditWithdrawn(payer, GAS.Hash, amount);
            return amount;
        }

        private static BigInteger SumLegacyCredits(
            byte[] prefix,
            UInt160[] payers)
        {
            BigInteger total = 0;
            for (int index = 0; index < payers.Length; index++)
            {
                ValidateAddress(payers[index]);
                for (int prior = 0; prior < index; prior++)
                {
                    ExecutionEngine.Assert(
                        payers[prior] != payers[index],
                        "duplicate legacy payer");
                }
                BigInteger balance = GetBigInteger(
                    LegacyCreditKey(prefix, payers[index]));
                ExecutionEngine.Assert(
                    balance > 0,
                    "legacy credit row missing");
                total += balance;
            }
            return total;
        }

        private static void ReceiveLegacyCreditTopUp(
            UInt160 payer,
            UInt160 asset,
            BigInteger amount)
        {
            ExecutionEngine.Assert(IsPaused(), "platform must stay paused");
            ExecutionEngine.Assert(
                LegacyCreditRecoveryState() == LegacyRecoveryBackingRequired,
                "legacy recovery not awaiting backing");
            OnLegacyCreditTopUp(payer, asset, amount);
        }

        private static void ValidateLegacyWithdrawal(
            UInt160 payer,
            BigInteger amount)
        {
            ExecutionEngine.Assert(
                LegacyCreditRecoveryState() == LegacyRecoveryActive,
                "legacy recovery not active");
            ValidateAddress(payer);
            ExecutionEngine.Assert(
                Runtime.CheckWitness(payer),
                "unauthorized");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
        }

        private static void DebitLegacyCredit(
            byte[] creditPrefix,
            byte[] liabilityPrefix,
            UInt160 payer,
            BigInteger amount)
        {
            ByteString creditKey = LegacyCreditKey(creditPrefix, payer);
            BigInteger balance = GetBigInteger(creditKey);
            BigInteger liability =
                GetBigInteger((ByteString)liabilityPrefix);
            ExecutionEngine.Assert(
                balance >= amount && liability >= amount,
                "insufficient legacy credit");
            PutOrDelete(creditKey, balance - amount);
            PutOrDelete((ByteString)liabilityPrefix, liability - amount);
        }

        private static void CompleteLegacyRecoveryIfEmpty()
        {
            if (LegacyNeoCreditLiability() != 0 ||
                LegacyGasCreditLiability() != 0) return;
            Put((ByteString)PREFIX_LEGACY_CREDIT_RECOVERY_STATE,
                LegacyRecoveryComplete);
        }
    }
}
