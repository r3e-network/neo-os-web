package chain

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ChainType identifies the blockchain protocol family.
type ChainType string

const (
	ChainTypeNeoN3 ChainType = "neo-n3"
	ChainTypeEVM   ChainType = "evm"
)

// NativeCurrency describes the native token of a chain.
type NativeCurrency struct {
	Name     string `json:"name"`
	Symbol   string `json:"symbol"`
	Decimals int    `json:"decimals"`
}

// ChainConfig holds the full configuration for a single blockchain network.
type ChainConfig struct {
	ID             string            `json:"id"`
	Name           string            `json:"name"`
	NameZh         string            `json:"name_zh"`
	Type           ChainType         `json:"type"`
	IsTestnet      bool              `json:"is_testnet"`
	Status         string            `json:"status"`
	Icon           string            `json:"icon"`
	Color          string            `json:"color"`
	NativeCurrency NativeCurrency    `json:"native_currency"`
	ExplorerURL    string            `json:"explorer_url"`
	BlockTime      int               `json:"block_time"`
	NetworkMagic   uint32            `json:"network_magic"`
	ChainID        uint64            `json:"chain_id"`
	RPCUrls        []string          `json:"rpc_urls"`
	WSUrls         []string          `json:"ws_urls"`
	Contracts      map[string]string `json:"contracts"`
	Metadata       map[string]any    `json:"metadata"`
}

// ChainsConfig is the top-level wrapper for multi-chain configuration.
// Named ChainsConfig (not Config) to avoid collision with the RPC client Config in this package.
type ChainsConfig struct {
	Chains []ChainConfig `json:"chains"`
}

// DefaultChainsConfigPath returns the default path for the chains JSON file.
func DefaultChainsConfigPath() string {
	return filepath.Join("config", "chains.json")
}

// LoadChainsConfig loads chain configuration from env vars or the default path.
func LoadChainsConfig() (*ChainsConfig, error) {
	if raw := strings.TrimSpace(os.Getenv("CHAINS_CONFIG_JSON")); raw != "" {
		return LoadChainsConfigFromBytes([]byte(raw))
	}
	if path := strings.TrimSpace(os.Getenv("CHAINS_CONFIG_PATH")); path != "" {
		return LoadChainsConfigFromPath(path)
	}
	return LoadChainsConfigFromPath(DefaultChainsConfigPath())
}

// LoadChainsConfigFromPath reads and parses chain configuration from a file.
func LoadChainsConfigFromPath(path string) (*ChainsConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read chains config: %w", err)
	}
	return LoadChainsConfigFromBytes(data)
}

// LoadChainsConfigFromBytes parses chain configuration from raw JSON bytes.
func LoadChainsConfigFromBytes(data []byte) (*ChainsConfig, error) {
	if len(data) == 0 {
		return nil, errors.New("chains config is empty")
	}
	var cfg ChainsConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse chains config: %w", err)
	}
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	return &cfg, nil
}

// Validate checks that at least one chain is configured and each chain is valid.
func (c *ChainsConfig) Validate() error {
	if c == nil || len(c.Chains) == 0 {
		return errors.New("no chains configured")
	}
	for _, ch := range c.Chains {
		if err := ch.Validate(); err != nil {
			return err
		}
	}
	return nil
}

// GetChain returns the ChainConfig with the given ID, if present.
func (c *ChainsConfig) GetChain(id string) (*ChainConfig, bool) {
	if c == nil {
		return nil, false
	}
	for i := range c.Chains {
		if c.Chains[i].ID == id {
			return &c.Chains[i], true
		}
	}
	return nil, false
}

// ActiveChains returns all chains whose status is empty or "active".
func (c *ChainsConfig) ActiveChains() []ChainConfig {
	if c == nil {
		return nil
	}
	var out []ChainConfig
	for _, ch := range c.Chains {
		if ch.Status == "" || strings.EqualFold(ch.Status, "active") {
			out = append(out, ch)
		}
	}
	return out
}

// Validate checks that a single chain entry has the required fields.
func (c ChainConfig) Validate() error {
	if strings.TrimSpace(c.ID) == "" {
		return errors.New("chain id is required")
	}
	if c.Type != ChainTypeNeoN3 {
		return fmt.Errorf("chain %s has invalid type %q (only neo-n3 is supported)", c.ID, c.Type)
	}
	if len(c.RPCUrls) == 0 {
		return fmt.Errorf("chain %s must have at least one rpc_url", c.ID)
	}
	return nil
}

// Contract returns the contract address for the given name, or empty string.
func (c ChainConfig) Contract(name string) string {
	if c.Contracts == nil {
		return ""
	}
	return strings.TrimSpace(c.Contracts[name])
}
