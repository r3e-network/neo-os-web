package postgres

import (
	"testing"
	"time"

	"github.com/R3E-Network/service_layer/internal/app/domain/account"
	"github.com/R3E-Network/service_layer/internal/app/domain/function"
	"github.com/R3E-Network/service_layer/internal/app/domain/gasbank"
)

// Verifies that tenant-aware list queries refuse to return rows whose tenant no longer
// matches the owning account. This is a defense-in-depth guard in addition to HTTP checks.
func TestTenantFiltersExcludeMismatchedRows(t *testing.T) {
	store, ctx := newTestStore(t)

	acct, err := store.CreateAccount(ctx, account.Account{
		Owner:    "tenant-user",
		Metadata: map[string]string{"tenant": "tenant-a"},
	})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}

	// Baseline function listing works when tenant matches.
	fn, err := store.CreateFunction(ctx, function.Definition{
		AccountID: acct.ID,
		Name:      "fn",
		Source:    "() => 1",
	})
	if err != nil {
		t.Fatalf("create function: %v", err)
	}
	if list, err := store.ListFunctions(ctx, acct.ID); err != nil {
		t.Fatalf("list functions: %v", err)
	} else if len(list) != 1 {
		t.Fatalf("expected 1 function, got %d", len(list))
	}

	// Tamper with tenant on the row; list should now exclude it for this account.
	if _, err := store.db.ExecContext(ctx, `UPDATE app_functions SET tenant = 'tenant-b' WHERE id = $1`, fn.ID); err != nil {
		t.Fatalf("force tenant mismatch: %v", err)
	}
	if list, err := store.ListFunctions(ctx, acct.ID); err != nil {
		t.Fatalf("list functions post-mismatch: %v", err)
	} else if len(list) != 0 {
		t.Fatalf("expected functions to be filtered out on tenant mismatch, got %d", len(list))
	}

	// Gas bank: tenant stored on the gas account; list should exclude transactions when tenant mismatches.
	gasAcct, err := store.CreateGasAccount(ctx, gasbank.Account{
		AccountID:     acct.ID,
		WalletAddress: "0xabc123abc123abc123abc123abc123abc123abcd",
		Metadata:      map[string]string{"note": "gas"},
	})
	if err != nil {
		t.Fatalf("create gas account: %v", err)
	}
	tx := gasbank.Transaction{
		AccountID:     gasAcct.ID,
		UserAccountID: acct.ID,
		Type:          gasbank.TransactionDeposit,
		Amount:        1,
		NetAmount:     1,
		Status:        gasbank.StatusCompleted,
		FromAddress:   "wallet-a",
		ToAddress:     "wallet-b",
		CompletedAt:   time.Now().UTC(),
	}
	if _, err := store.CreateGasTransaction(ctx, tx); err != nil {
		t.Fatalf("create gas tx: %v", err)
	}
	if list, err := store.ListGasTransactions(ctx, gasAcct.ID, 10); err != nil {
		t.Fatalf("list gas tx: %v", err)
	} else if len(list) != 1 {
		t.Fatalf("expected 1 gas tx, got %d", len(list))
	}

	// Mismatch tenant on the owning gas account; tenant filter should hide the row.
	if _, err := store.db.ExecContext(ctx, `UPDATE app_gas_accounts SET tenant = 'tenant-b' WHERE id = $1`, gasAcct.ID); err != nil {
		t.Fatalf("force gas account tenant mismatch: %v", err)
	}
	if list, err := store.ListGasTransactions(ctx, gasAcct.ID, 10); err != nil {
		t.Fatalf("list gas tx post-mismatch: %v", err)
	} else if len(list) != 0 {
		t.Fatalf("expected gas transactions to be filtered out on tenant mismatch, got %d", len(list))
	}
}
