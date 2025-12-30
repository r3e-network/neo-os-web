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
    public delegate void ContractCreatedHandler(BigInteger contractId, UInt160 party1, UInt160 party2, BigInteger stake);
    public delegate void ContractSignedHandler(BigInteger contractId, UInt160 signer);
    public delegate void BreakupTriggeredHandler(BigInteger contractId, UInt160 initiator, BigInteger penalty);
    public delegate void ContractCompletedHandler(BigInteger contractId, bool mutual);

    /// <summary>
    /// BreakupContract MiniApp - Smart contract for relationship commitments.
    /// Both parties stake GAS; early breakup triggers penalty distribution.
    /// </summary>
    [DisplayName("MiniAppBreakupContract")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. BreakupContract is a commitment application for relationship agreements. Use it to stake GAS with your partner, you can enforce commitment terms with penalty distribution for early exits.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-breakupcontract";
        private const long MIN_STAKE = 100000000; // 1 GAS
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_CONTRACT_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_CONTRACTS = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Data Structures
        public struct RelationshipContract
        {
            public UInt160 Party1;
            public UInt160 Party2;
            public BigInteger Stake;
            public bool Party1Signed;
            public bool Party2Signed;
            public BigInteger StartTime;
            public BigInteger Duration;
            public bool Active;
            public bool Completed;
        }
        #endregion

        #region App Events
        [DisplayName("ContractCreated")]
        public static event ContractCreatedHandler OnContractCreated;

        [DisplayName("ContractSigned")]
        public static event ContractSignedHandler OnContractSigned;

        [DisplayName("BreakupTriggered")]
        public static event BreakupTriggeredHandler OnBreakupTriggered;

        [DisplayName("ContractCompleted")]
        public static event ContractCompletedHandler OnContractCompleted;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_CONTRACT_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        public static BigInteger CreateContract(UInt160 party1, UInt160 party2, BigInteger stake, BigInteger durationDays, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(stake >= MIN_STAKE, "min stake 1 GAS");
            ExecutionEngine.Assert(durationDays >= 30, "min 30 days");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(party1), "unauthorized");

            ValidatePaymentReceipt(APP_ID, party1, stake, receiptId);

            BigInteger contractId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_CONTRACT_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_CONTRACT_ID, contractId);

            RelationshipContract contract = new RelationshipContract
            {
                Party1 = party1,
                Party2 = party2,
                Stake = stake,
                Party1Signed = true,
                Party2Signed = false,
                StartTime = 0,
                Duration = durationDays * 86400000,
                Active = false,
                Completed = false
            };
            StoreContract(contractId, contract);

            OnContractCreated(contractId, party1, party2, stake);
            return contractId;
        }

        public static void SignContract(BigInteger contractId, UInt160 party, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            RelationshipContract contract = GetContract(contractId);
            ExecutionEngine.Assert(contract.Party2 == party, "not party2");
            ExecutionEngine.Assert(!contract.Party2Signed, "already signed");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(party), "unauthorized");

            ValidatePaymentReceipt(APP_ID, party, contract.Stake, receiptId);

            contract.Party2Signed = true;
            contract.Active = true;
            contract.StartTime = Runtime.Time;
            StoreContract(contractId, contract);

            OnContractSigned(contractId, party);
        }

        public static void TriggerBreakup(BigInteger contractId, UInt160 initiator)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(initiator), "unauthorized");

            RelationshipContract contract = GetContract(contractId);
            ExecutionEngine.Assert(contract.Active, "not active");
            ExecutionEngine.Assert(initiator == contract.Party1 || initiator == contract.Party2, "not party");

            BigInteger elapsed = Runtime.Time - (ulong)contract.StartTime;
            BigInteger penalty = contract.Stake * (contract.Duration - elapsed) / contract.Duration;
            if (penalty < 0) penalty = 0;

            contract.Active = false;
            contract.Completed = true;
            StoreContract(contractId, contract);

            OnBreakupTriggered(contractId, initiator, penalty);
        }

        [Safe]
        public static RelationshipContract GetContract(BigInteger contractId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_CONTRACTS, (ByteString)contractId.ToByteArray()));
            if (data == null) return new RelationshipContract();
            return (RelationshipContract)StdLib.Deserialize(data);
        }

        #endregion

        #region Internal Helpers

        private static void StoreContract(BigInteger contractId, RelationshipContract contract)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_CONTRACTS, (ByteString)contractId.ToByteArray()),
                StdLib.Serialize(contract));
        }

        #endregion

        #region Automation
        [Safe]
        public static UInt160 AutomationAnchor()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR);
            return data != null ? (UInt160)data : UInt160.Zero;
        }

        public static void SetAutomationAnchor(UInt160 anchor)
        {
            ValidateAdmin();
            ValidateAddress(anchor);
            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR, anchor);
        }

        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");
        }
        #endregion
    }
}
