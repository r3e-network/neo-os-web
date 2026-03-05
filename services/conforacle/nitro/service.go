// Package oracle implements a simple oracle that can fetch external data and use secrets for auth.
package neooracle

import (
	"fmt"
	"net/http"
	"time"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/nitro"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/runtime"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/secrets"
	commonservice "github.com/r3e-network/neo-miniapp-platform/infrastructure/service"
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
	Nitro          *nitro.Nitro
	SecretProvider secrets.Provider
	MaxBodyBytes   int64        // optional response cap; default 2MB
	URLAllowlist   URLAllowlist // optional allowlist for outbound fetch
	Timeout        time.Duration
	Transport      http.RoundTripper // optional; defaults to httputil.NewSafeTransport() (SSRF-safe)
}

// New creates a new NeoOracle service.
//
//nolint:gocritic // Config is passed by value intentionally for ergonomic call sites and immutable setup.
func New(cfg Config) (*Service, error) {
	base := commonservice.NewBase(&commonservice.BaseConfig{
		ID:      ServiceID,
		Name:    ServiceName,
		Version: Version,
		Nitro:   cfg.Nitro,
	})

	strict := runtime.StrictIdentityMode() || (cfg.Nitro != nil && cfg.Nitro.IsEnclave())
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

	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = 20 * time.Second
	}

	s := &Service{
		BaseService:    base,
		secretProvider: cfg.SecretProvider,
		httpClient: func() *http.Client {
			client := &http.Client{Timeout: timeout}
			if cfg.Nitro != nil {
				client = httputil.CopyHTTPClientWithTimeout(cfg.Nitro.ExternalHTTPClient(), timeout, true)
			}
			// Layer SSRF-safe transport: resolve DNS up front and reject private IPs.
			if cfg.Transport != nil {
				client.Transport = cfg.Transport
			} else {
				client.Transport = httputil.NewSafeTransport()
			}
			// Disable automatic redirects so the URL allowlist cannot be
			// bypassed via a redirect chain to a non-allowlisted host.
			client.CheckRedirect = func(*http.Request, []*http.Request) error {
				return http.ErrUseLastResponse
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
