package cre

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/R3E-Network/service_layer/domain/cre"
)

func TestHTTPRunner_Dispatch(t *testing.T) {
	var called bool
	ts := newExecutorServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(ts.Close)

	runner := NewHTTPRunner(nil, nil)
	err := runner.Dispatch(context.Background(), cre.Run{ID: "run1"}, cre.Playbook{ID: "pb1"}, &cre.Executor{ID: "exec1", Endpoint: ts.URL})
	if err != nil {
		t.Fatalf("dispatch error: %v", err)
	}
	if !called {
		t.Fatalf("expected executor to be called")
	}
}

func TestHTTPRunner_SkipWithoutExecutor(t *testing.T) {
	runner := NewHTTPRunner(nil, nil)
	if err := runner.Dispatch(context.Background(), cre.Run{}, cre.Playbook{}, nil); err != nil {
		t.Fatalf("expected nil error when executor missing")
	}
}

func newExecutorServer(t *testing.T, handler http.Handler) *httptest.Server {
	t.Helper()
	l, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Skipf("tcp4 listener unavailable: %v", err)
	}
	server := &httptest.Server{
		Listener: l,
		Config:   &http.Server{Handler: handler},
	}
	server.Start()
	return server
}
