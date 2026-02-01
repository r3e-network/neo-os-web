// Package hex provides unified hexadecimal string handling utilities.
// This eliminates duplication across the codebase where hex encoding/decoding
// with 0x prefix handling is repeated.
package hex

import (
	"encoding/hex"
	"strings"
)

// =============================================================================
// String Utilities
// =============================================================================

// TrimPrefix removes "0x" or "0X" prefix from hex strings if present.
// This is the standard way to strip prefixes before hex operations.
func TrimPrefix(value string) string {
	value = strings.TrimSpace(value)
	value = strings.TrimPrefix(value, "0x")
	value = strings.TrimPrefix(value, "0X")
	return value
}

// Normalize returns a normalized hex string (lowercase, no 0x prefix).
// Useful for comparing hex addresses or storing in a canonical format.
func Normalize(value string) string {
	value = TrimPrefix(value)
	return strings.ToLower(value)
}

// =============================================================================
// Decode Utilities
// =============================================================================

// DecodeString decodes a hex string to bytes.
// It handles optional "0x" or "0X" prefix automatically.
// Returns an error if the string contains invalid hex characters.
func DecodeString(value string) ([]byte, error) {
	value = TrimPrefix(value)
	return hex.DecodeString(value)
}

// MustDecodeString decodes a hex string to bytes, panicking on error.
// Use this only for constants or values known to be valid at compile time.
func MustDecodeString(value string) []byte {
	result, err := DecodeString(value)
	if err != nil {
		panic("hex: invalid hex string: " + err.Error())
	}
	return result
}

// DecodeStringOrDefault decodes a hex string, returning the default value on error.
func DecodeStringOrDefault(value string, defaultValue []byte) []byte {
	result, err := DecodeString(value)
	if err != nil {
		return defaultValue
	}
	return result
}

// =============================================================================
// Encode Utilities
// =============================================================================

// EncodeToString converts bytes to a hex string without "0x" prefix.
// This is the inverse of DecodeString/TrimPrefix.
func EncodeToString(data []byte) string {
	return hex.EncodeToString(data)
}

// EncodeWithPrefix converts bytes to a hex string with "0x" prefix.
// Useful for displaying hex values to users.
func EncodeWithPrefix(data []byte) string {
	return "0x" + hex.EncodeToString(data)
}

// =============================================================================
// Validation Utilities
// =============================================================================

// IsValid checks if a string is a valid hex string.
// It handles optional "0x" or "0X" prefix.
func IsValid(value string) bool {
	value = TrimPrefix(value)
	if value == "" || len(value)%2 != 0 {
		return false
	}
	_, err := hex.DecodeString(value)
	return err == nil
}

// IsHexString checks if a string looks like hex encoded data.
// It does a quick character check without full decoding.
// Returns false for empty strings or odd-length strings.
func IsHexString(value string) bool {
	value = TrimPrefix(value)
	if value == "" || len(value)%2 != 0 {
		return false
	}

	for _, ch := range value {
		switch {
		case '0' <= ch && ch <= '9':
		case 'a' <= ch && ch <= 'f':
		case 'A' <= ch && ch <= 'F':
		default:
			return false
		}
	}
	return true
}

// =============================================================================
// Legacy Compatibility (safe decode with ok bool)
// =============================================================================

// TryDecode decodes a hex string, returning (data, true) on success
// or (nil, false) on any error. This matches the pattern used in
// marble.go for secret validation.
func TryDecode(value string) ([]byte, bool) {
	value = TrimPrefix(value)
	if value == "" || len(value)%2 != 0 {
		return nil, false
	}
	if !IsHexString(value) {
		return nil, false
	}

	result, err := hex.DecodeString(value)
	if err != nil {
		return nil, false
	}
	return result, true
}
