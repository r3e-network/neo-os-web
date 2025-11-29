package contract_test

import (
	"testing"

	"github.com/R3E-Network/service_layer/sdk/go/contract"
)

func TestSpecBuilder(t *testing.T) {
	spec := contract.NewSpec("TestContract").
		WithSymbol("TEST").
		WithDescription("A test contract").
		WithVersion("1.2.0").
		WithNetworks(contract.NetworkNeoN3, contract.NetworkEthereum).
		WithCapabilities(contract.CapOracleRequest, contract.CapGasBankRead).
		WithMethod("doSomething", []contract.Param{{Name: "input", Type: "uint256"}}, nil).
		WithViewMethod("getValue", nil, []contract.Param{{Name: "value", Type: "uint256"}}).
		WithEvent("SomethingDone", []contract.Param{{Name: "value", Type: "uint256", Indexed: true}}).
		WithMetadata("author", "test").
		Build()

	if spec.Name != "TestContract" {
		t.Errorf("expected name 'TestContract', got %s", spec.Name)
	}
	if spec.Symbol != "TEST" {
		t.Errorf("expected symbol 'TEST', got %s", spec.Symbol)
	}
	if spec.Version != "1.2.0" {
		t.Errorf("expected version '1.2.0', got %s", spec.Version)
	}
	if len(spec.Networks) != 2 {
		t.Errorf("expected 2 networks, got %d", len(spec.Networks))
	}
	if len(spec.Capabilities) != 2 {
		t.Errorf("expected 2 capabilities, got %d", len(spec.Capabilities))
	}
	if len(spec.Methods) != 2 {
		t.Errorf("expected 2 methods, got %d", len(spec.Methods))
	}
	if len(spec.Events) != 1 {
		t.Errorf("expected 1 event, got %d", len(spec.Events))
	}
}

func TestSpecBuilderValidation(t *testing.T) {
	// Empty name should fail
	builder := contract.NewSpec("")
	if err := builder.Validate(); err == nil {
		t.Error("expected validation error for empty name")
	}

	// Valid spec should pass
	builder = contract.NewSpec("ValidContract")
	if err := builder.Validate(); err != nil {
		t.Errorf("unexpected validation error: %v", err)
	}
}

func TestCapabilityValues(t *testing.T) {
	caps := []contract.Capability{
		contract.CapAccountRead,
		contract.CapAccountWrite,
		contract.CapGasBankRead,
		contract.CapGasBankWrite,
		contract.CapOracleRequest,
		contract.CapOracleProvide,
		contract.CapVRFRequest,
		contract.CapVRFProvide,
		contract.CapFeedRead,
		contract.CapFeedWrite,
		contract.CapAutomation,
		contract.CapSecrets,
		contract.CapCrossChain,
	}
	for _, c := range caps {
		if c == "" {
			t.Error("empty capability value")
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

func TestContractError(t *testing.T) {
	err := contract.NewError("TEST_ERROR", "test message")
	if err.Code != "TEST_ERROR" {
		t.Errorf("expected code 'TEST_ERROR', got %s", err.Code)
	}
	expected := "TEST_ERROR: test message"
	if err.Error() != expected {
		t.Errorf("expected error string '%s', got '%s'", expected, err.Error())
	}
}
