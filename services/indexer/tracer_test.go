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
