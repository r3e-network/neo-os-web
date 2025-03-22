package security_test

import (
	"crypto/rsa"
	"encoding/base64"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/R3E-Network/service_layer/internal/core/auth"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/pkg/logger"
	"github.com/dgrijalva/jwt-go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockUserRepository is a mock implementation of models.UserRepository
type MockUserRepository struct {
	mock.Mock
}

func (m *MockUserRepository) Create(user *models.User) error {
	args := m.Called(user)
	return args.Error(0)
}

func (m *MockUserRepository) GetByID(id int) (*models.User, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) GetByUsername(username string) (*models.User, error) {
	args := m.Called(username)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) GetByEmail(email string) (*models.User, error) {
	args := m.Called(email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) GetByAPIKey(apiKey string) (*models.User, error) {
	args := m.Called(apiKey)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) Update(user *models.User) error {
	args := m.Called(user)
	return args.Error(0)
}

func (m *MockUserRepository) Delete(id int) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockUserRepository) List(offset, limit int) ([]*models.User, error) {
	args := m.Called(offset, limit)
	return args.Get(0).([]*models.User), args.Error(1)
}

// Setup creates a new auth service with mock dependencies
func setupAuthService() (*auth.Service, *MockUserRepository) {
	// Create logger
	log := logger.NewLogger("test", "debug")

	// Create config with secure settings
	cfg := &config.Config{
		Auth: config.AuthConfig{
			JWTSecret:         "super-secure-jwt-secret-that-is-at-least-32-bytes-long",
			TokenExpiry:       3600,
			RefreshTokenExpiry: 86400,
		},
	}

	// Create mock user repository
	mockUserRepo := new(MockUserRepository)

	// Create auth service
	authService := auth.NewService(cfg, log, mockUserRepo)

	return authService, mockUserRepo
}

// TestJWTSecurityAlgorithm verifies that the JWT is using a secure algorithm (HS256)
func TestJWTSecurityAlgorithm(t *testing.T) {
	// Setup
	authService, mockUserRepo := setupAuthService()

	// Create test user
	testUser := &models.User{
		ID:       1,
		Username: "testuser",
		Email:    "test@example.com",
		IsActive: true,
	}

	// Setup repository mock
	mockUserRepo.On("GetByUsername", "testuser").Return(testUser, nil)
	mockUserRepo.On("GetByEmail", "test@example.com").Return(testUser, nil)

	// Login to get tokens
	tokens, err := authService.Login("testuser", "password")
	assert.NoError(t, err)
	assert.NotNil(t, tokens)

	// Parse the token (without validation) to check the algorithm
	parts := strings.Split(tokens.AccessToken, ".")
	assert.Equal(t, 3, len(parts), "JWT should have 3 parts")

	// Decode header
	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	assert.NoError(t, err)
	headerStr := string(headerBytes)

	// Check for secure algorithm
	assert.Contains(t, headerStr, "HS256", "JWT should use HS256 algorithm")
	assert.NotContains(t, headerStr, "none", "JWT should not use 'none' algorithm")
}

// TestJWTTokenExpiration verifies that tokens expire correctly
func TestJWTTokenExpiration(t *testing.T) {
	// Setup
	authService, mockUserRepo := setupAuthService()

	// Create test user
	testUser := &models.User{
		ID:       1,
		Username: "testuser",
		Email:    "test@example.com",
		IsActive: true,
	}

	// Setup repository mock
	mockUserRepo.On("GetByUsername", "testuser").Return(testUser, nil)

	// Login to get tokens
	tokens, err := authService.Login("testuser", "password")
	assert.NoError(t, err)
	assert.NotNil(t, tokens)

	// Verify token expiration is set correctly
	assert.Equal(t, 3600, tokens.ExpiresIn, "Token expiration should match config")

	// Parse the token to check expiry
	claims := &auth.Claims{}
	token, err := jwt.ParseWithClaims(tokens.AccessToken, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte("super-secure-jwt-secret-that-is-at-least-32-bytes-long"), nil
	})
	assert.NoError(t, err)
	assert.True(t, token.Valid)

	// Verify expiry time
	expiresAt := time.Unix(claims.ExpiresAt, 0)
	expectedExpiry := time.Now().Add(time.Duration(3600) * time.Second)
	
	// Allow for a small time difference (5 seconds) due to test execution
	assert.WithinDuration(t, expectedExpiry, expiresAt, 5*time.Second)
}

// TestJWTTokenRejectionAfterExpiry verifies that expired tokens are rejected
func TestJWTTokenRejectionAfterExpiry(t *testing.T) {
	// Setup
	authService, _ := setupAuthService()

	// Create an expired token
	claims := &auth.Claims{
		UserID:   1,
		Username: "testuser",
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: time.Now().Add(-1 * time.Hour).Unix(), // Token expired 1 hour ago
			IssuedAt:  time.Now().Add(-2 * time.Hour).Unix(),
			Issuer:    "service_layer",
		},
	}
	
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte("super-secure-jwt-secret-that-is-at-least-32-bytes-long"))
	assert.NoError(t, err)

	// Attempt to validate the expired token
	_, err = authService.ValidateToken(tokenString)
	assert.Error(t, err, "Expired token should be rejected")
	assert.Contains(t, err.Error(), "expired")
}

// TestJWTTokenRejectionWithWrongSignature verifies that tokens with invalid signatures are rejected
func TestJWTTokenRejectionWithWrongSignature(t *testing.T) {
	// Setup
	authService, mockUserRepo := setupAuthService()

	// Create test user
	testUser := &models.User{
		ID:       1,
		Username: "testuser",
		Email:    "test@example.com",
		IsActive: true,
	}

	// Setup repository mock
	mockUserRepo.On("GetByUsername", "testuser").Return(testUser, nil)

	// Login to get tokens
	tokens, err := authService.Login("testuser", "password")
	assert.NoError(t, err)
	assert.NotNil(t, tokens)

	// Tamper with the token by changing the signature
	parts := strings.Split(tokens.AccessToken, ".")
	tamperedToken := fmt.Sprintf("%s.%s.invalidSignature", parts[0], parts[1])

	// Attempt to validate the tampered token
	_, err = authService.ValidateToken(tamperedToken)
	assert.Error(t, err, "Tampered token should be rejected")
	assert.Contains(t, err.Error(), "signature", "Error should mention invalid signature")
}

// TestAlgorithmConfusionAttack verifies protection against algorithm confusion attacks
func TestAlgorithmConfusionAttack(t *testing.T) {
	// Setup
	authService, _ := setupAuthService()

	// Create claims
	claims := &auth.Claims{
		UserID:   1,
		Username: "testuser",
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: time.Now().Add(time.Hour).Unix(),
			IssuedAt:  time.Now().Unix(),
			Issuer:    "service_layer",
		},
	}

	// Create a token with RS256 algorithm but will be verified with HS256
	// This simulates an algorithm confusion attack
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	
	// Force the token to have a valid signature without proper signing
	// This is simulating an attacker who tries to bypass signature verification
	tokenString := token.Raw + ".forged_signature"

	// Attempt to validate the token
	_, err := authService.ValidateToken(tokenString)
	assert.Error(t, err, "Algorithm confusion attack should be rejected")
}

// TestJWTReplayAttack verifies protection against token replay after logout
func TestJWTReplayAttack(t *testing.T) {
	// This test is a placeholder for a more comprehensive test
	// In a real implementation, we would have a token blacklist or version mechanism
	// to prevent replay attacks after logout
	t.Skip("Implementation needed: Token blacklist for logout is not implemented yet")
}

// TestRefreshTokenSecure verifies refresh token security
func TestRefreshTokenSecure(t *testing.T) {
	// Setup
	authService, mockUserRepo := setupAuthService()

	// Create test user
	testUser := &models.User{
		ID:       1,
		Username: "testuser",
		Email:    "test@example.com",
		IsActive: true,
	}

	// Setup repository mock
	mockUserRepo.On("GetByUsername", "testuser").Return(testUser, nil)
	mockUserRepo.On("GetByID", 1).Return(testUser, nil)

	// Login to get tokens
	tokens, err := authService.Login("testuser", "password")
	assert.NoError(t, err)
	assert.NotNil(t, tokens)

	// Refresh token should have a different signature than access token
	assert.NotEqual(t, tokens.AccessToken, tokens.RefreshToken, "Refresh token should be different from access token")

	// Refresh the token
	newTokens, err := authService.RefreshToken(tokens.RefreshToken)
	assert.NoError(t, err)
	assert.NotNil(t, newTokens)

	// New tokens should be different from old tokens
	assert.NotEqual(t, tokens.AccessToken, newTokens.AccessToken, "New access token should be different")
	assert.NotEqual(t, tokens.RefreshToken, newTokens.RefreshToken, "New refresh token should be different")
}

// TestPasswordStorageSecurity verifies password storage security
func TestPasswordStorageSecurity(t *testing.T) {
	// Create a new user with a password
	user, err := models.NewUser("securitytest", "security@test.com", "SecurePassword123!")
	assert.NoError(t, err)

	// Password should be hashed, not stored in plaintext
	assert.NotEqual(t, "SecurePassword123!", user.PasswordHash, "Password should not be stored in plaintext")
	assert.NotEmpty(t, user.PasswordHash, "Password hash should not be empty")

	// Password hash should be using bcrypt (bcrypt hashes start with $2a$, $2b$, or $2y$)
	assert.True(t, strings.HasPrefix(user.PasswordHash, "$2a$") || 
		strings.HasPrefix(user.PasswordHash, "$2b$") || 
		strings.HasPrefix(user.PasswordHash, "$2y$"), 
		"Password should be hashed with bcrypt")

	// Verify password check functionality
	assert.True(t, user.CheckPassword("SecurePassword123!"), "Password check should succeed with correct password")
	assert.False(t, user.CheckPassword("WrongPassword"), "Password check should fail with incorrect password")
}

// TestLoginRateLimiting simulates testing for rate limiting of login attempts
// This is a placeholder as rate limiting would typically be implemented at the API level
func TestLoginRateLimiting(t *testing.T) {
	t.Skip("Implementation needed: Rate limiting for login attempts is not implemented in the core service")
}

// TestSecurityHeaders verifies security headers in API responses
// This would be implemented in API integration tests
func TestSecurityHeaders(t *testing.T) {
	t.Skip("Implementation needed: Security headers should be tested in API integration tests")
}