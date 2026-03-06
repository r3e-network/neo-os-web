package httputil

import (
	"crypto/tls"
	"net/http"
	"testing"
	"time"
)

func TestNewHTTPClientWithTLS12(t *testing.T) {
	client := NewHTTPClientWithTLS12(7 * time.Second)
	if client == nil {
		t.Fatal("expected client, got nil")
	}
	if client.Timeout != 7*time.Second {
		t.Fatalf("Timeout = %v, want %v", client.Timeout, 7*time.Second)
	}

	tr, ok := client.Transport.(*http.Transport)
	if !ok {
		t.Fatalf("Transport type = %T, want *http.Transport", client.Transport)
	}
	if tr.TLSClientConfig == nil || tr.TLSClientConfig.MinVersion < tls.VersionTLS12 {
		t.Fatal("expected TLS 1.2+ transport")
	}
}

func TestCopyHTTPClientWithTimeout_NilBase(t *testing.T) {
	client := CopyHTTPClientWithTimeout(nil, 5*time.Second, false)
	if client == nil {
		t.Fatal("expected client, got nil")
	}
	if client.Timeout != 5*time.Second {
		t.Fatalf("Timeout = %v, want %v", client.Timeout, 5*time.Second)
	}

	tr, ok := client.Transport.(*http.Transport)
	if !ok {
		t.Fatalf("Transport type = %T, want *http.Transport", client.Transport)
	}
	if tr.TLSClientConfig == nil || tr.TLSClientConfig.MinVersion < tls.VersionTLS12 {
		t.Fatal("expected TLS 1.2+ transport for nil base")
	}
}

func TestCopyHTTPClientWithTimeout_PreservesTimeoutUnlessForced(t *testing.T) {
	base := &http.Client{Timeout: 11 * time.Second}

	clone := CopyHTTPClientWithTimeout(base, 3*time.Second, false)
	if clone.Timeout != 11*time.Second {
		t.Fatalf("Timeout = %v, want %v", clone.Timeout, 11*time.Second)
	}
	if base.Timeout != 11*time.Second {
		t.Fatalf("base Timeout mutated: %v", base.Timeout)
	}

	forced := CopyHTTPClientWithTimeout(base, 3*time.Second, true)
	if forced.Timeout != 3*time.Second {
		t.Fatalf("forced Timeout = %v, want %v", forced.Timeout, 3*time.Second)
	}
	if base.Timeout != 11*time.Second {
		t.Fatalf("base Timeout mutated after forced copy: %v", base.Timeout)
	}
}

func TestCopyHTTPClientWithTimeout_SetsTimeoutWhenZero(t *testing.T) {
	base := &http.Client{Timeout: 0}
	clone := CopyHTTPClientWithTimeout(base, 9*time.Second, false)
	if clone.Timeout != 9*time.Second {
		t.Fatalf("Timeout = %v, want %v", clone.Timeout, 9*time.Second)
	}
	if base.Timeout != 0 {
		t.Fatalf("base Timeout mutated: %v", base.Timeout)
	}
}

func TestCopyHTTPClientWithTimeoutNoRedirect_NilBase(t *testing.T) {
	client := CopyHTTPClientWithTimeoutNoRedirect(nil, 13*time.Second, false)
	if client == nil {
		t.Fatal("expected client, got nil")
	}
	if client.Timeout != 13*time.Second {
		t.Fatalf("Timeout = %v, want %v", client.Timeout, 13*time.Second)
	}
	if client.CheckRedirect == nil {
		t.Fatal("CheckRedirect should be set")
	}
	if err := client.CheckRedirect(&http.Request{}, nil); err != http.ErrUseLastResponse {
		t.Fatalf("CheckRedirect() = %v, want %v", err, http.ErrUseLastResponse)
	}
}

func TestCopyHTTPClientWithTimeoutNoRedirect_DoesNotMutateBase(t *testing.T) {
	base := &http.Client{Timeout: 0}
	client := CopyHTTPClientWithTimeoutNoRedirect(base, 17*time.Second, false)
	if client == base {
		t.Fatal("expected copied client, got original pointer")
	}
	if base.CheckRedirect != nil {
		t.Fatal("base CheckRedirect should remain nil")
	}
	if client.CheckRedirect == nil {
		t.Fatal("copied client CheckRedirect should be set")
	}
	if client.Timeout != 17*time.Second {
		t.Fatalf("Timeout = %v, want %v", client.Timeout, 17*time.Second)
	}
}
