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
            StorageMap gasCredits = new StorageMap(Storage.CurrentContext, PREFIX_DIRECT_GAS_CREDIT);
            ByteString creditKey = (ByteString)(byte[])creator;
            ByteString existing = gasCredits.Get(creditKey);
            BigInteger bounty = existing == null ? 0 : (BigInteger)existing;
            ExecutionEngine.Assert(bounty >= MIN_BOUNTY, "min 1 GAS bounty");

            ConsumeGasCredit(creator, bounty);

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
                ExpiryTime = Runtime.Time + DEFAULT_VAULT_EXPIRY,
                Broken = false,
                Expired = false,
                Winner = UInt160.Zero
            };
            StoreVault(appId, vaultId, vault);

            OnVaultCreated(appId, vaultId, creator, bounty, difficulty);
            return vaultId;
        }

        /// <summary>
        /// Attempt to break a vault by providing the plaintext secret.
        /// The attempt fee (based on difficulty) is taken from attacker's GAS credit
        /// and added to the bounty pool.
        /// </summary>
        public static bool AttemptBreak(string appId, BigInteger vaultId, UInt160 attacker, ByteString solution)
        {
            ValidateAppNotPaused(appId);
            ValidateAppRegistered(appId, APP_TYPE_VAULT);
            ExecutionEngine.Assert(Runtime.CheckWitness(attacker), "unauthorized");

            VaultData vault = GetVault(appId, vaultId);
            ExecutionEngine.Assert(vault.Creator != UInt160.Zero, "vault not found");
            ExecutionEngine.Assert(!vault.Broken, "already broken");
            ExecutionEngine.Assert(!vault.Expired, "vault expired");
            ExecutionEngine.Assert(Runtime.Time < (ulong)vault.ExpiryTime, "vault expired");

            BigInteger attemptFee = GetAttemptFee(vault.Difficulty);
            ConsumeGasCredit(attacker, attemptFee);

            vault.AttemptCount += 1;
            vault.Bounty += attemptFee;

            ByteString attemptHash = CryptoLib.Sha256(solution);
            bool success = attemptHash == vault.SecretHash;

            if (success)
            {
                vault.Broken = true;
                vault.Winner = attacker;

                BigInteger fee = vault.Bounty * VAULT_PLATFORM_FEE_BPS / 10000;
                BigInteger reward = vault.Bounty - fee;

                ExecutionEngine.Assert(
                    GAS.Transfer(Runtime.ExecutingScriptHash, attacker, reward),
                    "reward transfer failed");

                if (fee > 0)
                {
                    UInt160 admin = Admin();
                    if (admin != UInt160.Zero && admin.IsValid)
                    {
                        GAS.Transfer(Runtime.ExecutingScriptHash, admin, fee);
                    }
                }

                OnVaultBroken(appId, vaultId, attacker, reward);
            }

            StoreVault(appId, vaultId, vault);
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

            ConsumeGasCredit(vault.Creator, amount);

            vault.Bounty += amount;
            StoreVault(appId, vaultId, vault);

            OnBountyIncreased(appId, vaultId, amount, vault.Bounty);
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
