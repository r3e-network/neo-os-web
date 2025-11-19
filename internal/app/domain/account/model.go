package account

import "time"

// Account represents a logical tenant or owner of resources within the service
// layer.
type Account struct {
	ID        string
	Owner     string
	Metadata  map[string]string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// WorkspaceWallet captures a wallet registered to a workspace/account.
type WorkspaceWallet struct {
	ID            string
	WorkspaceID   string
	WalletAddress string
	Label         string
	Status        string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}
