package chain

import (
	"encoding/hex"
	"testing"
)

func TestNewWallet(t *testing.T) {
	// Valid 32-byte private key (hex encoded)
	validKey := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

	tests := []struct {
		name    string
		keyHex  string
		wantErr bool
	}{
		{
			name:    "valid private key",
			keyHex:  validKey,
			wantErr: false,
		},
		{
			name:    "invalid hex",
			keyHex:  "not-hex",
			wantErr: true,
		},
		{
			name:    "empty key creates zero-key wallet",
			keyHex:  "",
			wantErr: false, // Empty hex decodes to empty bytes, creates wallet with zero key
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			wallet, err := NewWallet(tt.keyHex)
			if (err != nil) != tt.wantErr {
				t.Errorf("NewWallet() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && wallet == nil {
				t.Error("NewWallet() returned nil wallet without error")
			}
		})
	}
}

func TestWalletAddress(t *testing.T) {
	validKey := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	wallet, err := NewWallet(validKey)
	if err != nil {
		t.Fatalf("NewWallet() error = %v", err)
	}

	address := wallet.Address()
	if address == "" {
		t.Error("Address() returned empty string")
	}

	// Neo N3 addresses start with 'N'
	if address[0] != 'N' {
		t.Errorf("Address() should start with 'N', got %q", address)
	}
}

func TestWalletScriptHash(t *testing.T) {
	validKey := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	wallet, err := NewWallet(validKey)
	if err != nil {
		t.Fatalf("NewWallet() error = %v", err)
	}

	scriptHash := wallet.ScriptHash()
	if len(scriptHash) != 20 {
		t.Errorf("ScriptHash() length = %d, want 20", len(scriptHash))
	}
}

func TestWalletScriptHashHex(t *testing.T) {
	validKey := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	wallet, err := NewWallet(validKey)
	if err != nil {
		t.Fatalf("NewWallet() error = %v", err)
	}

	scriptHashHex := wallet.ScriptHashHex()
	if len(scriptHashHex) != 40 {
		t.Errorf("ScriptHashHex() length = %d, want 40", len(scriptHashHex))
	}

	// Should be valid hex
	_, err = hex.DecodeString(scriptHashHex)
	if err != nil {
		t.Errorf("ScriptHashHex() is not valid hex: %v", err)
	}
}

func TestWalletPublicKey(t *testing.T) {
	validKey := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	wallet, err := NewWallet(validKey)
	if err != nil {
		t.Fatalf("NewWallet() error = %v", err)
	}

	pubKey := wallet.PublicKey()
	// Compressed public key should be 33 bytes
	if len(pubKey) != 33 {
		t.Errorf("PublicKey() length = %d, want 33", len(pubKey))
	}

	// First byte should be 0x02 or 0x03 (compressed format)
	if pubKey[0] != 0x02 && pubKey[0] != 0x03 {
		t.Errorf("PublicKey() first byte = %x, want 0x02 or 0x03", pubKey[0])
	}
}

func TestWalletSign(t *testing.T) {
	validKey := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	wallet, err := NewWallet(validKey)
	if err != nil {
		t.Fatalf("NewWallet() error = %v", err)
	}

	data := []byte("test message to sign")
	signature, err := wallet.Sign(data)
	if err != nil {
		t.Errorf("Sign() error = %v", err)
	}

	// Neo N3 signature should be 64 bytes (r || s)
	if len(signature) != 64 {
		t.Errorf("Sign() signature length = %d, want 64", len(signature))
	}
}

func TestWalletSignDeterministic(t *testing.T) {
	validKey := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	wallet, err := NewWallet(validKey)
	if err != nil {
		t.Fatalf("NewWallet() error = %v", err)
	}

	data := []byte("test message")

	// Sign twice - should produce same signature (RFC6979)
	sig1, err := wallet.Sign(data)
	if err != nil {
		t.Fatalf("Sign() error = %v", err)
	}

	sig2, err := wallet.Sign(data)
	if err != nil {
		t.Fatalf("Sign() error = %v", err)
	}

	if hex.EncodeToString(sig1) != hex.EncodeToString(sig2) {
		t.Error("Sign() should be deterministic (RFC6979)")
	}
}
