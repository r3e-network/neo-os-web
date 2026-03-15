package globalsigner

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/crypto"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/serviceauth"
)

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

	data, err := decodeHexString(req.Data)
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
	if validateErr := validateKeyStatus(version, status, overlapEndsAt); validateErr != nil {
		return nil, validateErr
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

	data, err := decodeHexString(req.Data)
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
	if validateErr := validateKeyStatus(version, status, overlapEndsAt); validateErr != nil {
		return nil, validateErr
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

func decodeHexString(raw string) ([]byte, error) {
	trimmed := strings.TrimSpace(raw)
	trimmed = strings.TrimPrefix(trimmed, "0x")
	trimmed = strings.TrimPrefix(trimmed, "0X")
	return hex.DecodeString(trimmed)
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
	defer crypto.ZeroBytes(childKeyMaterial)

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
