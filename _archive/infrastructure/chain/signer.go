package chain

import (
	"context"

	"github.com/nspcc-dev/neo-go/pkg/config/netmode"
	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
	"github.com/nspcc-dev/neo-go/pkg/util"
)

// TxSigner abstracts Neo N3 transaction signing.
//
// It is intentionally compatible with `neo-go/pkg/wallet.Account` to allow
// using a local private key signer while also supporting remote/TEE signers.
type TxSigner interface {
	ScriptHash() util.Uint160
	GetVerificationScript() []byte
	SignTx(net netmode.Magic, tx *transaction.Transaction) error
}

// MessageSigner abstracts signing arbitrary byte payloads (typically used for
// on-chain parameter signatures verified by contracts).
type MessageSigner interface {
	Sign(ctx context.Context, data []byte) ([]byte, error)
}

// TEESigner is the combined signer used by TEE components that both submit
// chain transactions and produce contract-verifiable signatures.
type TEESigner interface {
	TxSigner
	MessageSigner
}
