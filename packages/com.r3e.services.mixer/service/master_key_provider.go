// Package mixer provides privacy-preserving transaction mixing service.
package mixer

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"sync"
)

// Master Key Provider Implementation for Double-Blind HD 1/2 Multi-sig Architecture
//
// The Master Key Provider manages the offline Master keys used for:
// - Emergency recovery of pool accounts
// - Administrative operations when TEE is unavailable
// - Multi-sig address generation (provides public keys only)
//
// SECURITY: The Master private key should be kept offline.
// This implementation supports two modes:
// 1. Public-key-only mode: Only public keys are available (production)
// 2. Full-key mode: Private keys available for testing/recovery

// HDMasterKeyProvider implements MasterKeyProvider using HD key derivation.
// In production, this should only have access to public keys.
// Private keys should be kept in cold storage.
type HDMasterKeyProvider struct {
	mu sync.RWMutex

	// Master extended key (public or private depending on mode)
	masterKey *ExtendedKey

	// Pre-derived public keys (for public-key-only mode)
	publicKeys map[uint32][]byte

	// Whether private keys are available (should be false in production)
	hasPrivateKeys bool

	// Key cache for performance
	keyCache map[uint32]*ExtendedKey
}

// MasterKeyProviderConfig configures the master key provider.
type MasterKeyProviderConfig struct {
	// Seed is the master seed (only for testing/recovery, nil in production)
	Seed []byte

	// PublicKeys is a map of pre-derived public keys (for production)
	// Key: HD index, Value: compressed public key (33 bytes)
	PublicKeys map[uint32][]byte

	// ExtendedPublicKey is the master extended public key (for deriving child public keys)
	// This allows deriving public keys without the private key
	ExtendedPublicKey *ExtendedKey
}

// NewHDMasterKeyProvider creates a new master key provider.
// For production: provide only PublicKeys or ExtendedPublicKey
// For testing/recovery: provide Seed
func NewHDMasterKeyProvider(config MasterKeyProviderConfig) (*HDMasterKeyProvider, error) {
	provider := &HDMasterKeyProvider{
		publicKeys: make(map[uint32][]byte),
		keyCache:   make(map[uint32]*ExtendedKey),
	}

	// Mode 1: Full private key access (testing/recovery only)
	if config.Seed != nil {
		masterKey, err := NewExtendedKeyFromSeed(config.Seed)
		if err != nil {
			return nil, fmt.Errorf("create master key from seed: %w", err)
		}
		provider.masterKey = masterKey
		provider.hasPrivateKeys = true
		return provider, nil
	}

	// Mode 2: Extended public key (can derive child public keys)
	if config.ExtendedPublicKey != nil {
		provider.masterKey = config.ExtendedPublicKey
		provider.hasPrivateKeys = false
		return provider, nil
	}

	// Mode 3: Pre-derived public keys only
	if len(config.PublicKeys) > 0 {
		for index, pubKey := range config.PublicKeys {
			if len(pubKey) != 33 {
				return nil, fmt.Errorf("invalid public key at index %d: expected 33 bytes, got %d", index, len(pubKey))
			}
			provider.publicKeys[index] = pubKey
		}
		provider.hasPrivateKeys = false
		return provider, nil
	}

	return nil, errors.New("must provide Seed, ExtendedPublicKey, or PublicKeys")
}

// GetMasterPublicKey returns the Master public key at the given HD index.
func (p *HDMasterKeyProvider) GetMasterPublicKey(ctx context.Context, hdIndex uint32) ([]byte, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	// Check pre-derived public keys first
	if pubKey, ok := p.publicKeys[hdIndex]; ok {
		return pubKey, nil
	}

	// If we have a master key, derive the public key
	if p.masterKey != nil {
		key, err := p.deriveKeyAtIndex(hdIndex)
		if err != nil {
			return nil, err
		}
		return key.PublicKey(), nil
	}

	return nil, fmt.Errorf("no public key available for index %d", hdIndex)
}

// VerifyMasterSignature verifies a signature against the Master public key at the given index.
func (p *HDMasterKeyProvider) VerifyMasterSignature(ctx context.Context, hdIndex uint32, data, signature []byte) (bool, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	// Get the public key
	pubKey, err := p.GetMasterPublicKey(ctx, hdIndex)
	if err != nil {
		return false, err
	}

	// Verify signature length
	if len(signature) != 64 {
		return false, fmt.Errorf("invalid signature length: expected 64, got %d", len(signature))
	}

	// Parse the public key
	ecdsaPubKey, err := parseCompressedPublicKey(pubKey)
	if err != nil {
		return false, fmt.Errorf("parse public key: %w", err)
	}

	// Hash the data
	hash := sha256.Sum256(data)

	// Parse r and s from signature
	r := new(big.Int).SetBytes(signature[:32])
	s := new(big.Int).SetBytes(signature[32:])

	// Verify
	return ecdsa.Verify(ecdsaPubKey, hash[:], r, s), nil
}

// SignWithMaster signs data using the Master private key at the given index.
// This is only available in testing/recovery mode.
func (p *HDMasterKeyProvider) SignWithMaster(ctx context.Context, hdIndex uint32, data []byte) ([]byte, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	if !p.hasPrivateKeys {
		return nil, errors.New("private keys not available (production mode)")
	}

	// Derive the private key
	key, err := p.deriveKeyAtIndex(hdIndex)
	if err != nil {
		return nil, err
	}

	// Convert to ECDSA
	ecdsaKey, err := key.ToECDSA()
	if err != nil {
		return nil, fmt.Errorf("convert to ECDSA: %w", err)
	}

	// Hash and sign
	hash := sha256.Sum256(data)
	r, s, err := ecdsa.Sign(nil, ecdsaKey, hash[:])
	if err != nil {
		return nil, fmt.Errorf("sign: %w", err)
	}

	// Encode signature
	signature := make([]byte, 64)
	rBytes := r.Bytes()
	sBytes := s.Bytes()
	copy(signature[32-len(rBytes):32], rBytes)
	copy(signature[64-len(sBytes):64], sBytes)

	return signature, nil
}

// HasPrivateKeys returns whether private keys are available.
func (p *HDMasterKeyProvider) HasPrivateKeys() bool {
	return p.hasPrivateKeys
}

// AddPublicKey adds a pre-derived public key at the given index.
func (p *HDMasterKeyProvider) AddPublicKey(index uint32, pubKey []byte) error {
	if len(pubKey) != 33 {
		return fmt.Errorf("invalid public key length: expected 33, got %d", len(pubKey))
	}

	p.mu.Lock()
	defer p.mu.Unlock()
	p.publicKeys[index] = pubKey
	return nil
}

// AddPublicKeyHex adds a pre-derived public key from hex string.
func (p *HDMasterKeyProvider) AddPublicKeyHex(index uint32, pubKeyHex string) error {
	pubKey, err := hex.DecodeString(pubKeyHex)
	if err != nil {
		return fmt.Errorf("decode hex: %w", err)
	}
	return p.AddPublicKey(index, pubKey)
}

// BatchAddPublicKeys adds multiple pre-derived public keys.
func (p *HDMasterKeyProvider) BatchAddPublicKeys(keys map[uint32][]byte) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	for index, pubKey := range keys {
		if len(pubKey) != 33 {
			return fmt.Errorf("invalid public key at index %d: expected 33 bytes, got %d", index, len(pubKey))
		}
		p.publicKeys[index] = pubKey
	}
	return nil
}

// deriveKeyAtIndex derives a key at the given index.
func (p *HDMasterKeyProvider) deriveKeyAtIndex(index uint32) (*ExtendedKey, error) {
	// Check cache
	if cached, ok := p.keyCache[index]; ok {
		return cached, nil
	}

	if p.masterKey == nil {
		return nil, errors.New("no master key available")
	}

	// Derive using mixer path
	path := MixerDerivationPath(index)
	key, err := p.masterKey.DerivePath(path)
	if err != nil {
		return nil, fmt.Errorf("derive path: %w", err)
	}

	// Cache the key
	p.keyCache[index] = key
	return key, nil
}

// parseCompressedPublicKey parses a compressed public key (33 bytes) to ECDSA public key.
func parseCompressedPublicKey(compressed []byte) (*ecdsa.PublicKey, error) {
	if len(compressed) != 33 {
		return nil, fmt.Errorf("invalid compressed key length: %d", len(compressed))
	}

	// Get the curve (P-256 / secp256r1)
	curve := elliptic.P256()
	params := curve.Params()

	// Parse prefix and x coordinate
	prefix := compressed[0]
	x := new(big.Int).SetBytes(compressed[1:])

	// Calculate y from x using the curve equation
	// y² = x³ - 3x + b (mod p) for P-256
	p := params.P
	b := params.B

	// x³
	x3 := new(big.Int).Mul(x, x)
	x3.Mul(x3, x)
	x3.Mod(x3, p)

	// -3x (for P-256, a = -3)
	threeX := new(big.Int).Mul(big.NewInt(3), x)
	threeX.Mod(threeX, p)

	// y² = x³ - 3x + b
	y2 := new(big.Int).Sub(x3, threeX)
	y2.Add(y2, b)
	y2.Mod(y2, p)

	// y = sqrt(y²) mod p
	y := new(big.Int).ModSqrt(y2, p)
	if y == nil {
		return nil, errors.New("invalid point: no square root")
	}

	// Check parity and adjust if needed
	if (prefix == 0x02 && y.Bit(0) != 0) || (prefix == 0x03 && y.Bit(0) == 0) {
		y.Sub(p, y)
	}

	return &ecdsa.PublicKey{
		Curve: curve,
		X:     x,
		Y:     y,
	}, nil
}

// Ensure HDMasterKeyProvider implements MasterKeyProvider interface
var _ MasterKeyProvider = (*HDMasterKeyProvider)(nil)
