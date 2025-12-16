package httputil

import (
	"net/http"
	"time"
)

// CopyHTTPClientWithTimeout returns a shallow copy of base with its Timeout set.
//
// It is safe to use with shared clients (e.g., Marble HTTP clients) because it
// never mutates the caller-provided instance.
//
// If base is nil, it returns a new http.Client.
// If base.Timeout is zero, the timeout is always set.
// If force is true, the timeout is set even when base.Timeout is non-zero.
func CopyHTTPClientWithTimeout(base *http.Client, timeout time.Duration, force bool) *http.Client {
	if base == nil {
		return &http.Client{Timeout: timeout}
	}

	copied := *base
	if copied.Timeout == 0 || force {
		copied.Timeout = timeout
	}
	return &copied
}
