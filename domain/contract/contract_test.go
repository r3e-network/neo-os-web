package contract_test

import (
	"testing"

	"github.com/R3E-Network/service_layer/domain/contract"
)

func TestContractStatusValues(t *testing.T) {
	statuses := []contract.ContractStatus{
		contract.ContractStatusDraft,
		contract.ContractStatusDeploying,
		contract.ContractStatusActive,
		contract.ContractStatusPaused,
		contract.ContractStatusUpgrading,
		contract.ContractStatusDeprecated,
		contract.ContractStatusRevoked,
	}
	for _, s := range statuses {
		if s == "" {
			t.Error("empty status value")
		}
	}
}

func TestContractTypeValues(t *testing.T) {
	types := []contract.ContractType{
		contract.ContractTypeEngine,
		contract.ContractTypeService,
		contract.ContractTypeUser,
	}
	for _, ct := range types {
		if ct == "" {
			t.Error("empty type value")
		}
	}
}

func TestNetworkValues(t *testing.T) {
	networks := []contract.Network{
		contract.NetworkNeoN3,
		contract.NetworkNeoX,
		contract.NetworkEthereum,
		contract.NetworkPolygon,
		contract.NetworkArbitrum,
		contract.NetworkOptimism,
		contract.NetworkBase,
		contract.NetworkAvalanche,
		contract.NetworkBSC,
		contract.NetworkTestnet,
		contract.NetworkLocalPriv,
	}
	for _, n := range networks {
		if n == "" {
			t.Error("empty network value")
		}
	}
}

func TestInvocationStatusValues(t *testing.T) {
	statuses := []contract.InvocationStatus{
		contract.InvocationStatusPending,
		contract.InvocationStatusSubmitted,
		contract.InvocationStatusConfirmed,
		contract.InvocationStatusFailed,
		contract.InvocationStatusReverted,
	}
	for _, s := range statuses {
		if s == "" {
			t.Error("empty invocation status value")
		}
	}
}

func TestDeploymentStatusValues(t *testing.T) {
	statuses := []contract.DeploymentStatus{
		contract.DeploymentStatusPending,
		contract.DeploymentStatusSubmitted,
		contract.DeploymentStatusConfirmed,
		contract.DeploymentStatusFailed,
	}
	for _, s := range statuses {
		if s == "" {
			t.Error("empty deployment status value")
		}
	}
}

func TestEngineContractsNotEmpty(t *testing.T) {
	if len(contract.EngineContracts) == 0 {
		t.Error("EngineContracts should not be empty")
	}
	expected := []string{
		"Manager",
		"AccountManager",
		"ServiceRegistry",
		"GasBank",
		"OracleHub",
		"RandomnessHub",
		"DataFeedHub",
		"AutomationScheduler",
		"SecretsVault",
		"JAMInbox",
	}
	if len(contract.EngineContracts) != len(expected) {
		t.Errorf("expected %d engine contracts, got %d", len(expected), len(contract.EngineContracts))
	}
	for i, name := range expected {
		if contract.EngineContracts[i] != name {
			t.Errorf("expected %s at index %d, got %s", name, i, contract.EngineContracts[i])
		}
	}
}

func TestTemplateCategoryValues(t *testing.T) {
	categories := []contract.TemplateCategory{
		contract.TemplateCategoryEngine,
		contract.TemplateCategoryToken,
		contract.TemplateCategoryOracle,
		contract.TemplateCategoryVRF,
		contract.TemplateCategoryFeed,
		contract.TemplateCategoryDeFi,
		contract.TemplateCategoryVault,
		contract.TemplateCategoryStake,
		contract.TemplateCategoryProxy,
		contract.TemplateCategoryMultisig,
		contract.TemplateCategoryGovernance,
		contract.TemplateCategoryCustom,
	}
	for _, c := range categories {
		if c == "" {
			t.Error("empty category value")
		}
	}
}

func TestContractCapabilityValues(t *testing.T) {
	caps := []contract.ContractCapability{
		contract.CapabilityAccountRead,
		contract.CapabilityAccountWrite,
		contract.CapabilityGasBankRead,
		contract.CapabilityGasBankWrite,
		contract.CapabilityOracleRequest,
		contract.CapabilityOracleProvide,
		contract.CapabilityVRFRequest,
		contract.CapabilityVRFProvide,
		contract.CapabilityFeedRead,
		contract.CapabilityFeedWrite,
		contract.CapabilityAutomation,
		contract.CapabilitySecrets,
		contract.CapabilityCrossChain,
	}
	for _, c := range caps {
		if c == "" {
			t.Error("empty capability value")
		}
	}
}
