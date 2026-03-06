package database

import (
	"fmt"
	"regexp"
	"strings"
)

// validFieldName matches safe PostgREST field names (letters, digits, underscores, dots).
var validFieldName = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_.]*$`)

// fieldValidationError validates safe PostgREST field names for exported helpers.
func fieldValidationError(field string) error {
	if validFieldName.MatchString(field) {
		return nil
	}
	return fmt.Errorf("invalid field name: %q", field)
}

// validateFieldList validates a comma-separated list of field names and returns
// a normalized, trimmed string suitable for PostgREST parameters like on_conflict.
func validateFieldList(fields string) (string, error) {
	trimmed := strings.TrimSpace(fields)
	if trimmed == "" {
		return "", fmt.Errorf("field list cannot be empty")
	}

	parts := strings.Split(trimmed, ",")
	validated := make([]string, 0, len(parts))
	for _, rawField := range parts {
		field := strings.TrimSpace(rawField)
		if err := fieldValidationError(field); err != nil {
			return "", err
		}
		validated = append(validated, field)
	}
	return strings.Join(validated, ","), nil
}
