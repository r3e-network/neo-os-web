// Package utils tests
package utils

import (
	"testing"
	"time"
)

// ============================================================================
// String Utilities Tests
// ============================================================================

func TestTrimEmpty(t *testing.T) {
	tests := []struct {
		name     string
		input    []string
		expected []string
	}{
		{
			name:     "removes empty strings",
			input:    []string{"a", "", "b", "", "c"},
			expected: []string{"a", "b", "c"},
		},
		{
			name:     "removes whitespace-only strings",
			input:    []string{"a", "  ", "b", "\t", "c"},
			expected: []string{"a", "b", "c"},
		},
		{
			name:     "handles empty slice",
			input:    []string{},
			expected: []string{},
		},
		{
			name:     "handles all empty strings",
			input:    []string{"", "", ""},
			expected: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := TrimEmpty(tt.input)
			if len(result) != len(tt.expected) {
				t.Errorf("TrimEmpty() = %v, want %v", result, tt.expected)
				return
			}
			for i := range result {
				if result[i] != tt.expected[i] {
					t.Errorf("TrimEmpty()[%d] = %q, want %q", i, result[i], tt.expected[i])
				}
			}
		})
	}
}

func TestSplitTrim(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		delimiter string
		expected  []string
	}{
		{
			name:      "basic split and trim",
			input:     "a, b, c",
			delimiter: ",",
			expected:  []string{"a", "b", "c"},
		},
		{
			name:      "handles extra spaces",
			input:     "  a  ,  b  ,  c  ",
			delimiter: ",",
			expected:  []string{"  a  ", "  b  ", "  c  "},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SplitTrim(tt.input, tt.delimiter)
			if len(result) != len(tt.expected) {
				t.Errorf("SplitTrim() length = %d, want %d", len(result), len(tt.expected))
			}
		})
	}
}

func TestIsEmpty(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{name: "empty string", input: "", expected: true},
		{name: "whitespace only", input: "   ", expected: true},
		{name: "tab only", input: "\t", expected: true},
		{name: "non-empty", input: "a", expected: false},
		{name: "whitespace with content", input: " a ", expected: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if result := IsEmpty(tt.input); result != tt.expected {
				t.Errorf("IsEmpty(%q) = %v, want %v", tt.input, result, tt.expected)
			}
		})
	}
}

func TestCoalesce(t *testing.T) {
	tests := []struct {
		name     string
		input    []string
		expected string
	}{
		{name: "first non-empty", input: []string{"", "", "a", "b"}, expected: "a"},
		{name: "first value", input: []string{"a", "b", "c"}, expected: "a"},
		{name: "all empty", input: []string{"", "", ""}, expected: ""},
		{name: "no input", input: []string{}, expected: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if result := Coalesce(tt.input...); result != tt.expected {
				t.Errorf("Coalesce(%v) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestTruncate(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		maxLen   int
		expected string
	}{
		{name: "shorter than max", input: "hello", maxLen: 10, expected: "hello"},
		{name: "exactly max", input: "hello", maxLen: 5, expected: "hello"},
		{name: "needs truncation", input: "hello world", maxLen: 8, expected: "hello..."},
		{name: "very short max", input: "hello", maxLen: 4, expected: "h..."},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if result := Truncate(tt.input, tt.maxLen); result != tt.expected {
				t.Errorf("Truncate(%q, %d) = %q, want %q", tt.input, tt.maxLen, result, tt.expected)
			}
		})
	}
}

func TestToSlice(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []string
	}{
		{name: "non-empty string", input: "hello", expected: []string{"hello"}},
		{name: "empty string", input: "", expected: []string{}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ToSlice(tt.input)
			if len(result) != len(tt.expected) ||
				(len(result) > 0 && result[0] != tt.expected[0]) {
				t.Errorf("ToSlice(%q) = %v, want %v", tt.input, result, tt.expected)
			}
		})
	}
}

// ============================================================================
// Validation Utilities Tests
// ============================================================================

func TestValidateRequired(t *testing.T) {
	tests := []struct {
		name        string
		fields      map[string]string
		expectError bool
	}{
		{
			name:        "all fields present",
			fields:      map[string]string{"a": "value", "b": "value2"},
			expectError: false,
		},
		{
			name:        "some fields missing",
			fields:      map[string]string{"a": "value", "b": ""},
			expectError: true,
		},
		{
			name:        "whitespace-only fields",
			fields:      map[string]string{"a": "  "},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateRequired(tt.fields)
			if (err != nil) != tt.expectError {
				t.Errorf("ValidateRequired() error = %v, expectError %v", err, tt.expectError)
			}
		})
	}
}

func TestValidateOneOf(t *testing.T) {
	tests := []struct {
		name        string
		fields      map[string]string
		expectError bool
	}{
		{
			name:        "one field present",
			fields:      map[string]string{"a": "", "b": "value"},
			expectError: false,
		},
		{
			name:        "all fields empty",
			fields:      map[string]string{"a": "", "b": ""},
			expectError: true,
		},
		{
			name:        "all fields present",
			fields:      map[string]string{"a": "value1", "b": "value2"},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateOneOf(tt.fields)
			if (err != nil) != tt.expectError {
				t.Errorf("ValidateOneOf() error = %v, expectError %v", err, tt.expectError)
			}
		})
	}
}

// ============================================================================
// Conversion Utilities Tests
// ============================================================================

func TestToString(t *testing.T) {
	tests := []struct {
		name     string
		input    interface{}
		expected string
	}{
		{name: "string", input: "hello", expected: "hello"},
		{name: "int", input: 42, expected: "42"},
		{name: "int64", input: int64(123), expected: "123"},
		{name: "float", input: 3.14, expected: "3.140000"},
		{name: "bool", input: true, expected: "true"},
		{name: "nil", input: nil, expected: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ToString(tt.input)
			if result != tt.expected {
				t.Errorf("ToString(%v) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestToInt(t *testing.T) {
	tests := []struct {
		name       string
		input      interface{}
		defaultVal int
		expected   int
	}{
		{name: "int", input: 42, defaultVal: 0, expected: 42},
		{name: "int64", input: int64(100), defaultVal: 0, expected: 100},
		{name: "float64", input: 3.7, defaultVal: 0, expected: 3},
		{name: "string valid", input: "42", defaultVal: 0, expected: 42},
		{name: "string invalid", input: "abc", defaultVal: 5, expected: 5},
		{name: "unsupported type", input: true, defaultVal: 10, expected: 10},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ToInt(tt.input, tt.defaultVal)
			if result != tt.expected {
				t.Errorf("ToInt(%v, %d) = %d, want %d", tt.input, tt.defaultVal, result, tt.expected)
			}
		})
	}
}

func TestToBool(t *testing.T) {
	tests := []struct {
		name       string
		input      interface{}
		defaultVal bool
		expected   bool
	}{
		{name: "bool true", input: true, defaultVal: false, expected: true},
		{name: "bool false", input: false, defaultVal: true, expected: false},
		{name: "string true", input: "true", defaultVal: false, expected: true},
		{name: "string 1", input: "1", defaultVal: false, expected: true},
		{name: "string yes", input: "yes", defaultVal: false, expected: true},
		{name: "string false", input: "false", defaultVal: true, expected: false},
		{name: "invalid string", input: "abc", defaultVal: true, expected: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ToBool(tt.input, tt.defaultVal)
			if result != tt.expected {
				t.Errorf("ToBool(%v, %v) = %v, want %v", tt.input, tt.defaultVal, result, tt.expected)
			}
		})
	}
}

// ============================================================================
// Slice Utilities Tests
// ============================================================================

func TestContains(t *testing.T) {
	tests := []struct {
		name     string
		slice    []string
		target   string
		expected bool
	}{
		{name: "contains", slice: []string{"a", "b", "c"}, target: "b", expected: true},
		{name: "not contains", slice: []string{"a", "b", "c"}, target: "d", expected: false},
		{name: "empty slice", slice: []string{}, target: "a", expected: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if result := Contains(tt.slice, tt.target); result != tt.expected {
				t.Errorf("Contains(%v, %q) = %v, want %v", tt.slice, tt.target, result, tt.expected)
			}
		})
	}
}

func TestUnique(t *testing.T) {
	tests := []struct {
		name     string
		input    []string
		expected []string
	}{
		{
			name:     "removes duplicates",
			input:    []string{"a", "b", "a", "c", "b"},
			expected: []string{"a", "b", "c"},
		},
		{
			name:     "already unique",
			input:    []string{"a", "b", "c"},
			expected: []string{"a", "b", "c"},
		},
		{
			name:     "empty slice",
			input:    []string{},
			expected: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := Unique(tt.input)
			if len(result) != len(tt.expected) {
				t.Errorf("Unique() length = %d, want %d", len(result), len(tt.expected))
				return
			}
			for i := range result {
				if result[i] != tt.expected[i] {
					t.Errorf("Unique()[%d] = %q, want %q", i, result[i], tt.expected[i])
				}
			}
		})
	}
}

func TestFilter(t *testing.T) {
	tests := []struct {
		name      string
		input     []string
		predicate func(string) bool
		expected  []string
	}{
		{
			name:  "filter even length",
			input: []string{"a", "bb", "ccc", "dddd"},
			predicate: func(s string) bool {
				return len(s)%2 == 0
			},
			expected: []string{"bb", "dddd"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := Filter(tt.input, tt.predicate)
			if len(result) != len(tt.expected) {
				t.Errorf("Filter() length = %d, want %d", len(result), len(tt.expected))
			}
		})
	}
}

func TestMap(t *testing.T) {
	input := []string{"a", "bb", "ccc"}
	fn := func(s string) string {
		return s + "x"
	}
	result := Map(input, fn)
	expected := []string{"ax", "bbx", "cccx"}
	if len(result) != len(expected) {
		t.Errorf("Map() length = %d, want %d", len(result), len(expected))
		return
	}
	for i := range result {
		if result[i] != expected[i] {
			t.Errorf("Map()[%d] = %q, want %q", i, result[i], expected[i])
		}
	}
}

// ============================================================================
// Time Utilities Tests
// ============================================================================

func TestFormatDuration(t *testing.T) {
	tests := []struct {
		name     string
		input    time.Duration
		expected string
	}{
		{name: "milliseconds", input: 500 * time.Millisecond, expected: "500ms"},
		{name: "seconds", input: 1500 * time.Millisecond, expected: "1.50s"},
		{name: "minutes", input: 90 * time.Second, expected: "1.50m"},
		{name: "hours", input: 2*time.Hour + 30*time.Minute, expected: "2.50h"},
		{name: "days", input: 48 * time.Hour, expected: "2.00d"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := FormatDuration(tt.input)
			if result != tt.expected {
				t.Errorf("FormatDuration(%v) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestNow(t *testing.T) {
	result := Now()
	if result == "" {
		t.Error("Now() returned empty string")
	}
	// Just verify it's valid RFC3339 format
	_, err := time.Parse(time.RFC3339, result)
	if err != nil {
		t.Errorf("Now() returned invalid RFC3339 format: %v", err)
	}
}

func TestMustParseDuration(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expectPanic bool
	}{
		{name: "valid hour", input: "1h", expectPanic: false},
		{name: "valid minute", input: "30m", expectPanic: false},
		{name: "valid ms", input: "500ms", expectPanic: false},
		{name: "invalid", input: "invalid", expectPanic: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.expectPanic {
				defer func() {
					if r := recover(); r == nil {
						t.Error("MustParseDuration() should have panicked")
					}
				}()
			}
			result := MustParseDuration(tt.input)
			if !tt.expectPanic && result == 0 {
				t.Error("MustParseDuration() returned zero duration")
			}
		})
	}
}

// ============================================================================
// JSON Utilities Tests
// ============================================================================

func TestJSONMarshal(t *testing.T) {
	input := map[string]string{"key": "value"}
	result := JSONMarshal(input)
	if result == "" {
		t.Error("JSONMarshal() returned empty string")
	}
	// Should contain key-value
	if !contains(result, "key") || !contains(result, "value") {
		t.Errorf("JSONMarshal() = %s, expected to contain key and value", result)
	}
}

func TestJSONParse(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expectError bool
	}{
		{name: "valid JSON", input: `{"key":"value"}`, expectError: false},
		{name: "invalid JSON", input: `{invalid}`, expectError: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := JSONParse(tt.input)
			if (err != nil) != tt.expectError {
				t.Errorf("JSONParse() error = %v, expectError %v", err, tt.expectError)
			}
		})
	}
}

func TestMustJSONParse(t *testing.T) {
	t.Run("valid JSON", func(t *testing.T) {
		result := MustJSONParse(`{"key":"value"}`)
		if result == nil {
			t.Error("MustJSONParse() returned nil")
		}
	})

	t.Run("invalid JSON panics", func(t *testing.T) {
		defer func() {
			if r := recover(); r == nil {
				t.Error("MustJSONParse() should have panicked")
			}
		}()
		MustJSONParse(`{invalid}`)
	})
}

// Helper function for string contains check
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) && indexOf(s, substr) >= 0)
}

func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

// ============================================================================
// Pointer Utilities Tests
// ============================================================================

func TestPtr(t *testing.T) {
	val := 42
	result := Ptr(val)
	if result == nil {
		t.Fatal("Ptr() returned nil")
	}
	if *result != val {
		t.Errorf("Ptr() = %d, want %d", *result, val)
	}
}

func TestPtrZero(t *testing.T) {
	t.Run("zero value returns nil", func(t *testing.T) {
		result := PtrZero(0)
		if result != nil {
			t.Error("PtrZero(0) should return nil")
		}
	})

	t.Run("non-zero value returns pointer", func(t *testing.T) {
		result := PtrZero(42)
		if result == nil {
			t.Fatal("PtrZero(42) should not return nil")
		}
		if *result != 42 {
			t.Errorf("PtrZero(42) = %d, want 42", *result)
		}
	})
}

func TestDeref(t *testing.T) {
	val := 42
	t.Run("non-nil pointer", func(t *testing.T) {
		result := Deref(&val)
		if result != val {
			t.Errorf("Deref(&%d) = %d", val, result)
		}
	})

	t.Run("nil pointer", func(t *testing.T) {
		result := Deref((*int)(nil))
		if result != 0 {
			t.Errorf("Deref(nil) = %d, want 0", result)
		}
	})
}

func TestDerefDefault(t *testing.T) {
	val := 42
	defaultVal := 99
	t.Run("non-nil pointer", func(t *testing.T) {
		result := DerefDefault(&val, defaultVal)
		if result != val {
			t.Errorf("DerefDefault(&%d, %d) = %d", val, defaultVal, result)
		}
	})

	t.Run("nil pointer", func(t *testing.T) {
		result := DerefDefault((*int)(nil), defaultVal)
		if result != defaultVal {
			t.Errorf("DerefDefault(nil, %d) = %d, want %d", defaultVal, result, defaultVal)
		}
	})
}

// ============================================================================
// Error Utilities Tests
// ============================================================================

func TestWrapError(t *testing.T) {
	inner := &testError{msg: "inner error"}
	wrapped := NewWrapError("wrapper", inner)

	if wrapped == nil {
		t.Fatal("NewWrapError() returned nil")
	}

	if wrapped.Error() != "wrapper: inner error" {
		t.Errorf("WrapError.Error() = %s, want 'wrapper: inner error'", wrapped.Error())
	}

	// Use type assertion to access Unwrap method
	if wrapErr, ok := wrapped.(*WrapError); ok {
		if wrapErr.Unwrap() != inner {
			t.Error("WrapError.Unwrap() did not return inner error")
		}
	} else {
		t.Error("NewWrapError() did not return *WrapError type")
	}
}

func TestMust(t *testing.T) {
	t.Run("no error returns value", func(t *testing.T) {
		result := Must("value", nil)
		if result != "value" {
			t.Errorf("Must() = %s, want 'value'", result)
		}
	})

	t.Run("with error panics", func(t *testing.T) {
		defer func() {
			if r := recover(); r == nil {
				t.Error("Must() with error should have panicked")
			}
		}()
		Must("", &testError{msg: "error"})
	})
}

// Test helper
type testError struct {
	msg string
}

func (e *testError) Error() string {
	return e.msg
}
