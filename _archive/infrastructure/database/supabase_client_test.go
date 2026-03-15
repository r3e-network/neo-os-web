package database

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
)

type supabaseRoundTripFunc func(*http.Request) (*http.Response, error)

func (f supabaseRoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

type supabaseFailingReadCloser struct {
	err error
}

func (r supabaseFailingReadCloser) Read(_ []byte) (int, error) {
	return 0, r.err
}

func (r supabaseFailingReadCloser) Close() error {
	return nil
}

func TestNewClient_AllowsHTTPInNonStrictMode(t *testing.T) {
	t.Setenv("NITRO_ENV", "development")
	t.Setenv("NITRO_CERT", "")
	t.Setenv("NITRO_KEY", "")
	t.Setenv("NITRO_ROOT_CA", "")

	_, err := NewClient(Config{
		URL:        "http://localhost:54321",
		ServiceKey: "test",
	})
	if err != nil {
		t.Fatalf("expected http SUPABASE_URL to be allowed in non-strict mode, got err: %v", err)
	}
}

func TestNewClient_StrictModeRejectsNonHTTPS(t *testing.T) {
	t.Setenv("NITRO_ENV", "production")
	t.Setenv("NITRO_CERT", "")
	t.Setenv("NITRO_KEY", "")
	t.Setenv("NITRO_ROOT_CA", "")

	_, err := NewClient(Config{
		URL:        "http://example.com",
		ServiceKey: "test",
	})
	if err == nil {
		t.Fatal("expected error for http SUPABASE_URL in strict mode, got nil")
	}
}

func TestNewClient_StrictModeRejectsUserInfo(t *testing.T) {
	t.Setenv("NITRO_ENV", "production")
	t.Setenv("NITRO_CERT", "")
	t.Setenv("NITRO_KEY", "")
	t.Setenv("NITRO_ROOT_CA", "")

	_, err := NewClient(Config{
		URL:        "https://user:pass@example.com",
		ServiceKey: "test",
	})
	if err == nil {
		t.Fatal("expected error for SUPABASE_URL with user info, got nil")
	}
}

func TestDoRequestReadErrorResponseStillWrapsAPIError(t *testing.T) {
	t.Parallel()

	c := &Client{
		serviceKey: "test-service-key",
		httpClient: &http.Client{
			Transport: supabaseRoundTripFunc(func(_ *http.Request) (*http.Response, error) {
				return &http.Response{
					StatusCode: http.StatusBadGateway,
					Status:     "502 Bad Gateway",
					Body:       supabaseFailingReadCloser{err: errors.New("boom")},
				}, nil
			}),
		},
	}

	_, err := c.doRequest(context.Background(), http.MethodGet, "https://supabase.example.test/rest/v1/users", "return=representation", nil)
	if err == nil {
		t.Fatal("doRequest() expected error")
	}

	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected *APIError, got %T", err)
	}
	if apiErr.StatusCode != http.StatusBadGateway {
		t.Fatalf("status code = %d, want %d", apiErr.StatusCode, http.StatusBadGateway)
	}
	if !strings.Contains(err.Error(), "failed to read body") {
		t.Fatalf("unexpected error: %v", err)
	}
	if !httputil.IsHTTPStatusError(err, http.StatusBadGateway) {
		t.Fatal("shared IsHTTPStatusError() should match 502")
	}
}

func TestNewClientDoRequestRedirectDoesNotFollow(t *testing.T) {
	t.Setenv("NITRO_ENV", "development")
	t.Setenv("NITRO_CERT", "")
	t.Setenv("NITRO_KEY", "")
	t.Setenv("NITRO_ROOT_CA", "")

	var redirectedHits int32
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&redirectedHits, 1)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`[]`))
	}))
	defer target.Close()

	redirector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, target.URL, http.StatusFound)
	}))
	defer redirector.Close()

	c, err := NewClient(Config{
		URL:        redirector.URL,
		ServiceKey: "test-service-key",
	})
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}

	_, err = c.doRequest(context.Background(), http.MethodGet, redirector.URL+"/rest/v1/users", "", nil)
	if err == nil {
		t.Fatal("doRequest() should return error for redirect status")
	}

	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected *APIError, got %T", err)
	}
	if apiErr.StatusCode != http.StatusFound {
		t.Fatalf("status code = %d, want %d", apiErr.StatusCode, http.StatusFound)
	}
	if hits := atomic.LoadInt32(&redirectedHits); hits != 0 {
		t.Fatalf("redirect target should not be called, got %d hit(s)", hits)
	}
}
