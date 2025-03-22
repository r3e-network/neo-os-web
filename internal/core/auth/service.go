package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/pkg/logger"
	"github.com/dgrijalva/jwt-go"
	"github.com/google/uuid"
)

// Claims represents JWT claims
type Claims struct {
	UserID   int    `json:"user_id"`
	Username string `json:"username"`
	jwt.StandardClaims
}

// RefreshClaims represents JWT refresh token claims
type RefreshClaims struct {
	UserID  int    `json:"user_id"`
	TokenID string `json:"token_id"`
	jwt.StandardClaims
}

// Tokens represents auth tokens
type Tokens struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
}

// Service handles user authentication
type Service struct {
	config         *config.Config
	logger         *logger.Logger
	userRepository models.UserRepository
}

// NewService creates a new auth service
func NewService(
	cfg *config.Config,
	log *logger.Logger,
	userRepository models.UserRepository,
) *Service {
	return &Service{
		config:         cfg,
		logger:         log,
		userRepository: userRepository,
	}
}

// Register registers a new user
func (s *Service) Register(username, email, password string) (*models.User, error) {
	// Check if username already exists
	existingUser, err := s.userRepository.GetByUsername(username)
	if err != nil {
		return nil, fmt.Errorf("failed to check username: %w", err)
	}
	if existingUser != nil {
		return nil, errors.New("username already exists")
	}

	// Check if email already exists
	existingUser, err = s.userRepository.GetByEmail(email)
	if err != nil {
		return nil, fmt.Errorf("failed to check email: %w", err)
	}
	if existingUser != nil {
		return nil, errors.New("email already exists")
	}

	// Create user
	user, err := models.NewUser(username, email, password)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Save to database
	err = s.userRepository.Create(user)
	if err != nil {
		return nil, fmt.Errorf("failed to save user: %w", err)
	}

	return user, nil
}

// Login authenticates a user and returns tokens
func (s *Service) Login(usernameOrEmail, password string) (*Tokens, error) {
	// Find user by username or email
	var user *models.User
	var err error

	user, err = s.userRepository.GetByUsername(usernameOrEmail)
	if err != nil {
		return nil, fmt.Errorf("failed to get user by username: %w", err)
	}

	if user == nil {
		user, err = s.userRepository.GetByEmail(usernameOrEmail)
		if err != nil {
			return nil, fmt.Errorf("failed to get user by email: %w", err)
		}
	}

	if user == nil {
		return nil, errors.New("invalid credentials")
	}

	// Check if user is active
	if !user.IsActive {
		return nil, errors.New("user account is inactive")
	}

	// Check password
	if !user.CheckPassword(password) {
		return nil, errors.New("invalid credentials")
	}

	// Generate tokens
	tokens, err := s.generateTokens(user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate tokens: %w", err)
	}

	return tokens, nil
}

// RefreshToken refreshes an access token
func (s *Service) RefreshToken(refreshToken string) (*Tokens, error) {
	// Parse refresh token
	token, err := jwt.ParseWithClaims(refreshToken, &RefreshClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(s.config.Auth.JWTSecret), nil
	})
	if err != nil {
		return nil, fmt.Errorf("invalid refresh token: %w", err)
	}

	// Validate claims
	claims, ok := token.Claims.(*RefreshClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid refresh token")
	}

	// Get user
	user, err := s.userRepository.GetByID(claims.UserID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	// Check if user is active
	if !user.IsActive {
		return nil, errors.New("user account is inactive")
	}

	// Generate new tokens
	tokens, err := s.generateTokens(user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate tokens: %w", err)
	}

	return tokens, nil
}

// ValidateToken validates an access token
func (s *Service) ValidateToken(accessToken string) (*Claims, error) {
	// Parse access token
	token, err := jwt.ParseWithClaims(accessToken, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(s.config.Auth.JWTSecret), nil
	})
	if err != nil {
		return nil, fmt.Errorf("invalid access token: %w", err)
	}

	// Validate claims
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid access token")
	}

	return claims, nil
}

// generateTokens generates access and refresh tokens
func (s *Service) generateTokens(user *models.User) (*Tokens, error) {
	// Create access token
	accessTokenExpiry := time.Now().Add(time.Duration(s.config.Auth.TokenExpiry) * time.Second)
	accessClaims := &Claims{
		UserID:   user.ID,
		Username: user.Username,
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: accessTokenExpiry.Unix(),
			IssuedAt:  time.Now().Unix(),
			Issuer:    "service_layer",
		},
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessTokenString, err := accessToken.SignedString([]byte(s.config.Auth.JWTSecret))
	if err != nil {
		return nil, fmt.Errorf("failed to sign access token: %w", err)
	}

	// Create refresh token
	refreshTokenExpiry := time.Now().Add(time.Duration(s.config.Auth.RefreshTokenExpiry) * time.Second)
	tokenID := uuid.New().String()
	refreshClaims := &RefreshClaims{
		UserID:  user.ID,
		TokenID: tokenID,
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: refreshTokenExpiry.Unix(),
			IssuedAt:  time.Now().Unix(),
			Issuer:    "service_layer",
		},
	}
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshTokenString, err := refreshToken.SignedString([]byte(s.config.Auth.JWTSecret))
	if err != nil {
		return nil, fmt.Errorf("failed to sign refresh token: %w", err)
	}

	return &Tokens{
		AccessToken:  accessTokenString,
		RefreshToken: refreshTokenString,
		ExpiresIn:    s.config.Auth.TokenExpiry,
	}, nil
}
