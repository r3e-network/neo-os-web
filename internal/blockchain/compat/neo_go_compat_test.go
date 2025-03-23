package compat

import (
	"encoding/hex"
	"testing"
)

func TestNeoGoVersion(t *testing.T) {
	// Just make sure this doesn't panic
	version := NeoGoVersion()
	t.Logf("Detected Neo-Go version: %s", version)
}

func TestStringToUint256(t *testing.T) {
	testCases := []struct {
		name        string
		input       string
		shouldError bool
	}{
		{
			name:        "Empty string",
			input:       "",
			shouldError: true,
		},
		{
			name:        "Valid hex without 0x",
			input:       "0000000000000000000000000000000000000000000000000000000000000000",
			shouldError: false,
		},
		{
			name:        "Valid hex with 0x",
			input:       "0x0000000000000000000000000000000000000000000000000000000000000000",
			shouldError: false,
		},
		{
			name:        "Invalid hex",
			input:       "not-hex",
			shouldError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result, err := StringToUint256(tc.input)
			if tc.shouldError && err == nil {
				t.Errorf("Expected error but got none")
			}
			if !tc.shouldError && err != nil {
				t.Errorf("Expected no error but got: %v", err)
			}
			if err == nil {
				t.Logf("Result: %v", result)
			}
		})
	}
}

func TestStringToUint160(t *testing.T) {
	testCases := []struct {
		name        string
		input       string
		shouldError bool
	}{
		{
			name:        "Empty string",
			input:       "",
			shouldError: true,
		},
		{
			name:        "Valid hex without 0x",
			input:       "0000000000000000000000000000000000000000",
			shouldError: false,
		},
		{
			name:        "Valid hex with 0x",
			input:       "0x0000000000000000000000000000000000000000",
			shouldError: false,
		},
		{
			name:        "Invalid hex",
			input:       "not-hex",
			shouldError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result, err := StringToUint160(tc.input)
			if tc.shouldError && err == nil {
				t.Errorf("Expected error but got none")
			}
			if !tc.shouldError && err != nil {
				t.Errorf("Expected no error but got: %v", err)
			}
			if err == nil {
				t.Logf("Result: %v", result)
			}
		})
	}
}

func TestBytesToHex(t *testing.T) {
	testCases := []struct {
		name     string
		input    []byte
		expected string
	}{
		{
			name:     "Empty bytes",
			input:    []byte{},
			expected: "",
		},
		{
			name:     "Single byte",
			input:    []byte{0x01},
			expected: "01",
		},
		{
			name:     "Multiple bytes",
			input:    []byte{0x01, 0x02, 0x03, 0x04},
			expected: "01020304",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := BytesToHex(tc.input)
			if result != tc.expected {
				t.Errorf("Expected %s but got %s", tc.expected, result)
			}
		})
	}
}

func TestAccountHelper_GetAddress(t *testing.T) {
	t.Skip("Requires an actual account object to test")
}

func TestAccountHelper_GetPrivateKeyHex(t *testing.T) {
	t.Skip("Requires an actual account object to test")
}

func TestAccountHelper_GetPublicKeyHex(t *testing.T) {
	t.Skip("Requires an actual account object to test")
}

// MockAccount is a simple mock implementation for testing
type MockAccount struct {
	address    string
	privateKey []byte
	publicKey  []byte
}

func (m *MockAccount) Address() string {
	return m.address
}

func (m *MockAccount) PrivateKey() []byte {
	return m.privateKey
}

func (m *MockAccount) PublicKey() []byte {
	return m.publicKey
}

func createMockAccount() *MockAccount {
	privKey, _ := hex.DecodeString("0000000000000000000000000000000000000000000000000000000000000001")
	pubKey, _ := hex.DecodeString("0250863ad64a87ae8a2fe83c1af1a8403cb53f53e486d8511dad8a04887e5b2352")

	return &MockAccount{
		address:    "NXGTSpLFfp85KiycNxNLqkqq2dampAcb1L",
		privateKey: privKey,
		publicKey:  pubKey,
	}
}
