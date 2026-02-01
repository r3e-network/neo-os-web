using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppUnbreakableVault
    {
        #region User Methods

        /// <summary>
        /// Create a new vault with bounty and secret hash.
        /// </summary>
        public static BigInteger CreateVault(
            UInt160 creator,
            ByteString secretHash,
            BigInteger bounty,
            BigInteger difficulty,
            string title,
            string description,
            BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(bounty >= MIN_BOUNTY, "min 1 GAS bounty");
            ExecutionEngine.Assert(secretHash.Length == 32, "invalid hash");
            ExecutionEngine.Assert(difficulty >= 1 && difficulty <= 3, "invalid difficulty");
            ExecutionEngine.Assert(title.Length > 0 && title.Length <= 100, "invalid title");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            ValidatePaymentReceipt(APP_ID, creator, bounty, receiptId);

            CreatorStats creatorStats = GetCreatorStats(creator);
            bool isNewCreator = creatorStats.JoinTime == 0;

            BigInteger vaultId = TotalVaults() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_VAULT_ID, vaultId);

            VaultData vault = new VaultData
            {
                Creator = creator,
                Bounty = bounty,
                SecretHash = secretHash,
                AttemptCount = 0,
                Difficulty = difficulty,
                CreatedTime = Runtime.Time,
                ExpiryTime = Runtime.Time + DEFAULT_EXPIRY_SECONDS,
                HintsRevealed = 0,
                Broken = false,
                Expired = false,
                Winner = UInt160.Zero,
                Title = title,
                Description = description
            };
            StoreVault(vaultId, vault);

            AddUserVault(creator, vaultId);
            UpdateTotalBounties(bounty, true);
            UpdateCreatorStatsOnCreate(creator, bounty, isNewCreator);

            OnVaultCreated(vaultId, creator, bounty, difficulty);
            return vaultId;
        }

        /// <summary>
        /// Attempt to break a vault by providing the secret.
        /// </summary>
        public static bool AttemptBreak(BigInteger vaultId, UInt160 attacker, ByteString secret, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            VaultData vault = GetVault(vaultId);
            ExecutionEngine.Assert(!vault.Broken, "already broken");
            ExecutionEngine.Assert(!vault.Expired, "vault expired");
            ExecutionEngine.Assert(Runtime.Time < vault.ExpiryTime, "vault expired");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(attacker), "unauthorized");

            BigInteger attemptFee = GetAttemptFee(vault.Difficulty);
            ValidatePaymentReceipt(APP_ID, attacker, attemptFee, receiptId);

            HackerStats hackerStats = GetHackerStats(attacker);
            bool isNewHacker = hackerStats.JoinTime == 0;

            vault.AttemptCount += 1;
            vault.Bounty += attemptFee;

            BigInteger totalAttempts = TotalAttempts();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_ATTEMPTS, totalAttempts + 1);

            ByteString attemptHash = CryptoLib.Sha256(secret);
            bool success = attemptHash == vault.SecretHash;

            if (success)
            {
                vault.Broken = true;
                vault.Winner = attacker;

                BigInteger fee = vault.Bounty * PLATFORM_FEE_BPS / 10000;
                BigInteger reward = vault.Bounty - fee;

                GAS.Transfer(Runtime.ExecutingScriptHash, attacker, reward);
                UpdateHackerStatsOnBreak(attacker, reward, vault.Difficulty, isNewHacker);
                UpdateCreatorStatsOnBroken(vault.Creator, vault.Bounty);
                UpdateTotalBroken();

                OnVaultBroken(vaultId, attacker, reward);
            }
            else
            {
                UpdateHackerStatsOnAttempt(attacker, isNewHacker);
            }

            StoreVault(vaultId, vault);
            OnAttemptMade(vaultId, attacker, success, vault.AttemptCount);
            return success;
        }

        /// <summary>
        /// Increase bounty on existing vault.
        /// </summary>
        public static void IncreaseBounty(BigInteger vaultId, BigInteger amount, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            VaultData vault = GetVault(vaultId);
            ExecutionEngine.Assert(!vault.Broken && !vault.Expired, "vault closed");
            ExecutionEngine.Assert(amount > 0, "invalid amount");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(vault.Creator), "unauthorized");

            ValidatePaymentReceipt(APP_ID, vault.Creator, amount, receiptId);

            vault.Bounty += amount;
            StoreVault(vaultId, vault);

            UpdateTotalBounties(amount, true);
            OnBountyIncreased(vaultId, amount, vault.Bounty);
        }

        /// <summary>
        /// Claim expired vault bounty (creator only).
        /// </summary>
        public static void ClaimExpiredVault(BigInteger vaultId)
        {
            ValidateNotGloballyPaused(APP_ID);

            VaultData vault = GetVault(vaultId);
            ExecutionEngine.Assert(!vault.Broken, "vault was broken");
            ExecutionEngine.Assert(!vault.Expired, "already claimed");
            ExecutionEngine.Assert(Runtime.Time >= vault.ExpiryTime, "not expired");
            ExecutionEngine.Assert(Runtime.CheckWitness(vault.Creator), "unauthorized");

            vault.Expired = true;
            StoreVault(vaultId, vault);

            BigInteger fee = vault.Bounty * PLATFORM_FEE_BPS / 10000;
            BigInteger refund = vault.Bounty - fee;

            GAS.Transfer(Runtime.ExecutingScriptHash, vault.Creator, refund);
            UpdateTotalBounties(vault.Bounty, false);
            UpdateCreatorStatsOnExpired(vault.Creator, refund);

            OnVaultExpired(vaultId, vault.Creator, refund);
        }

        #endregion

        #region Automation

        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");
        }

        #endregion
    }
}
