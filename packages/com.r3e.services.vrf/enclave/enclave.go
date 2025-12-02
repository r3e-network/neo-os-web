// Package enclave provides TEE-protected VRF (Verifiable Random Function) operations.
// All cryptographic operations run inside the enclave to ensure
// the randomness generation is tamper-proof and verifiable.
//
// This package integrates with the Enclave SDK for unified TEE operations.
package enclave

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"math/big"

	"github.com/R3E-Network/service_layer/system/enclave/sdk"
)

// EnclaveVRF handles all VRF operations within the TEE enclave.
// Critical operations:
// - VRF key generation
// - Random number generation with proof
// - Proof verification
type EnclaveVRF struct {
	*sdk.BaseEnclave
	publicKey *ecdsa.PublicKey
}

// VRFOutput represents the output of a VRF computation.
type VRFOutput struct {
	Randomness []byte // The generated random value
	Proof      []byte // The cryptographic proof
	PublicKey  []byte // The public key used
}

// VRFConfig holds configuration for the VRF enclave.
type VRFConfig struct {
	ServiceID string
	RequestID string
	CallerID  string
	AccountID string
	SealKey   []byte
}

// NewEnclaveVRF creates a new enclave VRF handler with SDK integration.
// Generates a new key pair sealed within the enclave.
func NewEnclaveVRF() (*EnclaveVRF, error) {
	base, err := sdk.NewBaseEnclave("vrf")
	if err != nil {
		return nil, err
	}

	return &EnclaveVRF{
		BaseEnclave: base,
		publicKey:   &base.GetSigningKey().PublicKey,
	}, nil
}

// NewEnclaveVRFWithSDK creates a VRF handler with full SDK integration.
func NewEnclaveVRFWithSDK(cfg *VRFConfig) (*EnclaveVRF, error) {
	baseCfg := &sdk.BaseConfig{
		ServiceID:   cfg.ServiceID,
		ServiceName: "vrf",
		RequestID:   cfg.RequestID,
		CallerID:    cfg.CallerID,
		AccountID:   cfg.AccountID,
		SealKey:     cfg.SealKey,
	}

	base, err := sdk.NewBaseEnclaveWithSDK(baseCfg)
	if err != nil {
		return nil, err
	}

	return &EnclaveVRF{
		BaseEnclave: base,
		publicKey:   &base.GetSigningKey().PublicKey,
	}, nil
}

// NewEnclaveVRFWithKey creates a VRF handler with an existing sealed key.
func NewEnclaveVRFWithKey(sealedKey []byte) (*EnclaveVRF, error) {
	// In production, unseal the key using TEE sealing
	// For now, derive a key from the sealed data
	if len(sealedKey) < 32 {
		return nil, errors.New("invalid sealed key")
	}

	// Derive private key from sealed data
	d := new(big.Int).SetBytes(sealedKey[:32])
	privateKey := &ecdsa.PrivateKey{
		PublicKey: ecdsa.PublicKey{
			Curve: elliptic.P256(),
		},
		D: d,
	}
	privateKey.PublicKey.X, privateKey.PublicKey.Y = privateKey.PublicKey.Curve.ScalarBaseMult(d.Bytes())

	base, err := sdk.NewBaseEnclave("vrf")
	if err != nil {
		return nil, err
	}
	base.SetSigningKey(privateKey)

	return &EnclaveVRF{
		BaseEnclave: base,
		publicKey:   &privateKey.PublicKey,
	}, nil
}

// InitializeWithSDK initializes the VRF handler with an existing SDK instance.
func (e *EnclaveVRF) InitializeWithSDK(enclaveSDK sdk.EnclaveSDK) error {
	return e.BaseEnclave.InitializeWithSDK(enclaveSDK)
}

// GenerateRandomness generates verifiable randomness for a given seed.
// This operation runs entirely within the TEE enclave.
func (e *EnclaveVRF) GenerateRandomness(seed []byte) (*VRFOutput, error) {
	e.Lock()
	defer e.Unlock()

	privateKey := e.GetSigningKey()

	// Hash the seed to get a point on the curve
	h := sha256.Sum256(seed)

	// Generate the VRF output using ECDSA-based VRF
	// In production, use a proper VRF implementation (e.g., ECVRF)
	r, s, err := ecdsa.Sign(rand.Reader, privateKey, h[:])
	if err != nil {
		return nil, err
	}

	// The randomness is derived from the signature
	randomnessHash := sha256.New()
	randomnessHash.Write(r.Bytes())
	randomnessHash.Write(s.Bytes())
	randomnessHash.Write(seed)
	randomness := randomnessHash.Sum(nil)

	// Create the proof
	proof := append(r.Bytes(), s.Bytes()...)

	// Encode public key
	pubKeyBytes := elliptic.Marshal(e.publicKey.Curve, e.publicKey.X, e.publicKey.Y)

	return &VRFOutput{
		Randomness: randomness,
		Proof:      proof,
		PublicKey:  pubKeyBytes,
	}, nil
}

// GenerateRandomnessWithSDK generates randomness using the SDK signer.
func (e *EnclaveVRF) GenerateRandomnessWithSDK(ctx context.Context, seed []byte) (*VRFOutput, error) {
	signature, pubKey, err := e.SignDataWithSDK(ctx, seed)
	if err != nil {
		return nil, err
	}

	// Derive randomness from signature
	randomnessHash := sha256.New()
	randomnessHash.Write(signature)
	randomnessHash.Write(seed)
	randomness := randomnessHash.Sum(nil)

	return &VRFOutput{
		Randomness: randomness,
		Proof:      signature,
		PublicKey:  pubKey,
	}, nil
}

// VerifyRandomness verifies a VRF proof.
// This can be done outside the enclave for transparency.
func VerifyRandomness(seed []byte, output *VRFOutput) (bool, error) {
	if len(output.Proof) < 64 {
		return false, errors.New("invalid proof length")
	}

	// Parse public key
	x, y := elliptic.Unmarshal(elliptic.P256(), output.PublicKey)
	if x == nil {
		return false, errors.New("invalid public key")
	}

	pubKey := &ecdsa.PublicKey{
		Curve: elliptic.P256(),
		X:     x,
		Y:     y,
	}

	// Parse proof (r, s)
	r := new(big.Int).SetBytes(output.Proof[:32])
	s := new(big.Int).SetBytes(output.Proof[32:64])

	// Verify the signature
	h := sha256.Sum256(seed)
	return ecdsa.Verify(pubKey, h[:], r, s), nil
}

// GetRandomnessHash returns the hash of generated randomness for logging.
func GetRandomnessHash(randomness []byte) string {
	h := sha256.Sum256(randomness)
	return hex.EncodeToString(h[:])
}
