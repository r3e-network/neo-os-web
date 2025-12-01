// Package mixer provides privacy-preserving transaction mixing service.
package mixer

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"sort"

	"golang.org/x/crypto/ripemd160"
)

// Neo N3 1-of-2 Multi-sig Implementation
//
// Verification Script Structure (Neo N3):
// - PUSHINT8 1 (minimum signatures required)
// - PUSHDATA1 <pubkey1> (33 bytes compressed)
// - PUSHDATA1 <pubkey2> (33 bytes compressed)
// - PUSHINT8 2 (total signers)
// - SYSCALL System.Crypto.CheckMultisig
//
// This creates a standard Neo N3 multi-sig account where:
// - Either TEE key OR Master key can sign (1-of-2)
// - On-chain, it appears as a normal multi-sig address
// - No contract deployment needed
// - Each derived address is independent (no linkability)

// Neo N3 OpCodes
const (
	OpPushInt8  byte = 0x00
	OpPushData1 byte = 0x0C
	OpSysCall   byte = 0x41
)

// Neo N3 System Call Hashes
var (
	// System.Crypto.CheckMultisig hash (little-endian)
	SysCallCheckMultisig = []byte{0x95, 0x44, 0x0d, 0x78}
)

// Neo N3 Address Version
const (
	NeoN3AddressVersion byte = 0x35 // Neo N3 mainnet address version
)

// Errors
var (
	ErrInvalidPublicKey    = errors.New("invalid public key: must be 33 bytes compressed")
	ErrInsufficientSigners = errors.New("insufficient signers: need at least 2 for multi-sig")
	ErrInvalidThreshold    = errors.New("invalid threshold: must be between 1 and number of signers")
)

// MultiSigAccount represents a Neo N3 multi-sig account.
type MultiSigAccount struct {
	Threshold          int      `json:"threshold"`           // Minimum signatures required (1 for 1-of-2)
	PublicKeys         [][]byte `json:"public_keys"`         // Sorted compressed public keys
	VerificationScript []byte   `json:"verification_script"` // Neo N3 verification script
	ScriptHash         []byte   `json:"script_hash"`         // 20-byte script hash
	Address            string   `json:"address"`             // Neo N3 address (base58check)
}

// CreateMultiSigAccount creates a Neo N3 multi-sig account from public keys.
// For 1-of-2 multi-sig: threshold=1, publicKeys=[teeKey, masterKey]
func CreateMultiSigAccount(threshold int, publicKeys ...[]byte) (*MultiSigAccount, error) {
	if len(publicKeys) < 2 {
		return nil, ErrInsufficientSigners
	}
	if threshold < 1 || threshold > len(publicKeys) {
		return nil, ErrInvalidThreshold
	}

	// Validate and copy public keys
	sortedKeys := make([][]byte, len(publicKeys))
	for i, pk := range publicKeys {
		if len(pk) != 33 {
			return nil, fmt.Errorf("%w: key %d has length %d", ErrInvalidPublicKey, i, len(pk))
		}
		sortedKeys[i] = make([]byte, 33)
		copy(sortedKeys[i], pk)
	}

	// Sort public keys lexicographically (Neo N3 requirement)
	sort.Slice(sortedKeys, func(i, j int) bool {
		return bytes.Compare(sortedKeys[i], sortedKeys[j]) < 0
	})

	// Build verification script
	script := buildMultiSigScript(threshold, sortedKeys)

	// Calculate script hash (RIPEMD160(SHA256(script)))
	scriptHash := hash160(script)

	// Generate Neo N3 address
	address := scriptHashToAddress(scriptHash)

	return &MultiSigAccount{
		Threshold:          threshold,
		PublicKeys:         sortedKeys,
		VerificationScript: script,
		ScriptHash:         scriptHash,
		Address:            address,
	}, nil
}

// Create1of2MultiSig creates a 1-of-2 multi-sig account for double-blind architecture.
// Either TEE key or Master key can sign transactions.
func Create1of2MultiSig(teePublicKey, masterPublicKey []byte) (*MultiSigAccount, error) {
	return CreateMultiSigAccount(1, teePublicKey, masterPublicKey)
}

// buildMultiSigScript constructs the Neo N3 verification script.
func buildMultiSigScript(threshold int, sortedKeys [][]byte) []byte {
	var script bytes.Buffer

	// Push threshold (minimum signatures)
	script.WriteByte(OpPushInt8)
	script.WriteByte(byte(threshold))

	// Push each public key
	for _, pk := range sortedKeys {
		script.WriteByte(OpPushData1)
		script.WriteByte(byte(len(pk))) // 33
		script.Write(pk)
	}

	// Push total signers count
	script.WriteByte(OpPushInt8)
	script.WriteByte(byte(len(sortedKeys)))

	// SYSCALL System.Crypto.CheckMultisig
	script.WriteByte(OpSysCall)
	script.Write(SysCallCheckMultisig)

	return script.Bytes()
}

// hash160 computes RIPEMD160(SHA256(data)).
func hash160(data []byte) []byte {
	sha := sha256.Sum256(data)
	ripemd := ripemd160.New()
	ripemd.Write(sha[:])
	return ripemd.Sum(nil)
}

// scriptHashToAddress converts a script hash to a Neo N3 address.
func scriptHashToAddress(scriptHash []byte) string {
	// Prepend version byte
	data := make([]byte, 21)
	data[0] = NeoN3AddressVersion
	copy(data[1:], scriptHash)

	// Base58Check encode
	return base58CheckEncode(data)
}

// base58CheckEncode encodes data with Base58Check (with checksum).
func base58CheckEncode(data []byte) string {
	// Double SHA256 for checksum
	hash1 := sha256.Sum256(data)
	hash2 := sha256.Sum256(hash1[:])
	checksum := hash2[:4]

	// Append checksum
	full := append(data, checksum...)

	return base58Encode(full)
}

// base58Encode encodes bytes to Base58.
func base58Encode(data []byte) string {
	const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

	// Count leading zeros
	leadingZeros := 0
	for _, b := range data {
		if b != 0 {
			break
		}
		leadingZeros++
	}

	// Convert to big integer
	num := new(big.Int).SetBytes(data)
	base := big.NewInt(58)
	zero := big.NewInt(0)
	mod := new(big.Int)

	var encoded []byte
	for num.Cmp(zero) > 0 {
		num.DivMod(num, base, mod)
		encoded = append([]byte{alphabet[mod.Int64()]}, encoded...)
	}

	// Add leading '1's for each leading zero byte
	for i := 0; i < leadingZeros; i++ {
		encoded = append([]byte{'1'}, encoded...)
	}

	return string(encoded)
}

// AddressToScriptHash converts a Neo N3 address back to script hash.
func AddressToScriptHash(address string) ([]byte, error) {
	decoded, err := base58CheckDecode(address)
	if err != nil {
		return nil, fmt.Errorf("decode address: %w", err)
	}

	if len(decoded) != 21 {
		return nil, errors.New("invalid address length")
	}

	if decoded[0] != NeoN3AddressVersion {
		return nil, errors.New("invalid address version")
	}

	return decoded[1:], nil
}

// base58CheckDecode decodes a Base58Check encoded string.
func base58CheckDecode(s string) ([]byte, error) {
	decoded := base58Decode(s)
	if len(decoded) < 5 {
		return nil, errors.New("invalid base58check: too short")
	}

	// Verify checksum
	data := decoded[:len(decoded)-4]
	checksum := decoded[len(decoded)-4:]

	hash1 := sha256.Sum256(data)
	hash2 := sha256.Sum256(hash1[:])

	if !bytes.Equal(checksum, hash2[:4]) {
		return nil, errors.New("invalid base58check: checksum mismatch")
	}

	return data, nil
}

// base58Decode decodes a Base58 string to bytes.
func base58Decode(s string) []byte {
	const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

	// Build reverse lookup
	alphabetMap := make(map[rune]int64)
	for i, c := range alphabet {
		alphabetMap[c] = int64(i)
	}

	// Count leading '1's
	leadingOnes := 0
	for _, c := range s {
		if c != '1' {
			break
		}
		leadingOnes++
	}

	// Convert from base58
	num := big.NewInt(0)
	base := big.NewInt(58)
	for _, c := range s {
		val, ok := alphabetMap[c]
		if !ok {
			return nil
		}
		num.Mul(num, base)
		num.Add(num, big.NewInt(val))
	}

	// Convert to bytes
	decoded := num.Bytes()

	// Add leading zeros
	result := make([]byte, leadingOnes+len(decoded))
	copy(result[leadingOnes:], decoded)

	return result
}

// VerifyMultiSigAddress verifies that an address matches the expected multi-sig configuration.
func VerifyMultiSigAddress(address string, threshold int, publicKeys ...[]byte) (bool, error) {
	expected, err := CreateMultiSigAccount(threshold, publicKeys...)
	if err != nil {
		return false, err
	}
	return expected.Address == address, nil
}

// ScriptHashHex returns the script hash as a hex string (big-endian, Neo convention).
func (m *MultiSigAccount) ScriptHashHex() string {
	// Neo uses big-endian for display
	reversed := make([]byte, len(m.ScriptHash))
	for i, b := range m.ScriptHash {
		reversed[len(m.ScriptHash)-1-i] = b
	}
	return hex.EncodeToString(reversed)
}

// VerificationScriptHex returns the verification script as a hex string.
func (m *MultiSigAccount) VerificationScriptHex() string {
	return hex.EncodeToString(m.VerificationScript)
}
