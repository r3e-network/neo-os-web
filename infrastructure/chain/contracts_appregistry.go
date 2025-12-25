package chain

import (
	"context"
	"fmt"
	"strings"
)

const (
	AppRegistryStatusPending  = 0
	AppRegistryStatusApproved = 1
	AppRegistryStatusDisabled = 2
)

// AppRegistryApp represents a decoded AppRegistry entry.
type AppRegistryApp struct {
	AppID           string
	Developer       string
	DeveloperPubKey []byte
	EntryURL        string
	ManifestHash    []byte
	Status          int
	AllowlistHash   []byte
}

// AppRegistryContract is a minimal wrapper for the AppRegistry contract.
type AppRegistryContract struct {
	*BaseContract
}

func NewAppRegistryContract(client *Client, hash string) *AppRegistryContract {
	return &AppRegistryContract{
		BaseContract: NewBaseContract(client, hash, nil),
	}
}

// GetApp returns the on-chain app entry or nil if not found.
func (c *AppRegistryContract) GetApp(ctx context.Context, appID string) (*AppRegistryApp, error) {
	if c == nil || c.BaseContract == nil || c.Client() == nil {
		return nil, fmt.Errorf("appregistry: client not configured")
	}
	if strings.TrimSpace(c.ContractHash()) == "" {
		return nil, fmt.Errorf("appregistry: contract hash not configured")
	}
	if strings.TrimSpace(appID) == "" {
		return nil, fmt.Errorf("appregistry: appID required")
	}

	return InvokeAndParse(c.BaseContract, ctx, "getApp", parseAppRegistryApp, NewStringParam(appID))
}

func parseAppRegistryApp(item StackItem) (*AppRegistryApp, error) {
	items, err := ParseArray(item)
	if err != nil {
		return nil, fmt.Errorf("appregistry: parse result: %w", err)
	}
	if len(items) < 7 {
		return nil, fmt.Errorf("appregistry: expected 7 fields, got %d", len(items))
	}

	appID, err := ParseStringFromItem(items[0])
	if err != nil {
		return nil, fmt.Errorf("appregistry: app_id: %w", err)
	}
	if strings.TrimSpace(appID) == "" {
		return nil, nil
	}

	developer, err := ParseHash160(items[1])
	if err != nil {
		return nil, fmt.Errorf("appregistry: developer: %w", err)
	}
	developerPubKey, err := ParseByteArray(items[2])
	if err != nil {
		return nil, fmt.Errorf("appregistry: developer_pubkey: %w", err)
	}
	entryURL, err := ParseStringFromItem(items[3])
	if err != nil {
		return nil, fmt.Errorf("appregistry: entry_url: %w", err)
	}
	manifestHash, err := ParseByteArray(items[4])
	if err != nil {
		return nil, fmt.Errorf("appregistry: manifest_hash: %w", err)
	}
	statusInt, err := ParseInteger(items[5])
	if err != nil {
		return nil, fmt.Errorf("appregistry: status: %w", err)
	}
	allowlistHash, err := ParseByteArray(items[6])
	if err != nil {
		return nil, fmt.Errorf("appregistry: allowlist_hash: %w", err)
	}

	return &AppRegistryApp{
		AppID:           appID,
		Developer:       developer,
		DeveloperPubKey: developerPubKey,
		EntryURL:        entryURL,
		ManifestHash:    manifestHash,
		Status:          int(statusInt.Int64()),
		AllowlistHash:   allowlistHash,
	}, nil
}
