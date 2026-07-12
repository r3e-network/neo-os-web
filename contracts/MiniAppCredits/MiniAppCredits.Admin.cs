using System;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCredits : SmartContract
    {
        #region Access control helpers
        internal static void ValidateOwner()
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(GetOwner()), "owner witness required");
        }

        /// <summary>
        /// Settlement authority: the designated settler key (hot, rotatable) or
        /// the owner itself (cold fallback so a lost settler key cannot freeze
        /// checkpointing).
        /// </summary>
        internal static void ValidateOperator()
        {
            UInt160 settlerKey = Settler();
            bool authorized = (!settlerKey.IsZero && Runtime.CheckWitness(settlerKey))
                || Runtime.CheckWitness(GetOwner());
            ExecutionEngine.Assert(authorized, "settler or owner witness required");
        }
        #endregion

        #region Owner administration
        /// <summary>Designate (or rotate) the settlement operator key.</summary>
        public static void SetSettler(UInt160 settlerKey)
        {
            ValidateOwner();
            ExecutionEngine.Assert(
                settlerKey is not null && settlerKey.IsValid && !settlerKey.IsZero,
                "invalid settler");
            Storage.Put(Storage.CurrentContext, PREFIX_SETTLER, settlerKey);
            OnSettlerChanged(settlerKey);
        }

        /// <summary>
        /// Emergency brake: blocks purchases (OnNEP17Payment) and settlements
        /// (PostSettlement). Reads stay live, and Exit deliberately stays live
        /// too — a pause must never trap user funds.
        /// </summary>
        public static void SetPaused(bool paused)
        {
            ValidateOwner();
            Storage.Put(Storage.CurrentContext, PREFIX_PAUSED, paused ? 1 : 0);
            OnPausedChanged(paused);
        }

        /// <summary>
        /// Owner sweeps purchase GAS that is no longer exit-backed: the surplus
        /// above TotalSettledCredits * GAS_PER_CREDIT (i.e. GAS whose credits
        /// were settled as spent, plus sub-credit purchase remainders). The
        /// solvency guard makes it impossible to withdraw GAS backing any
        /// still-settled credit, so Exit can never bounce for lack of funds.
        /// </summary>
        public static void WithdrawGas(UInt160 to, BigInteger amount)
        {
            ValidateOwner();
            ExecutionEngine.Assert(to is not null && to.IsValid && !to.IsZero, "invalid recipient");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            StorageContext ctx = Storage.CurrentContext;
            BigInteger held = (BigInteger)Storage.Get(ctx, PREFIX_HELD_GAS);
            BigInteger liability = (BigInteger)Storage.Get(ctx, PREFIX_TOTAL_CREDITS) * GAS_PER_CREDIT;
            ExecutionEngine.Assert(held - amount >= liability, "amount exceeds exit-backed surplus");

            Storage.Put(ctx, PREFIX_HELD_GAS, held - amount);
            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, to, amount, "" });
            ExecutionEngine.Assert(ok, "withdraw transfer failed");
            OnGasWithdrawn(to, amount);
        }

        /// <summary>Owner-gated instant contract upgrade (no timelock).</summary>
        public static void Update(ByteString nef, string manifest)
        {
            ValidateOwner();
            ContractManagement.Update(nef, manifest, new object[0]);
        }
        #endregion
    }
}
