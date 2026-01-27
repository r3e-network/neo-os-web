// Package middleware provides HTTP middleware for the service layer.
package middleware

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/R3E-Network/service_layer/infrastructure/httputil"
)

const defaultRequestTimeout = 30 * time.Second

// TimeoutMiddleware enforces request timeouts to prevent resource exhaustion.
type TimeoutMiddleware struct {
	timeout time.Duration
}

// NewTimeoutMiddleware creates a request timeout middleware.
// When timeout <= 0, a conservative default is applied.
func NewTimeoutMiddleware(timeout time.Duration) *TimeoutMiddleware {
	if timeout <= 0 {
		timeout = defaultRequestTimeout
	}
	return &TimeoutMiddleware{timeout: timeout}
}

// Handler returns the timeout middleware handler.
func (m *TimeoutMiddleware) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if m == nil || m.timeout <= 0 || r == nil {
			next.ServeHTTP(w, r)
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), m.timeout)
		defer cancel()

		// Create a channel to signal completion
		done := make(chan struct{})
		
		// Wrap the response writer to detect if headers have been written
		tw := &timeoutResponseWriter{
			ResponseWriter: w,
			done:           done,
		}

		go func() {
			next.ServeHTTP(tw, r.WithContext(ctx))
			close(done)
		}()

		select {
		case <-done:
			// Request completed normally
		case <-ctx.Done():
			// Timeout occurred
			if ctx.Err() == context.DeadlineExceeded {
				tw.mu.Lock()
				if !tw.wroteHeader {
					tw.mu.Unlock()
					httputil.WriteErrorResponse(
						w,
						r,
						http.StatusGatewayTimeout,
						"REQUEST_TIMEOUT",
						"request timed out",
						map[string]any{"timeout_seconds": m.timeout.Seconds()},
					)
				} else {
					tw.mu.Unlock()
				}
			}
		}
	})
}

// timeoutResponseWriter wraps http.ResponseWriter to track header writes.
type timeoutResponseWriter struct {
	http.ResponseWriter
	mu          sync.Mutex
	wroteHeader bool
	done        chan struct{}
}

func (tw *timeoutResponseWriter) WriteHeader(code int) {
	tw.mu.Lock()
	defer tw.mu.Unlock()
	if !tw.wroteHeader {
		tw.wroteHeader = true
		tw.ResponseWriter.WriteHeader(code)
	}
}

func (tw *timeoutResponseWriter) Write(b []byte) (int, error) {
	tw.mu.Lock()
	if !tw.wroteHeader {
		tw.wroteHeader = true
	}
	tw.mu.Unlock()
	return tw.ResponseWriter.Write(b)
}
