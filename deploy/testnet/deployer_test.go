package testnet

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/chain"
)

type deployerRoundTripFunc func(*http.Request) (*http.Response, error)

func (f deployerRoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

type deployerFailingReadCloser struct {
	err error
}

func (r deployerFailingReadCloser) Read(_ []byte) (int, error) {
	return 0, r.err
}

func (r deployerFailingReadCloser) Close() error {
	return nil
}

func TestDeployerCallReturnsTypedHTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = io.WriteString(w, "rpc overloaded")
	}))
	defer server.Close()

	d := &Deployer{
		rpcURL: server.URL,
		client: server.Client(),
	}

	_, err := d.call("getblockcount")
	if err == nil {
		t.Fatal("call() expected error")
	}

	var httpErr *chain.RPCHTTPError
	if !errors.As(err, &httpErr) {
		t.Fatalf("expected *chain.RPCHTTPError, got %T", err)
	}
	if httpErr.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("status code = %d, want %d", httpErr.StatusCode, http.StatusServiceUnavailable)
	}
	if !chain.IsRPCHTTPStatusError(err, http.StatusServiceUnavailable) {
		t.Fatal("IsRPCHTTPStatusError() should match 503")
	}
	if chain.IsRPCHTTPStatusError(err, http.StatusNotFound) {
		t.Fatal("IsRPCHTTPStatusError() should not match wrong status")
	}
}

func TestDeployerCallReadBodyFailureStillReturnsTypedHTTPError(t *testing.T) {
	d := &Deployer{
		rpcURL: "https://rpc.example.test",
		client: &http.Client{
			Transport: deployerRoundTripFunc(func(_ *http.Request) (*http.Response, error) {
				return &http.Response{
					StatusCode: http.StatusServiceUnavailable,
					Status:     "503 Service Unavailable",
					Body:       deployerFailingReadCloser{err: errors.New("boom")},
				}, nil
			}),
		},
	}

	_, err := d.call("getblockcount")
	if err == nil {
		t.Fatal("call() expected error")
	}

	var httpErr *chain.RPCHTTPError
	if !errors.As(err, &httpErr) {
		t.Fatalf("expected *chain.RPCHTTPError, got %T", err)
	}
	if httpErr.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("status code = %d, want %d", httpErr.StatusCode, http.StatusServiceUnavailable)
	}
	if !chain.IsRPCHTTPStatusError(err, http.StatusServiceUnavailable) {
		t.Fatal("IsRPCHTTPStatusError() should match 503")
	}
	if !strings.Contains(err.Error(), "failed to read body") {
		t.Fatalf("unexpected error: %v", err)
	}
}
