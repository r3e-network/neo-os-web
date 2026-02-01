package chains

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type ChainType string

const (
	ChainTypeNeoN3 ChainType = "neo-n3"
)

type NativeCurrency struct {
	Name     string `json:"name"`
	Symbol   string `json:"symbol"`
	Decimals int    `json:"decimals"`
}

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

type Config struct {
	Chains []ChainConfig `json:"chains"`
}

func DefaultConfigPath() string {
	return filepath.Join("config", "chains.json")
}

func LoadConfig() (*Config, error) {
	if raw := strings.TrimSpace(os.Getenv("CHAINS_CONFIG_JSON")); raw != "" {
		return LoadConfigFromBytes([]byte(raw))
	}
	if path := strings.TrimSpace(os.Getenv("CHAINS_CONFIG_PATH")); path != "" {
		return LoadConfigFromPath(path)
	}
	return LoadConfigFromPath(DefaultConfigPath())
}

func LoadConfigFromPath(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read chains config: %w", err)
	}
	return LoadConfigFromBytes(data)
}

func LoadConfigFromBytes(data []byte) (*Config, error) {
	if len(data) == 0 {
		return nil, errors.New("chains config is empty")
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse chains config: %w", err)
	}
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func (c *Config) Validate() error {
	if c == nil || len(c.Chains) == 0 {
		return errors.New("no chains configured")
	}
	for _, chain := range c.Chains {
		if err := chain.Validate(); err != nil {
			return err
		}
	}
	return nil
}

func (c *Config) GetChain(id string) (*ChainConfig, bool) {
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

func (c *Config) ActiveChains() []ChainConfig {
	if c == nil {
		return nil
	}
	var out []ChainConfig
	for _, chain := range c.Chains {
		if chain.Status == "" || strings.EqualFold(chain.Status, "active") {
			out = append(out, chain)
		}
	}
	return out
}

func (c ChainConfig) Validate() error {
	if strings.TrimSpace(c.ID) == "" {
		return errors.New("chain id is required")
	}
	if c.Type != ChainTypeNeoN3 {
		return fmt.Errorf("chain %s has invalid type %q", c.ID, c.Type)
	}
	if len(c.RPCUrls) == 0 {
		return fmt.Errorf("chain %s must have at least one rpc_url", c.ID)
	}
	return nil
}

func (c ChainConfig) Contract(name string) string {
	if c.Contracts == nil {
		return ""
	}
	return strings.TrimSpace(c.Contracts[name])
}
