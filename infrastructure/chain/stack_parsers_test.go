package chain

import (
	"encoding/json"
	"testing"
)

func TestDecodeStackBytes(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []byte
		wantErr  bool
	}{
		{
			name:     "hex with 0x prefix",
			input:    "0x48656c6c6f",
			expected: []byte("Hello"),
			wantErr:  false,
		},
		{
			name:     "hex with 0X prefix",
			input:    "0X48656c6c6f",
			expected: []byte("Hello"),
			wantErr:  false,
		},
		{
			name:     "base64 encoded",
			input:    "SGVsbG8=",
			expected: []byte("Hello"),
			wantErr:  false,
		},
		{
			name:     "raw hex",
			input:    "48656c6c6f",
			expected: []byte("Hello"),
			wantErr:  false,
		},
		{
			name:     "empty string",
			input:    "",
			expected: nil,
			wantErr:  false,
		},
		{
			name:     "whitespace only",
			input:    "   ",
			expected: nil,
			wantErr:  false,
		},
		{
			name:     "odd length hex",
			input:    "123",
			expected: nil,
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := decodeStackBytes(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("decodeStackBytes() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && string(result) != string(tt.expected) {
				t.Errorf("decodeStackBytes() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestParseArray(t *testing.T) {
	tests := []struct {
		name    string
		item    StackItem
		wantLen int
		wantErr bool
	}{
		{
			name: "valid array",
			item: StackItem{
				Type:  "Array",
				Value: json.RawMessage(`[{"type":"Integer","value":"1"},{"type":"Integer","value":"2"}]`),
			},
			wantLen: 2,
			wantErr: false,
		},
		{
			name: "valid struct",
			item: StackItem{
				Type:  "Struct",
				Value: json.RawMessage(`[{"type":"Integer","value":"1"}]`),
			},
			wantLen: 1,
			wantErr: false,
		},
		{
			name: "wrong type",
			item: StackItem{
				Type:  "Integer",
				Value: json.RawMessage(`"123"`),
			},
			wantLen: 0,
			wantErr: true,
		},
		{
			name: "invalid json",
			item: StackItem{
				Type:  "Array",
				Value: json.RawMessage(`not json`),
			},
			wantLen: 0,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseArray(tt.item)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseArray() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && len(result) != tt.wantLen {
				t.Errorf("ParseArray() length = %d, want %d", len(result), tt.wantLen)
			}
		})
	}
}

func TestParseHash160(t *testing.T) {
	// 20 bytes encoded in base64: base64.StdEncoding.EncodeToString(make([]byte, 20)) = "AAAAAAAAAAAAAAAAAAAAAAAAAAAA"
	// But that's 28 chars which decodes to 21 bytes. Use hex instead.
	hash160Hex := "0x0000000000000000000000000000000000000000" // 20 zero bytes in hex

	tests := []struct {
		name    string
		item    StackItem
		wantErr bool
	}{
		{
			name: "valid ByteString hex",
			item: StackItem{
				Type:  "ByteString",
				Value: json.RawMessage(`"` + hash160Hex + `"`),
			},
			wantErr: false,
		},
		{
			name: "valid Buffer hex",
			item: StackItem{
				Type:  "Buffer",
				Value: json.RawMessage(`"` + hash160Hex + `"`),
			},
			wantErr: false,
		},
		{
			name: "wrong type",
			item: StackItem{
				Type:  "Integer",
				Value: json.RawMessage(`"123"`),
			},
			wantErr: true,
		},
		{
			name: "wrong length",
			item: StackItem{
				Type:  "ByteString",
				Value: json.RawMessage(`"SGVsbG8="`), // "Hello" - 5 bytes
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseHash160(tt.item)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseHash160() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr {
				// Result should start with 0x
				if len(result) < 2 || result[:2] != "0x" {
					t.Errorf("ParseHash160() result should start with 0x, got %s", result)
				}
			}
		})
	}
}

func TestParseString(t *testing.T) {
	tests := []struct {
		name     string
		item     StackItem
		expected string
		wantErr  bool
	}{
		{
			name: "valid ByteString",
			item: StackItem{
				Type:  "ByteString",
				Value: json.RawMessage(`"SGVsbG8="`), // "Hello" in base64
			},
			expected: "Hello",
			wantErr:  false,
		},
		{
			name: "null type",
			item: StackItem{
				Type:  "Null",
				Value: nil,
			},
			expected: "",
			wantErr:  false,
		},
		{
			name: "wrong type",
			item: StackItem{
				Type:  "Integer",
				Value: json.RawMessage(`"123"`),
			},
			expected: "",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseString(tt.item)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseString() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && result != tt.expected {
				t.Errorf("ParseString() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestParseStringFromItem(t *testing.T) {
	// Same as ParseString - they're aliases
	item := StackItem{
		Type:  "ByteString",
		Value: json.RawMessage(`"SGVsbG8="`),
	}

	result, err := ParseStringFromItem(item)
	if err != nil {
		t.Errorf("ParseStringFromItem() error = %v", err)
	}
	if result != "Hello" {
		t.Errorf("ParseStringFromItem() = %q, want %q", result, "Hello")
	}
}

func TestParseIntegerEdgeCases(t *testing.T) {
	tests := []struct {
		name    string
		item    StackItem
		wantErr bool
	}{
		{
			name: "large integer",
			item: StackItem{
				Type:  "Integer",
				Value: json.RawMessage(`"999999999999999999999999999999"`),
			},
			wantErr: false,
		},
		{
			name: "negative integer",
			item: StackItem{
				Type:  "Integer",
				Value: json.RawMessage(`"-12345"`),
			},
			wantErr: false,
		},
		{
			name: "zero",
			item: StackItem{
				Type:  "Integer",
				Value: json.RawMessage(`"0"`),
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ParseInteger(tt.item)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseInteger() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestParseBooleanEdgeCases(t *testing.T) {
	tests := []struct {
		name     string
		item     StackItem
		expected bool
		wantErr  bool
	}{
		{
			name: "true",
			item: StackItem{
				Type:  "Boolean",
				Value: json.RawMessage(`true`),
			},
			expected: true,
			wantErr:  false,
		},
		{
			name: "false",
			item: StackItem{
				Type:  "Boolean",
				Value: json.RawMessage(`false`),
			},
			expected: false,
			wantErr:  false,
		},
		{
			name: "wrong type",
			item: StackItem{
				Type:  "Integer",
				Value: json.RawMessage(`"1"`),
			},
			expected: false,
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseBoolean(tt.item)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseBoolean() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && result != tt.expected {
				t.Errorf("ParseBoolean() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestParseByteArrayEdgeCases(t *testing.T) {
	tests := []struct {
		name    string
		item    StackItem
		wantNil bool
		wantErr bool
	}{
		{
			name: "Buffer type",
			item: StackItem{
				Type:  "Buffer",
				Value: json.RawMessage(`"SGVsbG8="`),
			},
			wantNil: false,
			wantErr: false,
		},
		{
			name: "empty ByteString",
			item: StackItem{
				Type:  "ByteString",
				Value: json.RawMessage(`""`),
			},
			wantNil: true,
			wantErr: false,
		},
		{
			name: "wrong type",
			item: StackItem{
				Type:  "Map",
				Value: json.RawMessage(`{}`),
			},
			wantNil: false,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseByteArray(tt.item)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseByteArray() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && tt.wantNil && result != nil {
				t.Errorf("ParseByteArray() = %v, want nil", result)
			}
		})
	}
}
