package pricefeed

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"

	domain "github.com/R3E-Network/service_layer/internal/domain/pricefeed"
)

func TestHTTPFetcher(t *testing.T) {
	server := newHTTPTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("base") != "NEO" || r.URL.Query().Get("quote") != "USD" {
			t.Fatalf("unexpected query: %s", r.URL.RawQuery)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer token" {
			t.Fatalf("expected auth header, got %q", got)
		}
		if _, err := w.Write([]byte(`{"price": 10.5, "source": "test"}`)); err != nil {
			t.Fatalf("write response: %v", err)
		}
	}))
	defer server.Close()

	fetcher, err := NewHTTPFetcher(server.Client(), server.URL, "token", nil)
	if err != nil {
		t.Fatalf("new fetcher: %v", err)
	}

	price, source, err := fetcher.Fetch(context.Background(), domain.Feed{BaseAsset: "NEO", QuoteAsset: "USD"})
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
	if price != 10.5 || source != "test" {
		t.Fatalf("unexpected result price=%v source=%s", price, source)
	}
}

func newHTTPTestServer(t *testing.T, handler http.Handler) *httptest.Server {
	t.Helper()
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Skipf("tcp4 listener unavailable: %v", err)
	}
	server := &httptest.Server{
		Listener: listener,
		Config:   &http.Server{Handler: handler},
	}
	server.Start()
	return server
}
