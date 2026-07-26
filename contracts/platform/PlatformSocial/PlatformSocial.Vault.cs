using System;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public partial class PlatformSocialContract
    {
        // ===================================================================
        // UnbreakableVault logic -- ported from MiniAppUnbreakableVault
        // ===================================================================

        #region Vault Methods

        /// <summary>
        /// Create a vault with a GAS bounty and a SHA-256 secret hash.
        /// difficulty: 1=Easy, 2=Medium, 3=Hard
        /// </summary>
        public static BigInteger CreateVault(
            string appId,
            UInt160 creator,
            ByteString secretHash,
            BigInteger difficulty)
        {
            ValidateAppNotPaused(appId);
            ValidateAppRegistered(appId, APP_TYPE_VAULT);
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "unauthorized");
            ExecutionEngine.Assert(creator != UInt160.Zero && creator.IsValid, "invalid creator");
            ExecutionEngine.Assert(secretHash.Length == 32, "invalid hash (need SHA-256)");
            ExecutionEngine.Assert(difficulty >= 1 && difficulty <= 3, "invalid difficulty");

            // Read the creator's GAS credit as the bounty
            BigInteger bounty = GetGasCreditBalance(appId, creator);
            ExecutionEngine.Assert(bounty >= MIN_BOUNTY, "min 1 GAS bounty");

            ConsumeGasCredit(appId, creator, bounty);

            // Increment vault counter for this app
            ByteString idKey = AppKey(appId, PREFIX_VAULT_ID);
            BigInteger vaultId = GetBigInteger(idKey) + 1;
            Put(idKey, vaultId);

            VaultData vault = new VaultData
            {
                Creator = creator,
                Bounty = bounty,
                SecretHash = secretHash,
                AttemptCount = 0,
                Difficulty = difficulty,
                CreatedTime = Runtime.Time,
                ExpiryTime = Runtime.Time + DEFAULT_VAULT_EXPIRY_MS,
                Broken = false,
                Expired = false,
                Winner = UInt160.Zero
            };
            StoreVault(appId, vaultId, vault);

            OnVaultCreated(appId, vaultId, creator, bounty, difficulty);
            return vaultId;
        }

        /// <summary>
        /// Commit to a vault attempt without revealing the solution. The commitment
        /// is `H(attacker || solution || salt)` and must be revealed via
        /// <see cref="RevealAttempt"/> at least <see cref="VAULT_REVEAL_MIN_DELAY_MS"/>
        /// later (audit fix H-10).
        ///
        /// Front-running protection: the previous single-step `AttemptBreak` accepted
        /// the plaintext solution in the tx body, so any mempool observer (including
        /// validators) could copy it, raise their fee, and steal the reward. Commit-
        /// reveal makes the front-runner's copy useless: the commit references the
        /// attacker's address, so re-using it would just lose the reveal.
        /// </summary>
        public static void CommitAttempt(string appId, BigInteger vaultId, UInt160 attacker, ByteString commitment)
        {
            ValidateAppNotPaused(appId);
            ValidateAppRegistered(appId, APP_TYPE_VAULT);
            ExecutionEngine.Assert(Runtime.CheckWitness(attacker), "unauthorized");
            ExecutionEngine.Assert(commitment != null && commitment.Length == 32, "invalid commitment");

            VaultData vault = GetVault(appId, vaultId);
            ExecutionEngine.Assert(vault.Creator != UInt160.Zero, "vault not found");
            ExecutionEngine.Assert(!vault.Broken, "already broken");
            ExecutionEngine.Assert(!vault.Expired, "vault expired");
            ExecutionEngine.Assert(Runtime.Time < (ulong)vault.ExpiryTime, "vault expired");

            // Commit fee is the same as the prior attempt fee so abusers can't spam
            // commits cheaply.
            BigInteger attemptFee = GetAttemptFee(vault.Difficulty);
            ConsumeGasCredit(appId, attacker, attemptFee);
            vault.Bounty += attemptFee;
            StoreVault(appId, vaultId, vault);

            // Store {commitment, commitTime}. Overwrites a prior pending commit by the
            // same attacker, which is intentional — only the most recent commit can be
            // revealed.
            ByteString record = StdLib.Serialize(new object[] { commitment, Runtime.Time });
            Put(AppKey(appId, PREFIX_VAULT_COMMIT, vaultId, attacker), record);
        }

        /// <summary>
        /// Reveal a previously committed solution. The reveal must happen at least
        /// <see cref="VAULT_REVEAL_MIN_DELAY_MS"/> after the commit (audit fix H-10).
        /// </summary>
        public static bool RevealAttempt(string appId, BigInteger vaultId, UInt160 attacker, ByteString solution, ByteString salt)
        {
            ValidateAppNotPaused(appId);
            ValidateAppRegistered(appId, APP_TYPE_VAULT);
            ExecutionEngine.Assert(Runtime.CheckWitness(attacker), "unauthorized");

            VaultData vault = GetVault(appId, vaultId);
            ExecutionEngine.Assert(vault.Creator != UInt160.Zero, "vault not found");
            ExecutionEngine.Assert(!vault.Broken, "already broken");
            ExecutionEngine.Assert(!vault.Expired, "vault expired");
            ExecutionEngine.Assert(Runtime.Time < (ulong)vault.ExpiryTime, "vault expired");

            ByteString commitKey = AppKey(appId, PREFIX_VAULT_COMMIT, vaultId, attacker);
            ByteString stored = Storage.Get(Storage.CurrentContext, commitKey);
            ExecutionEngine.Assert(stored != null, "no commit");

            object[] record = (object[])StdLib.Deserialize(stored);
            ByteString commitment = (ByteString)record[0];
            BigInteger commitTime = (BigInteger)record[1];
            // Use BigInteger arithmetic for the delay check so a future-dated
            // commitTime can't underflow into a giant `ulong` value and
            // accidentally satisfy the threshold. Runtime.Time is monotonic so
            // `(BigInteger)Runtime.Time >= commitTime` always under normal
            // operation; this just hardens against state corruption.
            BigInteger nowMs = (BigInteger)Runtime.Time;
            ExecutionEngine.Assert(nowMs >= commitTime, "commit in the future");
            ExecutionEngine.Assert(nowMs - commitTime >= VAULT_REVEAL_MIN_DELAY_MS, "reveal too soon");

            // Verify commitment = SHA256(attacker || solution || salt).
            ByteString preimage = Helper.Concat(
                Helper.Concat((ByteString)(byte[])attacker, solution),
                salt);
            ByteString computed = CryptoLib.Sha256(preimage);
            ExecutionEngine.Assert(computed == commitment, "commitment mismatch");

            // Consume the commit so it can't be replayed.
            Storage.Delete(Storage.CurrentContext, commitKey);

            vault.AttemptCount += 1;

            ByteString attemptHash = CryptoLib.Sha256(solution);
            bool success = attemptHash == vault.SecretHash;

            if (success)
            {
                vault.Broken = true;
                vault.Winner = attacker;

                BigInteger fee = vault.Bounty * VAULT_PLATFORM_FEE_BPS / 10000;
                BigInteger reward = vault.Bounty - fee;

                AcquireSocialLock();
                StoreVault(appId, vaultId, vault);

                ExecutionEngine.Assert(
                    GAS.Transfer(Runtime.ExecutingScriptHash, attacker, reward),
                    "reward transfer failed");

                if (fee > 0)
                {
                    UInt160 admin = Admin();
                    if (admin != UInt160.Zero && admin.IsValid)
                    {
                        ExecutionEngine.Assert(
                            GAS.Transfer(Runtime.ExecutingScriptHash, admin, fee),
                            "platform fee transfer failed");
                    }
                }
                EnsureGasCreditSolvent();
                ReleaseSocialLock();

                OnVaultBroken(appId, vaultId, attacker, reward);
            }
            else
            {
                StoreVault(appId, vaultId, vault);
            }

            OnAttemptMade(appId, vaultId, attacker, success, vault.AttemptCount);
            return success;
        }

        /// <summary>
        /// Increase the bounty on an existing vault.
        /// Owner signature fix: requires CheckWitness on vault.Creator
        /// (the original contract used a weaker IsAbstractAccountAuthorized check).
        /// </summary>
        public static void IncreaseBounty(string appId, BigInteger vaultId, BigInteger amount)
        {
            ValidateAppNotPaused(appId);
            ValidateAppRegistered(appId, APP_TYPE_VAULT);

            VaultData vault = GetVault(appId, vaultId);
            ExecutionEngine.Assert(vault.Creator != UInt160.Zero, "vault not found");
            ExecutionEngine.Assert(!vault.Broken && !vault.Expired, "vault closed");
            ExecutionEngine.Assert(amount > 0, "amount must be positive");

            // Owner signature fix: require direct witness from vault creator
            ExecutionEngine.Assert(Runtime.CheckWitness(vault.Creator), "only vault creator");

            ConsumeGasCredit(appId, vault.Creator, amount);

            vault.Bounty += amount;
            StoreVault(appId, vaultId, vault);

            OnBountyIncreased(appId, vaultId, amount, vault.Bounty);
        }

        /// <summary>
        /// Creator reclaims the unclaimed bounty from an expired, never-broken vault.
        /// Without this method the bounty (original + all accumulated attempt fees)
        /// would be locked in the contract forever once the expiry deadline passed.
        /// Refund is gated on:
        ///   • caller is the original creator (witness)
        ///   • vault has actually expired (Runtime.Time &gt; ExpiryTime)
        ///   • vault was never broken (no attacker won the bounty)
        ///   • Bounty &gt; 0 and not already refunded
        /// </summary>
        public static BigInteger RefundExpiredVault(string appId, BigInteger vaultId)
        {
            ValidateAppRegistered(appId, APP_TYPE_VAULT);

            VaultData vault = GetVault(appId, vaultId);
            ExecutionEngine.Assert(vault.Creator != UInt160.Zero, "vault not found");
            ExecutionEngine.Assert(Runtime.CheckWitness(vault.Creator), "only creator");
            ExecutionEngine.Assert(!vault.Broken, "vault already broken");
            ExecutionEngine.Assert(!vault.Expired, "vault already refunded");
            ExecutionEngine.Assert(Runtime.Time > (ulong)vault.ExpiryTime, "vault not expired");
            ExecutionEngine.Assert(vault.Bounty > 0, "nothing to refund");

            BigInteger refund = vault.Bounty;

            // Zero the bounty and mark expired BEFORE the transfer (CEI).
            vault.Bounty = 0;
            vault.Expired = true;
            AcquireSocialLock();
            StoreVault(appId, vaultId, vault);

            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, vault.Creator, refund),
                "refund transfer failed");
            EnsureGasCreditSolvent();
            ReleaseSocialLock();

            OnVaultRefunded(appId, vaultId, vault.Creator, refund);
            return refund;
        }

        /// <summary>
        /// Read vault state.
        /// </summary>
        [Safe]
        public static VaultData GetVault(string appId, BigInteger vaultId)
        {
            ByteString data = GetRaw(AppKey(appId, PREFIX_VAULTS, vaultId));
            if (data == null) return new VaultData();
            return (VaultData)StdLib.Deserialize(data);
        }

        #endregion

        #region Vault Internal Helpers

        private static void StoreVault(string appId, BigInteger vaultId, VaultData vault)
        {
            Put(AppKey(appId, PREFIX_VAULTS, vaultId), StdLib.Serialize(vault));
        }

        private static BigInteger GetAttemptFee(BigInteger difficulty)
        {
            if (difficulty == 1) return ATTEMPT_FEE_EASY;
            if (difficulty == 2) return ATTEMPT_FEE_MEDIUM;
            return ATTEMPT_FEE_HARD;
        }

        #endregion
    }
}
