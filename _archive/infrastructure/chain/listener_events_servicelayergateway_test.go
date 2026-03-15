package chain

import (
	"encoding/json"
	"testing"
)

func TestParseServiceFulfilledEventBooleanErrorField(t *testing.T) {
	event := &ContractEvent{
		EventName: "ServiceFulfilled",
		State: []StackItem{
			{Type: "Integer", Value: json.RawMessage(`"86"`)},
			{Type: "Boolean", Value: json.RawMessage(`true`)},
			{Type: "ByteString", Value: json.RawMessage(`""`)},
			{Type: "Boolean", Value: json.RawMessage(`false`)},
		},
	}

	parsed, err := ParseServiceFulfilledEvent(event)
	if err != nil {
		t.Fatalf("ParseServiceFulfilledEvent() error = %v", err)
	}
	if parsed.RequestID != "86" {
		t.Fatalf("request id = %q, want %q", parsed.RequestID, "86")
	}
	if !parsed.Success {
		t.Fatalf("success = %v, want true", parsed.Success)
	}
	if parsed.Error != "" {
		t.Fatalf("error = %q, want empty", parsed.Error)
	}
}

func TestParseServiceFulfilledEventStringErrorField(t *testing.T) {
	event := &ContractEvent{
		EventName: "ServiceFulfilled",
		State: []StackItem{
			{Type: "Integer", Value: json.RawMessage(`"87"`)},
			{Type: "Boolean", Value: json.RawMessage(`false`)},
			{Type: "ByteString", Value: json.RawMessage(`"AA=="`)},
			{Type: "ByteString", Value: json.RawMessage(`"c29tZSBmYWlsdXJl"`)},
		},
	}

	parsed, err := ParseServiceFulfilledEvent(event)
	if err != nil {
		t.Fatalf("ParseServiceFulfilledEvent() error = %v", err)
	}
	if parsed.RequestID != "87" {
		t.Fatalf("request id = %q, want %q", parsed.RequestID, "87")
	}
	if parsed.Success {
		t.Fatalf("success = %v, want false", parsed.Success)
	}
	if parsed.Error != "some failure" {
		t.Fatalf("error = %q, want %q", parsed.Error, "some failure")
	}
}
