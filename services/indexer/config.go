// Package indexer provides Neo N3 blockchain transaction indexing with VM execution tracing.
// IMPORTANT: This module uses ISOLATED Supabase credentials (INDEXER_ prefix) to prevent
// credential mixing with the main MiniApp platform.
package indexer

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Network represents the blockchain network type.
type Network string

const (
	NetworkMainnet      Network = "mainnet"
	NetworkTestnet      Network = "testnet"
	NetworkNeoXMainnet  Network = "neox-mainnet"
	NetworkNeoXTestnet  Network = "neox-testnet"
	NetworkEthereum     Network = "ethereum"
	NetworkSepolia      Network = "sepolia"
	NetworkPolygon      Network = "polygon"
	NetworkPolygonAmoy  Network = "polygon-amoy"
)

// Config holds the indexer configuration with isolated credentials.
type Config struct {
	// Supabase configuration (ISOLATED - uses INDEXER_ prefix)
	SupabaseURL        string
	SupabaseServiceKey string

	// PostgreSQL direct connection (ISOLATED)
	PostgresHost     string
	PostgresPort     int
	PostgresDB       string
	PostgresUser     string
	PostgresPassword string
	PostgresSSLMode  string

	// Neo RPC endpoints
	MainnetRPCURL string
	TestnetRPCURL string

	// EVM RPC endpoints
	NeoXMainnetRPCURL string
	NeoXTestnetRPCURL string
	EthereumRPCURL    string
	SepoliaRPCURL     string
	PolygonRPCURL     string
	AmoyRPCURL        string

	// Indexer settings
	Networks   []Network // Support multiple networks
	StartBlock uint64
	BatchSize  int
	Workers    int

	// Sync settings
	SyncInterval   time.Duration
	RetryInterval  time.Duration
	MaxRetries     int
	RequestTimeout time.Duration
}

// DefaultConfig returns a Config with default values.
func DefaultConfig() *Config {
	return &Config{
		PostgresPort:    5432,
		PostgresDB:      "postgres",
		PostgresUser:    "postgres",
		PostgresSSLMode: "require",
		Networks:        []Network{NetworkTestnet}, // Default to testnet only
		StartBlock:      0,
		BatchSize:       100,
		Workers:         4,
		SyncInterval:    15 * time.Second,
		RetryInterval:   5 * time.Second,
		MaxRetries:      3,
		RequestTimeout:  30 * time.Second,
	}
}

// LoadFromEnv loads configuration from environment variables.
// All variables use INDEXER_ prefix to isolate from main platform.
func LoadFromEnv() (*Config, error) {
	cfg := DefaultConfig()

	// Supabase (ISOLATED)
	cfg.SupabaseURL = os.Getenv("INDEXER_SUPABASE_URL")
	cfg.SupabaseServiceKey = os.Getenv("INDEXER_SUPABASE_SERVICE_KEY")

	// PostgreSQL (ISOLATED)
	if host := os.Getenv("INDEXER_POSTGRES_HOST"); host != "" {
		cfg.PostgresHost = host
	}
	if port := os.Getenv("INDEXER_POSTGRES_PORT"); port != "" {
		if p, err := strconv.Atoi(port); err == nil {
			cfg.PostgresPort = p
		}
	}
	if db := os.Getenv("INDEXER_POSTGRES_DB"); db != "" {
		cfg.PostgresDB = db
	}
	if user := os.Getenv("INDEXER_POSTGRES_USER"); user != "" {
		cfg.PostgresUser = user
	}
	if pass := os.Getenv("INDEXER_POSTGRES_PASSWORD"); pass != "" {
		cfg.PostgresPassword = pass
	}
	if ssl := os.Getenv("INDEXER_POSTGRES_SSLMODE"); ssl != "" {
		cfg.PostgresSSLMode = ssl
	}

	// Neo RPC
	cfg.MainnetRPCURL = os.Getenv("INDEXER_NEO_MAINNET_RPC")
	if cfg.MainnetRPCURL == "" {
		cfg.MainnetRPCURL = "https://mainnet1.neo.coz.io:443"
	}
	cfg.TestnetRPCURL = os.Getenv("INDEXER_NEO_TESTNET_RPC")
	if cfg.TestnetRPCURL == "" {
		cfg.TestnetRPCURL = "https://testnet1.neo.coz.io:443"
	}

	// EVM RPC
	cfg.NeoXMainnetRPCURL = os.Getenv("INDEXER_NEOX_MAINNET_RPC")
	cfg.NeoXTestnetRPCURL = os.Getenv("INDEXER_NEOX_TESTNET_RPC")
	cfg.EthereumRPCURL = os.Getenv("INDEXER_ETHEREUM_RPC")
	cfg.SepoliaRPCURL = os.Getenv("INDEXER_SEPOLIA_RPC")
	cfg.PolygonRPCURL = os.Getenv("INDEXER_POLYGON_RPC")
	cfg.AmoyRPCURL = os.Getenv("INDEXER_AMOY_RPC")

	// Network selection - supports "both", "mainnet", "testnet", or comma-separated
	if net := os.Getenv("INDEXER_NETWORKS"); net != "" {
		cfg.Networks = parseNetworks(net)
	} else if net := os.Getenv("INDEXER_NETWORK"); net != "" {
		cfg.Networks = parseNetworks(net)
	}

	// Indexer settings
	if start := os.Getenv("INDEXER_START_BLOCK"); start != "" {
		if s, err := strconv.ParseUint(start, 10, 64); err == nil {
			cfg.StartBlock = s
		}
	}
	if batch := os.Getenv("INDEXER_BATCH_SIZE"); batch != "" {
		if b, err := strconv.Atoi(batch); err == nil {
			cfg.BatchSize = b
		}
	}
	if workers := os.Getenv("INDEXER_WORKERS"); workers != "" {
		if w, err := strconv.Atoi(workers); err == nil {
			cfg.Workers = w
		}
	}

	return cfg, nil
}

// Validate checks if the configuration is valid.
func (c *Config) Validate() error {
	if c.SupabaseURL == "" && c.PostgresHost == "" {
		return fmt.Errorf("either INDEXER_SUPABASE_URL or INDEXER_POSTGRES_HOST required")
	}
	if c.PostgresHost != "" && c.PostgresPassword == "" {
		return fmt.Errorf("INDEXER_POSTGRES_PASSWORD required when using direct connection")
	}
	if len(c.Networks) == 0 {
		return fmt.Errorf("at least one network required")
	}
	// Validation of network values omitted for brevity as they are dynamic strings now
	if c.BatchSize < 1 || c.BatchSize > 1000 {
		return fmt.Errorf("batch size must be between 1 and 1000")
	}
	if c.Workers < 1 || c.Workers > 32 {
		return fmt.Errorf("workers must be between 1 and 32")
	}
	return nil
}

// GetRPCURL returns the RPC URL for the specified network.
func (c *Config) GetRPCURL(network Network) string {
	switch network {
	case NetworkMainnet:
		return c.MainnetRPCURL
	case NetworkTestnet:
		return c.TestnetRPCURL
	case NetworkNeoXMainnet:
		return c.NeoXMainnetRPCURL
	case NetworkNeoXTestnet:
		return c.NeoXTestnetRPCURL
	case NetworkEthereum:
		return c.EthereumRPCURL
	case NetworkSepolia:
		return c.SepoliaRPCURL
	case NetworkPolygon:
		return c.PolygonRPCURL
	case NetworkPolygonAmoy:
		return c.AmoyRPCURL
	}
	return ""
}

// GetPostgresDSN returns the PostgreSQL connection string.
func (c *Config) GetPostgresDSN() string {
	return fmt.Sprintf(
		"host=%s port=%d dbname=%s user=%s password=%s sslmode=%s",
		c.PostgresHost, c.PostgresPort, c.PostgresDB,
		c.PostgresUser, c.PostgresPassword, c.PostgresSSLMode,
	)
}

// parseNetworks parses network string into slice.
// Supports: "both", "mainnet", "testnet", "neox-mainnet", "ethereum", etc.
func parseNetworks(s string) []Network {
	s = strings.ToLower(strings.TrimSpace(s))
	if s == "both" || s == "all" {
		// Return all Neo chains by default if "all" is used, or maybe just main/test
		return []Network{NetworkMainnet, NetworkTestnet}
	}
	var networks []Network
	for _, n := range strings.Split(s, ",") {
		n = strings.TrimSpace(n)
		switch n {
		case "mainnet":
			networks = append(networks, NetworkMainnet)
		case "testnet":
			networks = append(networks, NetworkTestnet)
		case "neox-mainnet":
			networks = append(networks, NetworkNeoXMainnet)
		case "neox-testnet":
			networks = append(networks, NetworkNeoXTestnet)
		case "ethereum":
			networks = append(networks, NetworkEthereum)
		case "sepolia":
			networks = append(networks, NetworkSepolia)
		case "polygon":
			networks = append(networks, NetworkPolygon)
		case "polygon-amoy":
			networks = append(networks, NetworkPolygonAmoy)
		}
	}
	if len(networks) == 0 {
		return []Network{NetworkTestnet}
	}
	return networks
}
