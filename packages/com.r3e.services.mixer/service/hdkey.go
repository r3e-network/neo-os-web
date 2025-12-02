// Package mixer provides privacy-preserving transaction mixing service.
package mixer

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
)

// HD Key Derivation for Double-Blind 1/2 Multi-sig Architecture
//
// Architecture Overview:
// - Master Root Seed: Offline management, recovery capability
// - TEE Root Seed: Online service operations, daily signing
// - Each pool account: HD derived keys from both seeds at same index
// - Neo N3 1-of-2 multi-sig: Either key can sign (TEE daily, Master recovery)
//
// Derivation Path: m/44'/888'/account'/0/index
// - 888' = Neo N3 coin type
// - account' = service account (0 for mixer pools)
// - index = pool account index (incremental)

// HDKeyManager manages hierarchical deterministic key derivation.
type HDKeyManager interface {
	// DerivePoolKeys derives a key pair at the given index for pool accounts.
	// Returns TEE public key, Master public key, and the multi-sig address.
	DerivePoolKeys(ctx context.Context, index uint32) (*PoolKeyPair, error)

	// SignWithTEE signs data using the TEE-derived key at the given index.
	SignWithTEE(ctx context.Context, index uint32, data []byte) ([]byte, error)

	// GetTEEPublicKey returns the TEE public key at the given index.
	GetTEEPublicKey(ctx context.Context, index uint32) ([]byte, error)

	// GetMasterPublicKey returns the Master public key at the given index.
	// Master private key is kept offline; only public key is available.
	GetMasterPublicKey(ctx context.Context, index uint32) ([]byte, error)

	// VerifySignature verifies a signature against the multi-sig address.
	VerifySignature(ctx context.Context, index uint32, data, signature []byte) (bool, error)

	// GetNextIndex returns the next available pool index.
	GetNextIndex(ctx context.Context) (uint32, error)
}

// PoolKeyPair contains the derived keys for a pool account.
type PoolKeyPair struct {
	Index           uint32 `json:"index"`             // HD derivation index
	TEEPublicKey    []byte `json:"tee_public_key"`    // TEE-derived public key (compressed)
	MasterPublicKey []byte `json:"master_public_key"` // Master-derived public key (compressed)
	MultiSigScript  []byte `json:"multisig_script"`   // Neo N3 1-of-2 verification script
	Address         string `json:"address"`           // Neo N3 multi-sig address
}

// ExtendedKey represents a BIP32 extended key.
type ExtendedKey struct {
	Key       []byte // 33 bytes (compressed public) or 32 bytes (private)
	ChainCode []byte // 32 bytes
	Depth     uint8
	Index     uint32
	IsPrivate bool
}

// HD derivation constants
const (
	// HardenedOffset is the BIP32 hardened key offset
	HardenedOffset = 0x80000000

	// Neo N3 BIP44 coin type (888 for Neo)
	NeoN3CoinType = 888

	// Mixer service account index
	MixerAccountIndex = 0

	// Key derivation path components
	PurposeBIP44 = 44
)

// Errors
var (
	ErrInvalidSeed       = errors.New("invalid seed length: must be 16-64 bytes")
	ErrInvalidKeyLength  = errors.New("invalid key length")
	ErrHardenedPublic    = errors.New("cannot derive hardened key from public key")
	ErrInvalidIndex      = errors.New("invalid derivation index")
	ErrDerivationFailed  = errors.New("key derivation failed")
)

// NewExtendedKeyFromSeed creates a master extended key from a seed.
// Seed should be 16-64 bytes (128-512 bits).
func NewExtendedKeyFromSeed(seed []byte) (*ExtendedKey, error) {
	if len(seed) < 16 || len(seed) > 64 {
		return nil, ErrInvalidSeed
	}

	// HMAC-SHA512 with "Bitcoin seed" (BIP32 standard)
	hmacHash := hmac.New(sha512.New, []byte("Bitcoin seed"))
	hmacHash.Write(seed)
	lr := hmacHash.Sum(nil)

	// Split into key (left 32 bytes) and chain code (right 32 bytes)
	key := lr[:32]
	chainCode := lr[32:]

	// Verify key is valid (not zero, less than curve order)
	keyInt := new(big.Int).SetBytes(key)
	if keyInt.Sign() == 0 || keyInt.Cmp(elliptic.P256().Params().N) >= 0 {
		return nil, ErrDerivationFailed
	}

	return &ExtendedKey{
		Key:       key,
		ChainCode: chainCode,
		Depth:     0,
		Index:     0,
		IsPrivate: true,
	}, nil
}

// DeriveChild derives a child key at the given index.
// Use index >= HardenedOffset for hardened derivation.
func (k *ExtendedKey) DeriveChild(index uint32) (*ExtendedKey, error) {
	isHardened := index >= HardenedOffset

	// Cannot derive hardened child from public key
	if isHardened && !k.IsPrivate {
		return nil, ErrHardenedPublic
	}

	var data []byte
	if isHardened {
		// Hardened: 0x00 || private key || index
		data = make([]byte, 37)
		data[0] = 0x00
		copy(data[1:33], k.Key)
		binary.BigEndian.PutUint32(data[33:], index)
	} else {
		// Normal: public key || index
		pubKey := k.PublicKey()
		data = make([]byte, 37)
		copy(data[:33], pubKey)
		binary.BigEndian.PutUint32(data[33:], index)
	}

	// HMAC-SHA512
	hmacHash := hmac.New(sha512.New, k.ChainCode)
	hmacHash.Write(data)
	lr := hmacHash.Sum(nil)

	childKey := lr[:32]
	childChainCode := lr[32:]

	// Add parent key to child key (mod n)
	curve := elliptic.P256()
	childInt := new(big.Int).SetBytes(childKey)
	parentInt := new(big.Int).SetBytes(k.Key)
	childInt.Add(childInt, parentInt)
	childInt.Mod(childInt, curve.Params().N)

	if childInt.Sign() == 0 {
		return nil, ErrDerivationFailed
	}

	// Pad to 32 bytes
	childKeyBytes := childInt.Bytes()
	if len(childKeyBytes) < 32 {
		padded := make([]byte, 32)
		copy(padded[32-len(childKeyBytes):], childKeyBytes)
		childKeyBytes = padded
	}

	return &ExtendedKey{
		Key:       childKeyBytes,
		ChainCode: childChainCode,
		Depth:     k.Depth + 1,
		Index:     index,
		IsPrivate: k.IsPrivate,
	}, nil
}

// PublicKey returns the compressed public key (33 bytes).
func (k *ExtendedKey) PublicKey() []byte {
	if !k.IsPrivate {
		return k.Key
	}

	// Derive public key from private key
	curve := elliptic.P256()
	x, y := curve.ScalarBaseMult(k.Key)

	// Compress: 0x02 (even y) or 0x03 (odd y) + x
	pubKey := make([]byte, 33)
	if y.Bit(0) == 0 {
		pubKey[0] = 0x02
	} else {
		pubKey[0] = 0x03
	}
	xBytes := x.Bytes()
	copy(pubKey[33-len(xBytes):], xBytes)

	return pubKey
}

// PrivateKey returns the private key bytes (32 bytes).
// Returns nil if this is a public extended key.
func (k *ExtendedKey) PrivateKey() []byte {
	if !k.IsPrivate {
		return nil
	}
	return k.Key
}

// ToECDSA converts the extended key to an ECDSA private key.
func (k *ExtendedKey) ToECDSA() (*ecdsa.PrivateKey, error) {
	if !k.IsPrivate {
		return nil, errors.New("cannot convert public key to ECDSA private key")
	}

	curve := elliptic.P256()
	priv := new(ecdsa.PrivateKey)
	priv.Curve = curve
	priv.D = new(big.Int).SetBytes(k.Key)
	priv.PublicKey.X, priv.PublicKey.Y = curve.ScalarBaseMult(k.Key)

	return priv, nil
}

// DerivePath derives a key following a BIP32 path.
// Path format: m/44'/888'/0'/0/index
func (k *ExtendedKey) DerivePath(path []uint32) (*ExtendedKey, error) {
	current := k
	var err error

	for _, index := range path {
		current, err = current.DeriveChild(index)
		if err != nil {
			return nil, fmt.Errorf("derive index %d: %w", index, err)
		}
	}

	return current, nil
}

// MixerDerivationPath returns the standard derivation path for mixer pool accounts.
// Path: m/44'/888'/0'/0/index
func MixerDerivationPath(index uint32) []uint32 {
	return []uint32{
		PurposeBIP44 + HardenedOffset,    // 44' (BIP44 purpose)
		NeoN3CoinType + HardenedOffset,   // 888' (Neo N3)
		MixerAccountIndex + HardenedOffset, // 0' (mixer account)
		0,                                  // 0 (external chain)
		index,                              // pool index
	}
}

// PublicKeyHex returns the public key as a hex string.
func (k *ExtendedKey) PublicKeyHex() string {
	return hex.EncodeToString(k.PublicKey())
}

// Neuter returns a public extended key from a private extended key.
func (k *ExtendedKey) Neuter() *ExtendedKey {
	if !k.IsPrivate {
		return k
	}

	return &ExtendedKey{
		Key:       k.PublicKey(),
		ChainCode: k.ChainCode,
		Depth:     k.Depth,
		Index:     k.Index,
		IsPrivate: false,
	}
}
