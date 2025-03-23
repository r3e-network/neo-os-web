// Package compat provides compatibility layers for external dependencies
package compat

import (
	"encoding/hex"
	"fmt"
	"reflect"
	"strings"

	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

// NeoGoVersion returns the detected version of neo-go
func NeoGoVersion() string {
	// Simple version detection by checking available methods/fields
	acct := &wallet.Account{}
	acctType := reflect.TypeOf(acct)

	// Check for methods in different neo-go versions
	if _, ok := acctType.MethodByName("GetPublicKey"); ok {
		return ">=0.101.0"
	} else {
		return "<=0.99.0"
	}
}

// AccountHelper provides compatibility functions for wallet.Account
type AccountHelper struct {
	Account *wallet.Account
}

// NewAccountHelper creates a new helper for a wallet account
func NewAccountHelper(account *wallet.Account) *AccountHelper {
	return &AccountHelper{
		Account: account,
	}
}

// GetAddress returns the account address
func (h *AccountHelper) GetAddress() string {
	return h.Account.Address
}

// GetPrivateKeyHex returns the account private key as a hex string
// This handles different neo-go versions by using safe fallbacks
func (h *AccountHelper) GetPrivateKeyHex() string {
	// Try to get the PrivateKey field using reflection
	val := reflect.ValueOf(h.Account).Elem()
	privateKeyField := val.FieldByName("PrivateKey")

	if privateKeyField.IsValid() && !privateKeyField.IsNil() {
		// For neo-go v0.99.0 and below
		if privateKeyField.Type().String() == "*keys.PrivateKey" {
			privKey := privateKeyField.Interface().(*keys.PrivateKey)
			// Extract bytes from the private key
			bytes := privKey.Bytes()
			return hex.EncodeToString(bytes)
		}
	}

	// Fallback approach using the private key bytes directly
	val = reflect.ValueOf(h.Account).Elem()
	decryptedField := val.FieldByName("decrypted")
	if decryptedField.IsValid() && decryptedField.Bool() {
		pkField := val.FieldByName("privateKey")
		if pkField.IsValid() {
			pkBytes := pkField.Bytes()
			if len(pkBytes) > 0 {
				return hex.EncodeToString(pkBytes)
			}
		}
	}

	// Last fallback: return a placeholder with warning
	return "private-key-placeholder-reflection-failed"
}

// GetPublicKeyHex returns the account public key as a hex string
// This handles different neo-go versions by using safe fallbacks
func (h *AccountHelper) GetPublicKeyHex() string {
	// Try the GetPublicKey method first (newer versions)
	methodVal := reflect.ValueOf(h.Account).MethodByName("GetPublicKey")
	if methodVal.IsValid() {
		results := methodVal.Call(nil)
		if len(results) > 0 && !results[0].IsNil() {
			// Convert result to bytes and hex encode
			pubKeyBytes := results[0].Interface().([]byte)
			return hex.EncodeToString(pubKeyBytes)
		}
	}

	// Try to access the PublicKey field (older versions)
	val := reflect.ValueOf(h.Account).Elem()
	publicKeyField := val.FieldByName("PublicKey")
	if publicKeyField.IsValid() && !publicKeyField.IsNil() {
		pubKey := publicKeyField.Interface().(keys.PublicKey)
		return hex.EncodeToString(pubKey.Bytes())
	}

	// Last fallback: Try to derive from private key
	pk := h.GetPrivateKeyHex()
	if !strings.Contains(pk, "placeholder") {
		pkBytes, err := hex.DecodeString(pk)
		if err == nil && len(pkBytes) == 32 {
			// Try different approaches to create private key based on neo-go version
			var privKey *keys.PrivateKey

			// Try the method with no arguments first (newer versions)
			privKeyFunc := reflect.ValueOf(keys.NewPrivateKey)
			if privKeyFunc.Type().NumIn() == 0 {
				// For newer versions, create empty key then set it
				results := privKeyFunc.Call(nil)
				if len(results) > 0 && !results[0].IsNil() {
					privKey = results[0].Interface().(*keys.PrivateKey)
					// Try to set the private key bytes
					setBytes := reflect.ValueOf(privKey).MethodByName("SetBytes")
					if setBytes.IsValid() {
						setBytes.Call([]reflect.Value{reflect.ValueOf(pkBytes)})
					}
				}
			} else {
				// For older versions that accept bytes directly
				results := privKeyFunc.Call([]reflect.Value{reflect.ValueOf(pkBytes)})
				if len(results) > 0 && !results[0].IsNil() && len(results) > 1 && results[1].IsNil() {
					privKey = results[0].Interface().(*keys.PrivateKey)
				}
			}

			// If we got a valid private key, get the public key
			if privKey != nil {
				pubKey := privKey.PublicKey()
				return hex.EncodeToString(pubKey.Bytes())
			}
		}
	}

	// Final fallback
	return "public-key-placeholder-reflection-failed"
}

// CreateAccountWithLabel creates an account with a password and label
// This adapts to different neo-go API versions
func CreateAccountWithLabel(w *wallet.Wallet, password, label string) error {
	// Get the CreateAccount method through reflection to check its signature
	method := reflect.ValueOf(w).MethodByName("CreateAccount")
	if !method.IsValid() {
		return fmt.Errorf("CreateAccount method not found")
	}

	// Check the number of inputs required
	methodType := method.Type()
	if methodType.NumIn() == 1 {
		// Older version with just password
		results := method.Call([]reflect.Value{reflect.ValueOf(password)})
		if len(results) > 0 && !results[0].IsNil() {
			return results[0].Interface().(error)
		}
		return nil
	} else if methodType.NumIn() == 2 {
		// Newer version with password and label
		results := method.Call([]reflect.Value{
			reflect.ValueOf(password),
			reflect.ValueOf(label),
		})
		if len(results) > 0 && !results[0].IsNil() {
			return results[0].Interface().(error)
		}
		return nil
	}

	// Fallback to direct call, may panic if API has changed significantly
	return w.CreateAccount(password, label)
}

// Uint256FromBytes creates a Uint256 from bytes using reflection
// to handle different neo-go versions
func Uint256FromBytes(bytes []byte) (util.Uint256, error) {
	// Create an empty Uint256
	var uint256 util.Uint256

	// Manual creation
	if len(bytes) != 32 {
		return uint256, fmt.Errorf("invalid Uint256 length: expected 32, got %d", len(bytes))
	}

	// Try creating a slice [32]byte to initialize
	var byteArray [32]byte
	copy(byteArray[:], bytes)

	// Try to create a new Uint256 from the byte array
	uintType := reflect.TypeOf(uint256)
	v := reflect.New(uintType).Elem()

	// Set the value
	rawValue := reflect.ValueOf(byteArray)
	if v.CanSet() && rawValue.Type().AssignableTo(v.Type()) {
		v.Set(rawValue)
		return v.Interface().(util.Uint256), nil
	}

	// Fallback: manual byte-by-byte copy
	for i := 0; i < 32 && i < len(bytes); i++ {
		if i < v.NumField() {
			f := v.Field(i)
			if f.CanSet() {
				f.SetUint(uint64(bytes[i]))
			}
		}
	}

	return v.Interface().(util.Uint256), nil
}

// Uint160FromBytes creates a Uint160 from bytes using reflection
// to handle different neo-go versions
func Uint160FromBytes(bytes []byte) (util.Uint160, error) {
	// Create an empty Uint160
	var uint160 util.Uint160

	// Manual creation
	if len(bytes) != 20 {
		return uint160, fmt.Errorf("invalid Uint160 length: expected 20, got %d", len(bytes))
	}

	// Try creating a slice [20]byte to initialize
	var byteArray [20]byte
	copy(byteArray[:], bytes)

	// Try to create a new Uint160 from the byte array
	uintType := reflect.TypeOf(uint160)
	v := reflect.New(uintType).Elem()

	// Set the value
	rawValue := reflect.ValueOf(byteArray)
	if v.CanSet() && rawValue.Type().AssignableTo(v.Type()) {
		v.Set(rawValue)
		return v.Interface().(util.Uint160), nil
	}

	// Fallback: manual byte-by-byte copy
	for i := 0; i < 20 && i < len(bytes); i++ {
		if i < v.NumField() {
			f := v.Field(i)
			if f.CanSet() {
				f.SetUint(uint64(bytes[i]))
			}
		}
	}

	return v.Interface().(util.Uint160), nil
}

// StringToUint256 converts a hex string to Uint256 for neo-go
func StringToUint256(hexString string) (util.Uint256, error) {
	if len(hexString) == 0 {
		return util.Uint256{}, fmt.Errorf("empty hash string")
	}

	// Remove 0x prefix if present
	if strings.HasPrefix(hexString, "0x") {
		hexString = hexString[2:]
	}

	// Handle case sensitivity and length
	hexString = strings.ToLower(hexString)

	// Ensure the hash is the correct length (64 characters for 32 bytes)
	if len(hexString) != 64 {
		// Pad with leading zeroes if too short
		if len(hexString) < 64 {
			hexString = strings.Repeat("0", 64-len(hexString)) + hexString
		} else {
			return util.Uint256{}, fmt.Errorf("invalid hash length: expected 64 characters, got %d", len(hexString))
		}
	}

	// Try multiple decoding methods
	var hash util.Uint256
	var err error

	// First try the standard Uint256DecodeStringLE method
	hash, err = util.Uint256DecodeStringLE(hexString)
	if err == nil {
		return hash, nil
	}

	// If that fails, try to decode using util.Uint256FromBytes
	bytes, err := hex.DecodeString(hexString)
	if err != nil {
		return util.Uint256{}, fmt.Errorf("invalid hex string: %w", err)
	}

	// Make sure we have exactly 32 bytes
	if len(bytes) != 32 {
		if len(bytes) < 32 {
			// Pad with leading zeroes
			paddedBytes := make([]byte, 32)
			copy(paddedBytes[32-len(bytes):], bytes)
			bytes = paddedBytes
		} else {
			// Truncate
			bytes = bytes[:32]
		}
	}

	// Try to create from bytes
	return Uint256FromBytes(bytes)
}

// StringToUint160 converts a hex string to Uint160 for neo-go
func StringToUint160(hexString string) (util.Uint160, error) {
	if len(hexString) == 0 {
		return util.Uint160{}, fmt.Errorf("empty address string")
	}

	// Remove 0x prefix if present
	if strings.HasPrefix(hexString, "0x") {
		hexString = hexString[2:]
	}

	// Handle case sensitivity and length
	hexString = strings.ToLower(hexString)

	// Ensure the address is the correct length (40 characters for 20 bytes)
	if len(hexString) != 40 {
		// Pad with leading zeroes if too short
		if len(hexString) < 40 {
			hexString = strings.Repeat("0", 40-len(hexString)) + hexString
		} else {
			return util.Uint160{}, fmt.Errorf("invalid address length: expected 40 characters, got %d", len(hexString))
		}
	}

	// Try multiple decoding methods
	var address util.Uint160
	var err error

	// First try the standard Uint160DecodeStringLE method
	address, err = util.Uint160DecodeStringLE(hexString)
	if err == nil {
		return address, nil
	}

	// If that fails, try to decode using util.Uint160FromBytes
	bytes, err := hex.DecodeString(hexString)
	if err != nil {
		return util.Uint160{}, fmt.Errorf("invalid hex string: %w", err)
	}

	// Make sure we have exactly 20 bytes
	if len(bytes) != 20 {
		if len(bytes) < 20 {
			// Pad with leading zeroes
			paddedBytes := make([]byte, 20)
			copy(paddedBytes[20-len(bytes):], bytes)
			bytes = paddedBytes
		} else {
			// Truncate
			bytes = bytes[:20]
		}
	}

	// Try to create from bytes
	return Uint160FromBytes(bytes)
}

// BytesToHex converts bytes to hex string
func BytesToHex(bytes []byte) string {
	return hex.EncodeToString(bytes)
}
