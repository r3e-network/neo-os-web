package tee

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/pkg/logger"
)

// azureProvider implements the Provider interface for Azure Confidential Computing
type azureProvider struct {
	config      *config.AzureConfig
	logger      *logger.Logger
	jsRuntime   *JSRuntime
	keyPair     *rsa.PrivateKey
	initialized bool
	secrets     map[string]map[string]string // userID -> name -> value
	secretsMu   sync.RWMutex
	client      *http.Client
	attestation *azureAttestation
}

// azureAttestation holds Azure attestation information
type azureAttestation struct {
	token       string
	attestation []byte
	expiry      time.Time
}

// newAzureProvider creates a new Azure Confidential Computing provider
func newAzureProvider(cfg config.AzureConfig, log *logger.Logger) (Provider, error) {
	provider := &azureProvider{
		config:  &cfg,
		logger:  log,
		secrets: make(map[string]map[string]string),
		client:  &http.Client{Timeout: 30 * time.Second},
	}

	return provider, nil
}

// Initialize initializes the Azure provider
func (p *azureProvider) Initialize() error {
	p.logger.Info("Initializing Azure Confidential Computing provider")

	// Check if we're running in an SGX environment
	isSGX := p.isSGXEnvironment()
	if isSGX {
		p.logger.Info("Running in SGX environment")
	} else {
		p.logger.Warn("Not running in SGX environment - using simulation mode")
	}

	// Generate RSA key pair for encryption/decryption
	var err error
	p.keyPair, err = rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return fmt.Errorf("failed to generate key pair: %w", err)
	}

	// Create JS runtime
	p.jsRuntime = NewJSRuntime(
		int64(p.config.Runtime.JSMemoryLimit),
		p.config.Runtime.ExecutionTimeout,
		p,
	)

	// Generate attestation token
	if err := p.generateAttestationToken(); err != nil {
		p.logger.Warnf("Failed to generate attestation token: %v", err)
		// Continue anyway for development purposes
		// In production, we would fail here
	}

	p.initialized = true
	p.logger.Info("Azure Confidential Computing provider initialized")
	return nil
}

// ExecuteFunction executes a JavaScript function in the TEE
func (p *azureProvider) ExecuteFunction(ctx context.Context, function *models.Function, params map[string]interface{}, secrets map[string]string) (*models.ExecutionResult, error) {
	if !p.initialized {
		return nil, errors.New("provider not initialized")
	}

	p.logger.Infof("Executing function %s in TEE", function.Name)

	// In a real implementation, we would:
	// 1. Verify we're running in a valid SGX enclave
	// 2. Verify the attestation is still valid
	// 3. Setup the execution environment

	// Load any secrets into the execution context
	userID := function.UserID
	userIDStr := fmt.Sprintf("%d", userID)

	p.secretsMu.Lock()
	if _, exists := p.secrets[userIDStr]; !exists {
		p.secrets[userIDStr] = make(map[string]string)
	}

	// Add the secrets provided for this execution
	for name, value := range secrets {
		p.secrets[userIDStr][name] = value
	}
	p.secretsMu.Unlock()

	// Execute the function using our JS runtime
	result, err := p.jsRuntime.ExecuteFunction(ctx, function, params, userID)
	if err != nil {
		return &models.ExecutionResult{
			ExecutionID: fmt.Sprintf("exec_%d", time.Now().UnixNano()),
			FunctionID:  function.ID,
			Status:      "error",
			StartTime:   time.Now(),
			EndTime:     time.Now(),
			Result:      []byte(fmt.Sprintf(`{"error": "%s"}`, err.Error())),
			Logs:        []string{fmt.Sprintf("Error: %s", err.Error())},
		}, err
	}

	return result, nil
}

// StoreSecret securely stores a secret in the TEE
func (p *azureProvider) StoreSecret(ctx context.Context, secret *models.Secret) error {
	if !p.initialized {
		return errors.New("provider not initialized")
	}

	p.logger.Infof("Storing secret %s in TEE", secret.Name)

	// Verify attestation is valid before allowing secret storage
	if p.isSGXEnvironment() {
		_, err := p.GetAttestation(ctx)
		if err != nil {
			return fmt.Errorf("attestation verification failed, cannot store secret: %w", err)
		}
	}

	// Encrypt the secret value
	encryptedValue, err := p.encryptSecret(secret.Value)
	if err != nil {
		return fmt.Errorf("failed to encrypt secret: %w", err)
	}

	// Store in memory (and would persist to sealed storage in a real implementation)
	userIDStr := fmt.Sprintf("%d", secret.UserID)

	p.secretsMu.Lock()
	defer p.secretsMu.Unlock()

	if _, exists := p.secrets[userIDStr]; !exists {
		p.secrets[userIDStr] = make(map[string]string)
	}

	p.secrets[userIDStr][secret.Name] = encryptedValue
	return nil
}

// GetSecret retrieves a secret from the TEE
func (p *azureProvider) GetSecret(ctx context.Context, userID int, secretName string) (string, error) {
	if !p.initialized {
		return "", errors.New("provider not initialized")
	}

	p.logger.Infof("Retrieving secret %s from TEE", secretName)

	// Verify attestation is valid before allowing secret retrieval
	if p.isSGXEnvironment() {
		_, err := p.GetAttestation(ctx)
		if err != nil {
			return "", fmt.Errorf("attestation verification failed, cannot retrieve secret: %w", err)
		}
	}

	// Get the encrypted value
	userIDStr := fmt.Sprintf("%d", userID)

	p.secretsMu.RLock()
	defer p.secretsMu.RUnlock()

	if userSecrets, exists := p.secrets[userIDStr]; exists {
		if encryptedValue, exists := userSecrets[secretName]; exists {
			// Decrypt the value
			value, err := p.decryptSecret(encryptedValue)
			if err != nil {
				return "", fmt.Errorf("failed to decrypt secret: %w", err)
			}
			return value, nil
		}
	}

	return "", fmt.Errorf("secret not found: %s", secretName)
}

// DeleteSecret deletes a secret from the TEE
func (p *azureProvider) DeleteSecret(ctx context.Context, userID int, secretName string) error {
	if !p.initialized {
		return errors.New("provider not initialized")
	}

	p.logger.Infof("Deleting secret %s from TEE", secretName)

	// Verify attestation is valid before allowing secret deletion
	if p.isSGXEnvironment() {
		_, err := p.GetAttestation(ctx)
		if err != nil {
			return fmt.Errorf("attestation verification failed, cannot delete secret: %w", err)
		}
	}

	// Delete from memory
	userIDStr := fmt.Sprintf("%d", userID)

	p.secretsMu.Lock()
	defer p.secretsMu.Unlock()

	if userSecrets, exists := p.secrets[userIDStr]; exists {
		delete(userSecrets, secretName)
		return nil
	}

	return fmt.Errorf("secret not found: %s", secretName)
}

// GetAttestation gets an attestation report from the TEE
func (p *azureProvider) GetAttestation(ctx context.Context) ([]byte, error) {
	if !p.initialized {
		return nil, errors.New("provider not initialized")
	}

	p.logger.Info("Getting attestation report from TEE")

	// Check if our attestation has expired or needs refresh
	var needsRefresh bool
	if p.attestation == nil {
		needsRefresh = true
	} else if time.Now().After(p.attestation.expiry) {
		p.logger.Info("Attestation token has expired, refreshing")
		needsRefresh = true
	} else if p.attestation.token == "mock-attestation-token" ||
		strings.HasPrefix(p.attestation.token, "mock-attestation-token-") {
		// In development we might have a mock token, but in production we'd verify
		// the token's integrity here
		if !p.isSGXEnvironment() {
			// In development, we're fine with the mock token
			needsRefresh = false
		} else {
			// In production, refresh if we somehow have a mock token
			p.logger.Warn("Mock attestation token found in SGX environment, refreshing")
			needsRefresh = true
		}
	}

	// Refresh the attestation if needed
	if needsRefresh {
		if err := p.generateAttestationToken(); err != nil {
			return nil, fmt.Errorf("failed to refresh attestation token: %w", err)
		}
	}

	// Verify the attestation token before returning
	if p.isSGXEnvironment() && !strings.HasPrefix(p.attestation.token, "mock-attestation-token") {
		if err := p.verifyAttestationToken(p.attestation.token); err != nil {
			return nil, fmt.Errorf("attestation token verification failed: %w", err)
		}
	}

	return p.attestation.attestation, nil
}

// verifyAttestationToken validates the attestation token from Azure Attestation Service
func (p *azureProvider) verifyAttestationToken(token string) error {
	// In a real implementation, we would:
	// 1. Verify the JWT signature using Azure Attestation Service's public key
	// 2. Validate the claims (issuer, audience, expiration, etc.)
	// 3. Verify the SGX quote embedded in the token (mrenclave, mrsigner, etc.)

	p.logger.Info("Verifying attestation token")

	// Basic format validation - ensure it's a JWT token (3 parts separated by dots)
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return errors.New("invalid token format: not a JWT token")
	}

	// Decode the header and payload
	header, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return fmt.Errorf("failed to decode token header: %w", err)
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return fmt.Errorf("failed to decode token payload: %w", err)
	}

	// Parse the header
	var headerMap map[string]interface{}
	if err := json.Unmarshal(header, &headerMap); err != nil {
		return fmt.Errorf("failed to parse token header: %w", err)
	}

	// Parse the payload
	var payloadMap map[string]interface{}
	if err := json.Unmarshal(payload, &payloadMap); err != nil {
		return fmt.Errorf("failed to parse token payload: %w", err)
	}

	// Verify the token algorithm
	alg, ok := headerMap["alg"].(string)
	if !ok || (alg != "RS256" && alg != "ES256") {
		return fmt.Errorf("unsupported token algorithm: %v", alg)
	}

	// Verify token claims
	if err := p.verifyTokenClaims(payloadMap); err != nil {
		return err
	}

	// Verify SGX-specific claims if present
	if err := p.verifySGXClaims(payloadMap); err != nil {
		return err
	}

	p.logger.Info("Attestation token verification successful")
	return nil
}

// verifyTokenClaims verifies the standard JWT claims in the attestation token
func (p *azureProvider) verifyTokenClaims(claims map[string]interface{}) error {
	// Check token expiration
	exp, ok := claims["exp"].(float64)
	if !ok {
		return errors.New("token missing expiration claim")
	}

	expTime := time.Unix(int64(exp), 0)
	if time.Now().After(expTime) {
		return errors.New("token has expired")
	}

	// Check token issuer
	iss, ok := claims["iss"].(string)
	if !ok {
		return errors.New("token missing issuer claim")
	}

	// Verify the issuer is from Azure Attestation Service
	// The issuer should contain the attestation provider URL
	expectedIssuer := fmt.Sprintf("https://%s.%s.attest.azure.net",
		p.config.Attestation.Instance,
		p.config.Attestation.Region)

	if !strings.Contains(iss, ".attest.azure.net") {
		p.logger.Warnf("Invalid issuer: %s, expected: %s", iss, expectedIssuer)
		return fmt.Errorf("invalid token issuer: %s", iss)
	}

	// In a real implementation, we would also verify:
	// - The audience (aud) claim matches our expected value
	// - The issued at (iat) claim is reasonable
	// - Any additional claims required by your security policy

	return nil
}

// verifySGXClaims verifies the SGX-specific claims in the attestation token
func (p *azureProvider) verifySGXClaims(claims map[string]interface{}) error {
	// Look for SGX-specific claims, which might be nested in the token
	// The exact structure depends on the Azure Attestation Service response format

	// Example: Check for SGX enclave quote information
	var sgxClaims map[string]interface{}

	// Check various possible locations for SGX claims
	if x509, ok := claims["x509"].(map[string]interface{}); ok {
		if sgx, ok := x509["sgx"].(map[string]interface{}); ok {
			sgxClaims = sgx
		}
	} else if quote, ok := claims["sgx-quote"].(map[string]interface{}); ok {
		sgxClaims = quote
	} else if sgx, ok := claims["sgx"].(map[string]interface{}); ok {
		sgxClaims = sgx
	}

	if sgxClaims == nil {
		// If we're expecting SGX claims but don't find them, that's an error
		if p.isSGXEnvironment() {
			return errors.New("token missing SGX claims")
		}
		// Otherwise, we might be in development mode
		return nil
	}

	// In a real implementation, we would verify:
	// 1. The MRENCLAVE value matches our expected value
	// 2. The MRSIGNER value matches our expected value
	// 3. The security version numbers are acceptable
	// 4. Any other SGX-specific attributes required by your security policy

	// Example verification of mrenclave (if available)
	if mrenclave, ok := sgxClaims["mrenclave"].(string); ok {
		// In a real implementation, compare against the expected value
		expectedMrenclave := os.Getenv("EXPECTED_MRENCLAVE")
		if expectedMrenclave != "" && mrenclave != expectedMrenclave {
			return fmt.Errorf("mrenclave value does not match expected value")
		}
	}

	// Example verification of mrsigner (if available)
	if mrsigner, ok := sgxClaims["mrsigner"].(string); ok {
		// In a real implementation, compare against the expected value
		expectedMrsigner := os.Getenv("EXPECTED_MRSIGNER")
		if expectedMrsigner != "" && mrsigner != expectedMrsigner {
			return fmt.Errorf("mrsigner value does not match expected value")
		}
	}

	return nil
}

// generateAttestationToken generates an attestation token from the Azure Attestation Service
func (p *azureProvider) generateAttestationToken() error {
	p.logger.Info("Generating attestation token from Azure Attestation Service")

	// In a real SGX environment, we would:
	// 1. Generate an SGX quote
	// 2. Send it to the Azure Attestation Service
	// 3. Receive and validate the token

	if !p.isSGXEnvironment() {
		p.logger.Warn("Not running in SGX environment, using mock attestation")
		p.attestation = &azureAttestation{
			token:       fmt.Sprintf("mock-attestation-token-%d", time.Now().Unix()),
			attestation: []byte(fmt.Sprintf(`{"attestation": "mock-attestation-data", "timestamp": %d}`, time.Now().Unix())),
			expiry:      time.Now().Add(24 * time.Hour),
		}
		return nil
	}

	// Create Azure credential for Azure Attestation Service
	cred, err := azidentity.NewDefaultAzureCredential(nil)
	if err != nil {
		return fmt.Errorf("failed to create Azure credential: %w", err)
	}

	// Generate SGX quote
	quote, err := p.generateSGXQuote()
	if err != nil {
		return fmt.Errorf("failed to generate SGX quote: %w", err)
	}

	// Prepare the attestation request
	attestationURL := fmt.Sprintf("https://%s.%s.attest.azure.net/attest/sgx",
		p.config.Attestation.Instance,
		p.config.Attestation.Region)

	requestBody := map[string]string{
		"quote": base64.StdEncoding.EncodeToString(quote),
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return fmt.Errorf("failed to marshal attestation request: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequest("POST", attestationURL, strings.NewReader(string(jsonData)))
	if err != nil {
		return fmt.Errorf("failed to create attestation request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Add Azure authentication
	policies := policy.TokenRequestOptions{Scopes: []string{p.config.Attestation.Scope}}
	token, err := cred.GetToken(context.Background(), policies)
	if err != nil {
		return fmt.Errorf("failed to get Azure token: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+token.Token)

	// Send the request
	resp, err := p.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send attestation request: %w", err)
	}
	defer resp.Body.Close()

	// Read the response
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read attestation response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("attestation service returned error: %s - %s", resp.Status, string(body))
	}

	// Parse the attestation response
	var attestationResp struct {
		Token      string    `json:"token"`
		Expiration time.Time `json:"expiration"`
	}

	if err := json.Unmarshal(body, &attestationResp); err != nil {
		return fmt.Errorf("failed to parse attestation response: %w", err)
	}

	// Store the attestation information
	p.attestation = &azureAttestation{
		token:       attestationResp.Token,
		attestation: body,
		expiry:      attestationResp.Expiration,
	}

	p.logger.Info("Successfully generated attestation token")
	return nil
}

// generateSGXQuote generates an SGX quote for attestation
func (p *azureProvider) generateSGXQuote() ([]byte, error) {
	// In a real SGX environment, we would use SGX SDK to generate a quote
	// This is a placeholder implementation

	if !p.isSGXEnvironment() {
		// Return mock data for non-SGX environments
		return []byte("mock-sgx-quote-data"), nil
	}

	// For a real implementation:
	// 1. Create a report using EREPORT instruction
	// 2. Use the quote enclave (QE) to convert the report to a quote
	// 3. Return the quote

	// This would typically involve calling into C/C++ code via CGO
	// that interfaces with the SGX SDK

	// Placeholder for now
	return []byte("mock-sgx-quote-data"), nil
}

// isSGXEnvironment checks if we're running in an SGX enclave
func (p *azureProvider) isSGXEnvironment() bool {
	// In a real implementation, we would check for SGX support
	// This could involve checking for the existence of SGX device files
	// or using the SGX SDK to query enclave status

	// For now, check for SGX_ENABLED environment variable
	return os.Getenv("SGX_ENABLED") == "1"
}

// encryptSecret encrypts a secret value using the provider's key
func (p *azureProvider) encryptSecret(value string) (string, error) {
	// Use SGX-specific encryption if available
	if p.isSGXEnvironment() {
		return p.encryptWithSGX(value)
	}

	// For non-SGX environments, use RSA encryption with the key pair we generated
	// This is a simplified implementation for development

	// Generate a random label
	label := make([]byte, 16)
	if _, err := rand.Read(label); err != nil {
		return "", fmt.Errorf("failed to generate encryption label: %w", err)
	}

	// Encrypt the value
	ciphertext, err := rsa.EncryptOAEP(
		sha256.New(),
		rand.Reader,
		&p.keyPair.PublicKey,
		[]byte(value),
		label,
	)
	if err != nil {
		return "", fmt.Errorf("failed to encrypt: %w", err)
	}

	// Encode the ciphertext and label
	encoded := base64.StdEncoding.EncodeToString(ciphertext) + "|" + base64.StdEncoding.EncodeToString(label)
	return encoded, nil
}

// encryptWithSGX encrypts data using SGX sealing functionality
func (p *azureProvider) encryptWithSGX(value string) (string, error) {
	// In a real SGX environment, we would:
	// 1. Use sgx_seal_data or similar SGX SDK functions
	// 2. Use a key derived from the enclave's sealing identity
	// 3. Use authenticated encryption

	// Mock implementation for now
	// In a real implementation, this would call into C code via CGO
	// that interfaces with the SGX SDK

	// Generate a random IV
	iv := make([]byte, 12) // 12 bytes for GCM
	if _, err := rand.Read(iv); err != nil {
		return "", fmt.Errorf("failed to generate IV: %w", err)
	}

	// For demonstration, we're using AES-GCM with a derived key
	// In a real implementation, we would use SGX's sealing key
	key := p.deriveSealingKey()

	// Create a new AES-GCM block cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	// Encrypt the value
	ciphertext := aesGCM.Seal(nil, iv, []byte(value), nil)

	// Encode the IV and ciphertext
	encoded := "SGX|" + base64.StdEncoding.EncodeToString(iv) + "|" + base64.StdEncoding.EncodeToString(ciphertext)
	return encoded, nil
}

// decryptSecret decrypts a secret value using the provider's key
func (p *azureProvider) decryptSecret(encryptedValue string) (string, error) {
	// Check if this is an SGX-encrypted value
	if strings.HasPrefix(encryptedValue, "SGX|") {
		return p.decryptWithSGX(encryptedValue)
	}

	// For non-SGX encrypted values, use RSA decryption with the key pair we generated
	// Split the encoded value and label
	parts := strings.Split(encryptedValue, "|")
	if len(parts) != 2 {
		return "", errors.New("invalid encrypted value format")
	}

	// Decode the ciphertext and label
	ciphertext, err := base64.StdEncoding.DecodeString(parts[0])
	if err != nil {
		return "", fmt.Errorf("failed to decode ciphertext: %w", err)
	}

	label, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return "", fmt.Errorf("failed to decode label: %w", err)
	}

	// Decrypt the value
	plaintext, err := rsa.DecryptOAEP(
		sha256.New(),
		rand.Reader,
		p.keyPair,
		ciphertext,
		label,
	)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt: %w", err)
	}

	return string(plaintext), nil
}

// decryptWithSGX decrypts data using SGX unsealing functionality
func (p *azureProvider) decryptWithSGX(encryptedValue string) (string, error) {
	// In a real SGX environment, we would:
	// 1. Use sgx_unseal_data or similar SGX SDK functions
	// 2. Use a key derived from the enclave's sealing identity
	// 3. Verify the authentication tag

	// Parse the encrypted value
	parts := strings.Split(encryptedValue, "|")
	if len(parts) != 3 || parts[0] != "SGX" {
		return "", errors.New("invalid SGX encrypted value format")
	}

	// Decode the IV and ciphertext
	iv, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return "", fmt.Errorf("failed to decode IV: %w", err)
	}

	ciphertext, err := base64.StdEncoding.DecodeString(parts[2])
	if err != nil {
		return "", fmt.Errorf("failed to decode ciphertext: %w", err)
	}

	// For demonstration, we're using AES-GCM with a derived key
	// In a real implementation, we would use SGX's sealing key
	key := p.deriveSealingKey()

	// Create a new AES-GCM block cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	// Decrypt the value
	plaintext, err := aesGCM.Open(nil, iv, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt: %w", err)
	}

	return string(plaintext), nil
}

// deriveSealingKey derives a key for sealing/unsealing secrets
func (p *azureProvider) deriveSealingKey() []byte {
	// In a real SGX environment, we would use the SGX SDK to get a sealing key
	// This is a mock implementation for development

	// Generate a key derived from our RSA private key for demonstration
	keyHash := sha256.Sum256(p.keyPair.D.Bytes())
	return keyHash[:]
}

// Close closes the Azure provider
func (p *azureProvider) Close() error {
	if p.jsRuntime != nil {
		// Any cleanup needed for JS runtime
	}
	return nil
}
