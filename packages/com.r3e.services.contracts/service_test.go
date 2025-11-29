package contracts_test

import (
	"testing"

	"github.com/R3E-Network/service_layer/packages/com.r3e.services.contracts"
)

func TestServiceName(t *testing.T) {
	svc := contracts.New(nil, nil, nil)
	if svc.Name() != "contracts" {
		t.Errorf("expected name 'contracts', got %s", svc.Name())
	}
}

func TestServiceDomain(t *testing.T) {
	svc := contracts.New(nil, nil, nil)
	if svc.Domain() != "contracts" {
		t.Errorf("expected domain 'contracts', got %s", svc.Domain())
	}
}

func TestServiceManifest(t *testing.T) {
	svc := contracts.New(nil, nil, nil)
	m := svc.Manifest()
	if m == nil {
		t.Fatal("manifest should not be nil")
	}
	if m.Name != "contracts" {
		t.Errorf("expected manifest name 'contracts', got %s", m.Name)
	}
	if m.Layer != "service" {
		t.Errorf("expected layer 'service', got %s", m.Layer)
	}
	// Check capabilities
	expectedCaps := []string{"contracts", "deploy", "invoke"}
	if len(m.Capabilities) != len(expectedCaps) {
		t.Errorf("expected %d capabilities, got %d", len(expectedCaps), len(m.Capabilities))
	}
	for i, cap := range expectedCaps {
		if m.Capabilities[i] != cap {
			t.Errorf("expected capability %s at index %d, got %s", cap, i, m.Capabilities[i])
		}
	}
}

func TestServiceDescriptor(t *testing.T) {
	svc := contracts.New(nil, nil, nil)
	d := svc.Descriptor()
	if d.Name != "contracts" {
		t.Errorf("expected descriptor name 'contracts', got %s", d.Name)
	}
	if d.Domain != "contracts" {
		t.Errorf("expected descriptor domain 'contracts', got %s", d.Domain)
	}
}
