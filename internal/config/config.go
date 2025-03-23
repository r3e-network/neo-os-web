package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/joeshaw/envdecode"
	"github.com/joho/godotenv"
	"gopkg.in/yaml.v3"
)

// Config represents the application configuration
type Config struct {
	Environment string           `mapstructure:"environment"`
	Server      ServerConfig     `mapstructure:"server"`
	Database    DatabaseConfig   `mapstructure:"database"`
	Blockchain  BlockchainConfig `mapstructure:"blockchain"`
	Functions   FunctionsConfig  `mapstructure:"functions"`
	Secrets     SecretsConfig    `mapstructure:"secrets"`
	Oracle      OracleConfig     `mapstructure:"oracle"`
	PriceFeed   PriceFeedConfig  `mapstructure:"price_feed"`
	Automation  AutomationConfig `mapstructure:"automation"`
	GasBank     GasBankConfig    `mapstructure:"gas_bank"`
	TEE         TEEConfig        `mapstructure:"tee"`
	Monitoring  MonitoringConfig `mapstructure:"monitoring"`
}

// ServerConfig represents the server configuration
type ServerConfig struct {
	Host         string          `mapstructure:"host"`
	Port         int             `mapstructure:"port"`
	ReadTimeout  time.Duration   `mapstructure:"read_timeout"`
	WriteTimeout time.Duration   `mapstructure:"write_timeout"`
	IdleTimeout  time.Duration   `mapstructure:"idle_timeout"`
	RateLimit    RateLimitConfig `mapstructure:"rate_limit"`
	CORS         CORSConfig      `mapstructure:"cors"`
	Mode         string          `mapstructure:"mode"`
	Timeout      int             `mapstructure:"timeout"`
}

// DatabaseConfig represents the database configuration
type DatabaseConfig struct {
	Driver          string `mapstructure:"driver"`
	DSN             string `mapstructure:"dsn"`
	MaxOpenConns    int    `mapstructure:"max_open_conns"`
	MaxIdleConns    int    `mapstructure:"max_idle_conns"`
	ConnMaxLifetime int    `mapstructure:"conn_max_lifetime"`
}

// BlockchainConfig represents the blockchain configuration
type BlockchainConfig struct {
	Network     string `mapstructure:"network"`
	RPCEndpoint string `mapstructure:"rpc_endpoint"`
	WSEndpoint  string `mapstructure:"ws_endpoint"`
	PrivateKey  string `mapstructure:"private_key"`
}

// FunctionsConfig represents the functions configuration
type FunctionsConfig struct {
	MaxMemory        int `mapstructure:"max_memory"`
	ExecutionTimeout int `mapstructure:"execution_timeout"`
	MaxConcurrency   int `mapstructure:"max_concurrency"`
}

// SecretsConfig represents the secrets configuration
type SecretsConfig struct {
	KMSProvider string `mapstructure:"kms_provider"`
	KeyID       string `mapstructure:"key_id"`
	Region      string `mapstructure:"region"`
}

// OracleConfig represents the oracle service configuration
type OracleConfig struct {
	UpdateInterval int `mapstructure:"update_interval"`
	MaxDataSources int `mapstructure:"max_data_sources"`
}

// PriceFeedConfig represents the price feed service configuration
type PriceFeedConfig struct {
	UpdateInterval int               `mapstructure:"update_interval"`
	Sources        map[string]string `mapstructure:"sources"`
}

// AutomationConfig represents the automation service configuration
type AutomationConfig struct {
	MaxTriggers int `mapstructure:"max_triggers"`
	MinInterval int `mapstructure:"min_interval"`
}

// GasBankConfig represents the gas bank service configuration
type GasBankConfig struct {
	MaxWithdrawal string `mapstructure:"max_withdrawal"`
	FeePercentage int    `mapstructure:"fee_percentage"`
}

// TEEConfig represents the TEE configuration
type TEEConfig struct {
	Enabled             bool   `mapstructure:"enabled"`
	Provider            string `mapstructure:"provider"`
	AttestationEndpoint string `mapstructure:"attestation_endpoint"`
}

// MonitoringConfig represents the monitoring configuration
type MonitoringConfig struct {
	Enabled         bool   `mapstructure:"enabled"`
	PrometheusPort  int    `mapstructure:"prometheus_port"`
	MetricsEndpoint string `mapstructure:"metrics_endpoint"`
}

// RateLimitConfig represents the rate limiting configuration
type RateLimitConfig struct {
	Enabled        bool  `mapstructure:"enabled"`
	RequestsPerIP  int   `mapstructure:"requests_per_ip"`
	RequestsPerKey int   `mapstructure:"requests_per_key"`
	BurstIP        int   `mapstructure:"burst_ip"`
	BurstKey       int   `mapstructure:"burst_key"`
	TimeWindowSec  int64 `mapstructure:"time_window_sec"`
}

// CORSConfig represents the CORS configuration
type CORSConfig struct {
	AllowedOrigins []string `mapstructure:"allowed_origins"`
	AllowedMethods []string `mapstructure:"allowed_methods"`
	AllowedHeaders []string `mapstructure:"allowed_headers"`
	MaxAge         int      `mapstructure:"max_age"`
}

// New creates a new config instance with default values
func New() *Config {
	return &Config{
		Environment: "development",
		Server: ServerConfig{
			Host:         "0.0.0.0",
			Port:         8080,
			ReadTimeout:  60 * time.Second,
			WriteTimeout: 60 * time.Second,
			IdleTimeout:  120 * time.Second,
			RateLimit: RateLimitConfig{
				Enabled:        true,
				RequestsPerIP:  100,  // 100 requests per minute for IP-based limiting
				RequestsPerKey: 1000, // 1000 requests per minute for API key-based limiting
				BurstIP:        20,   // Allow bursts of up to 20 requests
				BurstKey:       100,  // Allow bursts of up to 100 requests for API keys
				TimeWindowSec:  60,   // 1 minute window
			},
			CORS: CORSConfig{
				AllowedOrigins: []string{"*"},
				AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
				AllowedHeaders: []string{"Origin", "Content-Type", "Authorization", "X-API-Key"},
				MaxAge:         86400,
			},
			Mode:    "development",
			Timeout: 60,
		},
		Database: DatabaseConfig{
			Driver:          "postgres",
			MaxOpenConns:    10,
			MaxIdleConns:    5,
			ConnMaxLifetime: 300, // 5 minutes
		},
		Blockchain: BlockchainConfig{
			Network:     "testnet",
			RPCEndpoint: "http://localhost:10332",
			WSEndpoint:  "ws://localhost:10334",
		},
		Functions: FunctionsConfig{
			MaxMemory:        128, // MB
			ExecutionTimeout: 30,  // seconds
			MaxConcurrency:   10,
		},
		Oracle: OracleConfig{
			UpdateInterval: 60, // seconds
			MaxDataSources: 100,
		},
		PriceFeed: PriceFeedConfig{
			UpdateInterval: 60, // seconds
			Sources: map[string]string{
				"default": "https://api.coingecko.com/api/v3",
			},
		},
		Automation: AutomationConfig{
			MaxTriggers: 100,
			MinInterval: 5, // seconds
		},
		GasBank: GasBankConfig{
			MaxWithdrawal: "10000",
			FeePercentage: 1,
		},
		TEE: TEEConfig{
			Enabled:  true,
			Provider: "azure",
		},
		Monitoring: MonitoringConfig{
			Enabled:        true,
			PrometheusPort: 9090,
		},
	}
}

// ConnectionString returns a PostgreSQL connection string
func (c DatabaseConfig) ConnectionString() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.User, c.Password, c.Name, c.SSLMode,
	)
}

// RedisAddress returns the Redis server address
func (c RedisConfig) RedisAddress() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}

// Load loads configuration from file and environment variables
func Load() (*Config, error) {
	// Load .env file if it exists
	_ = godotenv.Load()

	// Default config file path
	configPath := os.Getenv("CONFIG_FILE")
	if configPath == "" {
		configPath = "configs/config.yaml"
	}

	// Create config instance with default values
	cfg := &Config{}

	// Try to load from config file
	if err := loadFromFile(configPath, cfg); err != nil {
		fmt.Printf("Warning: Could not load config file: %v\n", err)
	}

	// Override with environment variables
	if err := envdecode.Decode(cfg); err != nil {
		return nil, fmt.Errorf("failed to decode environment variables: %w", err)
	}

	return cfg, nil
}

// loadFromFile loads configuration from YAML file
func loadFromFile(filePath string, cfg *Config) error {
	// Expand file path
	expandedPath, err := filepath.Abs(filePath)
	if err != nil {
		return err
	}

	// Read config file
	data, err := os.ReadFile(expandedPath)
	if err != nil {
		return err
	}

	// Parse YAML
	err = yaml.Unmarshal(data, cfg)
	if err != nil {
		return err
	}

	return nil
}

// IsDevelopment returns true if the server is in development mode
func (c ServerConfig) IsDevelopment() bool {
	return strings.ToLower(c.Mode) == "development"
}

// IsProduction returns true if the server is in production mode
func (c ServerConfig) IsProduction() bool {
	return strings.ToLower(c.Mode) == "production"
}
