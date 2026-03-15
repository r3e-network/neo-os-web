package httputil

import (
	"net/http"
	"time"
)

// NewHTTPClientWithTLS12 returns a new HTTP client with the given timeout and
// the shared TLS 1.2+ outbound transport baseline.
func NewHTTPClientWithTLS12(timeout time.Duration) *http.Client {
	return &http.Client{
		Timeout:   timeout,
		Transport: DefaultTransportWithMinTLS12(),
	}
}

// CopyHTTPClientWithTimeout returns a shallow copy of base with its Timeout set.
//
// It is safe to use with shared clients (e.g., Nitro HTTP clients) because it
// never mutates the caller-provided instance.
//
// If base is nil, it returns a new http.Client.
// If base.Timeout is zero, the timeout is always set.
// If force is true, the timeout is set even when base.Timeout is non-zero.
func CopyHTTPClientWithTimeout(base *http.Client, timeout time.Duration, force bool) *http.Client {
	if base == nil {
		return NewHTTPClientWithTLS12(timeout)
	}

	copied := *base
	if copied.Timeout == 0 || force {
		copied.Timeout = timeout
	}
	return &copied
}

// CopyHTTPClientWithTimeoutNoRedirect returns a copied client with timeout
// policy applied and redirects disabled.
//
// The returned client never mutates the caller-provided instance and always
// surfaces redirect responses to the caller instead of following them.
func CopyHTTPClientWithTimeoutNoRedirect(base *http.Client, timeout time.Duration, force bool) *http.Client {
	client := CopyHTTPClientWithTimeout(base, timeout, force)
	client.CheckRedirect = func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}
	return client
}
