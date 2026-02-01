using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHeritageTrust
    {
        #region NEP-17 Callback
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            // Allow receiving NEO, GAS, and bNEO.
            // If we receive GAS from the bNEO contract, treat it as staking rewards.
            if (Runtime.CallingScriptHash != GAS.Hash) return;

            UInt160 bneo = BneoContract();
            if (bneo != null && bneo.IsValid && from == bneo)
            {
                DistributeRewards(amount);
            }
        }

        private static void DistributeRewards(BigInteger amount)
        {
            if (amount <= 0) return;
            BigInteger totalNeo = TotalNeoPrincipal();
            if (totalNeo <= 0) return;

            BigInteger rewardPerNeo = GetRewardPerNeo();
            rewardPerNeo += (amount * 100000000) / totalNeo;
            Storage.Put(Storage.CurrentContext, PREFIX_REWARD_PER_NEO, rewardPerNeo);
        }
        #endregion

        #region Admin Methods

        public static void SetBneoContract(UInt160 bneo)
        {
            ValidateAdmin();
            ValidateAddress(bneo);
            SetBneoContractInternal(bneo);
        }

        #endregion

        #region User-Facing Methods

        /// <summary>
        /// Create a new living trust with NEO deposit.
        /// </summary>
        public static BigInteger CreateTrust(
            UInt160 owner,
            UInt160 heir,
            BigInteger neoAmount,
            BigInteger gasAmount,
            BigInteger heartbeatIntervalDays,
            BigInteger monthlyNeo,
            BigInteger monthlyGas,
            bool onlyRewards,
            string trustName,
            string notes,
            BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(owner.IsValid, "invalid owner");
            ExecutionEngine.Assert(heir.IsValid && heir != owner, "invalid heir");
            ExecutionEngine.Assert(neoAmount > 0 || gasAmount > 0, "no principal");
            if (neoAmount > 0)
            {
                ExecutionEngine.Assert(neoAmount >= MIN_PRINCIPAL, "below minimum principal");
            }
            ExecutionEngine.Assert(trustName.Length > 0 && trustName.Length <= 100, "invalid name");

            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "unauthorized");

            BigInteger intervalSeconds = heartbeatIntervalDays * 86400;
            ExecutionEngine.Assert(intervalSeconds >= MIN_HEARTBEAT_SECONDS && intervalSeconds <= MAX_HEARTBEAT_SECONDS, "invalid interval");

            ExecutionEngine.Assert(monthlyNeo >= 0 && monthlyGas >= 0, "invalid schedule");
            if (onlyRewards)
            {
                ExecutionEngine.Assert(gasAmount == 0, "gas principal not allowed");
                ExecutionEngine.Assert(neoAmount > 0, "rewards require NEO");
                monthlyNeo = 0;
                monthlyGas = 0;
            }
            else
            {
                if (neoAmount > 0)
                {
                    ExecutionEngine.Assert(monthlyNeo > 0, "monthly NEO required");
                }
                else
                {
                    ExecutionEngine.Assert(monthlyNeo == 0, "monthly NEO not allowed");
                }
                if (gasAmount > 0)
                {
                    ExecutionEngine.Assert(monthlyGas > 0, "monthly GAS required");
                }
                else
                {
                    ExecutionEngine.Assert(monthlyGas == 0, "monthly GAS not allowed");
                }
            }

            if (gasAmount > 0)
            {
                bool gasOk = GAS.Transfer(owner, Runtime.ExecutingScriptHash, gasAmount, null);
                ExecutionEngine.Assert(gasOk, "gas transfer failed");
            }

            // Transfer NEO into contract, then swap to bNEO for rewards
            if (neoAmount > 0)
            {
                bool neoOk = NEO.Transfer(owner, Runtime.ExecutingScriptHash, neoAmount, null);
                ExecutionEngine.Assert(neoOk, "neo transfer failed");
                StakeNeoToBneo(neoAmount);
            }

            BigInteger trustId = TotalTrusts() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_TRUST_ID, trustId);

            Trust trust = new Trust
            {
                Owner = owner,
                PrimaryHeir = heir,
                Principal = neoAmount,
                GasPrincipal = gasAmount,
                AccruedYield = 0,
                ClaimedYield = 0,
                MonthlyNeoRelease = onlyRewards ? 0 : monthlyNeo,
                MonthlyGasRelease = onlyRewards ? 0 : monthlyGas,
                OnlyReleaseRewards = onlyRewards,
                LastReleaseTime = 0,
                TotalNeoReleased = 0,
                TotalGasReleased = 0,
                CreatedTime = Runtime.Time,
                LastHeartbeat = Runtime.Time,
                HeartbeatInterval = intervalSeconds,
                Deadline = Runtime.Time + intervalSeconds,
                Active = true,
                Executed = false,
                Cancelled = false,
                TrustName = trustName,
                Notes = notes
            };

            // Initialize reward debt to existing RewardPerNeo
            BigInteger rewardPerNeo = GetRewardPerNeo();
            Storage.Put(Storage.CurrentContext, Helper.Concat(PREFIX_REWARD_DEBT, trustId.ToByteArray()), rewardPerNeo);

            StoreTrust(trustId, trust);

            AddUserTrust(owner, trustId);
            AddHeirTrust(heir, trustId);
            UpdateOwnerStatsOnCreate(owner, neoAmount + gasAmount);
            UpdateTotalPrincipal(neoAmount + gasAmount);
            UpdateTotalNeoPrincipal(neoAmount);

            OnTrustCreated(trustId, owner, heir, neoAmount);
            return trustId;
        }

        /// <summary>
        /// Record heartbeat to reset inheritance timer.
        /// </summary>
        public static void Heartbeat(BigInteger trustId)
        {
            ValidateNotGloballyPaused(APP_ID);

            Trust trust = GetTrust(trustId);
            ExecutionEngine.Assert(trust.Active, "trust not active");
            ExecutionEngine.Assert(!trust.Executed, "trust already executed");
            ExecutionEngine.Assert(Runtime.CheckWitness(trust.Owner), "unauthorized");

            trust.LastHeartbeat = Runtime.Time;
            trust.Deadline = Runtime.Time + trust.HeartbeatInterval;
            StoreTrust(trustId, trust);

            UpdateOwnerStatsOnHeartbeat(trust.Owner);

            OnHeartbeatRecorded(trustId, trust.Deadline);
        }

        /// <summary>
        /// Claim accumulated GAS yield from trust.
        /// </summary>
        public static void ClaimYield(BigInteger trustId)
        {
            ValidateNotGloballyPaused(APP_ID);

            Trust trust = GetTrust(trustId);
            ExecutionEngine.Assert(trust.Active, "trust not active");
            ExecutionEngine.Assert(!trust.Executed, "already executed");
            ExecutionEngine.Assert(Runtime.CheckWitness(trust.Owner), "unauthorized");

            ClaimBneoRewards();
            trust = RefreshTrustRewards(trustId, trust);

            ExecutionEngine.Assert(trust.AccruedYield > 0, "no yield to claim");

            BigInteger yieldAmount = trust.AccruedYield;
            trust.AccruedYield = 0;
            trust.ClaimedYield += yieldAmount;
            StoreTrust(trustId, trust);

            GAS.Transfer(Runtime.ExecutingScriptHash, trust.Owner, yieldAmount);

            UpdateOwnerStatsOnYieldClaim(trust.Owner, yieldAmount);
            UpdateTotalYield(yieldAmount);

            OnYieldClaimed(trustId, trust.Owner, yieldAmount);
        }

        /// <summary>
        /// Execute trust after owner presumed deceased (deadline passed).
        /// This marks the trust as triggered and starts the release schedule.
        /// </summary>
        public static void ExecuteTrust(BigInteger trustId)
        {
            ValidateNotGloballyPaused(APP_ID);

            Trust trust = GetTrust(trustId);
            ExecutionEngine.Assert(trust.Active, "trust not active");
            ExecutionEngine.Assert(!trust.Executed, "already executed");

            BigInteger graceDeadline = trust.Deadline + GRACE_PERIOD_SECONDS;
            ExecutionEngine.Assert(Runtime.Time >= graceDeadline, "owner still alive");

            bool isHeir = Runtime.CheckWitness(trust.PrimaryHeir);
            bool isGuardian = IsGuardian(trustId, Runtime.Transaction.Sender);
            ExecutionEngine.Assert(isHeir || isGuardian, "unauthorized executor");

            // Instead of total transfer, we mark it as "Executed" (meaning triggered for release)
            // Or we just update the state to allow beneficiary claims.
            trust.Executed = true;
            trust.LastReleaseTime = 0;
            StoreTrust(trustId, trust);

            UpdateOwnerStatsOnExecute(trust.Owner);
            UpdateTotalExecuted();

            OnTrustExecuted(trustId, trust.PrimaryHeir, trust.Principal + trust.GasPrincipal);
        }

        /// <summary>
        /// Beneficiary claims their monthly released portion.
        /// </summary>
        public static void ClaimReleasedAssets(BigInteger trustId)
        {
            ValidateNotGloballyPaused(APP_ID);

            Trust trust = GetTrust(trustId);
            ExecutionEngine.Assert(trust.Executed, "trust not executed/triggered");
            ExecutionEngine.Assert(trust.Active, "trust not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(trust.PrimaryHeir), "unauthorized beneficiary");

            ClaimBneoRewards();
            trust = RefreshTrustRewards(trustId, trust);

            BigInteger timeSinceLastRelease = Runtime.Time - trust.LastReleaseTime;
            BigInteger monthsToRelease = timeSinceLastRelease / 2592000; // 30 days
            if (trust.LastReleaseTime == 0) monthsToRelease = 1; // First claim

            ExecutionEngine.Assert(monthsToRelease > 0, "nothing to release yet");

            BigInteger neoToRelease = 0;
            BigInteger gasPrincipalToRelease = 0;

            if (!trust.OnlyReleaseRewards && trust.MonthlyNeoRelease > 0)
            {
                neoToRelease = trust.MonthlyNeoRelease * monthsToRelease;
                BigInteger remainingNeo = trust.Principal - trust.TotalNeoReleased;
                if (remainingNeo < 0) remainingNeo = 0;
                if (neoToRelease > remainingNeo)
                {
                    neoToRelease = remainingNeo;
                }
            }

            if (!trust.OnlyReleaseRewards && trust.MonthlyGasRelease > 0)
            {
                gasPrincipalToRelease = trust.MonthlyGasRelease * monthsToRelease;
                BigInteger remainingGas = trust.GasPrincipal - trust.TotalGasReleased;
                if (remainingGas < 0) remainingGas = 0;
                if (gasPrincipalToRelease > remainingGas)
                {
                    gasPrincipalToRelease = remainingGas;
                }
            }

            BigInteger rewardsToRelease = trust.AccruedYield;
            trust.AccruedYield = 0;
            trust.ClaimedYield += rewardsToRelease;

            BigInteger gasToRelease = gasPrincipalToRelease + rewardsToRelease;

            ExecutionEngine.Assert(neoToRelease > 0 || gasToRelease > 0, "no assets to release");

            trust.TotalNeoReleased += neoToRelease;
            trust.TotalGasReleased += gasPrincipalToRelease;
            trust.LastReleaseTime = Runtime.Time;

            if (neoToRelease > 0 || gasPrincipalToRelease > 0)
            {
                UpdateTotalPrincipal(-(neoToRelease + gasPrincipalToRelease));
            }
            
            if (trust.TotalNeoReleased >= trust.Principal && trust.TotalGasReleased >= trust.GasPrincipal && !trust.OnlyReleaseRewards)
            {
                trust.Active = false; // Trust fully drained
            }
            StoreTrust(trustId, trust);

            if (neoToRelease > 0)
            {
                RedeemBneoToNeo(neoToRelease);
                NEO.Transfer(Runtime.ExecutingScriptHash, trust.PrimaryHeir, neoToRelease);
                UpdateTotalNeoPrincipal(-neoToRelease);
            }
            if (gasToRelease > 0)
                GAS.Transfer(Runtime.ExecutingScriptHash, trust.PrimaryHeir, gasToRelease);

            if (rewardsToRelease > 0)
            {
                UpdateTotalYield(rewardsToRelease);
                OnYieldClaimed(trustId, trust.PrimaryHeir, rewardsToRelease);
            }
        }

        /// <summary>
        /// Cancel trust and return principal (with penalty if early).
        /// </summary>
        public static void CancelTrust(BigInteger trustId)
        {
            ValidateNotGloballyPaused(APP_ID);

            Trust trust = GetTrust(trustId);
            ExecutionEngine.Assert(trust.Active, "trust not active");
            ExecutionEngine.Assert(!trust.Executed, "already executed");
            ExecutionEngine.Assert(Runtime.CheckWitness(trust.Owner), "unauthorized");

            BigInteger penalty = trust.Principal * CANCEL_PENALTY_BPS / 10000;
            BigInteger refundAmount = trust.Principal - penalty;

            trust.Active = false;
            trust.Cancelled = true;
            StoreTrust(trustId, trust);

            if (trust.Principal > 0)
            {
                RedeemBneoToNeo(trust.Principal);
                NEO.Transfer(Runtime.ExecutingScriptHash, trust.Owner, refundAmount);
                UpdateTotalNeoPrincipal(-trust.Principal);

                if (penalty > 0)
                {
                    UInt160 admin = Admin();
                    if (admin != null && admin.IsValid)
                    {
                        NEO.Transfer(Runtime.ExecutingScriptHash, admin, penalty);
                    }
                }
            }

            if (trust.GasPrincipal > 0)
            {
                GAS.Transfer(Runtime.ExecutingScriptHash, trust.Owner, trust.GasPrincipal);
            }

            UpdateOwnerStatsOnCancel(trust.Owner);
            UpdateTotalCancelled();
            UpdateTotalPrincipal(-(trust.Principal + trust.GasPrincipal));

            OnTrustCancelled(trustId, trust.Owner, refundAmount);
        }

        /// <summary>
        /// Change the primary heir of a trust.
        /// </summary>
        public static void ChangeHeir(BigInteger trustId, UInt160 newHeir)
        {
            ValidateNotGloballyPaused(APP_ID);

            Trust trust = GetTrust(trustId);
            ExecutionEngine.Assert(trust.Active, "trust not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(trust.Owner), "unauthorized");
            ExecutionEngine.Assert(newHeir.IsValid && newHeir != trust.Owner, "invalid heir");

            UInt160 oldHeir = trust.PrimaryHeir;
            trust.PrimaryHeir = newHeir;
            StoreTrust(trustId, trust);

            RemoveHeirTrust(oldHeir, trustId);
            AddHeirTrust(newHeir, trustId);

            OnHeirChanged(trustId, oldHeir, newHeir);
            OnTrustModified(trustId, "heir_changed");
        }

        /// <summary>
        /// Add additional principal to an existing trust.
        /// </summary>
        public static void AddPrincipal(BigInteger trustId, BigInteger neoAmount, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            Trust trust = GetTrust(trustId);
            ExecutionEngine.Assert(trust.Active, "trust not active");
            ExecutionEngine.Assert(!trust.Executed, "trust already executed");
            ExecutionEngine.Assert(Runtime.CheckWitness(trust.Owner), "unauthorized");
            ExecutionEngine.Assert(neoAmount > 0, "invalid amount");

            ClaimBneoRewards();
            trust = RefreshTrustRewards(trustId, trust);

            bool neoOk = NEO.Transfer(trust.Owner, Runtime.ExecutingScriptHash, neoAmount, null);
            ExecutionEngine.Assert(neoOk, "neo transfer failed");
            StakeNeoToBneo(neoAmount);

            trust.Principal += neoAmount;
            StoreTrust(trustId, trust);

            UpdateOwnerStatsOnPrincipalAdd(trust.Owner, neoAmount);
            UpdateTotalPrincipal(neoAmount);
            UpdateTotalNeoPrincipal(neoAmount);

            Storage.Put(Storage.CurrentContext, Helper.Concat(PREFIX_REWARD_DEBT, trustId.ToByteArray()), GetRewardPerNeo());

            OnPrincipalAdded(trustId, neoAmount, trust.Principal);
            OnTrustModified(trustId, "principal_added");
        }

        /// <summary>
        /// Add a guardian who can execute the trust.
        /// </summary>
        public static void AddGuardian(BigInteger trustId, UInt160 guardian)
        {
            ValidateNotGloballyPaused(APP_ID);

            Trust trust = GetTrust(trustId);
            ExecutionEngine.Assert(trust.Active, "trust not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(trust.Owner), "unauthorized");
            ExecutionEngine.Assert(guardian.IsValid && guardian != trust.Owner, "invalid guardian");
            ExecutionEngine.Assert(!IsGuardian(trustId, guardian), "already guardian");

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_GUARDIANS, (ByteString)trustId.ToByteArray()),
                guardian);
            Storage.Put(Storage.CurrentContext, key, 1);

            UpdateOwnerStatsOnGuardianAdd(trust.Owner);

            OnGuardianAdded(trustId, guardian);
            OnTrustModified(trustId, "guardian_added");
        }

        /// <summary>
        /// Update heartbeat interval for a trust.
        /// </summary>
        public static void UpdateHeartbeatInterval(BigInteger trustId, BigInteger newIntervalDays)
        {
            ValidateNotGloballyPaused(APP_ID);

            Trust trust = GetTrust(trustId);
            ExecutionEngine.Assert(trust.Active, "trust not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(trust.Owner), "unauthorized");

            BigInteger intervalSeconds = newIntervalDays * 86400;
            ExecutionEngine.Assert(intervalSeconds >= MIN_HEARTBEAT_SECONDS && intervalSeconds <= MAX_HEARTBEAT_SECONDS, "invalid interval");

            trust.HeartbeatInterval = intervalSeconds;
            trust.Deadline = trust.LastHeartbeat + intervalSeconds;
            StoreTrust(trustId, trust);

            OnTrustModified(trustId, "interval_updated");
        }
        #endregion
    }
}
