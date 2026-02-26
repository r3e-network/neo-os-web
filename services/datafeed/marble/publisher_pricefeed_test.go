package neofeeds

import (
	"context"
	"math/big"
	"testing"
	"time"

	txproxytypes "github.com/r3e-network/neo-miniapp-platform/infrastructure/txproxy/types"
)

type mockTxProxyInvoker struct {
	calls []*txproxytypes.InvokeRequest
	err   error
}

func (m *mockTxProxyInvoker) Invoke(_ context.Context, req *txproxytypes.InvokeRequest) (*txproxytypes.InvokeResponse, error) {
	m.calls = append(m.calls, req)
	if m.err != nil {
		return nil, m.err
	}
	return &txproxytypes.InvokeResponse{
		RequestID: req.RequestID,
		TxHash:    "0xtest",
		VMState:   "HALT",
	}, nil
}

func newPublisherTestService(invoker *mockTxProxyInvoker, policy PublishPolicyConfig) *Service {
	return &Service{
		txProxy:         invoker,
		priceFeedHash:   "0x1234567890abcdef",
		attestationHash: []byte{1, 2, 3},
		publishPolicy:   policy,
		publishState:    make(map[string]*pricePublishState),
	}
}

func TestTryPublishPricePublishesOnFirstThresholdCross(t *testing.T) {
	invoker := &mockTxProxyInvoker{}
	svc := newPublisherTestService(invoker, PublishPolicyConfig{
		ThresholdBps: 10,
		MinInterval:  time.Nanosecond,
		MaxPerMinute: 30,
	})

	symbol := "BTC-USD"
	svc.publishState[symbol] = &pricePublishState{
		lastRoundID:        7,
		lastPublishedPrice: 10000,
	}

	svc.tryPublishPrice(context.Background(), symbol, 10010, uint64(time.Now().Unix()), big.NewInt(1))

	if len(invoker.calls) != 1 {
		t.Fatalf("Invoke() call count = %d, want 1", len(invoker.calls))
	}

	state := svc.publishState[symbol]
	if state.lastRoundID != 8 {
		t.Errorf("lastRoundID = %d, want 8", state.lastRoundID)
	}
	if state.lastPublishedPrice != 10010 {
		t.Errorf("lastPublishedPrice = %d, want 10010", state.lastPublishedPrice)
	}
}

func TestTryPublishPriceDoesNotPublishBelowThreshold(t *testing.T) {
	invoker := &mockTxProxyInvoker{}
	svc := newPublisherTestService(invoker, PublishPolicyConfig{
		ThresholdBps: 10,
		MinInterval:  time.Nanosecond,
		MaxPerMinute: 30,
	})

	symbol := "BTC-USD"
	svc.publishState[symbol] = &pricePublishState{
		lastRoundID:        1,
		lastPublishedPrice: 10000,
	}

	// 9 bps change (< 10 bps threshold).
	svc.tryPublishPrice(context.Background(), symbol, 10009, uint64(time.Now().Unix()), big.NewInt(1))

	if len(invoker.calls) != 0 {
		t.Fatalf("Invoke() call count = %d, want 0", len(invoker.calls))
	}
}

func TestTryPublishPriceRespectsMinInterval(t *testing.T) {
	invoker := &mockTxProxyInvoker{}
	svc := newPublisherTestService(invoker, PublishPolicyConfig{
		ThresholdBps: 10,
		MinInterval:  30 * time.Second,
		MaxPerMinute: 30,
	})

	symbol := "BTC-USD"
	svc.publishState[symbol] = &pricePublishState{
		lastRoundID:        2,
		lastPublishedPrice: 10000,
		lastPublishedAt:    time.Now(),
	}

	svc.tryPublishPrice(context.Background(), symbol, 12000, uint64(time.Now().Unix()), big.NewInt(1))

	if len(invoker.calls) != 0 {
		t.Fatalf("Invoke() call count = %d, want 0", len(invoker.calls))
	}
}

func TestTryPublishPriceHeartbeatPublishesBelowThresholdWithNewTimestamp(t *testing.T) {
	invoker := &mockTxProxyInvoker{}
	svc := newPublisherTestService(invoker, PublishPolicyConfig{
		ThresholdBps:      10,
		MinInterval:       time.Nanosecond,
		MaxPerMinute:      30,
		HeartbeatInterval: 10 * time.Minute,
	})

	symbol := "USDT-USD"
	svc.publishState[symbol] = &pricePublishState{
		lastRoundID:        4,
		lastPublishedPrice: 10000,
		lastPublishedTS:    100,
		lastPublishedAt:    time.Now().Add(-11 * time.Minute),
	}

	// 1 bps change (< threshold), but heartbeat interval elapsed and source timestamp advanced.
	svc.tryPublishPrice(context.Background(), symbol, 10001, 101, big.NewInt(1))

	if len(invoker.calls) != 1 {
		t.Fatalf("Invoke() call count = %d, want 1", len(invoker.calls))
	}

	state := svc.publishState[symbol]
	if state.lastRoundID != 5 {
		t.Errorf("lastRoundID = %d, want 5", state.lastRoundID)
	}
	if state.lastPublishedTS != 101 {
		t.Errorf("lastPublishedTS = %d, want 101", state.lastPublishedTS)
	}
}

func TestTryPublishPriceHeartbeatSkipsWithoutNewTimestamp(t *testing.T) {
	invoker := &mockTxProxyInvoker{}
	svc := newPublisherTestService(invoker, PublishPolicyConfig{
		ThresholdBps:      10,
		MinInterval:       time.Nanosecond,
		MaxPerMinute:      30,
		HeartbeatInterval: 10 * time.Minute,
	})

	symbol := "USDC-USD"
	svc.publishState[symbol] = &pricePublishState{
		lastRoundID:        2,
		lastPublishedPrice: 10000,
		lastPublishedTS:    200,
		lastPublishedAt:    time.Now().Add(-11 * time.Minute),
	}

	// 1 bps change and heartbeat elapsed, but source timestamp did not advance.
	svc.tryPublishPrice(context.Background(), symbol, 10001, 200, big.NewInt(1))

	if len(invoker.calls) != 0 {
		t.Fatalf("Invoke() call count = %d, want 0", len(invoker.calls))
	}
}

func TestTryPublishPricePublishesOnEachThresholdCross(t *testing.T) {
	invoker := &mockTxProxyInvoker{}
	svc := newPublisherTestService(invoker, PublishPolicyConfig{
		ThresholdBps: 10,
		MinInterval:  time.Nanosecond,
		MaxPerMinute: 30,
	})

	symbol := "BTC-USD"
	svc.publishState[symbol] = &pricePublishState{
		lastRoundID:        3,
		lastPublishedPrice: 10000,
	}

	ts := uint64(time.Now().Unix())
	svc.tryPublishPrice(context.Background(), symbol, 10010, ts, big.NewInt(1))
	svc.tryPublishPrice(context.Background(), symbol, 10022, ts+1, big.NewInt(1))

	if len(invoker.calls) != 2 {
		t.Fatalf("Invoke() call count = %d, want 2", len(invoker.calls))
	}

	state := svc.publishState[symbol]
	if state.lastRoundID != 5 {
		t.Errorf("lastRoundID = %d, want 5", state.lastRoundID)
	}
	if state.lastPublishedPrice != 10022 {
		t.Errorf("lastPublishedPrice = %d, want 10022", state.lastPublishedPrice)
	}
}

func TestMarkFeedEvaluatedHonorsInterval(t *testing.T) {
	svc := &Service{
		publishState: make(map[string]*pricePublishState),
	}

	now := time.Now()
	svc.publishState["XAU-USD"] = &pricePublishState{
		nextEvaluationAt: now,
	}

	if ok := svc.markFeedEvaluated("XAU-USD", 30*time.Second, now); !ok {
		t.Fatal("first markFeedEvaluated() = false, want true")
	}
	if ok := svc.markFeedEvaluated("XAU-USD", 30*time.Second, now.Add(5*time.Second)); ok {
		t.Fatal("second markFeedEvaluated() = true, want false within interval")
	}
	if ok := svc.markFeedEvaluated("XAU-USD", 30*time.Second, now.Add(31*time.Second)); !ok {
		t.Fatal("third markFeedEvaluated() = false, want true after interval")
	}
}

func TestMarkFeedEvaluatedZeroIntervalAlwaysRuns(t *testing.T) {
	svc := &Service{
		publishState: make(map[string]*pricePublishState),
	}

	now := time.Now()
	if ok := svc.markFeedEvaluated("BTC-USD", 0, now); !ok {
		t.Fatal("markFeedEvaluated() with zero interval = false, want true")
	}
	if ok := svc.markFeedEvaluated("BTC-USD", 0, now.Add(time.Millisecond)); !ok {
		t.Fatal("markFeedEvaluated() with zero interval second call = false, want true")
	}
}

func TestStableIntervalOffsetWithinRangeAndDeterministic(t *testing.T) {
	interval := 30 * time.Second
	offset1 := stableIntervalOffset("NVDA-USD", interval)
	offset2 := stableIntervalOffset("NVDA-USD", interval)

	if offset1 < 0 || offset1 >= interval {
		t.Fatalf("offset out of range: %v (interval=%v)", offset1, interval)
	}
	if offset1 != offset2 {
		t.Fatalf("offset should be deterministic, got %v and %v", offset1, offset2)
	}
}
