package database

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
)

// APIError represents a structured Supabase REST/RPC error response.
type APIError struct {
	StatusCode int
	Code       string
	Message    string
	Details    string
	Hint       string
	Raw        string
}

var apiErrorCodePattern = regexp.MustCompile(`(?i)"code"\s*:\s*"([a-z0-9]+)"`)
var uniqueViolationPattern = regexp.MustCompile(`(?i)(duplicate key value|violates unique constraint|unique constraint .*violat)`)

// NewAPIError parses raw Supabase error content into a typed APIError.
func NewAPIError(statusCode int, raw string) *APIError {
	err := &APIError{
		StatusCode: statusCode,
		Raw:        strings.TrimSpace(raw),
	}

	if err.Raw == "" {
		return err
	}

	var payload struct {
		Code    string `json:"code"`
		Message string `json:"message"`
		Details string `json:"details"`
		Hint    string `json:"hint"`
	}
	if json.Unmarshal([]byte(err.Raw), &payload) == nil {
		err.Code = strings.TrimSpace(payload.Code)
		err.Message = strings.TrimSpace(payload.Message)
		err.Details = strings.TrimSpace(payload.Details)
		err.Hint = strings.TrimSpace(payload.Hint)
	}

	return err
}

func (e *APIError) Error() string {
	if e == nil {
		return "supabase API error"
	}

	msg := strings.TrimSpace(e.Raw)
	if msg == "" {
		msg = strings.TrimSpace(e.Message)
	}

	if msg == "" {
		return fmt.Sprintf("supabase API error %d", e.StatusCode)
	}
	return fmt.Sprintf("supabase API error %d: %s", e.StatusCode, msg)
}

// Unwrap exposes a shared HTTP status error so callers can classify status
// codes across package boundaries with errors.As/Is helpers.
func (e *APIError) Unwrap() error {
	if e == nil {
		return nil
	}

	body := strings.TrimSpace(e.Raw)
	if body == "" {
		body = strings.TrimSpace(e.Message)
	}

	return &httputil.HTTPStatusError{
		StatusCode: e.StatusCode,
		Body:       body,
	}
}

// AsAPIError extracts a typed APIError from a wrapped error chain.
func AsAPIError(err error) (*APIError, bool) {
	if err == nil {
		return nil, false
	}
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		return nil, false
	}
	return apiErr, true
}

// IsAPIErrorCode reports whether an error is (or contains) a Supabase API
// error with the given Postgres error code.
func IsAPIErrorCode(err error, code string) bool {
	if err == nil {
		return false
	}
	code = strings.TrimSpace(code)
	if code == "" {
		return false
	}

	if apiErr, ok := AsAPIError(err); ok {
		return strings.EqualFold(strings.TrimSpace(apiErr.Code), code)
	}

	// Backward compatibility for legacy plain-string errors.
	msg := strings.TrimSpace(err.Error())
	if !looksLikeSupabaseLegacyError(msg) {
		return false
	}

	matches := apiErrorCodePattern.FindStringSubmatch(msg)
	if len(matches) == 2 {
		return strings.EqualFold(strings.TrimSpace(matches[1]), code)
	}
	return false
}

func looksLikeSupabaseLegacyError(msg string) bool {
	trimmed := strings.TrimSpace(msg)
	if trimmed == "" {
		return false
	}
	lower := strings.ToLower(trimmed)
	if strings.Contains(lower, "supabase api error") {
		return true
	}
	if strings.Contains(lower, "database error") {
		start := strings.Index(trimmed, "{")
		end := strings.LastIndex(trimmed, "}")
		return start >= 0 && end > start
	}
	return strings.HasPrefix(trimmed, "{") && strings.HasSuffix(trimmed, "}")
}

// IsUniqueViolationError reports duplicate/unique constraint violations.
func IsUniqueViolationError(err error) bool {
	if err == nil {
		return false
	}
	if IsAPIErrorCode(err, "23505") {
		return true
	}

	if apiErr, ok := AsAPIError(err); ok {
		msg := strings.ToLower(strings.TrimSpace(apiErr.Message))
		if uniqueViolationPattern.MatchString(msg) {
			return true
		}
	}

	// Backward compatibility for legacy plain-string errors.
	msg := strings.ToLower(strings.TrimSpace(err.Error()))
	return uniqueViolationPattern.MatchString(msg)
}
