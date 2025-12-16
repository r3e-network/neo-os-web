// Package oracle implements a simple oracle that can fetch external data and use secrets for auth.
package neooracle

import (
	"fmt"
	"net/http"
	"time"

	"github.com/R3E-Network/service_layer/infrastructure/httputil"
	"github.com/R3E-Network/service_layer/infrastructure/marble"
	"github.com/R3E-Network/service_layer/infrastructure/runtime"
	"github.com/R3E-Network/service_layer/infrastructure/secrets"
	commonservice "github.com/R3E-Network/service_layer/infrastructure/service"
)

const (
	ServiceID   = "neooracle"
	ServiceName = "NeoOracle Service"
	Version     = "1.0.0"
)

// Service implements the oracle.
type Service struct {
	*commonservice.BaseService
	secretProvider secrets.Provider
	httpClient     *http.Client
	maxBodyBytes   int64
	allowlist      URLAllowlist
}

// Config configures the oracle.
type Config struct {
	Marble         *marble.Marble
	SecretProvider secrets.Provider
	MaxBodyBytes   int64        // optional response cap; default 2MB
	URLAllowlist   URLAllowlist // optional allowlist for outbound fetch
}

// New creates a new NeoOracle service.
func New(cfg Config) (*Service, error) {
	base := commonservice.NewBase(&commonservice.BaseConfig{
		ID:      ServiceID,
		Name:    ServiceName,
		Version: Version,
		Marble:  cfg.Marble,
	})

	strict := runtime.StrictIdentityMode() || (cfg.Marble != nil && cfg.Marble.IsEnclave())
	if strict {
		validAllowlistEntries := 0
		for _, raw := range cfg.URLAllowlist.Prefixes {
			if _, ok := parseURLAllowlistEntry(raw); ok {
				validAllowlistEntries++
			}
		}
		if validAllowlistEntries == 0 {
			return nil, fmt.Errorf("neooracle: URL allowlist is required in strict identity mode (set ORACLE_HTTP_ALLOWLIST)")
		}
	}

	maxBytes := cfg.MaxBodyBytes
	if maxBytes <= 0 {
		maxBytes = 2 * 1024 * 1024 // 2MB default
	}

	s := &Service{
		BaseService:    base,
		secretProvider: cfg.SecretProvider,
		httpClient: func() *http.Client {
			client := &http.Client{Timeout: 20 * time.Second}
			if cfg.Marble != nil {
				client = httputil.CopyHTTPClientWithTimeout(cfg.Marble.ExternalHTTPClient(), 20*time.Second, true)
			}
			return client
		}(),
		maxBodyBytes: maxBytes,
		allowlist:    cfg.URLAllowlist,
	}

	base.RegisterStandardRoutes()
	s.registerRoutes()
	return s, nil
}
