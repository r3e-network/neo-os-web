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
            ExecutionEngine.Assert(caller == GAS.Hash || caller == NEO.Hash, "unsupported asset");
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

        #endregion

        // ===================================================================
        //  NEP-17 payment receiver
        // ===================================================================

        /// <summary>
        /// Receives GAS/NEO payments.  The data parameter must be a string
        /// in the format "appId:..." so the contract can route the credit
        /// to the correct tenant.
        ///
        /// SECURITY:
        /// - Only accepts GAS or NEO tokens
        /// - Validates that appId extracted from memo is registered
        /// - Credits stored per-payer, consumed by game operations
        /// </summary>
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            if (from == null || from == UInt160.Zero) return;
            // Self-transfers are internal bookkeeping
            if (from == Runtime.ExecutingScriptHash) return;

            UInt160 caller = Runtime.CallingScriptHash;
            ExecutionEngine.Assert(caller == GAS.Hash || caller == NEO.Hash,
                "only GAS/NEO accepted");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            string memo = ReadPaymentMemo(data);
            ExecutionEngine.Assert(memo != null && memo.Length > 0, "memo required");

            // Extract appId (everything before the first ':')
            string appId = ExtractAppId(memo);
            RequireRegistered(appId);

            if (ConsumePendingGachaInventoryPayment(appId, from, amount, data))
            {
                return;
            }

            // Credit the payer's balance under this appId
            CreditDirectGasPayment(appId, from, amount, data);
        }
    }
}
