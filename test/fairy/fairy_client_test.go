package fairy

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/chain"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
)

type fairyRoundTripFunc func(*http.Request) (*http.Response, error)

func (f fairyRoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

type fairyFailingReadCloser struct {
	err error
}

func (r fairyFailingReadCloser) Read(_ []byte) (int, error) {
	return 0, r.err
}

func (r fairyFailingReadCloser) Close() error {
	return nil
}

func TestResolveSessionWIFUsesEnvironment(t *testing.T) {
	privateKey, err := keys.NewPrivateKey()
	if err != nil {
		t.Fatalf("NewPrivateKey: %v", err)
	}
	want := privateKey.WIF()
	t.Setenv("NEO_TESTNET_WIF", want)

	got, err := resolveSessionWIF()
	if err != nil {
		t.Fatalf("resolveSessionWIF(): %v", err)
	}
	if got != want {
		t.Fatalf("resolveSessionWIF() = %q, want %q", got, want)
	}
}

func TestResolveSessionWIFFallsBackToGeneratedKey(t *testing.T) {
	t.Setenv("NEO_TESTNET_WIF", "")

	got, err := resolveSessionWIF()
	if err != nil {
		t.Fatalf("resolveSessionWIF(): %v", err)
	}
	if strings.TrimSpace(got) == "" {
		t.Fatal("resolveSessionWIF() returned empty WIF")
	}
	if _, err := keys.NewPrivateKeyFromWIF(got); err != nil {
		t.Fatalf("generated WIF should parse: %v", err)
	}
}

func TestFairyCallReturnsTypedHTTPError(t *testing.T) {
	c := NewClient("http://example")
	c.client.Transport = fairyRoundTripFunc(func(_ *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusBadGateway,
			Status:     "502 Bad Gateway",
			Header:     make(http.Header),
			Body:       http.NoBody,
		}, nil
	})

	_, err := c.call("getblockcount")
	if err == nil {
		t.Fatal("call() expected error")
	}

	var httpErr *chain.RPCHTTPError
	if !errors.As(err, &httpErr) {
		t.Fatalf("expected *chain.RPCHTTPError, got %T", err)
	}
	if httpErr.StatusCode != http.StatusBadGateway {
		t.Fatalf("status code = %d, want %d", httpErr.StatusCode, http.StatusBadGateway)
	}
	if !chain.IsRPCHTTPStatusError(err, http.StatusBadGateway) {
		t.Fatal("IsRPCHTTPStatusError() should match 502")
	}
	if !httputil.IsHTTPStatusError(err, http.StatusBadGateway) {
		t.Fatal("shared IsHTTPStatusError() should match 502")
	}
}

func TestFairyCallReadBodyFailureStillReturnsTypedHTTPError(t *testing.T) {
	c := NewClient("http://example")
	c.client.Transport = fairyRoundTripFunc(func(_ *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusBadGateway,
			Status:     "502 Bad Gateway",
			Header:     make(http.Header),
			Body:       fairyFailingReadCloser{err: errors.New("boom")},
		}, nil
	})

	_, err := c.call("getblockcount")
	if err == nil {
		t.Fatal("call() expected error")
	}

	var httpErr *chain.RPCHTTPError
	if !errors.As(err, &httpErr) {
		t.Fatalf("expected *chain.RPCHTTPError, got %T", err)
	}
	if !strings.Contains(err.Error(), "failed to read body") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestInvokeFunctionWithSessionEncodesContractParameters(t *testing.T) {
	c := NewClient("http://example")

	var captured struct {
		Method string            `json:"method"`
		Params []json.RawMessage `json:"params"`
	}

	c.client.Transport = fairyRoundTripFunc(func(req *http.Request) (*http.Response, error) {
		body, err := io.ReadAll(req.Body)
		if err != nil {
			return nil, err
		}
		if err := json.Unmarshal(body, &captured); err != nil {
			return nil, err
		}

		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       io.NopCloser(strings.NewReader(`{"jsonrpc":"2.0","id":1,"result":{"state":"HALT","stack":[]}}`)),
		}, nil
	})

	_, err := c.InvokeFunctionWithSession(
		"session-1",
		true,
		"0x1234",
		"setAppRegistry",
		[]interface{}{1, "gaming", true, "0x1111111111111111111111111111111111111111"},
	)
	if err != nil {
		t.Fatalf("InvokeFunctionWithSession(): %v", err)
	}

	if captured.Method != "invokefunctionwithsession" {
		t.Fatalf("method = %q, want %q", captured.Method, "invokefunctionwithsession")
	}
	if len(captured.Params) != 5 {
		t.Fatalf("param count = %d, want 5", len(captured.Params))
	}

	var args []map[string]any
	if err := json.Unmarshal(captured.Params[4], &args); err != nil {
		t.Fatalf("unmarshal args: %v", err)
	}
	if len(args) != 4 {
		t.Fatalf("arg count = %d, want 4", len(args))
	}

	if got := args[0]["type"]; got != "Integer" {
		t.Fatalf("arg[0].type = %#v, want %q", got, "Integer")
	}
	if got := args[0]["value"]; got != "1" {
		t.Fatalf("arg[0].value = %#v, want %q", got, "1")
	}

	if got := args[1]["type"]; got != "String" {
		t.Fatalf("arg[1].type = %#v, want %q", got, "String")
	}
	if got := args[1]["value"]; got != "gaming" {
		t.Fatalf("arg[1].value = %#v, want %q", got, "gaming")
	}

	if got := args[2]["type"]; got != "Boolean" {
		t.Fatalf("arg[2].type = %#v, want %q", got, "Boolean")
	}
	if got := args[2]["value"]; got != true {
		t.Fatalf("arg[2].value = %#v, want %v", got, true)
	}

	if got := args[3]["type"]; got != "Hash160" {
		t.Fatalf("arg[3].type = %#v, want %q", got, "Hash160")
	}
	if got := args[3]["value"]; got != "1111111111111111111111111111111111111111" {
		t.Fatalf("arg[3].value = %#v, want %q", got, "1111111111111111111111111111111111111111")
	}
}
