package service

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/R3E-Network/service_layer/applications/storage/memory"
	"github.com/R3E-Network/service_layer/domain/account"
)

// Base tests

func TestNewBase(t *testing.T) {
	store := memory.New()
	base := NewBase(store)

	if base == nil {
		t.Fatal("expected non-nil Base")
	}
	if base.accounts == nil {
		t.Fatal("expected accounts store to be set")
	}
	if base.tracer == nil {
		t.Fatal("expected default tracer to be set")
	}
}

func TestBase_SetWallets(t *testing.T) {
	store := memory.New()
	base := NewBase(store)

	base.SetWallets(store)
	if base.wallets == nil {
		t.Fatal("expected wallets store to be set")
	}
}

func TestBase_SetTracer(t *testing.T) {
	base := NewBase(nil)

	// Setting nil should use noop
	base.SetTracer(nil)
	if base.tracer != NoopTracer {
		t.Fatal("expected NoopTracer when setting nil")
	}

	// Setting custom tracer
	custom := &mockTracer{}
	base.SetTracer(custom)
	if base.tracer != custom {
		t.Fatal("expected custom tracer to be set")
	}
}

func TestBase_EnsureAccount(t *testing.T) {
	ctx := context.Background()
	store := memory.New()
	base := NewBase(store)

	// Empty account ID should fail
	err := base.EnsureAccount(ctx, "")
	if err == nil {
		t.Fatal("expected error for empty account_id")
	}

	// Whitespace only should fail
	err = base.EnsureAccount(ctx, "   ")
	if err == nil {
		t.Fatal("expected error for whitespace account_id")
	}

	// Non-existent account should fail
	err = base.EnsureAccount(ctx, "nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent account")
	}

	// Create a valid account
	acct, _ := store.CreateAccount(ctx, account.Account{Owner: "test"})

	// Valid account should succeed
	err = base.EnsureAccount(ctx, acct.ID)
	if err != nil {
		t.Fatalf("expected success for valid account: %v", err)
	}

	// With nil store, any non-empty ID passes
	baseNoStore := NewBase(nil)
	err = baseNoStore.EnsureAccount(ctx, "any-id")
	if err != nil {
		t.Fatalf("expected success with nil store: %v", err)
	}
}

func TestBase_NormalizeAccount(t *testing.T) {
	ctx := context.Background()
	store := memory.New()
	base := NewBase(store)

	// Empty account ID
	_, err := base.NormalizeAccount(ctx, "")
	if err == nil {
		t.Fatal("expected error for empty account_id")
	}

	// Whitespace should be trimmed and fail
	_, err = base.NormalizeAccount(ctx, "   ")
	if err == nil {
		t.Fatal("expected error for whitespace account_id")
	}

	// Create a valid account
	acct, _ := store.CreateAccount(ctx, account.Account{Owner: "test"})

	// Valid account with whitespace should be trimmed
	normalized, err := base.NormalizeAccount(ctx, "  "+acct.ID+"  ")
	if err != nil {
		t.Fatalf("expected success: %v", err)
	}
	if normalized != acct.ID {
		t.Fatalf("expected %q, got %q", acct.ID, normalized)
	}

	// With nil store, returns trimmed ID
	baseNoStore := NewBase(nil)
	normalized, err = baseNoStore.NormalizeAccount(ctx, "  test-id  ")
	if err != nil {
		t.Fatalf("expected success with nil store: %v", err)
	}
	if normalized != "test-id" {
		t.Fatalf("expected 'test-id', got %q", normalized)
	}
}

func TestBase_EnsureSignersOwned(t *testing.T) {
	ctx := context.Background()
	store := memory.New()
	base := NewBase(store)
	base.SetWallets(store)

	acct, _ := store.CreateAccount(ctx, account.Account{Owner: "test"})
	store.CreateWorkspaceWallet(ctx, account.WorkspaceWallet{
		WorkspaceID:   acct.ID,
		WalletAddress: "0x1234567890abcdef1234567890abcdef12345678",
		Label:         "wallet1",
	})

	// Empty signers should pass
	err := base.EnsureSignersOwned(ctx, acct.ID, nil)
	if err != nil {
		t.Fatalf("expected success for empty signers: %v", err)
	}

	// Valid signer should pass
	err = base.EnsureSignersOwned(ctx, acct.ID, []string{"0x1234567890abcdef1234567890abcdef12345678"})
	if err != nil {
		t.Fatalf("expected success for valid signer: %v", err)
	}

	// Unknown signer should fail
	err = base.EnsureSignersOwned(ctx, acct.ID, []string{"0xunknown0000000000000000000000000000000"})
	if err == nil {
		t.Fatal("expected error for unknown signer")
	}

	// With nil wallets store, passes
	baseNoWallets := NewBase(store)
	err = baseNoWallets.EnsureSignersOwned(ctx, acct.ID, []string{"any-signer"})
	if err != nil {
		t.Fatalf("expected success with nil wallets: %v", err)
	}
}

func TestBase_Tracer(t *testing.T) {
	base := NewBase(nil)

	// Default tracer
	if base.Tracer() != NoopTracer {
		t.Fatal("expected NoopTracer by default")
	}

	// Custom tracer
	custom := &mockTracer{}
	base.SetTracer(custom)
	if base.Tracer() != custom {
		t.Fatal("expected custom tracer")
	}

	// Nil base should return NoopTracer
	var nilBase *Base
	if nilBase.Tracer() != NoopTracer {
		t.Fatal("expected NoopTracer for nil base")
	}
}

// Retry tests

func TestRetry_SingleAttempt(t *testing.T) {
	ctx := context.Background()
	policy := DefaultRetryPolicy

	calls := 0
	err := Retry(ctx, policy, func() error {
		calls++
		return nil
	})

	if err != nil {
		t.Fatalf("expected no error: %v", err)
	}
	if calls != 1 {
		t.Fatalf("expected 1 call, got %d", calls)
	}
}

func TestRetry_MultipleAttempts(t *testing.T) {
	ctx := context.Background()
	policy := RetryPolicy{
		Attempts:       3,
		InitialBackoff: time.Millisecond,
		MaxBackoff:     10 * time.Millisecond,
		Multiplier:     2,
	}

	calls := 0
	testErr := errors.New("test error")
	err := Retry(ctx, policy, func() error {
		calls++
		if calls < 3 {
			return testErr
		}
		return nil
	})

	if err != nil {
		t.Fatalf("expected success on third attempt: %v", err)
	}
	if calls != 3 {
		t.Fatalf("expected 3 calls, got %d", calls)
	}
}

func TestRetry_AllAttemptsFail(t *testing.T) {
	ctx := context.Background()
	policy := RetryPolicy{
		Attempts:       2,
		InitialBackoff: time.Millisecond,
		MaxBackoff:     10 * time.Millisecond,
		Multiplier:     1,
	}

	calls := 0
	testErr := errors.New("persistent error")
	err := Retry(ctx, policy, func() error {
		calls++
		return testErr
	})

	if err != testErr {
		t.Fatalf("expected test error, got %v", err)
	}
	if calls != 2 {
		t.Fatalf("expected 2 calls, got %d", calls)
	}
}

func TestRetry_ContextCanceled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	policy := RetryPolicy{
		Attempts:       5,
		InitialBackoff: 100 * time.Millisecond,
		MaxBackoff:     time.Second,
		Multiplier:     2,
	}

	calls := 0
	testErr := errors.New("test error")

	go func() {
		time.Sleep(10 * time.Millisecond)
		cancel()
	}()

	err := Retry(ctx, policy, func() error {
		calls++
		return testErr
	})

	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context.Canceled, got %v", err)
	}
}

func TestRetry_ZeroAttempts(t *testing.T) {
	ctx := context.Background()
	policy := RetryPolicy{Attempts: 0}

	calls := 0
	Retry(ctx, policy, func() error {
		calls++
		return nil
	})

	// Should default to 1 attempt
	if calls != 1 {
		t.Fatalf("expected 1 call with 0 attempts, got %d", calls)
	}
}

func TestRetry_MaxBackoffClamp(t *testing.T) {
	ctx := context.Background()
	policy := RetryPolicy{
		Attempts:       3,
		InitialBackoff: 10 * time.Millisecond,
		MaxBackoff:     5 * time.Millisecond, // Less than initial
		Multiplier:     10,
	}

	start := time.Now()
	testErr := errors.New("test")
	Retry(ctx, policy, func() error { return testErr })
	elapsed := time.Since(start)

	// With MaxBackoff=5ms and 2 backoff waits, should be around 10-20ms total
	// Allow some buffer for test execution
	if elapsed > 100*time.Millisecond {
		t.Fatalf("backoff should be clamped to MaxBackoff, elapsed: %v", elapsed)
	}
}

// Limit tests

func TestClampLimit(t *testing.T) {
	tests := []struct {
		name     string
		limit    int
		defLimit int
		max      int
		want     int
	}{
		{"zero limit uses default", 0, 25, 100, 25},
		{"negative limit uses default", -1, 25, 100, 25},
		{"within range", 50, 25, 100, 50},
		{"exceeds max", 200, 25, 100, 100},
		{"equals max", 100, 25, 100, 100},
		{"zero default uses package default", 10, 0, 100, 10},
		{"zero max uses default", 50, 25, 0, 25},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := ClampLimit(tc.limit, tc.defLimit, tc.max)
			if got != tc.want {
				t.Errorf("ClampLimit(%d, %d, %d) = %d, want %d",
					tc.limit, tc.defLimit, tc.max, got, tc.want)
			}
		})
	}
}

// Normalize tests

func TestNormalizeMetadata(t *testing.T) {
	tests := []struct {
		name  string
		input map[string]string
		want  map[string]string
	}{
		{"nil map", nil, nil},
		{"empty map", map[string]string{}, nil},
		{"trims and lowercases", map[string]string{" Key ": " Value "}, map[string]string{"key": "Value"}},
		{"skips empty keys", map[string]string{"": "value", "  ": "value2"}, map[string]string{}},
		{"preserves valid entries", map[string]string{"foo": "bar", "BAZ": "QUX"}, map[string]string{"foo": "bar", "baz": "QUX"}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := NormalizeMetadata(tc.input)
			if tc.want == nil {
				if got != nil {
					t.Errorf("expected nil, got %v", got)
				}
				return
			}
			if len(got) != len(tc.want) {
				t.Errorf("length mismatch: got %d, want %d", len(got), len(tc.want))
				return
			}
			for k, v := range tc.want {
				if got[k] != v {
					t.Errorf("key %q: got %q, want %q", k, got[k], v)
				}
			}
		})
	}
}

func TestNormalizeTags(t *testing.T) {
	tests := []struct {
		name  string
		input []string
		want  []string
	}{
		{"nil slice", nil, nil},
		{"empty slice", []string{}, nil},
		{"trims and lowercases", []string{" Tag1 ", "TAG2"}, []string{"tag1", "tag2"}},
		{"removes duplicates", []string{"foo", "FOO", "bar", "foo"}, []string{"foo", "bar"}},
		{"skips empty", []string{"", "  ", "valid"}, []string{"valid"}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := NormalizeTags(tc.input)
			if tc.want == nil && got != nil {
				t.Errorf("expected nil, got %v", got)
				return
			}
			if len(got) != len(tc.want) {
				t.Errorf("length mismatch: got %d, want %d", len(got), len(tc.want))
				return
			}
			for i, v := range tc.want {
				if got[i] != v {
					t.Errorf("index %d: got %q, want %q", i, got[i], v)
				}
			}
		})
	}
}

// Observation hooks tests

func TestStartObservation(t *testing.T) {
	ctx := context.Background()
	var startCalled, completeCalled bool
	var capturedErr error
	var capturedDuration time.Duration

	hooks := ObservationHooks{
		OnStart: func(ctx context.Context, meta map[string]string) {
			startCalled = true
		},
		OnComplete: func(ctx context.Context, meta map[string]string, err error, dur time.Duration) {
			completeCalled = true
			capturedErr = err
			capturedDuration = dur
		},
	}

	finish := StartObservation(ctx, hooks, nil)
	if !startCalled {
		t.Fatal("expected OnStart to be called")
	}

	time.Sleep(5 * time.Millisecond)
	testErr := errors.New("test")
	finish(testErr)

	if !completeCalled {
		t.Fatal("expected OnComplete to be called")
	}
	if capturedErr != testErr {
		t.Fatalf("expected test error, got %v", capturedErr)
	}
	if capturedDuration < 5*time.Millisecond {
		t.Fatalf("expected duration >= 5ms, got %v", capturedDuration)
	}
}

func TestStartObservation_NilHooks(t *testing.T) {
	ctx := context.Background()
	hooks := ObservationHooks{} // both nil

	// Should not panic
	finish := StartObservation(ctx, hooks, nil)
	finish(nil)
}

// Dispatch tests

func TestNewDispatchOptions(t *testing.T) {
	opts := NewDispatchOptions()

	if opts.tracer != NoopTracer {
		t.Fatal("expected NoopTracer")
	}
	if opts.retry.Attempts != 1 {
		t.Fatalf("expected 1 attempt, got %d", opts.retry.Attempts)
	}
}

func TestDispatchOptions_SetTracer(t *testing.T) {
	opts := NewDispatchOptions()

	opts.SetTracer(nil)
	if opts.tracer != NoopTracer {
		t.Fatal("expected NoopTracer after setting nil")
	}

	custom := &mockTracer{}
	opts.SetTracer(custom)
	if opts.tracer != custom {
		t.Fatal("expected custom tracer")
	}
}

func TestDispatchOptions_SetHooks(t *testing.T) {
	opts := NewDispatchOptions()

	// Setting empty hooks uses noop
	opts.SetHooks(ObservationHooks{})
	// Should have noop hooks set

	// Setting with at least one callback
	called := false
	opts.SetHooks(ObservationHooks{
		OnStart: func(ctx context.Context, meta map[string]string) { called = true },
	})

	// Verify hooks are set by running
	ctx := context.Background()
	opts.Run(ctx, "test", nil, func(ctx context.Context) error { return nil })
	if !called {
		t.Fatal("expected OnStart to be called")
	}
}

func TestDispatchOptions_SetRetry(t *testing.T) {
	opts := NewDispatchOptions()

	// Zero attempts uses default
	opts.SetRetry(RetryPolicy{Attempts: 0})
	if opts.retry.Attempts != 1 {
		t.Fatalf("expected 1 attempt with zero policy, got %d", opts.retry.Attempts)
	}

	// Valid policy
	opts.SetRetry(RetryPolicy{Attempts: 3})
	if opts.retry.Attempts != 3 {
		t.Fatalf("expected 3 attempts, got %d", opts.retry.Attempts)
	}
}

func TestDispatchOptions_Run(t *testing.T) {
	ctx := context.Background()

	var spanStarted bool
	mockTracer := &mockTracer{
		onStart: func(ctx context.Context, name string, attrs map[string]string) (context.Context, func(error)) {
			spanStarted = true
			return ctx, func(error) {}
		},
	}

	opts := NewDispatchOptions()
	opts.SetTracer(mockTracer)
	opts.SetRetry(RetryPolicy{Attempts: 2, InitialBackoff: time.Millisecond})

	calls := 0
	testErr := errors.New("first fail")
	err := opts.Run(ctx, "test-span", map[string]string{"key": "value"}, func(ctx context.Context) error {
		calls++
		if calls == 1 {
			return testErr
		}
		return nil
	})

	if err != nil {
		t.Fatalf("expected success on second attempt: %v", err)
	}
	if calls != 2 {
		t.Fatalf("expected 2 calls, got %d", calls)
	}
	if !spanStarted {
		t.Fatal("expected span to be started")
	}
}

// Tracer tests

func TestNoopTracer(t *testing.T) {
	ctx := context.Background()
	spanCtx, finish := NoopTracer.StartSpan(ctx, "test", nil)

	if spanCtx != ctx {
		t.Fatal("expected same context")
	}

	// Should not panic
	finish(nil)
	finish(errors.New("error"))
}

// Mock tracer for testing

type mockTracer struct {
	onStart func(ctx context.Context, name string, attrs map[string]string) (context.Context, func(error))
	calls   int32
}

func (m *mockTracer) StartSpan(ctx context.Context, name string, attrs map[string]string) (context.Context, func(error)) {
	atomic.AddInt32(&m.calls, 1)
	if m.onStart != nil {
		return m.onStart(ctx, name, attrs)
	}
	return ctx, func(error) {}
}
