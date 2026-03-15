package database

import (
	"errors"
	"fmt"
	"testing"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
)

func TestAsAPIError(t *testing.T) {
	t.Run("unwraps wrapped APIError", func(t *testing.T) {
		base := &APIError{StatusCode: 400, Code: "42703", Message: "column does not exist", Raw: `{"code":"42703","message":"column does not exist"}`}
		err := fmt.Errorf("outer: %w", base)

		parsed, ok := AsAPIError(err)
		if !ok {
			t.Fatal("AsAPIError() = ok false, want true")
		}
		if parsed.Code != "42703" {
			t.Fatalf("code = %q, want %q", parsed.Code, "42703")
		}
	})

	t.Run("non API error", func(t *testing.T) {
		if _, ok := AsAPIError(errors.New("boom")); ok {
			t.Fatal("AsAPIError() = ok true, want false")
		}
	})

	t.Run("unwraps shared HTTP status error", func(t *testing.T) {
		base := &APIError{
			StatusCode: 409,
			Raw:        `{"code":"23505","message":"duplicate key value violates unique constraint"}`,
		}
		err := fmt.Errorf("outer: %w", base)

		var httpErr *httputil.HTTPStatusError
		if !errors.As(err, &httpErr) {
			t.Fatalf("expected *httputil.HTTPStatusError, got %T", err)
		}
		if httpErr.StatusCode != 409 {
			t.Fatalf("status code = %d, want %d", httpErr.StatusCode, 409)
		}
		if !httputil.IsHTTPStatusError(err, 409) {
			t.Fatal("IsHTTPStatusError() should match 409")
		}
	})
}

func TestIsAPIErrorCode(t *testing.T) {
	err := fmt.Errorf("wrap: %w", &APIError{StatusCode: 400, Code: "42P10", Message: "constraint mismatch"})
	if !IsAPIErrorCode(err, "42p10") {
		t.Fatal("IsAPIErrorCode() = false, want true")
	}
	if IsAPIErrorCode(err, "42703") {
		t.Fatal("IsAPIErrorCode() = true for wrong code")
	}

	err = errors.New(`supabase API error 400: { "code" : "42703", "message":"column missing" }`)
	if !IsAPIErrorCode(err, "42703") {
		t.Fatal("IsAPIErrorCode() should detect code from loosely formatted JSON text")
	}

	err = errors.New(`request failed: 409 Conflict - {"code":"42703","message":"from non-supabase source"}`)
	if IsAPIErrorCode(err, "42703") {
		t.Fatal("IsAPIErrorCode() = true for non-supabase legacy error text")
	}

	err = errors.New(`{"code":"42703","message":"column missing"}`)
	if !IsAPIErrorCode(err, "42703") {
		t.Fatal("IsAPIErrorCode() should detect code from raw JSON payload")
	}

	err = errors.New(`database error: {"code":"23505","message":"constraint violation"}`)
	if !IsAPIErrorCode(err, "23505") {
		t.Fatal("IsAPIErrorCode() should detect code from wrapped database error payload")
	}
}

func TestIsUniqueViolationError(t *testing.T) {
	t.Run("postgres unique code", func(t *testing.T) {
		err := &APIError{StatusCode: 409, Code: "23505", Message: "duplicate key value violates unique constraint"}
		if !IsUniqueViolationError(err) {
			t.Fatal("IsUniqueViolationError() = false, want true")
		}
	})

	t.Run("legacy string fallback", func(t *testing.T) {
		err := errors.New("supabase API error 409: duplicate key value violates unique constraint")
		if !IsUniqueViolationError(err) {
			t.Fatal("IsUniqueViolationError() = false, want true")
		}
	})

	t.Run("typed unrelated unique text", func(t *testing.T) {
		err := &APIError{StatusCode: 409, Code: "", Message: "unique endpoint timeout"}
		if IsUniqueViolationError(err) {
			t.Fatal("IsUniqueViolationError() = true, want false")
		}
	})

	t.Run("typed unrelated unique constraint text", func(t *testing.T) {
		err := &APIError{StatusCode: 409, Code: "", Message: "unique constraint parser initialization failed"}
		if IsUniqueViolationError(err) {
			t.Fatal("IsUniqueViolationError() = true, want false")
		}
	})

	t.Run("unrelated unique text", func(t *testing.T) {
		err := errors.New("unique endpoint timeout")
		if IsUniqueViolationError(err) {
			t.Fatal("IsUniqueViolationError() = true, want false")
		}
	})

	t.Run("legacy unrelated unique constraint text", func(t *testing.T) {
		err := errors.New("unique constraint parser initialization failed")
		if IsUniqueViolationError(err) {
			t.Fatal("IsUniqueViolationError() = true, want false")
		}
	})

	t.Run("legacy duplicate 409 without unique violation markers", func(t *testing.T) {
		err := errors.New("supabase API error 409: duplicate request already in progress")
		if IsUniqueViolationError(err) {
			t.Fatal("IsUniqueViolationError() = true, want false")
		}
	})
}
