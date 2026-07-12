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
        #region Settlement — batched spend checkpoints
        /// <summary>
        /// Posts one operator-signed settlement epoch: the NET SPEND per user
        /// since the previous epoch, as parallel (users[], deltas[]) arrays.
        ///
        /// PAYLOAD CHOICE — per-user delta arrays, NOT a balances merkle root:
        ///   * A merkle root is cheaper to WRITE (one 32-byte slot per epoch) but
        ///     makes the chain non-authoritative for reads: SettledBalanceOf and
        ///     Exit would need user-supplied merkle proofs plus an in-contract
        ///     verifier, and a user whose proof source (the platform DB/API) goes
        ///     away loses the exit path — exactly the custody failure this
        ///     checkpoint exists to mitigate.
        ///   * Delta arrays keep per-user settled balances as first-class
        ///     contract storage: Exit is proof-free, reads are direct, and each
        ///     epoch costs one storage write per DEBITED user only (users with no
        ///     net spend are simply omitted from the batch).
        ///   * Neo N3 sizing: a transaction script is capped at 102400 bytes and
        ///     one (address, delta) pair costs ~30 bytes of script, so
        ///     MAX_BATCH = 500 stays comfortably inside both the script cap and
        ///     the VM stack-item limits. Larger settlements split across
        ///     consecutive epochs — each call is its own checkpoint.
        ///
        /// SPEND-ONLY DELTAS: every delta must be strictly negative. The settler
        /// key can therefore never MINT exitable credits — a compromised settler
        /// can at worst zero out balances (griefing, recoverable by re-crediting
        /// through real purchases), never drain the contract's GAS through Exit.
        ///
        /// CLAMP, DON'T ABORT: if a user's recorded spend exceeds their on-chain
        /// balance (e.g. they exited mid-epoch), the debit clamps at zero instead
        /// of aborting, so one stale row cannot wedge the whole checkpoint. The
        /// DB stays the interactive truth; this checkpoint is the audit trail.
        ///
        /// EPOCHS are strictly monotonic with no gaps (next == current + 1), so
        /// a replayed or reordered batch is rejected outright.
        /// </summary>
        public static BigInteger PostSettlement(BigInteger epoch, UInt160[] users, BigInteger[] deltas)
        {
            ExecutionEngine.Assert(!IsPaused(), "contract paused");
            ValidateOperator();

            StorageContext ctx = Storage.CurrentContext;
            BigInteger current = (BigInteger)Storage.Get(ctx, PREFIX_EPOCH);
            ExecutionEngine.Assert(epoch == current + 1, "invalid epoch");

            ExecutionEngine.Assert(users is not null && deltas is not null, "invalid payload");
            ExecutionEngine.Assert(users.Length == deltas.Length, "length mismatch");
            ExecutionEngine.Assert(users.Length > 0 && users.Length <= MAX_BATCH, "batch size out of range");

            BigInteger totalDebited = 0;
            for (int i = 0; i < users.Length; i++)
            {
                UInt160 user = users[i];
                ExecutionEngine.Assert(user is not null && user.IsValid && !user.IsZero, "invalid user");
                BigInteger delta = deltas[i];
                ExecutionEngine.Assert(delta < 0, "delta must be negative");
                BigInteger spend = -delta;

                byte[] key = BalanceKey(user);
                BigInteger balance = (BigInteger)Storage.Get(ctx, key);
                BigInteger debit = balance < spend ? balance : spend; // clamp at zero
                if (debit == 0) continue;

                BigInteger next = balance - debit;
                if (next == 0) Storage.Delete(ctx, key);
                else Storage.Put(ctx, key, next);
                totalDebited += debit;
            }

            Storage.Put(ctx, PREFIX_EPOCH, epoch);
            Storage.Put(ctx, PREFIX_LAST_SETTLED_AT, Runtime.Time);
            if (totalDebited > 0)
            {
                Storage.Put(ctx, PREFIX_TOTAL_CREDITS,
                    (BigInteger)Storage.Get(ctx, PREFIX_TOTAL_CREDITS) - totalDebited);
            }

            OnSettlementPosted(epoch, users.Length, totalDebited);
            return totalDebited;
        }
        #endregion

        #region Exit — user trust mitigation
        /// <summary>
        /// Burns the caller's ENTIRE last-settled credit balance back to GAS at
        /// the same fixed rate (credits * 0.02 GAS) and pays it to their wallet.
        ///
        /// This is the user's unilateral escape hatch from platform custody: it
        /// needs no operator cooperation and — deliberately — keeps working while
        /// the contract is paused, so a pause can never trap user funds. The
        /// solvency invariant (heldGas >= exit liability, enforced by
        /// WithdrawGas) guarantees the transfer is always funded.
        ///
        /// KNOWN LIMIT (documented, not hidden): spends since the last settlement
        /// epoch are not yet reflected on-chain, so a user can exit credits the
        /// DB already debited. The next settlement clamps their on-chain balance
        /// at zero; the platform absorbs that gap and mitigates it by settling
        /// frequently. The DB should treat an observed CreditsExited event as an
        /// immediate zeroing debit for that user.
        /// </summary>
        public static BigInteger Exit(UInt160 user)
        {
            ExecutionEngine.Assert(user is not null && user.IsValid && !user.IsZero, "invalid user");
            ExecutionEngine.Assert(Runtime.CheckWitness(user), "user witness required");

            StorageContext ctx = Storage.CurrentContext;
            byte[] key = BalanceKey(user);
            BigInteger credits = (BigInteger)Storage.Get(ctx, key);
            ExecutionEngine.Assert(credits > 0, "no settled credits");

            BigInteger gasOut = credits * GAS_PER_CREDIT;

            // Effects before the transfer interaction (CEI): a reentrant call
            // sees a zero balance and aborts on "no settled credits".
            Storage.Delete(ctx, key);
            Storage.Put(ctx, PREFIX_TOTAL_CREDITS,
                (BigInteger)Storage.Get(ctx, PREFIX_TOTAL_CREDITS) - credits);
            Storage.Put(ctx, PREFIX_HELD_GAS,
                (BigInteger)Storage.Get(ctx, PREFIX_HELD_GAS) - gasOut);

            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, user, gasOut, "" });
            ExecutionEngine.Assert(ok, "exit transfer failed");

            OnCreditsExited(user, credits, gasOut);
            return gasOut;
        }
        #endregion
    }
}
