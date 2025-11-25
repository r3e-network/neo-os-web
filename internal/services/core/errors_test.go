package service

import (
	"errors"
	"testing"
)

func TestNotFoundError(t *testing.T) {
	err := NewNotFoundError("account", "abc123")

	// Check message
	expected := `account "abc123" not found`
	if err.Error() != expected {
		t.Errorf("expected %q, got %q", expected, err.Error())
	}

	// Check unwrap
	if !errors.Is(err, ErrNotFound) {
		t.Error("expected error to wrap ErrNotFound")
	}

	// Check IsNotFound helper
	if !IsNotFound(err) {
		t.Error("IsNotFound should return true")
	}
}

func TestNotFoundError_NoID(t *testing.T) {
	err := NewNotFoundError("function", "")

	expected := "function not found"
	if err.Error() != expected {
		t.Errorf("expected %q, got %q", expected, err.Error())
	}
}

func TestValidationError(t *testing.T) {
	err := NewValidationError("name", "must be alphanumeric")

	expected := "name: must be alphanumeric"
	if err.Error() != expected {
		t.Errorf("expected %q, got %q", expected, err.Error())
	}

	if !errors.Is(err, ErrInvalidInput) {
		t.Error("expected error to wrap ErrInvalidInput")
	}

	if !IsValidationError(err) {
		t.Error("IsValidationError should return true")
	}
}

func TestRequiredError(t *testing.T) {
	err := RequiredError("account_id")

	expected := "account_id: is required"
	if err.Error() != expected {
		t.Errorf("expected %q, got %q", expected, err.Error())
	}

	if !IsValidationError(err) {
		t.Error("IsValidationError should return true for RequiredError")
	}
}

func TestAccessDeniedError(t *testing.T) {
	err := NewAccessDeniedError("function", "func123", "acct456")

	if !errors.Is(err, ErrForbidden) {
		t.Error("expected error to wrap ErrForbidden")
	}

	if !IsForbidden(err) {
		t.Error("IsForbidden should return true")
	}

	// Check message contains all parts
	msg := err.Error()
	if msg != `access denied to function "func123" for account acct456` {
		t.Errorf("unexpected message: %s", msg)
	}
}

func TestAccessDeniedError_WithReason(t *testing.T) {
	err := &AccessDeniedError{
		Resource:  "secret",
		ID:        "api_key",
		AccountID: "user123",
		Reason:    "ACL check failed",
	}

	msg := err.Error()
	if msg != `access denied to secret "api_key" for account user123: ACL check failed` {
		t.Errorf("unexpected message: %s", msg)
	}
}

func TestConflictError(t *testing.T) {
	err := NewConflictError("feed", "BTC/USD", "pair already registered")

	if !errors.Is(err, ErrAlreadyExists) {
		t.Error("expected error to wrap ErrAlreadyExists")
	}

	if !IsConflict(err) {
		t.Error("IsConflict should return true")
	}
}

func TestServiceError(t *testing.T) {
	underlying := NewNotFoundError("account", "xyz")
	err := WrapServiceError("functions", "Execute", underlying)

	msg := err.Error()
	expected := `functions.Execute: account "xyz" not found`
	if msg != expected {
		t.Errorf("expected %q, got %q", expected, msg)
	}

	// Should unwrap to underlying
	if !errors.Is(err, ErrNotFound) {
		t.Error("wrapped error should still match ErrNotFound")
	}
}

func TestWrapServiceError_Nil(t *testing.T) {
	err := WrapServiceError("test", "op", nil)
	if err != nil {
		t.Error("WrapServiceError(nil) should return nil")
	}
}

func TestStandardErrors(t *testing.T) {
	tests := []struct {
		err  error
		name string
	}{
		{ErrNotFound, "ErrNotFound"},
		{ErrAlreadyExists, "ErrAlreadyExists"},
		{ErrInvalidInput, "ErrInvalidInput"},
		{ErrUnauthorized, "ErrUnauthorized"},
		{ErrForbidden, "ErrForbidden"},
		{ErrConflict, "ErrConflict"},
		{ErrRateLimited, "ErrRateLimited"},
		{ErrServiceUnavailable, "ErrServiceUnavailable"},
		{ErrTimeout, "ErrTimeout"},
		{ErrInternal, "ErrInternal"},
	}

	for _, tc := range tests {
		if tc.err == nil {
			t.Errorf("%s should not be nil", tc.name)
		}
		if tc.err.Error() == "" {
			t.Errorf("%s should have non-empty message", tc.name)
		}
	}
}
