package neorequests

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
)

func TestWrapUpstreamServiceError(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		service string
		err     error
		want    string
	}{
		{
			name:    "404 endpoint not found",
			service: "neooracle",
			err: &UpstreamHTTPError{
				HTTPStatusError: &httputil.HTTPStatusError{
					StatusCode: http.StatusNotFound,
					Status:     "404 Not Found",
					Body:       "missing route",
				},
			},
			want: "neooracle endpoint not found",
		},
		{
			name:    "4xx rejected",
			service: "neocompute",
			err: &UpstreamHTTPError{
				HTTPStatusError: &httputil.HTTPStatusError{
					StatusCode: http.StatusBadRequest,
					Status:     "400 Bad Request",
					Body:       "invalid payload",
				},
			},
			want: "neocompute request rejected",
		},
		{
			name:    "5xx unavailable",
			service: "neovrf",
			err: &UpstreamHTTPError{
				HTTPStatusError: &httputil.HTTPStatusError{
					StatusCode: http.StatusBadGateway,
					Status:     "502 Bad Gateway",
					Body:       "upstream unavailable",
				},
			},
			want: "neovrf service unavailable",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := wrapUpstreamServiceError(tc.service, tc.err)
			if got == nil {
				t.Fatal("wrapUpstreamServiceError() returned nil error")
			}
			if !strings.Contains(got.Error(), tc.want) {
				t.Fatalf("error = %q, want to contain %q", got.Error(), tc.want)
			}
		})
	}

	t.Run("context deadline treated as unavailable", func(t *testing.T) {
		got := wrapUpstreamServiceError("neovrf", context.DeadlineExceeded)
		if got == nil {
			t.Fatal("wrapUpstreamServiceError() returned nil error")
		}
		if !strings.Contains(got.Error(), "neovrf service unavailable") {
			t.Fatalf("error = %q, want to contain %q", got.Error(), "neovrf service unavailable")
		}
		if !errors.Is(got, context.DeadlineExceeded) {
			t.Fatalf("wrapped error should preserve context deadline, got %v", got)
		}
	})

	t.Run("transport error treated as unavailable", func(t *testing.T) {
		base := &url.Error{Op: http.MethodPost, URL: "https://example.test/query", Err: io.EOF}
		got := wrapUpstreamServiceError("neooracle", base)
		if got == nil {
			t.Fatal("wrapUpstreamServiceError() returned nil error")
		}
		if !strings.Contains(got.Error(), "neooracle service unavailable") {
			t.Fatalf("error = %q, want to contain %q", got.Error(), "neooracle service unavailable")
		}
		if !errors.Is(got, base) {
			t.Fatalf("wrapped error should preserve transport error, got %v", got)
		}
	})

	t.Run("non-upstream error passthrough", func(t *testing.T) {
		base := errors.New("network timeout")
		got := wrapUpstreamServiceError("neovrf", base)
		if !errors.Is(got, base) {
			t.Fatalf("wrapUpstreamServiceError() should preserve original error, got %v", got)
		}
	})
}
