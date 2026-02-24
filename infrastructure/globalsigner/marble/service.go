// Package globalsigner provides the TEE master key management service.
package globalsigner

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"encoding/hex"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/crypto"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/database"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/globalsigner/supabase"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/logging"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/marble"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/runtime"
	commonservice "github.com/r3e-network/neo-miniapp-platform/infrastructure/service"
)

// =============================================================================
// Service Definition
// =============================================================================

// Service implements the GlobalSigner TEE master key management service.
type Service struct {
	*commonservice.BaseService
	mu sync.RWMutex

	// Request policy
	maxBodyBytes     int64
	domainAllowlist  map[string][]string
	signRawAllowlist map[string]bool
	requireQuote     bool

	// Configuration
	rotationConfig *RotationConfig

	// Master seed (injected via MarbleRun)
	masterSeed []byte

	// Key management
	activeVersion string
	keys          map[string]*keyEntry

	// Repository
	repo supabase.Repository

	// Metrics
	signaturesIssued int64
	rotationsCount   int64
	startTime        time.Time
}

// keyEntry holds a key version's private key and metadata.
type keyEntry struct {
	privateKey *ecdsa.PrivateKey
	version    *KeyVersion
}

// Config holds GlobalSigner service configuration.
type Config struct {
	Marble         *marble.Marble
	DB             database.RepositoryInterface
	Repository     supabase.Repository
	RotationConfig *RotationConfig
	MaxBodyBytes   int64
	// DomainAllowlist optionally limits signing/derivation domains per service ID.
	DomainAllowlist map[string][]string
	// SignRawAllowlist optionally limits which services may call SignRaw.
	SignRawAllowlist []string
}

const (
	defaultMaxBodyBytes = 1 << 20 // 1MiB

	envDomainAllowlist  = "GLOBALSIGNER_DOMAIN_ALLOWLIST"
	envSignRawAllowlist = "GLOBALSIGNER_SIGN_RAW_ALLOWLIST"
	envMaxBodyBytes     = "GLOBALSIGNER_MAX_BODY_BYTES"
	envRequireQuote     = "GLOBALSIGNER_REQUIRE_QUOTE"
)

// =============================================================================
// Constructor
// =============================================================================

// New creates a new GlobalSigner service.
//
//nolint:gocritic // Config is passed by value intentionally for ergonomic call sites and immutable setup.
func New(cfg Config) (*Service, error) {
	if cfg.RotationConfig == nil {
		cfg.RotationConfig = DefaultRotationConfig()
	}

	base := commonservice.NewBase(&commonservice.BaseConfig{
		ID:      ServiceID,
		Name:    ServiceName,
		Version: Version,
		Marble:  cfg.Marble,
		DB:      cfg.DB,
		RequiredSecrets: []string{
			"GLOBALSIGNER_MASTER_SEED",
		},
	})

	maxBodyBytes := cfg.MaxBodyBytes
	if maxBodyBytes <= 0 {
		maxBodyBytes = defaultMaxBodyBytes
	}
	if raw := strings.TrimSpace(os.Getenv(envMaxBodyBytes)); raw != "" {
		if parsed, err := strconv.ParseInt(raw, 10, 64); err == nil && parsed > 0 {
			maxBodyBytes = parsed
		} else {
			base.Logger().Warn(context.Background(), "Invalid GLOBALSIGNER_MAX_BODY_BYTES; using default", map[string]interface{}{
				"value": raw,
			})
		}
	}

	domainAllowlist := cfg.DomainAllowlist
	if domainAllowlist == nil {
		domainAllowlist = parseServiceDomainAllowlist(strings.TrimSpace(os.Getenv(envDomainAllowlist)))
	}

	signRawAllowlist := parseServiceIDAllowlist(cfg.SignRawAllowlist)
	if len(cfg.SignRawAllowlist) == 0 {
		signRawAllowlist = parseServiceIDAllowlist(splitAndTrimCSV(strings.TrimSpace(os.Getenv(envSignRawAllowlist))))
	}

	requireQuote := cfg.Marble != nil && cfg.Marble.IsEnclave()
	if raw := strings.TrimSpace(os.Getenv(envRequireQuote)); raw != "" {
		if parsed, err := strconv.ParseBool(raw); err == nil {
			requireQuote = parsed
		} else {
			base.Logger().Warn(context.Background(), "Invalid GLOBALSIGNER_REQUIRE_QUOTE; using default", map[string]interface{}{
				"value": raw,
			})
		}
	}

	s := &Service{
		BaseService:      base,
		maxBodyBytes:     maxBodyBytes,
		domainAllowlist:  domainAllowlist,
		signRawAllowlist: signRawAllowlist,
		requireQuote:     requireQuote,
		rotationConfig:   cfg.RotationConfig,
		keys:             make(map[string]*keyEntry),
		repo:             cfg.Repository,
		startTime:        time.Now(),
	}

	strict := runtime.StrictIdentityMode() || (cfg.Marble != nil && cfg.Marble.IsEnclave())
	if strict && len(s.domainAllowlist) == 0 {
		return nil, fmt.Errorf("GLOBALSIGNER_DOMAIN_ALLOWLIST must be set in strict/enclave mode")
	}
	if strict && len(s.signRawAllowlist) == 0 {
		return nil, fmt.Errorf("GLOBALSIGNER_SIGNRAW_ALLOWLIST must be set in strict/enclave mode")
	}

	// Set up hydration to load keys on startup
	s.WithHydrate(s.hydrate)

	// Set up statistics provider
	s.WithStats(s.statistics)

	// Add rotation check worker (runs daily)
	if cfg.RotationConfig.AutoRotate {
		s.AddTickerWorker(24*time.Hour, s.rotationWorkerWithError)
	}

	// Attach ServeMux routes to the marble router.
	mux := http.NewServeMux()
	s.RegisterRoutes(mux)
	s.Router().NotFoundHandler = mux

	return s, nil
}

// =============================================================================
// Lifecycle
// =============================================================================

// hydrate loads master seed and existing keys from storage.
func (s *Service) hydrate(ctx context.Context) error {
	s.Logger().Info(ctx, "Hydrating GlobalSigner state...", nil)

	// Load master seed from Marble secrets
	seedBytes, ok := s.Marble().Secret("GLOBALSIGNER_MASTER_SEED")
	if !ok || len(seedBytes) == 0 {
		strict := runtime.StrictIdentityMode() || s.Marble().IsEnclave()
		if strict {
			return fmt.Errorf("failed to get master seed: secret not found")
		}

		s.Logger().Warn(ctx, "GLOBALSIGNER_MASTER_SEED not configured; generating ephemeral key (development/testing only)", nil)
		generated, err := crypto.GenerateRandomBytes(32)
		if err != nil {
			return fmt.Errorf("generate master seed: %w", err)
		}
		seedBytes = generated
	}

	seed := seedBytes
	if len(seed) != 32 {
		// Backward compatibility: allow a hex-encoded seed (e.g. env var injected as text).
		decoded, err := hex.DecodeString(strings.TrimPrefix(strings.TrimPrefix(strings.TrimSpace(string(seedBytes)), "0x"), "0X"))
		if err == nil {
			seed = decoded
		}
	}
	if len(seed) != 32 {
		return fmt.Errorf("master seed must be 32 bytes, got %d", len(seed))
	}

	s.masterSeed = make([]byte, 32)
	copy(s.masterSeed, seed)

	// Load existing key versions from repository
	if s.repo != nil {
		versions, err := s.repo.ListKeyVersions(ctx, []KeyStatus{KeyStatusActive, KeyStatusOverlapping})
		if err != nil {
			s.Logger().Warn(ctx, "Failed to load key versions", map[string]interface{}{"error": err.Error()})
		} else {
			for _, v := range versions {
				if err := s.loadKeyVersion(v); err != nil {
					s.Logger().Warn(ctx, "Failed to load key version", map[string]interface{}{"version": v.Version, "error": err.Error()})
				}
			}
		}
	}

	// Bootstrap if no active key exists
	if s.activeVersion == "" {
		s.Logger().Info(ctx, "No active key found, bootstrapping initial key...", nil)
		if _, err := s.rotate(ctx, true); err != nil {
			return fmt.Errorf("failed to bootstrap initial key: %w", err)
		}
	}

	s.Logger().Info(ctx, "GlobalSigner hydrated", map[string]interface{}{"active_version": s.activeVersion, "key_count": len(s.keys)})
	return nil
}

// loadKeyVersion derives and loads a key version into memory.
func (s *Service) loadKeyVersion(v *KeyVersion) error {
	priv, err := s.deriveKeyForVersion(v.Version)
	if err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.keys[v.Version] = &keyEntry{
		privateKey: priv,
		version:    v,
	}

	if v.Status == KeyStatusActive {
		s.activeVersion = v.Version
	}

	return nil
}

// deriveKeyForVersion derives a P-256 private key for a given version.
func (s *Service) deriveKeyForVersion(version string) (*ecdsa.PrivateKey, error) {
	// Use HKDF to derive key material
	info := "globalsigner:" + version
	keyMaterial, err := crypto.DeriveKey(s.masterSeed, nil, info, 32)
	if err != nil {
		return nil, fmt.Errorf("key derivation failed: %w", err)
	}
	defer crypto.ZeroBytes(keyMaterial)

	// Convert to P-256 private key using standard library
	curve := elliptic.P256()
	priv := new(ecdsa.PrivateKey)
	priv.PublicKey.Curve = curve
	d := new(big.Int).SetBytes(keyMaterial)
	nMinus1 := new(big.Int).Sub(curve.Params().N, big.NewInt(1))
	d.Mod(d, nMinus1)
	d.Add(d, big.NewInt(1)) // ensure non-zero
	priv.D = d
	priv.PublicKey.X, priv.PublicKey.Y = curve.ScalarBaseMult(d.Bytes())

	return priv, nil
}

// statistics returns service statistics for the /info endpoint.
func (s *Service) statistics() map[string]any {
	s.mu.RLock()
	defer s.mu.RUnlock()

	keyVersions := make([]string, 0, len(s.keys))
	for v := range s.keys {
		keyVersions = append(keyVersions, v)
	}

	return map[string]any{
		"active_version":    s.activeVersion,
		"key_versions":      keyVersions,
		"signatures_issued": s.signaturesIssued,
		"rotations_count":   s.rotationsCount,
		"uptime":            time.Since(s.startTime).String(),
		"is_enclave":        s.Marble().IsEnclave(),
	}
}

func (s *Service) logAudit(ctx context.Context, action string, fields map[string]interface{}) {
	if fields == nil {
		fields = map[string]interface{}{}
	}
	s.Logger().Info(ctx, "globalsigner."+action, fields)
}

// =============================================================================
// Accessors
// =============================================================================

// ActiveVersion returns the currently active key version.
func (s *Service) ActiveVersion() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.activeVersion
}

// GetKeyVersion returns information about a specific key version.
func (s *Service) GetKeyVersion(version string) (*KeyVersion, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	entry, ok := s.keys[version]
	if !ok {
		return nil, fmt.Errorf("key version not found: %s", version)
	}
	return entry.version, nil
}

// ListKeyVersions returns all loaded key versions.
func (s *Service) ListKeyVersions() []*KeyVersion {
	s.mu.RLock()
	defer s.mu.RUnlock()

	versions := make([]*KeyVersion, 0, len(s.keys))
	for _, entry := range s.keys {
		versions = append(versions, entry.version)
	}
	return versions
}

// Logger returns the service logger.
func (s *Service) Logger() *logging.Logger {
	return s.BaseService.Logger()
}
