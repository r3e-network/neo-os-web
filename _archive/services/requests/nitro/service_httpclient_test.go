package neorequests

import (
	"crypto/tls"
	"net/http"
	"testing"
	"time"
)

func TestResolveHTTPClientWithoutNitroUsesTLS12TransportAndDisablesRedirects(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("resolveHTTPClient should not panic without Nitro: %v", r)
		}
	}()

	client := resolveHTTPClient(&Config{})
	if client == nil {
		t.Fatal("resolveHTTPClient() returned nil")
	}
	if client.Timeout != 30*time.Second {
		t.Fatalf("Timeout = %v, want %v", client.Timeout, 30*time.Second)
	}
	if client.CheckRedirect == nil {
		t.Fatal("CheckRedirect should be set")
	}
	if err := client.CheckRedirect(&http.Request{}, nil); err != http.ErrUseLastResponse {
		t.Fatalf("CheckRedirect() = %v, want %v", err, http.ErrUseLastResponse)
	}

	tr, ok := client.Transport.(*http.Transport)
	if !ok {
		t.Fatalf("Transport type = %T, want *http.Transport", client.Transport)
	}
	if tr.TLSClientConfig == nil || tr.TLSClientConfig.MinVersion < tls.VersionTLS12 {
		t.Fatal("resolveHTTPClient() did not enforce TLS 1.2+")
	}
}

func TestResolveHTTPClientWithExplicitClientCopiesAndDisablesRedirects(t *testing.T) {
	base := &http.Client{}
	client := resolveHTTPClient(&Config{HTTPClient: base})
	if client == nil {
		t.Fatal("resolveHTTPClient() returned nil")
	}
	if client == base {
		t.Fatal("resolveHTTPClient() should copy caller-provided client")
	}
	if base.CheckRedirect != nil {
		t.Fatal("caller-provided client should not be mutated")
	}
	if client.Timeout != 30*time.Second {
		t.Fatalf("Timeout = %v, want %v", client.Timeout, 30*time.Second)
	}
	if client.CheckRedirect == nil {
		t.Fatal("CheckRedirect should be set")
	}
	if err := client.CheckRedirect(&http.Request{}, nil); err != http.ErrUseLastResponse {
		t.Fatalf("CheckRedirect() = %v, want %v", err, http.ErrUseLastResponse)
	}
}
