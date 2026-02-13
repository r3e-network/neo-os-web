package chain

import (
	"context"
	"crypto/elliptic"
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/nspcc-dev/neo-go/pkg/config/netmode"
	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
	"github.com/nspcc-dev/neo-go/pkg/crypto/hash"
	neokeys "github.com/nspcc-dev/neo-go/pkg/crypto/keys"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/vm/opcode"

	gsclient "github.com/R3E-Network/neo-miniapps-platform/infrastructure/globalsigner/client"
)

// GlobalSignerSigner implements TEESigner using the GlobalSigner infrastructure marble.
// It never holds long-lived private key material locally.
type GlobalSignerSigner struct {
	client             *gsclient.Client
	pubKey             *neokeys.PublicKey
	scriptHash         util.Uint160
	verificationScript []byte
}

// NewGlobalSignerSigner constructs a signer backed by GlobalSigner.
// It fetches the active public key via /attestation to compute ScriptHash and verification script.
func NewGlobalSignerSigner(ctx context.Context, client *gsclient.Client) (*GlobalSignerSigner, error) {
	if client == nil {
		return nil, fmt.Errorf("globalsigner client required")
	}

	att, err := client.GetAttestation(ctx)
	if err != nil {
		return nil, fmt.Errorf("get attestation: %w", err)
	}

	pubKeyBytes, err := hex.DecodeString(strings.TrimPrefix(strings.TrimPrefix(att.PubKeyHex, "0x"), "0X"))
	if err != nil {
		return nil, fmt.Errorf("decode pubkey: %w", err)
	}
	if len(pubKeyBytes) != 33 {
		return nil, fmt.Errorf("invalid pubkey length: %d", len(pubKeyBytes))
	}

	pubKey, err := neokeys.NewPublicKeyFromBytes(pubKeyBytes, elliptic.P256())
	if err != nil {
		return nil, fmt.Errorf("parse pubkey: %w", err)
	}

	return &GlobalSignerSigner{
		client:             client,
		pubKey:             pubKey,
		scriptHash:         pubKey.GetScriptHash(),
		verificationScript: pubKey.GetVerificationScript(),
	}, nil
}

func (s *GlobalSignerSigner) ScriptHash() util.Uint160 {
	if s == nil {
		return util.Uint160{}
	}
	return s.scriptHash
}

func (s *GlobalSignerSigner) GetVerificationScript() []byte {
	if s == nil {
		return nil
	}
	return s.verificationScript
}

// SignTx signs tx and updates its witnesses, matching neo-go's expected witness format.
// The transaction MUST already contain a signer entry for this signer's ScriptHash.
func (s *GlobalSignerSigner) SignTx(net netmode.Magic, tx *transaction.Transaction) error {
	if s == nil || s.client == nil {
		return fmt.Errorf("globalsigner signer not configured")
	}
	if tx == nil {
		return fmt.Errorf("transaction required")
	}

	pos := -1
	for i := range tx.Signers {
		if tx.Signers[i].Account.Equals(s.scriptHash) {
			pos = i
			break
		}
	}
	if pos == -1 {
		return fmt.Errorf("transaction is not signed by this account")
	}
	if len(tx.Scripts) < pos {
		return fmt.Errorf("transaction is not yet signed by the previous signer")
	}
	if len(tx.Scripts) == pos {
		tx.Scripts = append(tx.Scripts, transaction.Witness{
			VerificationScript: s.verificationScript,
		})
	} else if len(tx.Scripts[pos].VerificationScript) == 0 {
		tx.Scripts[pos].VerificationScript = s.verificationScript
	}

	signedData := hash.GetSignedData(uint32(net), tx)
	resp, err := s.client.SignRaw(context.Background(), &gsclient.SignRawRequest{
		Data: hex.EncodeToString(signedData),
	})
	if err != nil {
		return fmt.Errorf("globalsigner sign tx: %w", err)
	}

	signature, err := hex.DecodeString(strings.TrimPrefix(strings.TrimPrefix(resp.Signature, "0x"), "0X"))
	if err != nil {
		return fmt.Errorf("decode tx signature: %w", err)
	}
	if len(signature) != neokeys.SignatureLen {
		return fmt.Errorf("invalid signature length: %d", len(signature))
	}

	invocation := []byte{byte(opcode.PUSHDATA1), neokeys.SignatureLen}
	invocation = append(invocation, signature...)
	tx.Scripts[pos].InvocationScript = invocation

	return nil
}

// Sign signs an arbitrary payload using GlobalSigner raw signing.
func (s *GlobalSignerSigner) Sign(ctx context.Context, data []byte) ([]byte, error) {
	if s == nil || s.client == nil {
		return nil, fmt.Errorf("globalsigner signer not configured")
	}
	if len(data) == 0 {
		return nil, fmt.Errorf("data required")
	}

	resp, err := s.client.SignRaw(ctx, &gsclient.SignRawRequest{
		Data: hex.EncodeToString(data),
	})
	if err != nil {
		return nil, fmt.Errorf("globalsigner sign: %w", err)
	}

	sig, err := hex.DecodeString(resp.Signature)
	if err != nil {
		return nil, fmt.Errorf("decode signature: %w", err)
	}
	return sig, nil
}
