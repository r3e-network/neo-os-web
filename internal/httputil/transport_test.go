package httputil

import (
	"crypto/tls"
	"net/http"
	"testing"
)

func TestDefaultTransportWithMinTLS12(t *testing.T) {
	rt := DefaultTransportWithMinTLS12()

	tr, ok := rt.(*http.Transport)
	if !ok {
		t.Fatalf("expected *http.Transport, got %T", rt)
	}
	if tr.TLSClientConfig == nil {
		t.Fatal("expected TLSClientConfig to be set")
	}
	if tr.TLSClientConfig.MinVersion < tls.VersionTLS12 {
		t.Fatalf("expected MinVersion >= TLS1.2, got %v", tr.TLSClientConfig.MinVersion)
	}
}
