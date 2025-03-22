package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/joho/godotenv"
	"github.com/joeshaw/envdecode"
	"gopkg.in/yaml.v3"
)

// Config holds all configuration for the service
type Config struct {
	Server     ServerConfig     `yaml:"server"`
	Database   DatabaseConfig   `yaml:"database"`
	Redis      RedisConfig      `yaml:"redis"`
	Neo        NeoConfig        `yaml:"neo"`
	TEE        TEEConfig        `yaml:"tee"`
	Auth       AuthConfig       `yaml:"auth"`
	Services   ServicesConfig   `yaml:"services"`
	Monitoring MonitoringConfig `yaml:"monitoring"`
	Features   FeaturesConfig   `yaml:"features"`
}

// ServerConfig holds HTTP server configuration
type ServerConfig struct {
	Port    int    `yaml:"port" env:"SERVER_PORT,default=8080"`
	Host    string `yaml:"host" env:"SERVER_HOST,default=127.0.0.1"`
	Mode    string `yaml:"mode" env:"SERVER_MODE,default=development"`
	Timeout int    `yaml:"timeout" env:"SERVER_TIMEOUT,default=30"`
	CORS    CORSConfig `yaml:"cors"`
}

// CORSConfig holds CORS configuration
type CORSConfig struct {
	AllowedOrigins []string `yaml:"allowed_origins" env:"CORS_ALLOWED_ORIGINS,default=*"`
	AllowedMethods []string `yaml:"allowed_methods" env:"CORS_ALLOWED_METHODS,default=GET,POST,PUT,DELETE,OPTIONS"`
	AllowedHeaders []string `yaml:"allowed_headers" env:"CORS_ALLOWED_HEADERS,default=Content-Type,Authorization"`
	MaxAge         int      `yaml:"max_age" env:"CORS_MAX_AGE,default=86400"`
}

// DatabaseConfig holds database configuration
type DatabaseConfig struct {
	Host            string `yaml:"host" env:"DB_HOST,default=localhost"`
	Port            int    `yaml:"port" env:"DB_PORT,default=5432"`
	User            string `yaml:"user" env:"DB_USER,default=postgres"`
	Password        string `yaml:"password" env:"DB_PASSWORD,default=postgres"`
	Name            string `yaml:"name" env:"DB_NAME,default=service_layer"`
	SSLMode         string `yaml:"ssl_mode" env:"DB_SSL_MODE,default=disable"`
	MaxOpenConns    int    `yaml:"max_open_conns" env:"DB_MAX_OPEN_CONNS,default=25"`
	MaxIdleConns    int    `yaml:"max_idle_conns" env:"DB_MAX_IDLE_CONNS,default=5"`
	ConnMaxLifetime int    `yaml:"conn_max_lifetime" env:"DB_CONN_MAX_LIFETIME,default=300"`
}

// RedisConfig holds Redis configuration
type RedisConfig struct {
	Host     string `yaml:"host" env:"REDIS_HOST,default=localhost"`
	Port     int    `yaml:"port" env:"REDIS_PORT,default=6379"`
	Password string `yaml:"password" env:"REDIS_PASSWORD"`
	DB       int    `yaml:"db" env:"REDIS_DB,default=0"`
	PoolSize int    `yaml:"pool_size" env:"REDIS_POOL_SIZE,default=10"`
}

// NeoConfig holds Neo N3 blockchain configuration
type NeoConfig struct {
	RPCURL   string `yaml:"rpc_url" env:"NEO_RPC_URL,default=http://localhost:10332"`
	Network  string `yaml:"network" env:"NEO_NETWORK,default=private"`
	GasLimit int64  `yaml:"gas_limit" env:"NEO_GAS_LIMIT,default=100000000"`
	GasPrice int64  `yaml:"gas_price" env:"NEO_GAS_PRICE,default=1000"`
}

// TEEConfig holds Trusted Execution Environment configuration
type TEEConfig struct {
	Provider string      `yaml:"provider" env:"TEE_PROVIDER,default=azure"`
	Azure    AzureConfig `yaml:"azure"`
	Runtime  RuntimeConfig `yaml:"runtime"`
}

// AzureConfig holds Azure Confidential Computing configuration
type AzureConfig struct {
	Region         string `yaml:"region" env:"AZURE_REGION,default=eastus"`
	VMSize         string `yaml:"vm_size" env:"AZURE_VM_SIZE,default=Standard_DC4s_v3"`
	AttestationURL string `yaml:"attestation_url" env:"AZURE_ATTESTATION_URL"`
}

// RuntimeConfig holds TEE runtime configuration
type RuntimeConfig struct {
	JSMemoryLimit    int `yaml:"js_memory_limit" env:"TEE_JS_MEMORY_LIMIT,default=128"`
	ExecutionTimeout int `yaml:"execution_timeout" env:"TEE_EXECUTION_TIMEOUT,default=30"`
	MaxCPUTime       int `yaml:"max_cpu_time" env:"TEE_MAX_CPU_TIME,default=10"`
}

// AuthConfig holds authentication configuration
type AuthConfig struct {
	JWTSecret          string `yaml:"jwt_secret" env:"AUTH_JWT_SECRET,default=***REMOVED***"`
	TokenExpiry        int    `yaml:"token_expiry" env:"AUTH_TOKEN_EXPIRY,default=86400"`
	RefreshTokenExpiry int    `yaml:"refresh_token_expiry" env:"AUTH_REFRESH_TOKEN_EXPIRY,default=604800"`
	PasswordHashCost   int    `yaml:"password_hash_cost" env:"AUTH_PASSWORD_HASH_COST,default=10"`
}

// ServicesConfig holds service-specific configuration
type ServicesConfig struct {
	Functions   FunctionsConfig   `yaml:"functions"`
	Secrets     SecretsConfig     `yaml:"secrets"`
	Automation  AutomationConfig  `yaml:"automation"`
	PriceFeed   PriceFeedConfig   `yaml:"price_feed"`
	GasBank     GasBankConfig     `yaml:"gas_bank"`
}

// FunctionsConfig holds Functions Service configuration
type FunctionsConfig struct {
	MaxFunctionsPerUser  int `yaml:"max_functions_per_user" env:"FUNCTIONS_MAX_PER_USER,default=100"`
	MaxExecutionHistory  int `yaml:"max_execution_history" env:"FUNCTIONS_MAX_EXECUTION_HISTORY,default=1000"`
	MaxSourceCodeSize    int `yaml:"max_source_code_size" env:"FUNCTIONS_MAX_SOURCE_CODE_SIZE,default=100000"`
}

// SecretsConfig holds Secrets Service configuration
type SecretsConfig struct {
	MaxSecretsPerUser int `yaml:"max_secrets_per_user" env:"SECRETS_MAX_PER_USER,default=50"`
	MaxSecretSize     int `yaml:"max_secret_size" env:"SECRETS_MAX_SIZE,default=5000"`
}

// AutomationConfig holds Contract Automation Service configuration
type AutomationConfig struct {
	MaxTriggersPerUser int `yaml:"max_triggers_per_user" env:"AUTOMATION_MAX_TRIGGERS_PER_USER,default=100"`
	MinCronInterval    int `yaml:"min_cron_interval" env:"AUTOMATION_MIN_CRON_INTERVAL,default=60"`
}

// PriceFeedConfig holds Price Feed Service configuration
type PriceFeedConfig struct {
	DefaultUpdateFrequency  int     `yaml:"default_update_frequency" env:"PRICE_FEED_DEFAULT_UPDATE_FREQUENCY,default=300"`
	MaxSources              int     `yaml:"max_sources" env:"PRICE_FEED_MAX_SOURCES,default=10"`
	MinSources              int     `yaml:"min_sources" env:"PRICE_FEED_MIN_SOURCES,default=3"`
	DefaultDeviationThreshold float64 `yaml:"default_deviation_threshold" env:"PRICE_FEED_DEFAULT_DEVIATION_THRESHOLD,default=0.5"`
}

// GasBankConfig holds Gas Bank Service configuration
type GasBankConfig struct {
	MinDeposit    float64 `yaml:"min_deposit" env:"GAS_BANK_MIN_DEPOSIT,default=1.0"`
	MaxWithdrawal float64 `yaml:"max_withdrawal" env:"GAS_BANK_MAX_WITHDRAWAL,default=100.0"`
	GasReserve    float64 `yaml:"gas_reserve" env:"GAS_BANK_RESERVE,default=10.0"`
}

// MonitoringConfig holds monitoring configuration
type MonitoringConfig struct {
	Prometheus PrometheusConfig `yaml:"prometheus"`
	Logging    LoggingConfig    `yaml:"logging"`
	Tracing    TracingConfig    `yaml:"tracing"`
}

// PrometheusConfig holds Prometheus configuration
type PrometheusConfig struct {
	Enabled bool `yaml:"enabled" env:"PROMETHEUS_ENABLED,default=true"`
	Port    int  `yaml:"port" env:"PROMETHEUS_PORT,default=9090"`
}

// LoggingConfig holds logging configuration
type LoggingConfig struct {
	Level    string `yaml:"level" env:"LOG_LEVEL,default=info"`
	Format   string `yaml:"format" env:"LOG_FORMAT,default=json"`
	Output   string `yaml:"output" env:"LOG_OUTPUT,default=stdout"`
	FilePath string `yaml:"file_path" env:"LOG_FILE_PATH,default=logs/service_layer.log"`
}

// TracingConfig holds distributed tracing configuration
type TracingConfig struct {
	Enabled        bool   `yaml:"enabled" env:"TRACING_ENABLED,default=false"`
	JaegerEndpoint string `yaml:"jaeger_endpoint" env:"JAEGER_ENDPOINT,default=http://localhost:14268/api/traces"`
	ServiceName    string `yaml:"service_name" env:"TRACING_SERVICE_NAME,default=service_layer"`
}

// FeaturesConfig holds feature flag configuration
type FeaturesConfig struct {
	RandomGenerator bool `yaml:"random_generator" env:"FEATURE_RANDOM_GENERATOR,default=true"`
	PriceFeed       bool `yaml:"price_feed" env:"FEATURE_PRICE_FEED,default=true"`
	Functions       bool `yaml:"functions" env:"FEATURE_FUNCTIONS,default=true"`
	Automation      bool `yaml:"automation" env:"FEATURE_AUTOMATION,default=true"`
	GasBank         bool `yaml:"gas_bank" env:"FEATURE_GAS_BANK,default=true"`
	Oracle          bool `yaml:"oracle" env:"FEATURE_ORACLE,default=true"`
	Secrets         bool `yaml:"secrets" env:"FEATURE_SECRETS,default=true"`
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