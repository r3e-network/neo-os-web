package neofeeds

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/mux"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/nitro"
)

// newTestDatafeedService creates a Service with simulation mode and default config.
func newTestDatafeedService(t *testing.T) *Service {
	t.Helper()
	m, _ := nitro.New(nitro.Config{NitroType: "neofeeds"})
	svc, err := New(Config{Nitro: m})
	if err != nil {
		t.Fatalf("New() err = %v", err)
	}
	return svc
}

func TestHandleGetConfigNoAdmin(t *testing.T) {
	svc := newTestDatafeedService(t)

	req := httptest.NewRequest("GET", "/config", nil)
	// No X-User-Role header → RequireAdminRole returns false → 403
	rr := httptest.NewRecorder()
	svc.handleGetConfig(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusForbidden)
	}
}

func TestHandleListSourcesNoAdmin(t *testing.T) {
	svc := newTestDatafeedService(t)

	req := httptest.NewRequest("GET", "/sources", nil)
	rr := httptest.NewRecorder()
	svc.handleListSources(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusForbidden)
	}
}

func TestHandleGetPriceEmptyPair(t *testing.T) {
	svc := newTestDatafeedService(t)

	req := httptest.NewRequest("GET", "/price/", nil)
	// No mux vars → pair is empty string → 400
	rr := httptest.NewRecorder()
	svc.handleGetPrice(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusBadRequest)
	}
}

func TestHandleGetPriceNotFound(t *testing.T) {
	m, _ := nitro.New(nitro.Config{NitroType: "neofeeds"})
	// Config with a single feed; no HTTP client → all source fetches fail.
	cfg := &NeoFeedsConfig{
		Version: "1.0",
		Sources: []SourceConfig{
			{ID: "dummy", Name: "Dummy", URL: "http://localhost:1", JSONPath: "price", Weight: 1},
		},
		Feeds: []FeedConfig{
			{ID: "BTC-USD", Pair: "BTCUSDT", Sources: []string{"dummy"}, Enabled: true},
		},
		UpdateInterval: 60 * time.Second,
	}
	svc, err := New(Config{Nitro: m, FeedsConfig: cfg})
	if err != nil {
		t.Fatalf("New() err = %v", err)
	}

	req := httptest.NewRequest("GET", "/price/UNKNOWN-PAIR", nil)
	req = mux.SetURLVars(req, map[string]string{"pair": "UNKNOWN-PAIR"})
	rr := httptest.NewRecorder()
	svc.handleGetPrice(rr, req)

	// Unknown pair with failing sources → "no prices available" → 503
	if rr.Code != http.StatusServiceUnavailable {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusServiceUnavailable)
	}
}

func TestHandleGetPricesNoDB(t *testing.T) {
	m, _ := nitro.New(nitro.Config{NitroType: "neofeeds"})
	svc, err := New(Config{Nitro: m, DB: nil})
	if err != nil {
		t.Fatalf("New() err = %v", err)
	}

	req := httptest.NewRequest("GET", "/prices", nil)
	rr := httptest.NewRecorder()
	svc.handleGetPrices(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusOK)
	}

	var prices []PriceResponse
	if err := json.NewDecoder(rr.Body).Decode(&prices); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(prices) != 0 {
		t.Errorf("len(prices) = %d, want 0", len(prices))
	}
}

func TestHandleListFeedsReturnsConfiguredFeeds(t *testing.T) {
	m, _ := nitro.New(nitro.Config{NitroType: "neofeeds"})
	cfg := &NeoFeedsConfig{
		Version: "1.0",
		Sources: []SourceConfig{
			{ID: "src1", Name: "Source1", URL: "http://localhost:1", JSONPath: "price", Weight: 1},
		},
		Feeds: []FeedConfig{
			{ID: "BTC-USD", Pair: "BTCUSDT", Decimals: 8, Sources: []string{"src1"}, Enabled: true},
			{ID: "ETH-USD", Pair: "ETHUSDT", Decimals: 8, Sources: []string{"src1"}, Enabled: true},
			{ID: "DISABLED", Pair: "XYZUSDT", Decimals: 8, Sources: []string{"src1"}, Enabled: false},
		},
		UpdateInterval: 60 * time.Second,
	}
	svc, err := New(Config{Nitro: m, FeedsConfig: cfg})
	if err != nil {
		t.Fatalf("New() err = %v", err)
	}

	req := httptest.NewRequest("GET", "/feeds", nil)
	rr := httptest.NewRecorder()
	svc.handleListFeeds(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusOK)
	}

	var feeds []FeedSummary
	if err := json.NewDecoder(rr.Body).Decode(&feeds); err != nil {
		t.Fatalf("decode: %v", err)
	}

	// Only enabled feeds should be returned (2 out of 3).
	if len(feeds) != 2 {
		t.Fatalf("len(feeds) = %d, want 2", len(feeds))
	}

	// Verify feed fields are populated.
	for _, f := range feeds {
		if f.ID == "" {
			t.Error("feed ID is empty")
		}
		if f.Decimals == 0 {
			t.Errorf("feed %s: decimals = 0", f.ID)
		}
		if !f.Enabled {
			t.Errorf("feed %s: enabled = false, want true", f.ID)
		}
	}
}
