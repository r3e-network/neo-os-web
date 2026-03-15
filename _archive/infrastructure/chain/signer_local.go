package chain

import (
	"context"
	"fmt"

	"github.com/nspcc-dev/neo-go/pkg/config/netmode"
	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

// LocalTEESigner implements TEESigner using a locally available private key.
// It is primarily intended for local development/testing or transitional setups.
type LocalTEESigner struct {
	account *wallet.Account
	legacy  *Wallet
}

// NewLocalTEESignerFromPrivateKeyHex constructs a local signer from a hex-encoded private key.
func NewLocalTEESignerFromPrivateKeyHex(privateKeyHex string) (*LocalTEESigner, error) {
	account, err := AccountFromPrivateKey(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("create account: %w", err)
	}

	legacyWallet, err := NewWallet(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("create legacy wallet: %w", err)
	}

	return &LocalTEESigner{
		account: account,
		legacy:  legacyWallet,
	}, nil
}

func (s *LocalTEESigner) ScriptHash() util.Uint160 {
	if s == nil || s.account == nil {
		return util.Uint160{}
	}
	return s.account.ScriptHash()
}

func (s *LocalTEESigner) GetVerificationScript() []byte {
	if s == nil || s.account == nil {
		return nil
	}
	return s.account.GetVerificationScript()
}

func (s *LocalTEESigner) SignTx(net netmode.Magic, tx *transaction.Transaction) error {
	if s == nil || s.account == nil {
		return fmt.Errorf("local signer account not configured")
	}
	return s.account.SignTx(net, tx)
}

func (s *LocalTEESigner) Sign(_ context.Context, data []byte) ([]byte, error) {
	if s == nil || s.legacy == nil {
		return nil, fmt.Errorf("local signer legacy wallet not configured")
	}
	return s.legacy.Sign(data)
}
