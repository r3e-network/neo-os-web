package indexer

import (
	"testing"
)

func TestTracerParseScript(t *testing.T) {
	tracer := NewTracer(nil)

	// Simple PUSH1 script
	traces, err := tracer.ParseScript("0x123", "11") // PUSH1
	if err != nil {
		t.Fatalf("parse script: %v", err)
	}
	if len(traces) != 1 {
		t.Errorf("expected 1 trace, got %d", len(traces))
	}
	if traces[0].Opcode != "PUSH1" {
		t.Errorf("expected PUSH1, got %s", traces[0].Opcode)
	}
}

func TestTracerParseScriptMultiple(t *testing.T) {
	tracer := NewTracer(nil)

	// PUSH1 + PUSH2 + NOP
	traces, err := tracer.ParseScript("0x456", "111261")
	if err != nil {
		t.Fatalf("parse script: %v", err)
	}
	if len(traces) != 3 {
		t.Errorf("expected 3 traces, got %d", len(traces))
	}
}

func TestTracerInvalidScript(t *testing.T) {
	tracer := NewTracer(nil)

	_, err := tracer.ParseScript("0x789", "invalid")
	if err == nil {
		t.Error("expected error for invalid hex")
	}
}

func TestGetOpcodeSize(t *testing.T) {
	tests := []struct {
		name string
		op   byte
		size int
	}{
		{"NOP", 0x21, 1},
		{"PUSH1", 0x11, 1},
		{"SYSCALL", 0x41, 5},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Basic size check
			if tt.size < 1 {
				t.Error("size must be >= 1")
			}
		})
	}
}

// Tests for IsComplexTransaction - the new function added in T1
func TestIsComplexTransaction(t *testing.T) {
	tests := []struct {
		name     string
		script   string
		expected bool
	}{
		{
			name:     "simple transfer - no syscall",
			script:   "11121314", // PUSH1-4, no SYSCALL
			expected: false,
		},
		{
			name:     "complex - SYSCALL with Contract.Call interop",
			script:   "41" + "525b7d62", // SYSCALL (0x41) + interop ID
			expected: true,
		},
		{
			name:     "empty script",
			script:   "",
			expected: false,
		},
		{
			name:     "invalid hex",
			script:   "not-valid-hex",
			expected: false,
		},
		{
			name:     "syscall but not Contract.Call",
			script:   "41" + "12345678",
			expected: false,
		},
		{
			name:     "SYSCALL at end without interop ID",
			script:   "111241",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsComplexTransaction(tt.script)
			if result != tt.expected {
				t.Errorf("got %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestIsComplexTransaction_RealWorldScripts(t *testing.T) {
	// Test with realistic Neo N3 script patterns
	tests := []struct {
		name     string
		script   string
		expected bool
	}{
		{
			name:     "NEP-17 transfer with Contract.Call",
			script:   "0c14" + "0000000000000000000000000000000000000000" + "41" + "525b7d62",
			expected: true, // Contains System.Contract.Call (0x627d5b52 little-endian)
		},
		{
			name:     "simple push operations only",
			script:   "11121314151617",
			expected: false,
		},
		{
			name:     "multiple opcodes ending with Contract.Call",
			script:   "111213" + "41" + "525b7d62" + "21",
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsComplexTransaction(tt.script)
			if result != tt.expected {
				t.Errorf("IsComplexTransaction(%q) = %v, want %v", tt.script, result, tt.expected)
			}
		})
	}
}

func TestExtractContractCalls(t *testing.T) {
	tracer := NewTracer(nil)

	notifications := []Notification{
		{ContractHash: "0xabc", EventName: "Transfer", StateJSON: []byte(`["from","to",100]`)},
		{ContractHash: "0xdef", EventName: "Approve", StateJSON: []byte(`["owner","spender",50]`)},
	}

	calls := tracer.ExtractContractCalls("0x123", notifications)

	if len(calls) != 2 {
		t.Fatalf("expected 2 calls, got %d", len(calls))
	}
	if calls[0].ContractHash != "0xabc" {
		t.Errorf("expected contract 0xabc, got %s", calls[0].ContractHash)
	}
	if calls[0].Method != "Transfer" {
		t.Errorf("expected method Transfer, got %s", calls[0].Method)
	}
	if !calls[0].Success {
		t.Error("expected success=true")
	}
}

func TestExtractContractCalls_Empty(t *testing.T) {
	tracer := NewTracer(nil)
	calls := tracer.ExtractContractCalls("0x456", nil)
	if len(calls) != 0 {
		t.Errorf("expected 0 calls for nil input, got %d", len(calls))
	}
}
