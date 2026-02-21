package httputil

import (
	"net/http"
	"testing"
	"time"
)

func TestCopyHTTPClientWithTimeout_NilBase(t *testing.T) {
	client := CopyHTTPClientWithTimeout(nil, 5*time.Second, false)
	if client == nil {
		t.Fatal("expected client, got nil")
	}
	if client.Timeout != 5*time.Second {
		t.Fatalf("Timeout = %v, want %v", client.Timeout, 5*time.Second)
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
