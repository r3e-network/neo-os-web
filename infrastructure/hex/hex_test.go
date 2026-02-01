package hex

import (
	"testing"
)

func TestTrimPrefix(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"lowercase 0x", "0xabcdef", "abcdef"},
		{"uppercase 0X", "0XABCDEF", "ABCDEF"},
		{"mixed case", "0xAbCdEf", "AbCdEf"},
		{"with spaces", "  0xabcdef  ", "abcdef"},
		{"no prefix", "abcdef", "abcdef"},
		{"empty string", "", ""},
		{"only prefix", "0x", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := TrimPrefix(tt.input)
			if result != tt.expected {
				t.Errorf("TrimPrefix(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestNormalize(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"lowercase 0x", "0xABCDEF", "abcdef"},
		{"uppercase 0X", "0XABCDEF", "abcdef"},
		{"mixed case", "  0xAbCdEf  ", "abcdef"},
		{"no prefix", "ABCDEF", "abcdef"},
		{"empty string", "", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := Normalize(tt.input)
			if result != tt.expected {
				t.Errorf("Normalize(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestDecodeString(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		expected  []byte
		expectErr bool
	}{
		{"valid lowercase", "0xabcdef", []byte{0xab, 0xcd, 0xef}, false},
		{"valid uppercase", "0XABCDEF", []byte{0xab, 0xcd, 0xef}, false},
		{"valid no prefix", "abcdef", []byte{0xab, 0xcd, 0xef}, false},
		{"empty string", "", []byte{}, false},
		{"invalid chars", "0xghij", nil, true},
		{"odd length", "0xabc", nil, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := DecodeString(tt.input)
			if (err != nil) != tt.expectErr {
				t.Errorf("DecodeString(%q) error = %v, expectErr %v", tt.input, err, tt.expectErr)
				return
			}
			if !tt.expectErr && string(result) != string(tt.expected) {
				t.Errorf("DecodeString(%q) = %x, want %x", tt.input, result, tt.expected)
			}
		})
	}
}

func TestIsValid(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{"valid with 0x", "0xabcdef", true},
		{"valid without 0x", "abcdef", true},
		{"empty string", "", false},
		{"odd length", "abc", false},
		{"invalid chars", "0xghij", false},
		{"only 0x", "0x", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsValid(tt.input)
			if result != tt.expected {
				t.Errorf("IsValid(%q) = %v, want %v", tt.input, result, tt.expected)
			}
		})
	}
}

func TestIsHexString(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{"valid hex", "0xabcdef0123456789", true},
		{"valid uppercase", "0XABCDEF0123456789", true},
		{"valid mixed", "0xAaBbCcDd", true},
		{"empty", "", false},
		{"odd length", "0xabc", false},
		{"invalid chars", "0xghij", false},
		{"spaces", "  0xabc  ", false}, // TrimPrefix is called first
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsHexString(tt.input)
			if result != tt.expected {
				t.Errorf("IsHexString(%q) = %v, want %v", tt.input, result, tt.expected)
			}
		})
	}
}

func TestTryDecode(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expectOK bool
	}{
		{"valid hex", "0xabcdef", true},
		{"valid no prefix", "abcdef", true},
		{"empty string", "", false},
		{"odd length", "0xabc", false},
		{"invalid chars", "0xghij", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, ok := TryDecode(tt.input)
			if ok != tt.expectOK {
				t.Errorf("TryDecode(%q) ok = %v, want %v", tt.input, ok, tt.expectOK)
				return
			}
			if tt.expectOK && len(result) == 0 {
				t.Errorf("TryDecode(%q) returned empty bytes for valid input", tt.input)
			}
		})
	}
}

func TestEncodeToString(t *testing.T) {
	input := []byte{0xab, 0xcd, 0xef}
	expected := "abcdef"
	result := EncodeToString(input)
	if result != expected {
		t.Errorf("EncodeToString(%x) = %s, want %s", input, result, expected)
	}
}

func TestEncodeWithPrefix(t *testing.T) {
	input := []byte{0xab, 0xcd, 0xef}
	expected := "0xabcdef"
	result := EncodeWithPrefix(input)
	if result != expected {
		t.Errorf("EncodeWithPrefix(%x) = %s, want %s", input, result, expected)
	}
}

func TestMustDecodeString(t *testing.T) {
	// Valid case
	result := MustDecodeString("0xabcdef")
	if len(result) != 3 || result[0] != 0xab {
		t.Errorf("MustDecodeString(0xabcdef) = %x, want abcdef", result)
	}

	// Panic case
	defer func() {
		if r := recover(); r == nil {
			t.Errorf("MustDecodeString did not panic on invalid input")
		}
	}()
	MustDecodeString("0xghij")
}
