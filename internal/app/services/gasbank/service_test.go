package gasbank

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"testing"

	"github.com/R3E-Network/service_layer/internal/app/domain/account"
	domain "github.com/R3E-Network/service_layer/internal/app/domain/gasbank"
	"github.com/R3E-Network/service_layer/internal/app/storage/memory"
	"github.com/R3E-Network/service_layer/pkg/logger"
)

func TestService_DepositWithdraw(t *testing.T) {
	store := memory.New()
	acct, err := store.CreateAccount(context.Background(), account.Account{Owner: "owner"})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}

	svc := New(store, store, nil)
	gasAcct, err := svc.EnsureAccount(context.Background(), acct.ID, " wallet1 ")
	if err != nil {
		t.Fatalf("ensure gas account: %v", err)
	}
	if gasAcct.WalletAddress != "wallet1" {
		t.Fatalf("wallet not normalised: %s", gasAcct.WalletAddress)
	}

	updated, tx, err := svc.Deposit(context.Background(), gasAcct.ID, 10, "tx1", "from", "to")
	if err != nil {
		t.Fatalf("deposit: %v", err)
	}
	if updated.Available < 9.999 {
		t.Fatalf("unexpected balance: %v", updated.Available)
	}
	if updated.Pending != 0 {
		t.Fatalf("pending should be zero after deposit: %v", updated.Pending)
	}
	if tx.Type != "deposit" {
		t.Fatalf("unexpected tx type: %s", tx.Type)
	}

	updated, tx, err = svc.Withdraw(context.Background(), acct.ID, gasAcct.ID, 5, "to-wallet")
	if err != nil {
		t.Fatalf("withdraw: %v", err)
	}
	if updated.Available < 4.999 {
		t.Fatalf("balance not reduced: %v", updated.Available)
	}
	if updated.Pending < 4.999 || updated.Pending > 5.001 {
		t.Fatalf("pending not tracked: %v", updated.Pending)
	}
	if updated.Balance < 9.999 {
		t.Fatalf("total balance should remain until settlement: %v", updated.Balance)
	}
	if tx.Type != "withdrawal" {
		t.Fatalf("unexpected tx type: %s", tx.Type)
	}

	settled, settledTx, err := svc.CompleteWithdrawal(context.Background(), tx.ID, true, "")
	if err != nil {
		t.Fatalf("complete withdrawal: %v", err)
	}
	if settled.Pending > Epsilon {
		t.Fatalf("pending not cleared: %v", settled.Pending)
	}
	if math.Abs(settled.Balance-5.0) > 1e-3 {
		t.Fatalf("balance not reduced: %v", settled.Balance)
	}
	if settledTx.Status != domain.StatusCompleted {
		t.Fatalf("unexpected status: %s", settledTx.Status)
	}

	secondAcct, secondTx, err := svc.Withdraw(context.Background(), acct.ID, gasAcct.ID, 2, "addr")
	if err != nil {
		t.Fatalf("second withdraw: %v", err)
	}
	if secondAcct.Pending < 1.999 {
		t.Fatalf("second pending incorrect: %v", secondAcct.Pending)
	}

	failureAcct, failureTx, err := svc.CompleteWithdrawal(context.Background(), secondTx.ID, false, "insufficient balance")
	if err != nil {
		t.Fatalf("complete withdrawal failure: %v", err)
	}
	if math.Abs(failureAcct.Available-5.0) > 1e-3 {
		t.Fatalf("available not restored: %v", failureAcct.Available)
	}
	if failureTx.Status != domain.StatusFailed {
		t.Fatalf("unexpected failure status: %s", failureTx.Status)
	}
}

func TestService_PreventDuplicateWallets(t *testing.T) {
	store := memory.New()
	acct1, err := store.CreateAccount(context.Background(), account.Account{Owner: "a"})
	if err != nil {
		t.Fatalf("create account 1: %v", err)
	}
	acct2, err := store.CreateAccount(context.Background(), account.Account{Owner: "b"})
	if err != nil {
		t.Fatalf("create account 2: %v", err)
	}

	svc := New(store, store, nil)
	if _, err := svc.EnsureAccount(context.Background(), acct1.ID, "WalletX"); err != nil {
		t.Fatalf("ensure wallet for account1: %v", err)
	}
	if _, err := svc.EnsureAccount(context.Background(), acct2.ID, "walletx"); err == nil || !errors.Is(err, ErrWalletInUse) {
		t.Fatalf("expected duplicate wallet error, got %v", err)
	}
}

func TestService_WithdrawRejectsForeignAccount(t *testing.T) {
	store := memory.New()
	owner, err := store.CreateAccount(context.Background(), account.Account{Owner: "owner"})
	if err != nil {
		t.Fatalf("create owner: %v", err)
	}
	other, err := store.CreateAccount(context.Background(), account.Account{Owner: "other"})
	if err != nil {
		t.Fatalf("create other: %v", err)
	}

	svc := New(store, store, nil)
	gasAcct, err := svc.EnsureAccount(context.Background(), owner.ID, "wallet-123")
	if err != nil {
		t.Fatalf("ensure account: %v", err)
	}
	if _, _, err := svc.Deposit(context.Background(), gasAcct.ID, 5, "tx", "", ""); err != nil {
		t.Fatalf("seed deposit: %v", err)
	}

	if _, _, err := svc.Withdraw(context.Background(), other.ID, gasAcct.ID, 1, "dest"); err == nil {
		t.Fatalf("expected withdraw to reject foreign account")
	}
}

func TestService_DepositRollsBackOnTransactionFailure(t *testing.T) {
	store := &failingGasBankStore{Store: memory.New(), failCreateTx: true}
	acct, err := store.CreateAccount(context.Background(), account.Account{Owner: "owner"})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}
	gasAcct, err := store.CreateGasAccount(context.Background(), domain.Account{AccountID: acct.ID})
	if err != nil {
		t.Fatalf("create gas account: %v", err)
	}

	svc := New(store, store, nil)
	if _, _, err := svc.Deposit(context.Background(), gasAcct.ID, 15, "tx", "", ""); err == nil {
		t.Fatalf("expected deposit to fail")
	}

	stored, err := store.GetGasAccount(context.Background(), gasAcct.ID)
	if err != nil {
		t.Fatalf("get gas account: %v", err)
	}
	if stored.Balance != 0 || stored.Available != 0 || stored.Pending != 0 {
		t.Fatalf("expected balances to rollback, got %+v", stored)
	}
}

func TestService_Summary(t *testing.T) {
	store := memory.New()
	acct, err := store.CreateAccount(context.Background(), account.Account{Owner: "owner"})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}

	svc := New(store, store, logger.NewDefault("test"))
	gasAcct, err := svc.EnsureAccount(context.Background(), acct.ID, "wallet-summary")
	if err != nil {
		t.Fatalf("ensure gas account: %v", err)
	}
	if _, _, err := svc.Deposit(context.Background(), gasAcct.ID, 25, "tx-summary", "from", "to"); err != nil {
		t.Fatalf("deposit: %v", err)
	}
	if _, _, err := svc.Withdraw(context.Background(), acct.ID, gasAcct.ID, 5, "dest"); err != nil {
		t.Fatalf("withdraw: %v", err)
	}

	summary, err := svc.Summary(context.Background(), acct.ID)
	if err != nil {
		t.Fatalf("summary: %v", err)
	}
	if len(summary.Accounts) != 1 {
		t.Fatalf("expected 1 account in summary, got %d", len(summary.Accounts))
	}
	if summary.TotalBalance < 24.999 || summary.TotalBalance > 25.001 {
		t.Fatalf("unexpected total balance: %v", summary.TotalBalance)
	}
	if summary.PendingWithdrawals != 1 {
		t.Fatalf("expected 1 pending withdrawal, got %d", summary.PendingWithdrawals)
	}
	if summary.PendingAmount < 4.999 || summary.PendingAmount > 5.001 {
		t.Fatalf("unexpected pending amount: %v", summary.PendingAmount)
	}
	if summary.LastDeposit == nil || summary.LastDeposit.ID == "" {
		t.Fatalf("expected last deposit info")
	}
	if summary.LastWithdrawal == nil || summary.LastWithdrawal.ID == "" {
		t.Fatalf("expected last withdrawal info")
	}
}

func TestService_WithdrawRollsBackOnTransactionFailure(t *testing.T) {
	store := &failingGasBankStore{Store: memory.New()}
	acct, err := store.CreateAccount(context.Background(), account.Account{Owner: "owner"})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}
	gasAcct, err := store.CreateGasAccount(context.Background(), domain.Account{AccountID: acct.ID})
	if err != nil {
		t.Fatalf("create gas account: %v", err)
	}

	svc := New(store, store, nil)
	if _, _, err := svc.Deposit(context.Background(), gasAcct.ID, 20, "tx", "", ""); err != nil {
		t.Fatalf("deposit: %v", err)
	}

	store.failCreateTx = true
	if _, _, err := svc.Withdraw(context.Background(), acct.ID, gasAcct.ID, 7, "dest"); err == nil {
		t.Fatalf("expected withdraw to fail")
	}

	stored, err := store.GetGasAccount(context.Background(), gasAcct.ID)
	if err != nil {
		t.Fatalf("get gas account: %v", err)
	}
	if math.Abs(stored.Available-20) > 1e-9 {
		t.Fatalf("available balance should rollback to 20, got %v", stored.Available)
	}
	if stored.Pending != 0 {
		t.Fatalf("pending should be zero after rollback, got %v", stored.Pending)
	}
}

type failingGasBankStore struct {
	*memory.Store
	failCreateTx bool
}

func (s *failingGasBankStore) CreateGasTransaction(ctx context.Context, tx domain.Transaction) (domain.Transaction, error) {
	if s.failCreateTx {
		return domain.Transaction{}, fmt.Errorf("stub create gas transaction failure")
	}
	created, err := s.Store.CreateGasTransaction(ctx, tx)
	if err == nil {
		// Reset failure flag so subsequent operations can toggle explicitly.
		s.failCreateTx = false
	}
	return created, err
}

func ExampleService_Deposit() {
	store := memory.New()
	acct, _ := store.CreateAccount(context.Background(), account.Account{Owner: "owner"})
	gasAcct, _ := store.CreateGasAccount(context.Background(), domain.Account{AccountID: acct.ID})

	log := logger.NewDefault("example-gasbank")
	log.SetOutput(io.Discard)
	svc := New(store, store, log)
	accountWithFunds, tx, _ := svc.Deposit(context.Background(), gasAcct.ID, 10, "tx123", "walletA", "walletB")
	fmt.Printf("balance:%.0f status:%s\n", accountWithFunds.Available, tx.Status)
	// Output:
	// balance:10 status:completed
}
