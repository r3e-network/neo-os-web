package neofeeds

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/nitro"
	"github.com/tidwall/gjson"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestIsDuplicatePriceFeedError(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{
			name: "nil error",
			err:  nil,
			want: false,
		},
		{
			name: "postgres duplicate code and message",
			err:  errors.New(`database error: create price feed: supabase API error 409: {"code":"23505","message":"duplicate key value violates unique constraint \"price_feeds_feed_id_key\""}`),
			want: true,
		},
		{
			name: "duplicate without postgres code",
			err:  errors.New("duplicate key value violates unique constraint"),
			want: true,
		},
		{
			name: "postgres unique code without duplicate marker",
			err:  errors.New(`database error: {"code":"23505","message":"constraint violation"}`),
			want: true,
		},
		{
			name: "other error",
			err:  errors.New("connection timeout"),
			want: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := isDuplicatePriceFeedError(tc.err); got != tc.want {
				t.Fatalf("isDuplicatePriceFeedError() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestParsePriceResult(t *testing.T) {
	tests := []struct {
		name    string
		rawJSON string
		path    string
		want    float64
		wantErr bool
	}{
		{
			name:    "numeric json value",
			rawJSON: `{"price":123.45}`,
			path:    "price",
			want:    123.45,
		},
		{
			name:    "currency formatted string",
			rawJSON: `{"price":"$195.9117"}`,
			path:    "price",
			want:    195.9117,
		},
		{
			name:    "comma formatted string",
			rawJSON: `{"price":"250,384,003.971606"}`,
			path:    "price",
			want:    250384003.971606,
		},
		{
			name:    "invalid string",
			rawJSON: `{"price":"N/A"}`,
			path:    "price",
			wantErr: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := gjson.Get(tc.rawJSON, tc.path)
			got, err := parsePriceResult(result)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("parsePriceResult() expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("parsePriceResult() error = %v", err)
			}
			if got != tc.want {
				t.Fatalf("parsePriceResult() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestGetPriceReturnsTypedErrors(t *testing.T) {
	t.Run("pair required", func(t *testing.T) {
		svc := newTestDatafeedService(t)

		_, err := svc.GetPrice(context.Background(), "")
		if !errors.Is(err, ErrPairRequired) {
			t.Fatalf("GetPrice() error = %v, want errors.Is(err, ErrPairRequired)", err)
		}
	})

	t.Run("price data unavailable", func(t *testing.T) {
		m, _ := nitro.New(nitro.Config{NitroType: "neofeeds"})
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

		_, err = svc.GetPrice(context.Background(), "BTC-USD")
		if !errors.Is(err, ErrPriceDataUnavailable) {
			t.Fatalf("GetPrice() error = %v, want errors.Is(err, ErrPriceDataUnavailable)", err)
		}
	})

	t.Run("feed not found", func(t *testing.T) {
		m, _ := nitro.New(nitro.Config{NitroType: "neofeeds"})
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

		_, err = svc.GetPrice(context.Background(), "ETH-USD")
		if !errors.Is(err, ErrPriceFeedNotFound) {
			t.Fatalf("GetPrice() error = %v, want errors.Is(err, ErrPriceFeedNotFound)", err)
		}
	})
}

func TestFetchPriceFromSourceRedirectDoesNotFollow(t *testing.T) {
	var redirectedHits int32
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&redirectedHits, 1)
		_, _ = io.WriteString(w, `{"price": 123.45}`)
	}))
	defer target.Close()

	redirector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, target.URL, http.StatusFound)
	}))
	defer redirector.Close()

	m, _ := nitro.New(nitro.Config{NitroType: "neofeeds"})
	baseClient := &http.Client{}
	svc, err := New(Config{Nitro: m, HTTPClient: baseClient})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	if baseClient.CheckRedirect != nil {
		t.Fatal("New() should not mutate caller-provided HTTP client")
	}

	src := &SourceConfig{
		ID:       "primary",
		URL:      redirector.URL + "/prices?pair={pair}",
		JSONPath: "price",
		Timeout:  time.Second,
	}

	_, err = svc.fetchPriceFromSource(context.Background(), "BTCUSD", nil, src)
	if err == nil {
		t.Fatal("fetchPriceFromSource() should return error for redirect status")
	}

	var httpErr *priceSourceHTTPError
	if !errors.As(err, &httpErr) {
		t.Fatalf("expected *priceSourceHTTPError, got %T", err)
	}
	if httpErr.StatusCode != http.StatusFound {
		t.Fatalf("status code = %d, want %d", httpErr.StatusCode, http.StatusFound)
	}
	if hits := atomic.LoadInt32(&redirectedHits); hits != 0 {
		t.Fatalf("redirect target should not be called, got %d hit(s)", hits)
	}
}

func TestFetchPriceFromSourceWrapsTransportErrorWithSourceContext(t *testing.T) {
	t.Parallel()

	transportErr := errors.New("connection reset by peer")
	svc := &Service{
		httpClient: &http.Client{
			Transport: roundTripFunc(func(_ *http.Request) (*http.Response, error) {
				return nil, transportErr
			}),
		},
	}
	src := &SourceConfig{
		ID:       "primary",
		URL:      "https://prices.example.test/quote?pair={pair}",
		JSONPath: "price",
	}

	_, err := svc.fetchPriceFromSource(context.Background(), "BTCUSD", nil, src)
	if err == nil {
		t.Fatal("fetchPriceFromSource() expected transport error")
	}
	if !errors.Is(err, transportErr) {
		t.Fatalf("wrapped error should preserve original transport error, got %v", err)
	}
	if !strings.Contains(err.Error(), "primary") {
		t.Fatalf("error = %q, want to contain source id", err.Error())
	}
	if !strings.Contains(err.Error(), "prices.example.test") {
		t.Fatalf("error = %q, want to contain source url", err.Error())
	}
}

func TestFetchPriceFromSourceReturnsTypedHTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = io.WriteString(w, "upstream unavailable")
	}))
	defer server.Close()

	svc := &Service{httpClient: server.Client()}
	src := &SourceConfig{
		ID:       "primary",
		URL:      server.URL + "/prices?pair={pair}",
		JSONPath: "price",
	}

	_, err := svc.fetchPriceFromSource(context.Background(), "BTCUSD", nil, src)
	if err == nil {
		t.Fatal("fetchPriceFromSource() expected error")
	}

	var httpErr *priceSourceHTTPError
	if !errors.As(err, &httpErr) {
		t.Fatalf("expected *priceSourceHTTPError, got %T", err)
	}
	if httpErr.StatusCode != http.StatusBadGateway {
		t.Fatalf("status code = %d, want %d", httpErr.StatusCode, http.StatusBadGateway)
	}
	if !errors.Is(err, httpErr) {
		t.Fatal("error should wrap typed http error")
	}
	if httpErr.SourceID != "primary" {
		t.Fatalf("source id = %q, want %q", httpErr.SourceID, "primary")
	}
	if !isPriceSourceStatusError(err, http.StatusBadGateway) {
		t.Fatal("isPriceSourceStatusError() should match 502")
	}
	if isPriceSourceStatusError(err, http.StatusNotFound) {
		t.Fatal("isPriceSourceStatusError() should not match wrong status")
	}
	var sharedErr *httputil.HTTPStatusError
	if !errors.As(err, &sharedErr) {
		t.Fatalf("expected shared *httputil.HTTPStatusError, got %T", err)
	}
	if !httputil.IsHTTPStatusError(err, http.StatusBadGateway) {
		t.Fatal("shared IsHTTPStatusError() should match 502")
	}
}

func TestToPriceSourceHTTPErrorNilResponse(t *testing.T) {
	t.Parallel()

	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("toPriceSourceHTTPError should not panic on nil response: %v", r)
		}
	}()

	err := toPriceSourceHTTPError(nil, "primary", "https://example.test/prices")
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "response is nil") {
		t.Fatalf("unexpected error: %v", err)
	}
}
