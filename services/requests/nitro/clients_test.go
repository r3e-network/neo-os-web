package neorequests

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
)

func TestPostJSONErrorIncludesStatusAndBody(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = io.WriteString(w, "upstream unavailable")
	}))
	defer server.Close()

	svc := &Service{httpClient: server.Client()}
	_, err := svc.postJSON(context.Background(), server.URL, "", map[string]any{"ok": true})
	if err == nil {
		t.Fatal("expected postJSON error")
	}
	if !strings.Contains(err.Error(), "502 Bad Gateway") {
		t.Fatalf("error should include HTTP status, got: %v", err)
	}
	if !strings.Contains(err.Error(), "upstream unavailable") {
		t.Fatalf("error should include response body, got: %v", err)
	}
}

func TestPostJSONReturnsTypedHTTPError(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = io.WriteString(w, "missing endpoint")
	}))
	defer server.Close()

	svc := &Service{httpClient: server.Client()}
	_, err := svc.postJSON(context.Background(), server.URL, "", map[string]any{"ok": true})
	if err == nil {
		t.Fatal("expected postJSON error")
	}

	var httpErr *UpstreamHTTPError
	if !errors.As(err, &httpErr) {
		t.Fatalf("expected *UpstreamHTTPError, got %T", err)
	}
	if httpErr.StatusCode != http.StatusNotFound {
		t.Fatalf("status code = %d, want %d", httpErr.StatusCode, http.StatusNotFound)
	}
	if httpErr.Body != "missing endpoint" {
		t.Fatalf("body = %q, want %q", httpErr.Body, "missing endpoint")
	}
	if !IsUpstreamStatusError(err, http.StatusNotFound) {
		t.Fatal("IsUpstreamStatusError() should detect 404 status")
	}
	if IsUpstreamStatusError(err, http.StatusInternalServerError) {
		t.Fatal("IsUpstreamStatusError() should not match wrong status")
	}

	var sharedErr *httputil.HTTPStatusError
	if !errors.As(err, &sharedErr) {
		t.Fatalf("expected shared *httputil.HTTPStatusError, got %T", err)
	}
	if !httputil.IsHTTPStatusError(err, http.StatusNotFound) {
		t.Fatal("shared IsHTTPStatusError() should detect 404 status")
	}
}
