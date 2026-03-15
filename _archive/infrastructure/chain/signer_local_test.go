package chain

import (
	"context"
	"testing"

	"github.com/nspcc-dev/neo-go/pkg/util"
)

func TestNewLocalTEESignerFromPrivateKeyHex(t *testing.T) {
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
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			signer, err := NewLocalTEESignerFromPrivateKeyHex(tt.keyHex)
			if (err != nil) != tt.wantErr {
				t.Errorf("NewLocalTEESignerFromPrivateKeyHex() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && signer == nil {
				t.Error("NewLocalTEESignerFromPrivateKeyHex() returned nil signer without error")
			}
		})
	}
}

func TestLocalTEESignerScriptHash(t *testing.T) {
	validKey := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	signer, err := NewLocalTEESignerFromPrivateKeyHex(validKey)
	if err != nil {
		t.Fatalf("NewLocalTEESignerFromPrivateKeyHex() error = %v", err)
	}

	scriptHash := signer.ScriptHash()
	// Script hash should not be zero
	if scriptHash.Equals(util.Uint160{}) {
		t.Error("ScriptHash() returned zero value")
	}
}

func TestLocalTEESignerScriptHashNil(t *testing.T) {
	var signer *LocalTEESigner
	scriptHash := signer.ScriptHash()
	// Should return zero value without panic
	if !scriptHash.Equals(util.Uint160{}) {
		t.Error("ScriptHash() on nil should return zero Uint160")
	}
}

func TestLocalTEESignerGetVerificationScript(t *testing.T) {
	validKey := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	signer, err := NewLocalTEESignerFromPrivateKeyHex(validKey)
	if err != nil {
		t.Fatalf("NewLocalTEESignerFromPrivateKeyHex() error = %v", err)
	}

	script := signer.GetVerificationScript()
	if len(script) == 0 {
		t.Error("GetVerificationScript() returned empty script")
	}
}

func TestLocalTEESignerGetVerificationScriptNil(t *testing.T) {
	var signer *LocalTEESigner
	script := signer.GetVerificationScript()
	if script != nil {
		t.Error("GetVerificationScript() on nil should return nil")
	}
}

func TestLocalTEESignerSign(t *testing.T) {
	validKey := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	signer, err := NewLocalTEESignerFromPrivateKeyHex(validKey)
	if err != nil {
		t.Fatalf("NewLocalTEESignerFromPrivateKeyHex() error = %v", err)
	}

	data := []byte("test message to sign")
	signature, err := signer.Sign(context.Background(), data)
	if err != nil {
		t.Errorf("Sign() error = %v", err)
	}

	// Neo N3 signature should be 64 bytes
	if len(signature) != 64 {
		t.Errorf("Sign() signature length = %d, want 64", len(signature))
	}
}

func TestLocalTEESignerSignNil(t *testing.T) {
	var signer *LocalTEESigner
	_, err := signer.Sign(context.Background(), []byte("test"))
	if err == nil {
		t.Error("Sign() on nil signer should return error")
	}
}

func TestLocalTEESignerSignTxNil(t *testing.T) {
	var signer *LocalTEESigner
	err := signer.SignTx(0, nil)
	if err == nil {
		t.Error("SignTx() on nil signer should return error")
	}
}
