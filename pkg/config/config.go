package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/joeshaw/envdecode"
	"github.com/joho/godotenv"
	"gopkg.in/yaml.v3"
)

// ServerConfig controls the HTTP server.
type ServerConfig struct {
	Host string `json:"host" env:"SERVER_HOST"`
	Port int    `json:"port" env:"SERVER_PORT"`
}

// DatabaseConfig controls persistence.
type DatabaseConfig struct {
	Driver          string `json:"driver" env:"DATABASE_DRIVER"`
	DSN             string `json:"dsn" env:"DATABASE_DSN"`
	Host            string `json:"host" env:"DATABASE_HOST"`
	Port            int    `json:"port" env:"DATABASE_PORT"`
	User            string `json:"user" env:"DATABASE_USER"`
	Password        string `json:"password" env:"DATABASE_PASSWORD"`
	Name            string `json:"name" env:"DATABASE_NAME"`
	SSLMode         string `json:"sslmode" env:"DATABASE_SSLMODE"`
	MaxOpenConns    int    `json:"max_open_conns" env:"DATABASE_MAX_OPEN_CONNS"`
	MaxIdleConns    int    `json:"max_idle_conns" env:"DATABASE_MAX_IDLE_CONNS"`
	ConnMaxLifetime int    `json:"conn_max_lifetime" env:"DATABASE_CONN_MAX_LIFETIME"`
	MigrateOnStart  bool   `json:"migrate_on_start" yaml:"migrate_on_start" env:"DATABASE_MIGRATE_ON_START"`
}

// LoggingConfig controls application logging.
type LoggingConfig struct {
	Level      string `json:"level" env:"LOG_LEVEL"`
	Format     string `json:"format" env:"LOG_FORMAT"`
	Output     string `json:"output" env:"LOG_OUTPUT"`
	FilePrefix string `json:"file_prefix" env:"LOG_FILE_PREFIX"`
}

// SecurityConfig controls encryption-specific parameters.
type SecurityConfig struct {
	SecretEncryptionKey string `json:"secret_encryption_key" env:"SECRET_ENCRYPTION_KEY"`
}

// AuthConfig controls HTTP API authentication.
type AuthConfig struct {
	Tokens              []string   `json:"tokens"`
	JWTSecret           string     `json:"jwt_secret" env:"AUTH_JWT_SECRET"`
	Users               []UserSpec `json:"users"`
	SupabaseJWTSecret   string     `json:"supabase_jwt_secret" env:"SUPABASE_JWT_SECRET"`
	SupabaseJWTAud      string     `json:"supabase_jwt_aud" env:"SUPABASE_JWT_AUD"`
	SupabaseAdminRoles  []string   `json:"supabase_admin_roles" env:"SUPABASE_ADMIN_ROLES"`
	SupabaseTenantClaim string     `json:"supabase_tenant_claim" env:"SUPABASE_TENANT_CLAIM"`
	SupabaseRoleClaim   string     `json:"supabase_role_claim" env:"SUPABASE_ROLE_CLAIM"`
	SupabaseGoTrueURL   string     `json:"supabase_gotrue_url" env:"SUPABASE_GOTRUE_URL"`
}

// SupabaseConfig holds self-hosted Supabase connection settings.
type SupabaseConfig struct {
	ProjectURL     string `json:"project_url" env:"SUPABASE_URL"`
	AnonKey        string `json:"anon_key" env:"SUPABASE_ANON_KEY"`
	ServiceRoleKey string `json:"service_role_key" env:"SUPABASE_SERVICE_ROLE_KEY"`
	StorageURL     string `json:"storage_url" env:"SUPABASE_STORAGE_URL"`
}

// TracingConfig configures OTLP/Tracing exporters.
type TracingConfig struct {
	Endpoint           string            `json:"endpoint" env:"TRACING_OTLP_ENDPOINT"`
	Insecure           bool              `json:"insecure" env:"TRACING_OTLP_INSECURE"`
	ServiceName        string            `json:"service_name" env:"TRACING_SERVICE_NAME"`
	ResourceAttributes map[string]string `json:"resource_attributes" mapstructure:"resource_attributes"`
	AttributesEnv      string            `json:"-" yaml:"-" env:"TRACING_OTLP_ATTRIBUTES"`
}

type UserSpec struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

// Config is the top-level configuration structure.
type Config struct {
	Server   ServerConfig   `json:"server"`
	Database DatabaseConfig `json:"database"`
	Logging  LoggingConfig  `json:"logging"`
	Runtime  RuntimeConfig  `json:"runtime"`
	Security SecurityConfig `json:"security"`
	Auth     AuthConfig     `json:"auth"`
	Supabase SupabaseConfig `json:"supabase"`
	Tracing  TracingConfig  `json:"tracing"`
}

// New returns a configuration populated with defaults.
func New() *Config {
	return &Config{
		Server: ServerConfig{
			Host: "0.0.0.0",
			Port: 8080,
		},
		Database: DatabaseConfig{
			Driver:          "postgres",
			MaxOpenConns:    10,
			MaxIdleConns:    5,
			ConnMaxLifetime: 300,
			MigrateOnStart:  true,
		},
		Logging: LoggingConfig{
			Level:      "info",
			Format:     "text",
			Output:     "stdout",
			FilePrefix: "service-layer",
		},
		Runtime: RuntimeConfig{
			AutoDepsFromAPIs: true,
		},
		Security: SecurityConfig{},
		Auth:     AuthConfig{},
		Supabase: SupabaseConfig{},
		Tracing:  TracingConfig{},
	}
}

// ConnectionString builds a PostgreSQL connection string using host parameters.
func (c DatabaseConfig) ConnectionString() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.User, c.Password, c.Name, c.SSLMode,
	)
}

// Load loads configuration from file (if present) and environment variables.
func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg := New()

	if path := strings.TrimSpace(os.Getenv("CONFIG_FILE")); path != "" {
		if err := loadFromFile(path, cfg); err != nil {
			return nil, err
		}
	} else {
		_ = loadFromFile("configs/config.yaml", cfg)
	}

	if err := envdecode.Decode(cfg); err != nil {
		// envdecode returns an error when no tagged fields are present in the
		// environment; treat that case as "no overrides" so local runs work
		// without exporting vars.
		if !strings.Contains(err.Error(), "none of the target fields were set") {
			return nil, fmt.Errorf("decode env: %w", err)
		}
	}

	applyDatabaseURLOverride(cfg)
	cfg.normalize()

	return cfg, nil
}

// LoadFile reads configuration from a YAML file.
func LoadFile(path string) (*Config, error) {
	cfg := New()
	if err := loadFromFile(path, cfg); err != nil {
		return nil, err
	}
	applyDatabaseURLOverride(cfg)
	cfg.normalize()
	return cfg, nil
}

func loadFromFile(path string, cfg *Config) error {
	expanded, err := filepath.Abs(path)
	if err != nil {
		return err
	}
	data, err := os.ReadFile(expanded)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return err
	}
	return nil
}

// LoadConfig is a helper used by tests to load JSON config snippets.
func LoadConfig(path string) (*Config, error) {
	cfg := New()
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(data, cfg); err != nil {
		return nil, err
	}
	applyDatabaseURLOverride(cfg)
	cfg.normalize()
	return cfg, nil
}

// applyDatabaseURLOverride aligns config loading with cmd/appserver: DATABASE_URL (Supabase DSN)
// overrides any file-based DSN to reduce setup friction.
func applyDatabaseURLOverride(cfg *Config) {
	if cfg == nil {
		return
	}
	if dsn := strings.TrimSpace(os.Getenv("DATABASE_URL")); dsn != "" {
		cfg.Database.DSN = dsn
	}
}

func (t *TracingConfig) normalize() {
	if t == nil {
		return
	}
	t.MergeAttributes(t.AttributesEnv)
}

// MergeAttributes merges comma-separated key=value pairs into ResourceAttributes.
func (t *TracingConfig) MergeAttributes(raw string) {
	if t == nil {
		return
	}
	pairs := parseAttributePairs(raw)
	if len(pairs) == 0 {
		return
	}
	if t.ResourceAttributes == nil {
		t.ResourceAttributes = make(map[string]string, len(pairs))
	}
	for k, v := range pairs {
		if k == "" {
			continue
		}
		t.ResourceAttributes[k] = v
	}
}

func parseAttributePairs(raw string) map[string]string {
	result := make(map[string]string)
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		kv := strings.SplitN(part, "=", 2)
		key := strings.TrimSpace(kv[0])
		if key == "" {
			continue
		}
		val := ""
		if len(kv) > 1 {
			val = strings.TrimSpace(kv[1])
		}
		result[key] = val
	}
	return result
}

func (c *Config) normalize() {
	if c == nil {
		return
	}
	c.Tracing.normalize()
}
