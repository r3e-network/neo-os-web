package neofeeds

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
)

type chainlinkRoundTripFunc func(*http.Request) (*http.Response, error)

func (f chainlinkRoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

type failingReadCloser struct {
	err error
}

func (r failingReadCloser) Read(_ []byte) (int, error) {
	return 0, r.err
}

func (r failingReadCloser) Close() error {
	return nil
}

func TestNewChainlinkClientRedirectDoesNotFollow(t *testing.T) {
	var redirectedHits int32
	resultHex := fmt.Sprintf(
		"0x%064x%064x%064x%064x%064x",
		0,
		12345000000,
		0,
		time.Now().Unix(),
		0,
	)

	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&redirectedHits, 1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, fmt.Sprintf(`{"jsonrpc":"2.0","id":1,"result":"%s"}`, resultHex))
	}))
	defer target.Close()

	redirector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, target.URL, http.StatusFound)
	}))
	defer redirector.Close()

	client, err := NewChainlinkClient(redirector.URL)
	if err != nil {
		t.Fatalf("NewChainlinkClient() error = %v", err)
	}

	_, _, err = client.GetPrice(context.Background(), "BTC-USD")
	if err == nil {
		t.Fatal("GetPrice() should return error for redirect status")
	}

	var httpErr *httputil.HTTPStatusError
	if !errors.As(err, &httpErr) {
		t.Fatalf("expected *httputil.HTTPStatusError, got %T", err)
	}
	if httpErr.StatusCode != http.StatusFound {
		t.Fatalf("status code = %d, want %d", httpErr.StatusCode, http.StatusFound)
	}
	if hits := atomic.LoadInt32(&redirectedHits); hits != 0 {
		t.Fatalf("redirect target should not be called, got %d hit(s)", hits)
	}
}

func TestChainlinkGetPriceReturnsTypedHTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = io.WriteString(w, "upstream unavailable")
	}))
	defer server.Close()

	client := &ChainlinkClient{
		rpcURL: server.URL,
		client: server.Client(),
		feeds: map[string]*ChainlinkFeedConfig{
			"BTC-USD": {
				FeedID:   "BTC-USD",
				Address:  "0x1234",
				Decimals: 8,
			},
		},
	}

	_, _, err := client.GetPrice(context.Background(), "BTC-USD")
	if err == nil {
		t.Fatal("GetPrice() expected error")
	}

	var httpErr *httputil.HTTPStatusError
	if !errors.As(err, &httpErr) {
		t.Fatalf("expected *httputil.HTTPStatusError, got %T", err)
	}
	if httpErr.StatusCode != http.StatusBadGateway {
		t.Fatalf("status code = %d, want %d", httpErr.StatusCode, http.StatusBadGateway)
	}
	if !httputil.IsHTTPStatusError(err, http.StatusBadGateway) {
		t.Fatal("IsHTTPStatusError() should match 502")
	}
	if httputil.IsHTTPStatusError(err, http.StatusNotFound) {
		t.Fatal("IsHTTPStatusError() should not match wrong status")
	}
}

func TestChainlinkGetPriceReadBodyFailureStillWrapsHTTPStatusError(t *testing.T) {
	client := &ChainlinkClient{
		rpcURL: "https://rpc.example.test",
		client: &http.Client{
			Transport: chainlinkRoundTripFunc(func(_ *http.Request) (*http.Response, error) {
				return &http.Response{
					StatusCode: http.StatusBadGateway,
					Status:     "502 Bad Gateway",
					Body:       failingReadCloser{err: errors.New("boom")},
				}, nil
			}),
		},
		feeds: map[string]*ChainlinkFeedConfig{
			"BTC-USD": {
				FeedID:   "BTC-USD",
				Address:  "0x1234",
				Decimals: 8,
			},
		},
	}

	_, _, err := client.GetPrice(context.Background(), "BTC-USD")
	if err == nil {
		t.Fatal("GetPrice() expected error")
	}

	var httpErr *httputil.HTTPStatusError
	if !errors.As(err, &httpErr) {
		t.Fatalf("expected *httputil.HTTPStatusError, got %T", err)
	}
	if !httputil.IsHTTPStatusError(err, http.StatusBadGateway) {
		t.Fatal("IsHTTPStatusError() should match 502")
	}
	if !strings.Contains(err.Error(), "failed to read body") {
		t.Fatalf("unexpected error: %v", err)
	}
}
