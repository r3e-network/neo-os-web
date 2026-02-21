package chain

import (
	"testing"
)

func TestRPCErrorError(t *testing.T) {
	tests := []struct {
		name     string
		err      *RPCError
		expected string
	}{
		{
			name:     "basic error",
			err:      &RPCError{Code: -100, Message: "test error"},
			expected: "RPC error -100: test error",
		},
		{
			name:     "zero code",
			err:      &RPCError{Code: 0, Message: "no error"},
			expected: "RPC error 0: no error",
		},
		{
			name:     "with data",
			err:      &RPCError{Code: -1, Message: "error", Data: "extra"},
			expected: "RPC error -1: error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.err.Error(); got != tt.expected {
				t.Errorf("Error() = %q, want %q", got, tt.expected)
			}
		})
	}
}

func TestIsNotFoundError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "unknown transaction message",
			err:      &RPCError{Code: -1, Message: "Unknown transaction"},
			expected: true,
		},
		{
			name:     "code -100",
			err:      &RPCError{Code: -100, Message: "some error"},
			expected: true,
		},
		{
			name:     "other error",
			err:      &RPCError{Code: -1, Message: "other error"},
			expected: false,
		},
		{
			name:     "case insensitive",
			err:      &RPCError{Code: -1, Message: "UNKNOWN TRANSACTION"},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isNotFoundError(tt.err); got != tt.expected {
				t.Errorf("isNotFoundError() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestWitnessScopeConstants(t *testing.T) {
	// Verify constants are defined correctly
	if ScopeNone != "None" {
		t.Errorf("ScopeNone = %q, want %q", ScopeNone, "None")
	}
	if ScopeCalledByEntry != "CalledByEntry" {
		t.Errorf("ScopeCalledByEntry = %q, want %q", ScopeCalledByEntry, "CalledByEntry")
	}
	if ScopeCustomContracts != "CustomContracts" {
		t.Errorf("ScopeCustomContracts = %q, want %q", ScopeCustomContracts, "CustomContracts")
	}
	if ScopeCustomGroups != "CustomGroups" {
		t.Errorf("ScopeCustomGroups = %q, want %q", ScopeCustomGroups, "CustomGroups")
	}
	if ScopeGlobal != "Global" {
		t.Errorf("ScopeGlobal = %q, want %q", ScopeGlobal, "Global")
	}
	if ScopeWitnessRules != "WitnessRules" {
		t.Errorf("ScopeWitnessRules = %q, want %q", ScopeWitnessRules, "WitnessRules")
	}
}
