package contracts_test

import (
	"context"
	"testing"

	domaincontract "github.com/R3E-Network/service_layer/domain/contract"
	"github.com/R3E-Network/service_layer/applications/storage"
	"github.com/R3E-Network/service_layer/packages/com.r3e.services.contracts"
)

func setupTestService(t *testing.T) (*contracts.Service, *storage.MemoryContractStore, context.Context) {
	t.Helper()
	mem := storage.NewMemory()
	contractStore := storage.NewMemoryContractStore(mem)

	// Create a test account
	_, err := mem.CreateAccount(context.Background(), storage.TestAccount("test-account"))
	if err != nil {
		t.Fatalf("failed to create test account: %v", err)
	}

	svc := contracts.New(mem, contractStore, nil)
	return svc, contractStore, context.Background()
}

func TestCreateContract(t *testing.T) {
	svc, _, ctx := setupTestService(t)

	c := domaincontract.Contract{
		AccountID: "test-account",
		Name:      "TestContract",
		Network:   domaincontract.NetworkNeoN3,
		Version:   "1.0.0",
		Type:      domaincontract.ContractTypeUser,
	}

	created, err := svc.CreateContract(ctx, c)
	if err != nil {
		t.Fatalf("CreateContract failed: %v", err)
	}

	if created.ID == "" {
		t.Error("expected non-empty ID")
	}
	if created.Name != "TestContract" {
		t.Errorf("expected name 'TestContract', got %s", created.Name)
	}
	if created.Status != domaincontract.ContractStatusDraft {
		t.Errorf("expected status 'draft', got %s", created.Status)
	}
}

func TestCreateContract_ValidationErrors(t *testing.T) {
	svc, _, ctx := setupTestService(t)

	tests := []struct {
		name     string
		contract domaincontract.Contract
	}{
		{
			name: "missing name",
			contract: domaincontract.Contract{
				AccountID: "test-account",
				Network:   domaincontract.NetworkNeoN3,
			},
		},
		{
			name: "missing network",
			contract: domaincontract.Contract{
				AccountID: "test-account",
				Name:      "Test",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := svc.CreateContract(ctx, tt.contract)
			if err == nil {
				t.Error("expected validation error")
			}
		})
	}
}

func TestGetContract(t *testing.T) {
	svc, _, ctx := setupTestService(t)

	c := domaincontract.Contract{
		AccountID: "test-account",
		Name:      "TestContract",
		Network:   domaincontract.NetworkNeoN3,
	}

	created, err := svc.CreateContract(ctx, c)
	if err != nil {
		t.Fatalf("CreateContract failed: %v", err)
	}

	fetched, err := svc.GetContract(ctx, "test-account", created.ID)
	if err != nil {
		t.Fatalf("GetContract failed: %v", err)
	}

	if fetched.ID != created.ID {
		t.Errorf("expected ID %s, got %s", created.ID, fetched.ID)
	}
}

func TestGetContract_WrongAccount(t *testing.T) {
	svc, _, ctx := setupTestService(t)

	c := domaincontract.Contract{
		AccountID: "test-account",
		Name:      "TestContract",
		Network:   domaincontract.NetworkNeoN3,
	}

	created, err := svc.CreateContract(ctx, c)
	if err != nil {
		t.Fatalf("CreateContract failed: %v", err)
	}

	// Try to get with wrong account
	_, err = svc.GetContract(ctx, "other-account", created.ID)
	if err == nil {
		t.Error("expected error when getting contract with wrong account")
	}
}

func TestListContracts(t *testing.T) {
	svc, _, ctx := setupTestService(t)

	// Create multiple contracts
	for i := 0; i < 3; i++ {
		c := domaincontract.Contract{
			AccountID: "test-account",
			Name:      "TestContract",
			Network:   domaincontract.NetworkNeoN3,
		}
		_, err := svc.CreateContract(ctx, c)
		if err != nil {
			t.Fatalf("CreateContract failed: %v", err)
		}
	}

	contracts, err := svc.ListContracts(ctx, "test-account")
	if err != nil {
		t.Fatalf("ListContracts failed: %v", err)
	}

	if len(contracts) != 3 {
		t.Errorf("expected 3 contracts, got %d", len(contracts))
	}
}

func TestUpdateContract(t *testing.T) {
	svc, _, ctx := setupTestService(t)

	c := domaincontract.Contract{
		AccountID:   "test-account",
		Name:        "TestContract",
		Network:     domaincontract.NetworkNeoN3,
		Description: "Original",
	}

	created, err := svc.CreateContract(ctx, c)
	if err != nil {
		t.Fatalf("CreateContract failed: %v", err)
	}

	created.Description = "Updated"
	created.Status = domaincontract.ContractStatusActive

	updated, err := svc.UpdateContract(ctx, created)
	if err != nil {
		t.Fatalf("UpdateContract failed: %v", err)
	}

	if updated.Description != "Updated" {
		t.Errorf("expected description 'Updated', got %s", updated.Description)
	}
	if updated.Status != domaincontract.ContractStatusActive {
		t.Errorf("expected status 'active', got %s", updated.Status)
	}
}
