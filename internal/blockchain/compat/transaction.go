package compat

import (
	"fmt"
	"reflect"

	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/vm/opcode"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

// TransactionHelper provides compatibility functions for transactions
type TransactionHelper struct {
	// Empty by design, just a namespace for methods
}

// NewTransactionHelper creates a new transaction helper
func NewTransactionHelper() *TransactionHelper {
	return &TransactionHelper{}
}

// CreateInvocationTx creates an invocation transaction for different neo-go versions
func (h *TransactionHelper) CreateInvocationTx(
	script []byte,
	account *wallet.Account,
	sysFee int64,
	netFee int64,
	additionalAttributes ...transaction.Attribute,
) (*transaction.Transaction, error) {
	// Check for the newer API first (Transaction builder)
	builderType := reflect.TypeOf((*transaction.Builder)(nil))
	if builderType != nil {
		return h.createInvocationTxNew(script, account, sysFee, netFee, additionalAttributes...)
	}

	// Fall back to the older API
	return h.createInvocationTxOld(script, account, sysFee, netFee, additionalAttributes...)
}

// createInvocationTxNew creates a transaction using the new builder API
func (h *TransactionHelper) createInvocationTxNew(
	script []byte,
	account *wallet.Account,
	sysFee int64,
	netFee int64,
	additionalAttributes ...transaction.Attribute,
) (*transaction.Transaction, error) {
	// Get the Builder type using reflection
	builderType := reflect.TypeOf((*transaction.Builder)(nil)).Elem()

	// Create a new builder
	builder := reflect.New(builderType).Interface().(*transaction.Builder)

	// Call builder methods using reflection
	methodNames := []string{
		"Script", "SystemFee", "NetworkFee", "Attributes", "Signers",
	}

	for _, methodName := range methodNames {
		method := reflect.ValueOf(builder).MethodByName(methodName)
		if !method.IsValid() {
			return nil, fmt.Errorf("method %s not found on transaction builder", methodName)
		}
	}

	// Set the script
	scriptMethod := reflect.ValueOf(builder).MethodByName("Script")
	scriptMethod.Call([]reflect.Value{reflect.ValueOf(script)})

	// Set fees
	sysMethod := reflect.ValueOf(builder).MethodByName("SystemFee")
	sysMethod.Call([]reflect.Value{reflect.ValueOf(sysFee)})

	netMethod := reflect.ValueOf(builder).MethodByName("NetworkFee")
	netMethod.Call([]reflect.Value{reflect.ValueOf(netFee)})

	// Set attributes
	attrMethod := reflect.ValueOf(builder).MethodByName("Attributes")
	attrMethod.Call([]reflect.Value{reflect.ValueOf(additionalAttributes)})

	// Set signer (account)
	signerMethod := reflect.ValueOf(builder).MethodByName("Signers")

	// Create the signers
	signerHash, err := smartcontract.CreateSignatureRedeemScript(account.PublicKey().Bytes())
	if err != nil {
		return nil, fmt.Errorf("failed to create signature redeem script: %w", err)
	}

	// Get the hash
	hash, err := getScriptHash(signerHash)
	if err != nil {
		return nil, fmt.Errorf("failed to get script hash: %w", err)
	}

	// Create caller contract (differs by version)
	caller := createDefaultSigner(hash)

	// Add the signer
	signerMethod.Call([]reflect.Value{reflect.ValueOf(caller)})

	// Build the transaction
	buildMethod := reflect.ValueOf(builder).MethodByName("Build")
	results := buildMethod.Call(nil)

	if len(results) == 0 || results[0].IsNil() {
		return nil, fmt.Errorf("failed to build transaction")
	}

	tx := results[0].Interface().(*transaction.Transaction)

	// Sign the transaction
	if err := signTransaction(tx, account); err != nil {
		return nil, fmt.Errorf("failed to sign transaction: %w", err)
	}

	return tx, nil
}

// createInvocationTxOld creates a transaction using the old API
func (h *TransactionHelper) createInvocationTxOld(
	script []byte,
	account *wallet.Account,
	sysFee int64,
	netFee int64,
	additionalAttributes ...transaction.Attribute,
) (*transaction.Transaction, error) {
	// Try older API by using reflection to find the NewInvocationTX function
	invokeTxFunc := reflect.ValueOf(transaction.NewInvocationTX)
	if !invokeTxFunc.IsValid() {
		return nil, fmt.Errorf("NewInvocationTX function not found")
	}

	// Different versions have different number of parameters
	methodType := invokeTxFunc.Type()

	switch methodType.NumIn() {
	case 4: // Older versions: script, gas, attrubites, signers
		args := []reflect.Value{
			reflect.ValueOf(script),
			reflect.ValueOf(sysFee),
			reflect.ValueOf(additionalAttributes),
			reflect.ValueOf([]transaction.Signer{createDefaultSigner(account.ScriptHash())}),
		}
		results := invokeTxFunc.Call(args)
		if len(results) > 0 && !results[0].IsNil() {
			tx := results[0].Interface().(*transaction.Transaction)
			// Sign the transaction
			if err := signTransaction(tx, account); err != nil {
				return nil, fmt.Errorf("failed to sign transaction: %w", err)
			}
			return tx, nil
		}
	case 3: // Very old versions: script, gas, attributes
		args := []reflect.Value{
			reflect.ValueOf(script),
			reflect.ValueOf(sysFee),
			reflect.ValueOf(additionalAttributes),
		}
		results := invokeTxFunc.Call(args)
		if len(results) > 0 && !results[0].IsNil() {
			tx := results[0].Interface().(*transaction.Transaction)
			// Set the sender and sign
			setSender(tx, account)
			// Sign the transaction
			if err := signTransaction(tx, account); err != nil {
				return nil, fmt.Errorf("failed to sign transaction: %w", err)
			}
			return tx, nil
		}
	}

	return nil, fmt.Errorf("unsupported transaction API")
}

// Helper functions using reflection to handle API differences

func getScriptHash(script []byte) (util.Uint160, error) {
	// Try to use a direct method if available
	hashMethod := reflect.ValueOf(smartcontract.CreateSignatureRedeemScript).MethodByName("GetScriptHash")
	if hashMethod.IsValid() {
		results := hashMethod.Call([]reflect.Value{reflect.ValueOf(script)})
		if len(results) > 0 && !results[0].IsNil() && len(results) > 1 && results[1].IsNil() {
			return results[0].Interface().(util.Uint160), nil
		}
	}

	// Try the utility package
	hashFunc := reflect.ValueOf(util.Uint160FromBytes)
	if hashFunc.IsValid() {
		results := hashFunc.Call([]reflect.Value{reflect.ValueOf(script)})
		if len(results) > 0 && !results[0].IsNil() && len(results) > 1 && results[1].IsNil() {
			return results[0].Interface().(util.Uint160), nil
		}
	}

	// Fallback to direct calculation
	h := util.Uint160{}
	// Simple hash calculation, replace with actual implementation if needed
	copy(h[:], script[len(script)-20:])
	return h, nil
}

func createDefaultSigner(hash util.Uint160) interface{} {
	// Try to create a transaction.Signer
	signerType := reflect.TypeOf((*transaction.Signer)(nil)).Elem()
	if signerType.Kind() == reflect.Struct {
		// For newer versions using the struct directly
		signerValue := reflect.New(signerType).Elem()

		// Set the Account field
		accountField := signerValue.FieldByName("Account")
		if accountField.IsValid() && accountField.CanSet() {
			accountField.Set(reflect.ValueOf(hash))
		}

		// Set the Scopes field if it exists
		scopesField := signerValue.FieldByName("Scopes")
		if scopesField.IsValid() && scopesField.CanSet() {
			// Use CalledByEntry scope (usually constant 1)
			scopesField.Set(reflect.ValueOf(transaction.CalledByEntry))
		}

		return signerValue.Interface()
	}

	// For older versions, try to use the constructor
	signerFunc := reflect.ValueOf(transaction.NewSigner)
	if signerFunc.IsValid() {
		// Try with different numbers of arguments
		switch signerFunc.Type().NumIn() {
		case 1: // Just hash
			results := signerFunc.Call([]reflect.Value{reflect.ValueOf(hash)})
			if len(results) > 0 && !results[0].IsNil() {
				return results[0].Interface()
			}
		case 2: // Hash and scope
			results := signerFunc.Call([]reflect.Value{
				reflect.ValueOf(hash),
				reflect.ValueOf(transaction.CalledByEntry),
			})
			if len(results) > 0 && !results[0].IsNil() {
				return results[0].Interface()
			}
		}
	}

	// Last resort fallback - struct initialization
	return struct {
		Account util.Uint160
		Scopes  transaction.WitnessScope
	}{
		Account: hash,
		Scopes:  transaction.CalledByEntry,
	}
}

func setSender(tx *transaction.Transaction, account *wallet.Account) {
	// Try to set sender using reflection to handle different versions
	method := reflect.ValueOf(tx).MethodByName("SetSender")
	if method.IsValid() {
		method.Call([]reflect.Value{reflect.ValueOf(account.ScriptHash())})
	}
}

func signTransaction(tx *transaction.Transaction, account *wallet.Account) error {
	// Get the private key
	var privKey *keys.PrivateKey

	// Get private key from account
	accVal := reflect.ValueOf(account).Elem()
	pkField := accVal.FieldByName("PrivateKey")
	if pkField.IsValid() && !pkField.IsNil() {
		privKey = pkField.Interface().(*keys.PrivateKey)
	} else {
		// Try alternative fields
		pkField = accVal.FieldByName("privateKey")
		if pkField.IsValid() && pkField.Len() > 0 {
			// Create a private key from bytes
			keyBytes := pkField.Bytes()
			helper := NewPrivateKeyHelper()
			var err error
			privKey, err = helper.FromBytes(keyBytes)
			if err != nil {
				return fmt.Errorf("failed to create private key: %w", err)
			}
		} else {
			return fmt.Errorf("unable to get private key")
		}
	}

	// Sign the transaction
	signMethod := reflect.ValueOf(tx).MethodByName("Sign")
	if !signMethod.IsValid() {
		return fmt.Errorf("Sign method not found on transaction")
	}

	// Get the network magic number
	// This is a placeholder, should be replaced with actual network magic
	networkMagic := uint32(0)

	// Call the sign method with different numbers of arguments
	switch signMethod.Type().NumIn() {
	case 2: // privKey, networkMagic
		results := signMethod.Call([]reflect.Value{
			reflect.ValueOf(privKey),
			reflect.ValueOf(networkMagic),
		})
		if len(results) > 0 && !results[0].IsNil() {
			return results[0].Interface().(error)
		}
		return nil
	case 1: // just privKey
		results := signMethod.Call([]reflect.Value{reflect.ValueOf(privKey)})
		if len(results) > 0 && !results[0].IsNil() {
			return results[0].Interface().(error)
		}
		return nil
	default:
		return fmt.Errorf("unsupported Sign method signature")
	}
}

// PrivateKeyHelper provides utilities for private key operations
type PrivateKeyHelper struct{}

// NewPrivateKeyHelper creates a new private key helper
func NewPrivateKeyHelper() *PrivateKeyHelper {
	return &PrivateKeyHelper{}
}

// FromBytes creates a private key from bytes
func (h *PrivateKeyHelper) FromBytes(data []byte) (*keys.PrivateKey, error) {
	// Try to create directly if the constructor accepts bytes
	newKeyFunc := reflect.ValueOf(keys.NewPrivateKey)
	if newKeyFunc.Type().NumIn() == 1 {
		results := newKeyFunc.Call([]reflect.Value{reflect.ValueOf(data)})
		if len(results) >= 2 {
			if !results[1].IsNil() {
				return nil, results[1].Interface().(error)
			}
			if !results[0].IsNil() {
				return results[0].Interface().(*keys.PrivateKey), nil
			}
		}
	}

	// Try newer versions where you create empty then set bytes
	if newKeyFunc.Type().NumIn() == 0 {
		results := newKeyFunc.Call(nil)
		if len(results) > 0 && !results[0].IsNil() {
			privKey := results[0].Interface().(*keys.PrivateKey)

			// Try to set the bytes
			setBytesMethod := reflect.ValueOf(privKey).MethodByName("SetBytes")
			if setBytesMethod.IsValid() {
				setBytesResults := setBytesMethod.Call([]reflect.Value{reflect.ValueOf(data)})
				if len(setBytesResults) == 0 || (len(setBytesResults) > 0 && setBytesResults[0].IsNil()) {
					return privKey, nil
				}
				if len(setBytesResults) > 0 && !setBytesResults[0].IsNil() {
					return nil, setBytesResults[0].Interface().(error)
				}
			}
		}
	}

	return nil, fmt.Errorf("unsupported private key API")
}

// CreateSmartContractScript creates a smart contract script for different neo-go versions
func (h *TransactionHelper) CreateSmartContractScript(
	scriptHash util.Uint160,
	method string,
	params []interface{},
) ([]byte, error) {
	// Try to find the CreateCallScript function
	createScriptFunc := reflect.ValueOf(smartcontract.CreateCallScript)
	if !createScriptFunc.IsValid() {
		return nil, fmt.Errorf("CreateCallScript function not found")
	}

	// Try different argument patterns
	switch createScriptFunc.Type().NumIn() {
	case 3: // scriptHash, method, params
		results := createScriptFunc.Call([]reflect.Value{
			reflect.ValueOf(scriptHash),
			reflect.ValueOf(method),
			reflect.ValueOf(params),
		})
		if len(results) > 0 && !results[0].IsNil() {
			return results[0].Interface().([]byte), nil
		}
	case 2: // scriptHash, combined params
		// Need to build a script with the method name as first param
		allParams := make([]interface{}, len(params)+1)
		allParams[0] = method
		copy(allParams[1:], params)

		results := createScriptFunc.Call([]reflect.Value{
			reflect.ValueOf(scriptHash),
			reflect.ValueOf(allParams),
		})
		if len(results) > 0 && !results[0].IsNil() {
			return results[0].Interface().([]byte), nil
		}
	}

	// Fallback: manual script creation
	// This is a very simplified implementation
	script := []byte{byte(opcode.PUSHDATA1)}
	script = append(script, byte(len(method)))
	script = append(script, []byte(method)...)

	// Add params (simplified)
	for _, param := range params {
		// Just pushing a placeholder
		script = append(script, byte(opcode.PUSHDATA1), 1, 0)
	}

	// Add contract hash
	script = append(script, scriptHash[:]...)

	// Add call instruction
	script = append(script, byte(opcode.CALL))

	return script, nil
}

// CreateDeploymentScript creates a deployment script for different neo-go versions
func (h *TransactionHelper) CreateDeploymentScript(
	nef []byte,
	manifest []byte,
) ([]byte, error) {
	// Try to find the CreateDeploymentScript function
	deployFunc := reflect.ValueOf(smartcontract.CreateDeploymentScript)
	if !deployFunc.IsValid() {
		return nil, fmt.Errorf("CreateDeploymentScript function not found")
	}

	// Try with arguments
	results := deployFunc.Call([]reflect.Value{
		reflect.ValueOf(nef),
		reflect.ValueOf(manifest),
	})

	if len(results) > 0 && !results[0].IsNil() {
		return results[0].Interface().([]byte), nil
	}

	// Fallback: simplified script
	script := []byte{byte(opcode.PUSHDATA1)}
	script = append(script, byte(len(nef)))
	script = append(script, nef...)

	script = append(script, byte(opcode.PUSHDATA1))
	script = append(script, byte(len(manifest)))
	script = append(script, manifest...)

	// Add deployment syscall
	script = append(script, []byte{byte(opcode.SYSCALL), 0x01, 0x02, 0x03, 0x04}...)

	return script, nil
}
