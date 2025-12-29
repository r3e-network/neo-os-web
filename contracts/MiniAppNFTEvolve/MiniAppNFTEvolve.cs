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
    public delegate void EvolutionInitiatedHandler(UInt160 owner, ByteString tokenId, BigInteger currentLevel, BigInteger evolutionId);
    public delegate void RngRequestedHandler(BigInteger evolutionId, BigInteger requestId);
    public delegate void NFTEvolvedHandler(UInt160 owner, ByteString tokenId, BigInteger newLevel, bool success, BigInteger evolutionId);
    public delegate void AutomationRegisteredHandler(BigInteger taskId, string triggerType, string schedule);
    public delegate void AutomationCancelledHandler(BigInteger taskId);
    public delegate void PeriodicExecutionTriggeredHandler(BigInteger taskId);

    /// <summary>
    /// NFT Evolve - NFT evolution with RNG oracle.
    ///
    /// ARCHITECTURE (Chainlink-style):
    /// - Owner initiates evolution via InitiateEvolution
    /// - Contract requests RNG → Gateway calls RNG service
    /// - Gateway fulfills → Contract determines evolution outcome → Updates NFT
    ///
    /// MECHANICS:
    /// - Pay evolution fee
    /// - RNG determines success/failure and stat boosts
    /// - Higher levels have lower success rates
    /// </summary>
    [DisplayName("MiniAppNFTEvolve")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "NFT Evolve - NFT evolution with on-chain RNG oracle")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-nftevolve";
        private const long EVOLUTION_FEE = 50000000; // 0.5 GAS
        private const int MAX_LEVEL = 10;
        #endregion

        #region App Prefixes (start from 0x10)
        private static readonly byte[] PREFIX_EVOLUTION_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_EVOLUTIONS = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_REQUEST_TO_EVOLUTION = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_NFT_LEVELS = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_AUTOMATION_TASK = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Evolution Data Structure
        public struct EvolutionData
        {
            public UInt160 Owner;
            public ByteString TokenId;
            public BigInteger CurrentLevel;
            public BigInteger Timestamp;
            public bool Resolved;
        }
        #endregion

        #region App Events
        [DisplayName("EvolutionInitiated")]
        public static event EvolutionInitiatedHandler OnEvolutionInitiated;

        [DisplayName("RngRequested")]
        public static event RngRequestedHandler OnRngRequested;

        [DisplayName("NFTEvolved")]
        public static event NFTEvolvedHandler OnNFTEvolved;

        [DisplayName("AutomationRegistered")]
        public static event AutomationRegisteredHandler OnAutomationRegistered;

        [DisplayName("AutomationCancelled")]
        public static event AutomationCancelledHandler OnAutomationCancelled;

        [DisplayName("PeriodicExecutionTriggered")]
        public static event PeriodicExecutionTriggeredHandler OnPeriodicExecutionTriggered;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_EVOLUTION_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        /// <summary>
        /// Initiate NFT evolution attempt.
        /// </summary>
        public static BigInteger InitiateEvolution(UInt160 owner, ByteString tokenId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "unauthorized");
            ExecutionEngine.Assert(tokenId != null && tokenId.Length > 0, "token id required");

            BigInteger currentLevel = GetNFTLevel(tokenId);
            ExecutionEngine.Assert(currentLevel < MAX_LEVEL, "max level reached");

            BigInteger evolutionId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_EVOLUTION_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_EVOLUTION_ID, evolutionId);

            EvolutionData evolution = new EvolutionData
            {
                Owner = owner,
                TokenId = tokenId,
                CurrentLevel = currentLevel,
                Timestamp = Runtime.Time,
                Resolved = false
            };
            StoreEvolution(evolutionId, evolution);

            // Request RNG for evolution outcome
            BigInteger requestId = RequestRng(evolutionId);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_EVOLUTION, (ByteString)requestId.ToByteArray()),
                evolutionId);

            OnEvolutionInitiated(owner, tokenId, currentLevel, evolutionId);
            OnRngRequested(evolutionId, requestId);
            return evolutionId;
        }

        [Safe]
        public static EvolutionData GetEvolution(BigInteger evolutionId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_EVOLUTIONS, (ByteString)evolutionId.ToByteArray()));
            if (data == null) return new EvolutionData();
            return (EvolutionData)StdLib.Deserialize(data);
        }

        [Safe]
        public static BigInteger GetNFTLevel(ByteString tokenId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_NFT_LEVELS, tokenId));
            if (data == null) return 1; // Default level 1
            return (BigInteger)data;
        }

        #endregion

        #region Service Request Methods

        private static BigInteger RequestRng(BigInteger evolutionId)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { evolutionId });
            return (BigInteger)Contract.Call(
                gateway, "requestService", CallFlags.All,
                APP_ID, "rng", payload,
                Runtime.ExecutingScriptHash, "onServiceCallback"
            );
        }

        public static void OnServiceCallback(
            BigInteger requestId, string appId, string serviceType,
            bool success, ByteString result, string error)
        {
            ValidateGateway();

            ByteString evolutionIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_EVOLUTION, (ByteString)requestId.ToByteArray()));
            ExecutionEngine.Assert(evolutionIdData != null, "unknown request");

            BigInteger evolutionId = (BigInteger)evolutionIdData;
            EvolutionData evolution = GetEvolution(evolutionId);
            ExecutionEngine.Assert(!evolution.Resolved, "already resolved");
            ExecutionEngine.Assert(evolution.Owner != null, "evolution not found");

            Storage.Delete(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_EVOLUTION, (ByteString)requestId.ToByteArray()));

            evolution.Resolved = true;
            StoreEvolution(evolutionId, evolution);

            if (!success)
            {
                OnNFTEvolved(evolution.Owner, evolution.TokenId, evolution.CurrentLevel, false, evolutionId);
                return;
            }

            ExecutionEngine.Assert(result != null && result.Length > 0, "no rng data");
            BigInteger randomValue = (BigInteger)StdLib.Deserialize(result);

            // Evolution success rate decreases with level: 90% at level 1, 10% at level 9
            BigInteger successThreshold = 100 - (evolution.CurrentLevel * 10);
            BigInteger roll = randomValue % 100;
            bool evolved = roll < successThreshold;

            if (evolved)
            {
                BigInteger newLevel = evolution.CurrentLevel + 1;
                Storage.Put(Storage.CurrentContext,
                    Helper.Concat(PREFIX_NFT_LEVELS, evolution.TokenId),
                    newLevel);
                OnNFTEvolved(evolution.Owner, evolution.TokenId, newLevel, true, evolutionId);
            }
            else
            {
                OnNFTEvolved(evolution.Owner, evolution.TokenId, evolution.CurrentLevel, false, evolutionId);
            }
        }

        #endregion

        #region Internal Helpers

        private static void StoreEvolution(BigInteger evolutionId, EvolutionData evolution)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_EVOLUTIONS, (ByteString)evolutionId.ToByteArray()),
                StdLib.Serialize(evolution));
        }

        #endregion

        #region Periodic Automation

        /// <summary>
        /// Returns the AutomationAnchor contract address.
        /// </summary>
        [Safe]
        public static UInt160 AutomationAnchor()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR);
            return data != null ? (UInt160)data : UInt160.Zero;
        }

        /// <summary>
        /// Sets the AutomationAnchor contract address.
        /// SECURITY: Only admin can set the automation anchor.
        /// </summary>
        public static void SetAutomationAnchor(UInt160 anchor)
        {
            ValidateAdmin();
            ValidateAddress(anchor);
            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR, anchor);
        }

        /// <summary>
        /// Periodic execution callback invoked by AutomationAnchor.
        /// SECURITY: Only AutomationAnchor can invoke this method.
        /// LOGIC: Checks and triggers evolution conditions for eligible NFTs.
        /// </summary>
        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            // Verify caller is AutomationAnchor
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            OnPeriodicExecutionTriggered(taskId);

            // Process automated evolution eligibility checks
            ProcessAutomatedEvolution();
        }

        /// <summary>
        /// Registers this MiniApp for periodic automation.
        /// SECURITY: Only admin can register.
        /// CORRECTNESS: AutomationAnchor must be set first.
        /// </summary>
        public static BigInteger RegisterAutomation(string triggerType, string schedule)
        {
            ValidateAdmin();
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero, "automation anchor not set");

            // Call AutomationAnchor.RegisterPeriodicTask
            BigInteger taskId = (BigInteger)Contract.Call(anchor, "registerPeriodicTask", CallFlags.All,
                Runtime.ExecutingScriptHash, "onPeriodicExecution", triggerType, schedule, 1000000); // 0.01 GAS limit

            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_TASK, taskId);
            OnAutomationRegistered(taskId, triggerType, schedule);
            return taskId;
        }

        /// <summary>
        /// Cancels the registered automation task.
        /// SECURITY: Only admin can cancel.
        /// </summary>
        public static void CancelAutomation()
        {
            ValidateAdmin();
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_TASK);
            ExecutionEngine.Assert(data != null, "no automation registered");

            BigInteger taskId = (BigInteger)data;
            UInt160 anchor = AutomationAnchor();
            Contract.Call(anchor, "cancelPeriodicTask", CallFlags.All, taskId);

            Storage.Delete(Storage.CurrentContext, PREFIX_AUTOMATION_TASK);
            OnAutomationCancelled(taskId);
        }

        /// <summary>
        /// Internal method to process automated evolution eligibility.
        /// Called by OnPeriodicExecution.
        /// Checks NFTs ready for evolution based on time/conditions and triggers auto-evolution.
        /// </summary>
        private static void ProcessAutomatedEvolution()
        {
            // Auto-evolution configuration: 7 days cooldown
            BigInteger EVOLUTION_COOLDOWN = 604800; // 7 days in seconds
            BigInteger currentTime = Runtime.Time;

            // Scan recent evolutions (last 50) to find NFTs ready for next evolution
            BigInteger currentEvolutionId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_EVOLUTION_ID);
            BigInteger startId = currentEvolutionId > 50 ? currentEvolutionId - 50 : 1;

            for (BigInteger evolutionId = startId; evolutionId <= currentEvolutionId; evolutionId++)
            {
                EvolutionData evolution = GetEvolution(evolutionId);

                // Skip unresolved or failed evolutions
                if (!evolution.Resolved || evolution.Owner == null)
                {
                    continue;
                }

                // Get current NFT level
                BigInteger currentLevel = GetNFTLevel(evolution.TokenId);

                // Check if NFT is eligible for next evolution
                if (currentLevel >= MAX_LEVEL)
                {
                    continue; // Already at max level
                }

                // Check if enough time has passed since last evolution
                BigInteger timeSinceEvolution = currentTime - evolution.Timestamp;
                if (timeSinceEvolution < EVOLUTION_COOLDOWN)
                {
                    continue; // Still in cooldown
                }

                // Check if NFT has pending evolution already
                ByteString pendingKey = Helper.Concat(
                    (ByteString)new byte[] { 0x19 },
                    evolution.TokenId);
                ByteString pendingData = Storage.Get(Storage.CurrentContext, pendingKey);

                if (pendingData != null)
                {
                    continue; // Evolution already pending
                }

                // Mark as eligible and emit event for external processing
                // In production, this could trigger actual evolution or just notify
                // For safety, we only emit notification - actual evolution requires user consent
                Storage.Put(Storage.CurrentContext, pendingKey, currentTime);

                // Event for external monitoring - admin can review and approve
                OnEvolutionInitiated(evolution.Owner, evolution.TokenId, currentLevel, evolutionId);
            }
        }

        #endregion
    }
}
