// Package globalsigner provides the TEE master key management service.
package globalsigner

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"math"
	"math/big"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/edgelesssys/ego/enclave"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/crypto"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/database"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/globalsigner/supabase"
	slhex "github.com/R3E-Network/neo-miniapps-platform/infrastructure/hex"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/logging"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/marble"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/runtime"
	commonservice "github.com/R3E-Network/neo-miniapps-platform/infrastructure/service"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/serviceauth"
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
	// SECURITY: In strict/enclave mode, require explicit allowlists
	if strict && len(s.domainAllowlist) == 0 {
		return nil, fmt.Errorf("globalsigner: GLOBALSIGNER_DOMAIN_ALLOWLIST is required in strict/enclave mode")
	}
	if strict && len(s.signRawAllowlist) == 0 {
		return nil, fmt.Errorf("globalsigner: GLOBALSIGNER_SIGN_RAW_ALLOWLIST is required in strict/enclave mode")
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
// SECURITY: Uses version-specific salt to prevent all-keys-compromised scenario
// if master seed is leaked. Each version gets unique cryptographic isolation.
func (s *Service) deriveKeyForVersion(version string) (*ecdsa.PrivateKey, error) {
	// Use HKDF to derive key material with version-specific salt
	// Salt is derived from version string using SHA-256 to ensure fixed length
	versionBytes := []byte(version)
	saltHash := sha256.Sum256(append([]byte("globalsigner-salt:"), versionBytes...))
	salt := saltHash[:]

	info := "globalsigner:key:" + version
	keyMaterial, err := crypto.DeriveKey(s.masterSeed, salt, info, 32)
	if err != nil {
		return nil, fmt.Errorf("key derivation failed: %w", err)
	}

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

// =============================================================================
// Key Rotation
// =============================================================================

// rotationWorkerWithError checks if rotation is needed and performs it.
func (s *Service) rotationWorkerWithError(ctx context.Context) error {
	s.mu.RLock()
	activeEntry := s.keys[s.activeVersion]
	s.mu.RUnlock()

	if activeEntry == nil || activeEntry.version == nil {
		return nil
	}

	// Check if rotation is due
	activatedAt := activeEntry.version.ActivatedAt
	if activatedAt == nil {
		return nil
	}

	nextRotation := activatedAt.Add(s.rotationConfig.RotationPeriod)
	if time.Now().Before(nextRotation) {
		return nil
	}

	s.Logger().Info(ctx, "Rotation period reached, initiating key rotation...", nil)
	if _, err := s.rotate(ctx, false); err != nil {
		s.Logger().Error(ctx, "Automatic key rotation failed", err, nil)
		return err
	}
	return nil
}

// Rotate performs a key rotation.
func (s *Service) Rotate(ctx context.Context, force bool) (*RotateResponse, error) {
	return s.rotate(ctx, force)
}

func (s *Service) rotate(ctx context.Context, force bool) (*RotateResponse, error) {
	now := time.Now().UTC()
	newVersion := keyVersionFromTime(now)

	s.mu.Lock()
	oldVersion := s.activeVersion

	// Idempotency check
	if oldVersion == newVersion && !force {
		s.mu.Unlock()
		return &RotateResponse{
			OldVersion: oldVersion,
			NewVersion: newVersion,
			RotatedAt:  now,
			Rotated:    false,
		}, nil
	}
	s.mu.Unlock()

	// Derive new key
	priv, err := s.deriveKeyForVersion(newVersion)
	if err != nil {
		return nil, fmt.Errorf("failed to derive new key: %w", err)
	}

	// Compute public key hash
	pubKeyBytes := elliptic.MarshalCompressed(priv.Curve, priv.PublicKey.X, priv.PublicKey.Y)
	pubKeyHex := hex.EncodeToString(pubKeyBytes)
	pubKeyHash := sha256.Sum256(pubKeyBytes)
	pubKeyHashHex := hex.EncodeToString(pubKeyHash[:])

	// Create new key version
	newKeyVersion := &KeyVersion{
		Version:     newVersion,
		Status:      KeyStatusActive,
		PubKeyHex:   pubKeyHex,
		PubKeyHash:  pubKeyHashHex,
		CreatedAt:   now,
		ActivatedAt: &now,
	}

	// Calculate overlap end time
	var overlapEndsAt *time.Time
	if oldVersion != "" {
		overlapEnd := now.Add(s.rotationConfig.OverlapPeriod)
		overlapEndsAt = &overlapEnd
	}

	attestation, err := s.buildAttestation(ctx, newVersion, pubKeyHex, pubKeyHashHex)
	if err != nil {
		return nil, err
	}

	// Update old key to overlapping status
	s.mu.Lock()
	if oldVersion != "" {
		if oldEntry, ok := s.keys[oldVersion]; ok {
			oldEntry.version.Status = KeyStatusOverlapping
			oldEntry.version.OverlapEndsAt = overlapEndsAt
		}
	}

	// Add new key
	s.keys[newVersion] = &keyEntry{
		privateKey: priv,
		version:    newKeyVersion,
	}
	s.activeVersion = newVersion
	s.rotationsCount++
	s.mu.Unlock()

	// Persist to repository
	if s.repo != nil {
		if oldVersion != "" {
			if err := s.repo.UpdateKeyStatus(ctx, oldVersion, KeyStatusOverlapping, overlapEndsAt); err != nil {
				s.Logger().Warn(ctx, "Failed to update old key status", map[string]interface{}{
					"error":       err.Error(),
					"old_version": oldVersion,
				})
			}
		}
		if err := s.repo.CreateKeyVersion(ctx, newKeyVersion); err != nil {
			s.Logger().Warn(ctx, "Failed to persist new key version", map[string]interface{}{"error": err.Error()})
		}
	}

	if s.repo != nil {
		if err := s.repo.StoreAttestation(ctx, newVersion, attestation); err != nil {
			s.Logger().Warn(ctx, "Failed to persist attestation", map[string]interface{}{
				"error":       err.Error(),
				"new_version": newVersion,
			})
		}
	}

	s.Logger().Info(ctx, "Key rotation completed", map[string]interface{}{
		"old_version":     oldVersion,
		"new_version":     newVersion,
		"overlap_ends_at": overlapEndsAt,
	})

	return &RotateResponse{
		OldVersion:    oldVersion,
		NewVersion:    newVersion,
		OverlapEndsAt: overlapEndsAt,
		RotatedAt:     now,
		Rotated:       true,
	}, nil
}

// keyVersionFromTime generates a version string from a timestamp.
func keyVersionFromTime(t time.Time) string {
	return fmt.Sprintf("v%d-%02d", t.Year(), t.Month())
}

// =============================================================================
// Signing Operations
// =============================================================================

// Sign performs domain-separated signing.
func (s *Service) Sign(ctx context.Context, req *SignRequest) (*SignResponse, error) {
	if err := validateDomain(req.Domain); err != nil {
		return nil, err
	}
	if req.Data == "" {
		return nil, fmt.Errorf("data is required")
	}
	if err := s.authorizeDomain(ctx, req.Domain); err != nil {
		return nil, err
	}

	data, err := slhex.DecodeString(req.Data)
	if err != nil {
		return nil, fmt.Errorf("invalid data hex: %w", err)
	}
	if len(data) == 0 {
		return nil, fmt.Errorf("data is required")
	}

	// Get signing key
	version := strings.TrimSpace(req.KeyVersion)
	if version == "" {
		version = s.ActiveVersion()
	}

	s.mu.RLock()
	entry, ok := s.keys[version]
	if !ok {
		s.mu.RUnlock()
		return nil, fmt.Errorf("key version not found: %s", version)
	}
	privateKey := entry.privateKey
	pubKeyHex := entry.version.PubKeyHex
	status := entry.version.Status
	var overlapEndsAt *time.Time
	if entry.version.OverlapEndsAt != nil {
		overlapCopy := *entry.version.OverlapEndsAt
		overlapEndsAt = &overlapCopy
	}
	s.mu.RUnlock()

	if pubKeyHex == "" {
		return nil, fmt.Errorf("key version missing public key: %s", version)
	}
	if statusErr := validateKeyStatus(version, status, overlapEndsAt); statusErr != nil {
		return nil, statusErr
	}

	// Domain-separated signing: sign over sha256(domain || 0x00 || data).
	// crypto.Sign hashes its input with sha256 before producing the Neo-style
	// 64-byte (r||s) signature, so we pass the un-hashed message here to avoid
	// accidentally double hashing.
	signingMessage := make([]byte, 0, len(req.Domain)+1+len(data))
	signingMessage = append(signingMessage, []byte(req.Domain)...)
	signingMessage = append(signingMessage, 0x00) // separator
	signingMessage = append(signingMessage, data...)

	sig, err := crypto.Sign(privateKey, signingMessage)
	if err != nil {
		return nil, fmt.Errorf("signing failed: %w", err)
	}

	s.mu.Lock()
	s.signaturesIssued++
	s.mu.Unlock()

	s.logAudit(ctx, "sign", map[string]interface{}{
		"service_id":  normalizeServiceID(serviceauth.GetServiceID(ctx)),
		"domain":      req.Domain,
		"key_version": version,
		"data_len":    len(data),
	})

	return &SignResponse{
		Signature:  hex.EncodeToString(sig),
		KeyVersion: version,
		PubKeyHex:  pubKeyHex,
	}, nil
}

// SignRaw signs data as-is without domain separation.
//
// This is primarily intended for:
// - Neo transaction witness signing (hash.GetSignedData(net, tx))
// - legacy on-chain messages that do not include a domain prefix
//
// For most application-level signatures prefer Sign() which provides
// domain separation.
func (s *Service) SignRaw(ctx context.Context, req *SignRawRequest) (*SignResponse, error) {
	if req.Data == "" {
		return nil, fmt.Errorf("data is required")
	}
	if err := s.authorizeSignRaw(ctx); err != nil {
		return nil, err
	}

	data, err := slhex.DecodeString(req.Data)
	if err != nil {
		return nil, fmt.Errorf("invalid data hex: %w", err)
	}
	if len(data) == 0 {
		return nil, fmt.Errorf("data is required")
	}

	version := strings.TrimSpace(req.KeyVersion)
	if version == "" {
		version = s.ActiveVersion()
	}

	s.mu.RLock()
	entry, ok := s.keys[version]
	if !ok {
		s.mu.RUnlock()
		return nil, fmt.Errorf("key version not found: %s", version)
	}
	privateKey := entry.privateKey
	pubKeyHex := entry.version.PubKeyHex
	status := entry.version.Status
	var overlapEndsAt *time.Time
	if entry.version.OverlapEndsAt != nil {
		overlapCopy := *entry.version.OverlapEndsAt
		overlapEndsAt = &overlapCopy
	}
	s.mu.RUnlock()

	if pubKeyHex == "" {
		return nil, fmt.Errorf("key version missing public key: %s", version)
	}
	if statusErr := validateKeyStatus(version, status, overlapEndsAt); statusErr != nil {
		return nil, statusErr
	}

	sig, err := crypto.Sign(privateKey, data)
	if err != nil {
		return nil, fmt.Errorf("signing failed: %w", err)
	}

	s.mu.Lock()
	s.signaturesIssued++
	s.mu.Unlock()

	s.logAudit(ctx, "sign_raw", map[string]interface{}{
		"service_id":  normalizeServiceID(serviceauth.GetServiceID(ctx)),
		"key_version": version,
		"data_len":    len(data),
	})

	return &SignResponse{
		Signature:  hex.EncodeToString(sig),
		KeyVersion: version,
		PubKeyHex:  pubKeyHex,
	}, nil
}

const (
	maxDomainLength = 256
	maxPathLength   = 512
)

func validateDomain(domain string) error {
	trimmed := strings.TrimSpace(domain)
	if trimmed == "" {
		return fmt.Errorf("domain is required")
	}
	if len(domain) > maxDomainLength {
		return fmt.Errorf("domain too long")
	}
	if strings.ContainsRune(domain, '\x00') {
		return fmt.Errorf("domain contains invalid characters")
	}
	return nil
}

func validateDeriveDomain(domain string) error {
	if err := validateDomain(domain); err != nil {
		return err
	}
	if strings.Contains(domain, ":") {
		return fmt.Errorf("domain must not contain ':'")
	}
	return nil
}

func validateDerivePath(path string) error {
	trimmed := strings.TrimSpace(path)
	if trimmed == "" {
		return fmt.Errorf("path is required")
	}
	if len(path) > maxPathLength {
		return fmt.Errorf("path too long")
	}
	if strings.ContainsRune(path, '\x00') {
		return fmt.Errorf("path contains invalid characters")
	}
	return nil
}

func validateKeyStatus(version string, status KeyStatus, overlapEndsAt *time.Time) error {
	switch status {
	case KeyStatusActive:
		return nil
	case KeyStatusOverlapping:
		if overlapEndsAt != nil && time.Now().After(*overlapEndsAt) {
			return fmt.Errorf("key version overlap expired: %s", version)
		}
		return nil
	case KeyStatusPending:
		return fmt.Errorf("key version not active: %s", version)
	case KeyStatusRevoked:
		return fmt.Errorf("key version revoked: %s", version)
	default:
		return fmt.Errorf("key version not usable: %s", version)
	}
}

func (s *Service) authorizeDomain(ctx context.Context, domain string) error {
	if len(s.domainAllowlist) == 0 {
		return nil
	}

	serviceID := normalizeServiceID(serviceauth.GetServiceID(ctx))
	if serviceID == "" {
		return fmt.Errorf("service authentication required")
	}

	allowed := s.domainAllowlist[serviceID]
	if len(allowed) == 0 {
		return fmt.Errorf("service not authorized for domain")
	}

	domainLower := strings.ToLower(domain)
	for _, prefix := range allowed {
		if matchesDomainPrefix(domainLower, prefix) {
			return nil
		}
	}

	return fmt.Errorf("service not authorized for domain")
}

func (s *Service) authorizeSignRaw(ctx context.Context) error {
	if len(s.signRawAllowlist) == 0 {
		return nil
	}

	serviceID := normalizeServiceID(serviceauth.GetServiceID(ctx))
	if serviceID == "" {
		return fmt.Errorf("service authentication required")
	}
	if !s.signRawAllowlist[serviceID] {
		return fmt.Errorf("service not authorized for raw signing")
	}
	return nil
}

func matchesDomainPrefix(domain, prefix string) bool {
	if prefix == "" {
		return false
	}
	if prefix == "*" {
		return true
	}
	prefix = strings.TrimSuffix(prefix, "*")
	return strings.HasPrefix(domain, prefix)
}

func (s *Service) logAudit(ctx context.Context, action string, fields map[string]interface{}) {
	if fields == nil {
		fields = map[string]interface{}{}
	}
	s.Logger().Info(ctx, "globalsigner."+action, fields)
}

func normalizeServiceID(raw string) string {
	return strings.ToLower(strings.TrimSpace(raw))
}

func parseServiceDomainAllowlist(raw string) map[string][]string {
	entries := splitAndTrimCSV(raw)
	if len(entries) == 0 {
		return nil
	}

	allowlist := make(map[string][]string)
	for _, entry := range entries {
		parts := strings.SplitN(entry, ":", 2)
		if len(parts) != 2 {
			continue
		}
		serviceID := normalizeServiceID(parts[0])
		if serviceID == "" {
			continue
		}

		domains := splitAndTrimList(parts[1])
		if len(domains) == 0 {
			continue
		}
		for _, domain := range domains {
			if domain == "" {
				continue
			}
			normalized := strings.ToLower(domain)
			allowlist[serviceID] = append(allowlist[serviceID], normalized)
		}
	}

	if len(allowlist) == 0 {
		return nil
	}
	return allowlist
}

func parseServiceIDAllowlist(ids []string) map[string]bool {
	if len(ids) == 0 {
		return nil
	}
	allowlist := make(map[string]bool)
	for _, raw := range ids {
		serviceID := normalizeServiceID(raw)
		if serviceID == "" {
			continue
		}
		if serviceID == "*" {
			return nil
		}
		allowlist[serviceID] = true
	}
	if len(allowlist) == 0 {
		return nil
	}
	return allowlist
}

func splitAndTrimCSV(raw string) []string {
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func splitAndTrimList(raw string) []string {
	if raw == "" {
		return nil
	}
	parts := strings.FieldsFunc(raw, func(r rune) bool {
		return r == '|' || r == ';'
	})
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

// =============================================================================
// Key Derivation
// =============================================================================

// Derive performs deterministic child key derivation.
func (s *Service) Derive(ctx context.Context, req *DeriveRequest) (*DeriveResponse, error) {
	if err := validateDeriveDomain(req.Domain); err != nil {
		return nil, err
	}
	if err := validateDerivePath(req.Path); err != nil {
		return nil, err
	}
	if err := s.authorizeDomain(ctx, req.Domain); err != nil {
		return nil, err
	}

	version := strings.TrimSpace(req.KeyVersion)
	if version == "" {
		version = s.ActiveVersion()
	}

	s.mu.RLock()
	entry, ok := s.keys[version]
	if !ok {
		s.mu.RUnlock()
		return nil, fmt.Errorf("key version not found: %s", version)
	}
	status := entry.version.Status
	var overlapEndsAt *time.Time
	if entry.version.OverlapEndsAt != nil {
		overlapCopy := *entry.version.OverlapEndsAt
		overlapEndsAt = &overlapCopy
	}
	s.mu.RUnlock()

	if err := validateKeyStatus(version, status, overlapEndsAt); err != nil {
		return nil, err
	}

	// Derive child key: HKDF(master_key, domain || path)
	info := req.Domain + ":" + req.Path
	childKeyMaterial, err := crypto.DeriveKey(s.masterSeed, []byte(version), info, 32)
	if err != nil {
		return nil, fmt.Errorf("derivation failed: %w", err)
	}

	// Convert to P-256 private key using standard library
	curve := elliptic.P256()
	childPriv := new(ecdsa.PrivateKey)
	childPriv.PublicKey.Curve = curve
	d := new(big.Int).SetBytes(childKeyMaterial)
	nMinus1 := new(big.Int).Sub(curve.Params().N, big.NewInt(1))
	d.Mod(d, nMinus1)
	d.Add(d, big.NewInt(1))
	childPriv.D = d
	childPriv.PublicKey.X, childPriv.PublicKey.Y = curve.ScalarBaseMult(d.Bytes())

	pubKeyBytes := elliptic.MarshalCompressed(childPriv.Curve, childPriv.PublicKey.X, childPriv.PublicKey.Y)

	s.logAudit(ctx, "derive", map[string]interface{}{
		"service_id":  normalizeServiceID(serviceauth.GetServiceID(ctx)),
		"domain":      req.Domain,
		"key_version": version,
	})

	return &DeriveResponse{
		PubKeyHex:  hex.EncodeToString(pubKeyBytes),
		KeyVersion: version,
	}, nil
}

// =============================================================================
// Attestation
// =============================================================================

// buildAttestation generates an attestation for a key version.
func (s *Service) buildAttestation(ctx context.Context, version, pubKeyHex, pubKeyHash string) (*MasterKeyAttestation, error) {
	if strings.TrimSpace(version) == "" {
		return nil, fmt.Errorf("key version is required")
	}
	if strings.TrimSpace(pubKeyHex) == "" || strings.TrimSpace(pubKeyHash) == "" {
		return nil, fmt.Errorf("key version %s missing attestation metadata", version)
	}

	att := &MasterKeyAttestation{
		KeyVersion: version,
		PubKeyHex:  pubKeyHex,
		PubKeyHash: pubKeyHash,
		Timestamp:  time.Now().UTC().Format(time.RFC3339),
		Simulated:  !s.Marble().IsEnclave(),
	}

	// Generate SGX quote if in enclave mode
	if s.Marble().IsEnclave() {
		quote, report, err := s.generateQuote(pubKeyHash)
		if err != nil {
			if s.requireQuote {
				return nil, fmt.Errorf("generate SGX quote: %w", err)
			}
			s.Logger().Warn(ctx, "Failed to generate SGX quote", map[string]interface{}{
				"error":       err.Error(),
				"key_version": version,
			})
		} else {
			att.Quote = quote
			att.MRENCLAVE = report.MRENCLAVE
			att.MRSIGNER = report.MRSIGNER
			att.ProdID = report.ProdID
			att.ISVSVN = report.ISVSVN
		}
	}

	return att, nil
}

// SGXReport holds parsed SGX report fields.
type SGXReport struct {
	MRENCLAVE string
	MRSIGNER  string
	ProdID    uint16
	ISVSVN    uint16
}

// generateQuote generates an SGX quote with the given report data.
// Returns error in simulation mode; uses EGo's enclave.GetRemoteReport in SGX hardware mode.
func (s *Service) generateQuote(reportData string) (string, *SGXReport, error) {
	payload := strings.TrimSpace(reportData)
	payload = strings.TrimPrefix(payload, "0x")
	payload = strings.TrimPrefix(payload, "0X")

	userData := []byte(payload)
	if decoded, err := hex.DecodeString(payload); err == nil && len(decoded) > 0 {
		userData = decoded
	}

	if len(userData) > 64 {
		userData = userData[:64]
	}
	if len(userData) < 64 {
		padded := make([]byte, 64)
		copy(padded, userData)
		userData = padded
	}

	quote, err := enclave.GetRemoteReport(userData)
	if err != nil {
		return "", nil, err
	}
	report, err := enclave.VerifyRemoteReport(quote)
	if err != nil {
		return "", nil, err
	}

	out := &SGXReport{
		MRENCLAVE: base64.StdEncoding.EncodeToString(report.UniqueID),
		MRSIGNER:  base64.StdEncoding.EncodeToString(report.SignerID),
	}
	if len(report.ProductID) >= 2 {
		out.ProdID = uint16(report.ProductID[1])<<8 | uint16(report.ProductID[0])
	}
	if report.SecurityVersion <= math.MaxUint16 {
		out.ISVSVN = uint16(report.SecurityVersion)
	}

	return base64.StdEncoding.EncodeToString(quote), out, nil
}

// GetAttestation returns the attestation for the active key.
func (s *Service) GetAttestation(ctx context.Context) (*MasterKeyAttestation, error) {
	version := s.ActiveVersion()
	if version == "" {
		return nil, fmt.Errorf("no active key version")
	}
	s.mu.RLock()
	entry, ok := s.keys[version]
	if !ok {
		s.mu.RUnlock()
		return nil, fmt.Errorf("key version not found: %s", version)
	}
	pubKeyHex := entry.version.PubKeyHex
	pubKeyHash := entry.version.PubKeyHash
	s.mu.RUnlock()

	return s.buildAttestation(ctx, version, pubKeyHex, pubKeyHash)
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
