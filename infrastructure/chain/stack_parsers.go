package chain

import (
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"strings"
)

// =============================================================================
// Stack Item Parsers
// =============================================================================

func decodeStackBytes(value string) ([]byte, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil, nil
	}

	// Explicit hex prefix (common in client-supplied values).
	if strings.HasPrefix(trimmed, "0x") || strings.HasPrefix(trimmed, "0X") {
		return hex.DecodeString(trimmed[2:])
	}

	// Neo N3 RPC encodes ByteString/Buffer stack items as base64.
	if decoded, err := base64.StdEncoding.DecodeString(trimmed); err == nil {
		return decoded, nil
	}

	// Fallback: some tools may return raw hex without a prefix.
	if len(trimmed)%2 != 0 {
		return nil, fmt.Errorf("invalid byte string")
	}
	for _, c := range trimmed {
		if (c >= '0' && c <= '9') ||
			(c >= 'a' && c <= 'f') ||
			(c >= 'A' && c <= 'F') {
			continue
		}
		return nil, fmt.Errorf("invalid byte string")
	}
	return hex.DecodeString(trimmed)
}

// ParseArray extracts an array of StackItems from a parent StackItem.
func ParseArray(item StackItem) ([]StackItem, error) {
	if item.Type != "Array" && item.Type != "Struct" {
		return nil, fmt.Errorf("expected Array or Struct, got %s", item.Type)
	}

	var items []StackItem
	if err := json.Unmarshal(item.Value, &items); err != nil {
		return nil, fmt.Errorf("unmarshal array: %w", err)
	}
	return items, nil
}

// ParseString parses a string from a StackItem.
// Alias for ParseStringFromItem for consistency.
func ParseString(item StackItem) (string, error) {
	return ParseStringFromItem(item)
}

func ParseHash160(item StackItem) (string, error) {
	if item.Type == "ByteString" || item.Type == "Buffer" {
		var value string
		if err := json.Unmarshal(item.Value, &value); err != nil {
			return "", err
		}
		bytes, err := decodeStackBytes(value)
		if err != nil {
			return "", err
		}
		if len(bytes) != 20 {
			return "", fmt.Errorf("unexpected Hash160 length: %d", len(bytes))
		}
		// Reverse for big-endian display.
		reversed := make([]byte, len(bytes))
		for i, b := range bytes {
			reversed[len(bytes)-1-i] = b
		}
		return "0x" + hex.EncodeToString(reversed), nil
	}
	return "", fmt.Errorf("unexpected type: %s", item.Type)
}

func ParseByteArray(item StackItem) ([]byte, error) {
	if item.Type == "ByteString" || item.Type == "Buffer" {
		var value string
		if err := json.Unmarshal(item.Value, &value); err != nil {
			return nil, err
		}
		return decodeStackBytes(value)
	}
	if item.Type == "Null" {
		return nil, nil
	}
	return nil, fmt.Errorf("unexpected type: %s", item.Type)
}

func ParseInteger(item StackItem) (*big.Int, error) {
	if item.Type == "Integer" {
		var value string
		if err := json.Unmarshal(item.Value, &value); err != nil {
			return nil, err
		}
		n := new(big.Int)
		if _, ok := n.SetString(value, 10); !ok {
			return nil, fmt.Errorf("invalid integer value: %q", value)
		}
		return n, nil
	}
	return nil, fmt.Errorf("unexpected type: %s", item.Type)
}

func ParseBoolean(item StackItem) (bool, error) {
	if item.Type == "Boolean" {
		var value bool
		if err := json.Unmarshal(item.Value, &value); err != nil {
			return false, err
		}
		return value, nil
	}
	if item.Type == "Integer" {
		n, err := ParseInteger(item)
		if err != nil {
			return false, err
		}
		return n.Sign() != 0, nil
	}
	if item.Type == "ByteString" || item.Type == "Buffer" {
		var value string
		if err := json.Unmarshal(item.Value, &value); err != nil {
			return false, err
		}
		bytes, err := decodeStackBytes(value)
		if err != nil {
			return false, err
		}
		switch len(bytes) {
		case 0:
			return false, nil
		case 1:
			return bytes[0] != 0, nil
		default:
			switch strings.ToLower(strings.TrimSpace(string(bytes))) {
			case "true", "1":
				return true, nil
			case "false", "0":
				return false, nil
			}
			// Fallback for VM-encoded integer booleans represented as multi-byte
			// little-endian values (for example 0x01 0x00).
			for _, b := range bytes {
				if b != 0 {
					return true, nil
				}
			}
			return false, nil
		}
	}
	return false, fmt.Errorf("unexpected type: %s", item.Type)
}

func ParseStringFromItem(item StackItem) (string, error) {
	if item.Type == "ByteString" || item.Type == "Buffer" {
		var value string
		if err := json.Unmarshal(item.Value, &value); err != nil {
			return "", err
		}
		bytes, err := decodeStackBytes(value)
		if err != nil {
			return "", err
		}
		return string(bytes), nil
	}
	if item.Type == "Null" {
		return "", nil
	}
	return "", fmt.Errorf("unexpected type for string: %s", item.Type)
}
