package app

import "github.com/R3E-Network/service_layer/internal/app/storage/memory"

// NewMemoryStoresForTest constructs a fully populated in-memory store set.
// Intended for unit tests; production deployments should use Supabase Postgres.
func NewMemoryStoresForTest() Stores {
	mem := memory.New()
	return Stores{
		Accounts:         mem,
		Functions:        mem,
		Triggers:         mem,
		GasBank:          mem,
		Automation:       mem,
		PriceFeeds:       mem,
		DataFeeds:        mem,
		DataStreams:      mem,
		DataLink:         mem,
		DTA:              mem,
		Confidential:     mem,
		Oracle:           mem,
		Secrets:          mem,
		CRE:              mem,
		CCIP:             mem,
		VRF:              mem,
		WorkspaceWallets: mem,
	}
}
