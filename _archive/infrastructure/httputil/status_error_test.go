package httputil

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestHTTPStatusErrorIncludesBodyWhenPresent(t *testing.T) {
	err := &HTTPStatusError{
		StatusCode: http.StatusBadGateway,
		Body:       "upstream unavailable",
	}

	if got, want := err.Error(), "http 502: upstream unavailable"; got != want {
		t.Fatalf("Error() = %q, want %q", got, want)
	}
}

func TestIsHTTPStatusError(t *testing.T) {
	err := errors.New("boom")
	if IsHTTPStatusError(err, http.StatusBadGateway) {
		t.Fatal("IsHTTPStatusError() should be false for non-http status errors")
	}

	wrappedTyped := fmt.Errorf("wrapped: %w", &HTTPStatusError{StatusCode: http.StatusServiceUnavailable})
	if !IsHTTPStatusError(wrappedTyped, http.StatusServiceUnavailable) {
		t.Fatal("IsHTTPStatusError() should match wrapped typed errors")
	}

	wrappedString := errors.New("wrapped: " + (&HTTPStatusError{
		StatusCode: http.StatusServiceUnavailable,
	}).Error())
	if IsHTTPStatusError(wrappedString, http.StatusServiceUnavailable) {
		t.Fatal("IsHTTPStatusError() should not match plain formatted strings")
	}

	httpErr := &HTTPStatusError{StatusCode: http.StatusServiceUnavailable}
	if !IsHTTPStatusError(httpErr, http.StatusServiceUnavailable) {
		t.Fatal("IsHTTPStatusError() should match direct typed errors")
	}
	if IsHTTPStatusError(httpErr, http.StatusBadGateway) {
		t.Fatal("IsHTTPStatusError() should not match wrong status")
	}
}

func TestBuildHTTPStatusError(t *testing.T) {
	resp := &http.Response{
		StatusCode: http.StatusBadGateway,
		Status:     "502 Bad Gateway",
		Body:       io.NopCloser(strings.NewReader("  upstream unavailable  ")),
	}

	httpErr, err := BuildHTTPStatusError(resp, http.MethodPost, "https://rpc.example", 32<<10)
	if err != nil {
		t.Fatalf("BuildHTTPStatusError() error = %v", err)
	}
	if httpErr.StatusCode != http.StatusBadGateway {
		t.Fatalf("status code = %d, want %d", httpErr.StatusCode, http.StatusBadGateway)
	}
	if httpErr.Status != "502 Bad Gateway" {
		t.Fatalf("status = %q, want %q", httpErr.Status, "502 Bad Gateway")
	}
	if httpErr.Method != http.MethodPost {
		t.Fatalf("method = %q, want %q", httpErr.Method, http.MethodPost)
	}
	if httpErr.URL != "https://rpc.example" {
		t.Fatalf("url = %q, want %q", httpErr.URL, "https://rpc.example")
	}
	if httpErr.Body != "upstream unavailable" {
		t.Fatalf("body = %q, want %q", httpErr.Body, "upstream unavailable")
	}
}

func TestWrapReadBodyError(t *testing.T) {
	t.Run("returns base error when read error is nil", func(t *testing.T) {
		base := &HTTPStatusError{StatusCode: http.StatusBadGateway}
		err := WrapReadBodyError(base, nil)
		if !errors.Is(err, base) {
			t.Fatal("expected wrapped error to include base error")
		}
	})

	t.Run("returns read error when base error is nil", func(t *testing.T) {
		readErr := errors.New("boom")
		err := WrapReadBodyError(nil, readErr)
		if !errors.Is(err, readErr) {
			t.Fatal("expected read error to be returned")
		}
	})

	t.Run("wraps base and read error", func(t *testing.T) {
		base := &HTTPStatusError{StatusCode: http.StatusBadGateway}
		readErr := errors.New("boom")
		err := WrapReadBodyError(base, readErr)
		if err == nil {
			t.Fatal("expected error")
		}
		if !errors.Is(err, base) {
			t.Fatal("expected wrapped error to include base error")
		}
		if !strings.Contains(err.Error(), "failed to read body") {
			t.Fatalf("unexpected error: %v", err)
		}
		if !strings.Contains(err.Error(), "boom") {
			t.Fatalf("unexpected error: %v", err)
		}
	})
}

func TestBuildHTTPStatusErrorFromRequest(t *testing.T) {
	t.Run("uses request method and url", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, "https://rpc.example/test", http.NoBody)
		if err != nil {
			t.Fatalf("NewRequest() error = %v", err)
		}

		resp := &http.Response{
			StatusCode: http.StatusBadGateway,
			Status:     "502 Bad Gateway",
			Body:       io.NopCloser(strings.NewReader("upstream unavailable")),
		}

		httpErr, buildErr := BuildHTTPStatusErrorFromRequest(resp, req, 32<<10)
		if buildErr != nil {
			t.Fatalf("BuildHTTPStatusErrorFromRequest() error = %v", buildErr)
		}
		if httpErr.Method != http.MethodPost {
			t.Fatalf("method = %q, want %q", httpErr.Method, http.MethodPost)
		}
		if httpErr.URL != "https://rpc.example/test" {
			t.Fatalf("url = %q, want %q", httpErr.URL, "https://rpc.example/test")
		}
	})

	t.Run("handles nil request", func(t *testing.T) {
		resp := &http.Response{
			StatusCode: http.StatusBadGateway,
			Status:     "502 Bad Gateway",
			Body:       io.NopCloser(strings.NewReader("upstream unavailable")),
		}

		httpErr, buildErr := BuildHTTPStatusErrorFromRequest(resp, nil, 32<<10)
		if buildErr != nil {
			t.Fatalf("BuildHTTPStatusErrorFromRequest() error = %v", buildErr)
		}
		if httpErr.Method != "" {
			t.Fatalf("method = %q, want empty", httpErr.Method)
		}
		if httpErr.URL != "" {
			t.Fatalf("url = %q, want empty", httpErr.URL)
		}
	})

	t.Run("handles request with nil url", func(t *testing.T) {
		req := &http.Request{Method: http.MethodGet}
		resp := &http.Response{
			StatusCode: http.StatusBadGateway,
			Status:     "502 Bad Gateway",
			Body:       io.NopCloser(strings.NewReader("upstream unavailable")),
		}

		httpErr, buildErr := BuildHTTPStatusErrorFromRequest(resp, req, 32<<10)
		if buildErr != nil {
			t.Fatalf("BuildHTTPStatusErrorFromRequest() error = %v", buildErr)
		}
		if httpErr.Method != http.MethodGet {
			t.Fatalf("method = %q, want %q", httpErr.Method, http.MethodGet)
		}
		if httpErr.URL != "" {
			t.Fatalf("url = %q, want empty", httpErr.URL)
		}
	})
}
