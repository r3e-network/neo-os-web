package middleware

import (
	"errors"
	"net/http"
	"testing"
)

func TestServiceError_Error(t *testing.T) {
	tests := []struct {
		name string
		err  *ServiceError
		want string
	}{
		{
			name: "error without underlying error",
			err:  newServiceError(ErrCodeUnauthorized, "test message", http.StatusUnauthorized),
			want: "[AUTH_1001] test message",
		},
		{
			name: "error with underlying error",
			err:  wrapServiceError(ErrCodeInternal, "test message", http.StatusInternalServerError, errors.New("underlying")),
			want: "[SVC_5001] test message: underlying",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.err.Error(); got != tt.want {
				t.Errorf("Error() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestServiceError_Unwrap(t *testing.T) {
	underlying := errors.New("underlying error")
	err := wrapServiceError(ErrCodeInternal, "test", http.StatusInternalServerError, underlying)

	if got := err.Unwrap(); got != underlying {
		t.Errorf("Unwrap() = %v, want %v", got, underlying)
	}
}

func TestServiceError_WithDetails(t *testing.T) {
	err := newServiceError(ErrCodeInvalidFormat, "test", http.StatusBadRequest)
	err.WithDetails("field", "username").WithDetails("reason", "too short")

	if len(err.Details) != 2 {
		t.Errorf("Details length = %d, want 2", len(err.Details))
	}

	if err.Details["field"] != "username" {
		t.Errorf("Details[field] = %v, want username", err.Details["field"])
	}

	if err.Details["reason"] != "too short" {
		t.Errorf("Details[reason] = %v, want too short", err.Details["reason"])
	}
}

func TestErrUnauthorized(t *testing.T) {
	err := errUnauthorized("test message")

	if err.Code != ErrCodeUnauthorized {
		t.Errorf("Code = %v, want %v", err.Code, ErrCodeUnauthorized)
	}

	if err.HTTPStatus != http.StatusUnauthorized {
		t.Errorf("HTTPStatus = %d, want %d", err.HTTPStatus, http.StatusUnauthorized)
	}

	if err.Message != "test message" {
		t.Errorf("Message = %v, want test message", err.Message)
	}
}

func TestErrInvalidToken(t *testing.T) {
	underlying := errors.New("token parse error")
	err := errInvalidToken(underlying)

	if err.Code != ErrCodeInvalidToken {
		t.Errorf("Code = %v, want %v", err.Code, ErrCodeInvalidToken)
	}

	if err.HTTPStatus != http.StatusUnauthorized {
		t.Errorf("HTTPStatus = %d, want %d", err.HTTPStatus, http.StatusUnauthorized)
	}

	if err.Err != underlying {
		t.Errorf("Err = %v, want %v", err.Err, underlying)
	}
}

func TestErrForbidden(t *testing.T) {
	err := errForbidden("access denied")

	if err.Code != ErrCodeForbidden {
		t.Errorf("Code = %v, want %v", err.Code, ErrCodeForbidden)
	}

	if err.HTTPStatus != http.StatusForbidden {
		t.Errorf("HTTPStatus = %d, want %d", err.HTTPStatus, http.StatusForbidden)
	}
}

func TestErrInvalidFormat(t *testing.T) {
	err := errInvalidFormat("email", "RFC 5322")

	if err.Code != ErrCodeInvalidFormat {
		t.Errorf("Code = %v, want %v", err.Code, ErrCodeInvalidFormat)
	}

	if err.HTTPStatus != http.StatusBadRequest {
		t.Errorf("HTTPStatus = %d, want %d", err.HTTPStatus, http.StatusBadRequest)
	}

	if err.Details["field"] != "email" {
		t.Errorf("Details[field] = %v, want email", err.Details["field"])
	}

	if err.Details["expected"] != "RFC 5322" {
		t.Errorf("Details[expected] = %v, want RFC 5322", err.Details["expected"])
	}
}

func TestErrInternal(t *testing.T) {
	underlying := errors.New("database connection failed")
	err := errInternal("internal error", underlying)

	if err.Code != ErrCodeInternal {
		t.Errorf("Code = %v, want %v", err.Code, ErrCodeInternal)
	}

	if err.HTTPStatus != http.StatusInternalServerError {
		t.Errorf("HTTPStatus = %d, want %d", err.HTTPStatus, http.StatusInternalServerError)
	}

	if err.Err != underlying {
		t.Errorf("Err = %v, want %v", err.Err, underlying)
	}
}

func TestErrRateLimitExceeded(t *testing.T) {
	err := errRateLimitExceeded(100, "1m")

	if err.Code != ErrCodeRateLimitExceeded {
		t.Errorf("Code = %v, want %v", err.Code, ErrCodeRateLimitExceeded)
	}

	if err.HTTPStatus != http.StatusTooManyRequests {
		t.Errorf("HTTPStatus = %d, want %d", err.HTTPStatus, http.StatusTooManyRequests)
	}

	if err.Details["limit"] != 100 {
		t.Errorf("Details[limit] = %v, want 100", err.Details["limit"])
	}
}

func TestGetServiceError(t *testing.T) {
	serviceErr := newServiceError(ErrCodeInternal, "test", http.StatusInternalServerError)
	standardErr := errors.New("standard error")

	tests := []struct {
		name string
		err  error
		want *ServiceError
	}{
		{
			name: "service error",
			err:  serviceErr,
			want: serviceErr,
		},
		{
			name: "standard error",
			err:  standardErr,
			want: nil,
		},
		{
			name: "nil error",
			err:  nil,
			want: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := getServiceError(tt.err)
			if got != tt.want {
				t.Errorf("getServiceError() = %v, want %v", got, tt.want)
			}
		})
	}
}
