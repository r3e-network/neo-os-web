// Package utils provides common utility functions shared across all service layer services
package utils

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"
	"time"
)

// ============================================================================
// String Utilities
// ============================================================================

// TrimEmpty removes all whitespace-only strings from a slice
func TrimEmpty(strs []string) []string {
	var result []string
	for _, s := range strs {
		s = strings.TrimSpace(s)
		if s != "" {
			result = append(result, s)
		}
	}
	return result
}

// SplitTrim splits a string by delimiter and trims each part
func SplitTrim(s, delimiter string) []string {
	parts := strings.Split(s, delimiter)
	for i, p := range parts {
		parts[i] = strings.TrimSpace(p)
	}
	return parts
}

// IsEmpty checks if a string is empty or whitespace-only
func IsEmpty(s string) bool {
	return strings.TrimSpace(s) == ""
}

// Coalesce returns the first non-empty string
func Coalesce(strs ...string) string {
	for _, s := range strs {
		if !IsEmpty(s) {
			return s
		}
	}
	return ""
}

// Truncate truncates a string to max length, adding "..." if needed
func Truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

// ToSlice converts a single string to a slice
func ToSlice(s string) []string {
	if s == "" {
		return []string{}
	}
	return []string{s}
}

// ============================================================================
// Environment Utilities
// ============================================================================

// GetEnv retrieves an environment variable with optional default
func GetEnv(key, defaultValue string) string {
	if val := GetEnvOptional(key); val != "" {
		return val
	}
	return defaultValue
}

// GetEnvOptional retrieves an environment variable without default
func GetEnvOptional(key string) string {
	return strings.TrimSpace(os.Getenv(key))
}

// GetEnvBool retrieves a boolean environment variable
func GetEnvBool(key string, defaultValue bool) bool {
	val := GetEnvOptional(key)
	if val == "" {
		return defaultValue
	}
	return strings.ToLower(val) == "true" || val == "1"
}

// GetEnvInt retrieves an integer environment variable
func GetEnvInt(key string, defaultValue int) int {
	val := GetEnvOptional(key)
	if val == "" {
		return defaultValue
	}
	var result int
	fmt.Sscanf(val, "%d", &result)
	return result
}

// ============================================================================
// JSON Utilities
// ============================================================================

// JSONMarshal converts an interface to JSON string with error handling
func JSONMarshal(v interface{}) string {
	data, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(data)
}

// JSONMarshalIndent converts an interface to indented JSON string
func JSONMarshalIndent(v interface{}) string {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return "{}"
	}
	return string(data)
}

// JSONParse parses JSON string into an interface
func JSONParse(jsonStr string) (interface{}, error) {
	var result interface{}
	err := json.Unmarshal([]byte(jsonStr), &result)
	return result, err
}

// MustJSONParse parses JSON string or panics
func MustJSONParse(jsonStr string) interface{} {
	result, err := JSONParse(jsonStr)
	if err != nil {
		panic(err)
	}
	return result
}

// ============================================================================
// Time Utilities
// ============================================================================

// FormatDuration formats a duration in a human-readable way
func FormatDuration(d time.Duration) string {
	if d < time.Second {
		return fmt.Sprintf("%dms", d.Milliseconds())
	}
	if d < time.Minute {
		return fmt.Sprintf("%.2fs", d.Seconds())
	}
	if d < time.Hour {
		return fmt.Sprintf("%.2fm", d.Minutes())
	}
	if d < 24*time.Hour {
		return fmt.Sprintf("%.2fh", d.Hours())
	}
	return fmt.Sprintf("%.2fd", d.Hours()/24)
}

// Now returns the current time as a string
func Now() string {
	return time.Now().Format(time.RFC3339)
}

// NowFormatted returns current time in specified format
func NowFormatted(format string) string {
	return time.Now().Format(format)
}

// ParseDuration parses a duration string (e.g., "1h", "30m", "500ms")
func ParseDuration(s string) (time.Duration, error) {
	return time.ParseDuration(s)
}

// MustParseDuration parses a duration string or panics
func MustParseDuration(s string) time.Duration {
	d, err := ParseDuration(s)
	if err != nil {
		panic(err)
	}
	return d
}

// ============================================================================
// Validation Utilities
// ============================================================================

// ValidateRequired checks if required fields are non-empty
func ValidateRequired(fields map[string]string) error {
	var missing []string
	for field, value := range fields {
		if IsEmpty(value) {
			missing = append(missing, field)
		}
	}
	if len(missing) > 0 {
		return fmt.Errorf("required fields missing: %s", strings.Join(missing, ", "))
	}
	return nil
}

// ValidateOneOf checks that at least one field is non-empty
func ValidateOneOf(fields map[string]string) error {
	for _, value := range fields {
		if !IsEmpty(value) {
			return nil
		}
	}
	return fmt.Errorf("at least one of these fields must be set: %s", strings.Join(getMapKeys(fields), ", "))
}

// getMapKeys returns the keys of a map as a string slice
func getMapKeys(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// ============================================================================
// Conversion Utilities
// ============================================================================

// ToString converts various types to string
func ToString(v interface{}) string {
	switch val := v.(type) {
	case string:
		return val
	case int, int8, int16, int32:
		return fmt.Sprintf("%d", val)
	case int64:
		return fmt.Sprintf("%d", val)
	case uint, uint8, uint16, uint32:
		return fmt.Sprintf("%d", val)
	case uint64:
		return fmt.Sprintf("%d", val)
	case float32, float64:
		return fmt.Sprintf("%.6f", val)
	case bool:
		return fmt.Sprintf("%t", val)
	case time.Time:
		return val.Format(time.RFC3339)
	case time.Duration:
		return val.String()
	default:
		if v != nil {
			return fmt.Sprintf("%v", v)
		}
		return ""
	}
}

// ToInt converts various types to int
func ToInt(v interface{}, defaultValue int) int {
	switch val := v.(type) {
	case int:
		return val
	case int64:
		return int(val)
	case float64:
		return int(val)
	case string:
		var result int
		n, err := fmt.Sscanf(val, "%d", &result)
		if n != 1 || err != nil {
			return defaultValue
		}
		return result
	default:
		return defaultValue
	}
}

// ToBool converts various types to bool
func ToBool(v interface{}, defaultValue bool) bool {
	switch val := v.(type) {
	case bool:
		return val
	case string:
		lower := strings.ToLower(val)
		if lower == "true" || lower == "1" || lower == "yes" {
			return true
		}
		if lower == "false" || lower == "0" || lower == "no" {
			return false
		}
		return defaultValue
	default:
		return defaultValue
	}
}

// ============================================================================
// Slice Utilities
// ============================================================================

// Contains checks if a slice contains a string
func Contains(slice []string, target string) bool {
	for _, item := range slice {
		if item == target {
			return true
		}
	}
	return false
}

// ContainsAny checks if a slice contains any of the targets
func ContainsAny(slice []string, targets []string) bool {
	for _, target := range targets {
		if Contains(slice, target) {
			return true
		}
	}
	return false
}

// Unique removes duplicate strings from a slice while preserving order
func Unique(slice []string) []string {
	seen := make(map[string]bool)
	result := []string{}
	for _, item := range slice {
		if !seen[item] {
			seen[item] = true
			result = append(result, item)
		}
	}
	return result
}

// Filter filters a slice based on a predicate
func Filter(slice []string, predicate func(string) bool) []string {
	result := []string{}
	for _, item := range slice {
		if predicate(item) {
			result = append(result, item)
		}
	}
	return result
}

// Map applies a function to all elements of a slice
func Map(slice []string, fn func(string) string) []string {
	result := make([]string, len(slice))
	for i, item := range slice {
		result[i] = fn(item)
	}
	return result
}

// ============================================================================
// Error Utilities
// ============================================================================

// WrapError wraps an error with additional context
type WrapError struct {
	Message string
	Err     error
}

func (e *WrapError) Error() string {
	return fmt.Sprintf("%s: %v", e.Message, e.Err)
}

func (e *WrapError) Unwrap() error {
	return e.Err
}

// NewWrapError creates a new wrapped error
func NewWrapError(message string, err error) error {
	return &WrapError{
		Message: message,
		Err:     err,
	}
}

// Wrapf wraps an error with formatted message
func Wrapf(err error, format string, args ...interface{}) error {
	msg := fmt.Sprintf(format, args...)
	return &WrapError{Message: msg, Err: err}
}

// Must panics if error is not nil, otherwise returns value
func Must[T any](v T, err error) T {
	if err != nil {
		panic(err)
	}
	return v
}

// ============================================================================
// Pointer Utilities
// ============================================================================

// Ptr returns a pointer to the given value
func Ptr[T any](v T) *T {
	return &v
}

// PtrZero returns a nil pointer if value is zero, otherwise pointer to value
func PtrZero[T comparable](v T) *T {
	var zero T
	if v == zero {
		return nil
	}
	return &v
}

// Deref returns the value pointed to, or zero value if nil
func Deref[T any](p *T) T {
	if p == nil {
		var zero T
		return zero
	}
	return *p
}

// DerefDefault returns the value pointed to, or default if nil
func DerefDefault[T any](p *T, defaultVal T) T {
	if p == nil {
		return defaultVal
	}
	return *p
}

// ============================================================================
// Retry Utilities
// ============================================================================

// RetryOpts specifies options for Retry
type RetryOpts struct {
	MaxAttempts int
	InitialDelay time.Duration
	MaxDelay     time.Duration
	BackoffFactor float64
}

// DefaultRetryOpts returns default retry options
func DefaultRetryOpts() RetryOpts {
	return RetryOpts{
		MaxAttempts:  3,
		InitialDelay: 100 * time.Millisecond,
		MaxDelay:     5 * time.Second,
		BackoffFactor: 2.0,
	}
}

// Retry executes a function until it succeeds or max attempts reached
func Retry(fn func() error, opts ...RetryOpts) error {
	o := DefaultRetryOpts()
	if len(opts) > 0 && opts[0].MaxAttempts > 0 {
		o = opts[0]
	}

	var lastErr error
	delay := o.InitialDelay

	for attempt := 0; attempt < o.MaxAttempts; attempt++ {
		err := fn()
		if err == nil {
			return nil
		}

		lastErr = err

		// Don't delay after last attempt
		if attempt < o.MaxAttempts-1 {
			time.Sleep(delay)
			// Exponential backoff
			delay = time.Duration(float64(delay) * o.BackoffFactor)
			if delay > o.MaxDelay {
				delay = o.MaxDelay
			}
		}
	}

	return Wrapf(lastErr, "failed after %d attempts", o.MaxAttempts)
}

// MustRetry executes a function until it succeeds or panics
func MustRetry(fn func() error, opts ...RetryOpts) {
	if err := Retry(fn, opts...); err != nil {
		panic(err)
	}
}

// ============================================================================
// HTTP Utilities
// ============================================================================

// BuildURL constructs a URL from base and path components
func BuildURL(base string, path string, params map[string]string) string {
	u := base
	if path != "" && path[0] != '/' {
		u = strings.TrimSuffix(base, "/") + "/" + strings.TrimPrefix(path, "/")
	} else if path == "" {
		u = strings.TrimSuffix(base, "/")
	}

	if len(params) > 0 {
		u += "?"
		first := true
		for k, v := range params {
			if !first {
				u += "&"
			}
			u += fmt.Sprintf("%s=%s", k, v)
			first = false
		}
	}

	return u
}

// JoinPath joins path components with proper separators
func JoinPath(parts ...string) string {
	path := strings.Join(parts, "/")
	// Replace multiple consecutive slashes with single slash
	re := regexp.MustCompile("/{2,}")
	return strings.Trim(re.ReplaceAllString(path, "/"), "/")
}

// ============================================================================
// Collection Utilities
// ============================================================================

// SliceToMap converts a slice to map using key function
func SliceToMap[T any, K comparable](slice []T, keyFn func(T) K) map[K]T {
	result := make(map[K]T)
	for _, item := range slice {
		result[keyFn(item)] = item
	}
	return result
}

// MapKeys extracts keys from a map as a slice
func MapKeys[K comparable, V any](m map[K]V) []K {
	keys := make([]K, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// MapValues extracts values from a map as a slice
func MapValues[K comparable, V any](m map[K]V) []V {
	values := make([]V, 0, len(m))
	for _, v := range m {
		values = append(values, v)
	}
	return values
}

// MergeMaps merges multiple maps, later maps override earlier ones
func MergeMaps[K comparable, V any](maps ...map[K]V) map[K]V {
	result := make(map[K]V)
	for _, m := range maps {
		for k, v := range m {
			result[k] = v
		}
	}
	return result
}

// ============================================================================
// Goroutine Utilities
// ============================================================================

// SafeGo starts a goroutine that recovers from panics
func SafeGo(fn func(), recoveryFn func(error)) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				err, ok := r.(error)
				if !ok {
					err = fmt.Errorf("panic: %v", r)
				}
				if recoveryFn != nil {
					recoveryFn(err)
				}
			}
		}()
		fn()
	}()
}

// GoSafeGo starts a goroutine with default panic recovery (logs error)
func GoSafeGo(fn func()) {
	SafeGo(fn, func(err error) {
		// Default: log the error
		// In production, this could send to a monitoring system
		fmt.Printf("[PANIC RECOVERED] %v\n", err)
	})
}
