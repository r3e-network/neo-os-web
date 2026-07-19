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
    // Audit fix H-1: emitted when a payer reclaims unconsumed prepaid GAS credit.
    public delegate void GasCreditWithdrawnHandler(string appId, UInt160 payer, BigInteger amount);

    public partial class PlatformGameContract
    {
        [DisplayName("GasCreditWithdrawn")]
        public static event GasCreditWithdrawnHandler OnGasCreditWithdrawn;

        #region Direct GAS Credit Flow

        /// <summary>Read the payment memo from OnNEP17Payment data.</summary>
        private static string ReadPaymentMemo(object data)
        {
            if (data == null) return "";
            if (data is string text) return text ?? "";
            if (data is ByteString byteString) return (string)byteString;
            return data.ToString() ?? "";
        }

        /// <summary>
        /// Credit GAS to a payer's balance.
        /// Uses appId-namespaced keys so balances are per-tenant.
        /// </summary>
        private static void CreditDirectGasPayment(string appId, UInt160 from, BigInteger amount, object data)
        {
            if (from == Runtime.ExecutingScriptHash) return;

            UInt160 caller = Runtime.CallingScriptHash;
            ExecutionEngine.Assert(caller == GAS.Hash, "only GAS accepted");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            // Validate memo format: "appId:..."
            string memo = ReadPaymentMemo(data);
            ExecutionEngine.Assert(memo.StartsWith(appId + ":"), "invalid payment memo");

            // Store credit under appId + player address
            byte[] key = AppKey(appId, PREFIX_DIRECT_GAS_CREDIT, from);
            BigInteger balance = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            Storage.Put(Storage.CurrentContext, key, balance + amount);
        }

        /// <summary>Get a player's prepaid GAS balance for an appId.</summary>
        [Safe]
        public static BigInteger GetDirectGasCredit(string appId, UInt160 payer)
        {
            byte[] key = AppKey(appId, PREFIX_DIRECT_GAS_CREDIT, payer);
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }

        /// <summary>
        /// Consume prepaid GAS credit for a specific appId.
        /// Asserts the payer has sufficient balance.
        /// </summary>
        private static void ConsumeDirectGasCredit(string appId, UInt160 payer, BigInteger amount)
        {
            ValidateAddress(payer);
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            byte[] key = AppKey(appId, PREFIX_DIRECT_GAS_CREDIT, payer);
            BigInteger balance = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            ExecutionEngine.Assert(balance >= amount, "insufficient prepaid gas");

            BigInteger next = balance - amount;
            if (next == 0)
            {
                Storage.Delete(Storage.CurrentContext, key);
            }
            else
            {
                Storage.Put(Storage.CurrentContext, key, next);
            }
        }

        /// <summary>
        /// Audit fix H-1: reclaim unconsumed prepaid GAS credit for an appId.
        /// Witness-gated to the credit owner (the original payer). Intentionally
        /// does NOT call RequireNotPaused so funds are never permanently locked
        /// when an app is paused or deregistered. Checks-effects-interactions:
        /// the ledger is debited before the GAS is sent, so a recipient contract's
        /// onNEP17Payment callback cannot re-withdraw.
        /// </summary>
        public static void WithdrawGasCredit(string appId, BigInteger amount)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "appId required");
            UInt160 payer = Runtime.Transaction.Sender;
            ValidateAddress(payer);
            ExecutionEngine.Assert(Runtime.CheckWitness(payer), "unauthorized");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            byte[] key = AppKey(appId, PREFIX_DIRECT_GAS_CREDIT, payer);
            BigInteger balance = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            ExecutionEngine.Assert(balance >= amount, "insufficient prepaid gas");

            BigInteger next = balance - amount;
            if (next == 0)
            {
                Storage.Delete(Storage.CurrentContext, key);
            }
            else
            {
                Storage.Put(Storage.CurrentContext, key, next);
            }

            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, payer, amount),
                "gas withdrawal failed");
            OnGasCreditWithdrawn(appId, payer, amount);
        }

        /// <summary>
        /// Credit GAS to a payer's prepaid balance from contract-internal funds
        /// (e.g. a settled prize). Used for pull-payment payouts so a recipient
        /// whose onNEP17Payment faults can never brick the paying call: the
        /// recipient pulls the credited GAS via WithdrawGasCredit instead.
        /// </summary>
        private static void AddDirectGasCredit(string appId, UInt160 payer, BigInteger amount)
        {
            ValidateAddress(payer);
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            byte[] key = AppKey(appId, PREFIX_DIRECT_GAS_CREDIT, payer);
            BigInteger balance = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            Storage.Put(Storage.CurrentContext, key, balance + amount);
        }

        #endregion

        // ===================================================================
        //  NEP-17 payment receiver
        // ===================================================================

        /// <summary>
        /// Receives GAS payments.  The data parameter must be a string
        /// in the format "appId:..." so the contract can route the credit
        /// to the correct tenant.
        ///
        /// SECURITY:
        /// - Only accepts GAS (audit: NEO was previously credited 1:1 into
        ///   the GAS-denominated ledger — 1 NEO, indivisible, landed as one
        ///   GAS base unit and silently destroyed the payer's value)
        /// - Validates that appId extracted from memo is registered
        /// - Credits stored per-payer, consumed by game operations
        /// </summary>
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            if (from == null || from == UInt160.Zero) return;
            // Self-transfers are internal bookkeeping
            if (from == Runtime.ExecutingScriptHash) return;

            UInt160 caller = Runtime.CallingScriptHash;
            ExecutionEngine.Assert(caller == GAS.Hash, "only GAS accepted");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            string memo = ReadPaymentMemo(data);
            ExecutionEngine.Assert(memo != null && memo.Length > 0, "memo required");

            // Extract appId (everything before the first ':')
            string appId = ExtractAppId(memo);
            RequireRegistered(appId);

            // RewardGame tenants (gameType 5) route to their own sub-ledgers:
            // "appId:fund" tops up the reward pool, "appId:entry" prepays the
            // player's entry credit. Credit-only, like every lane here.
            if (GetGameType(appId) == GameType_RewardGame)
            {
                CreditRewardGamePayment(appId, from, amount, memo);
                return;
            }

            if (ConsumePendingGachaInventoryPayment(appId, from, amount, data))
            {
                return;
            }

            // Credit the payer's balance under this appId
            CreditDirectGasPayment(appId, from, amount, data);
        }
    }
}
