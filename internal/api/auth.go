package api

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/willtech-services/service_layer/internal/core/auth"
)

// LoginRequest represents a login request
type LoginRequest struct {
	UsernameOrEmail string `json:"username_or_email" binding:"required"`
	Password        string `json:"password" binding:"required"`
}

// RegisterRequest represents a registration request
type RegisterRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

// RefreshTokenRequest represents a token refresh request
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// loginHandler handles user login requests
func (s *Server) loginHandler(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request: " + err.Error()})
		return
	}

	tokens, err := s.authService.Login(req.UsernameOrEmail, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "Authentication failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": tokens})
}

// registerHandler handles user registration requests
func (s *Server) registerHandler(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request: " + err.Error()})
		return
	}

	user, err := s.authService.Register(req.Username, req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Registration failed: " + err.Error()})
		return
	}

	// Generate tokens
	tokens, err := s.authService.Login(req.Username, req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Token generation failed"})
		return
	}

	// Return user info and tokens
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"user":   user,
			"tokens": tokens,
		},
	})
}

// refreshTokenHandler handles token refresh requests
func (s *Server) refreshTokenHandler(c *gin.Context) {
	var req RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request: " + err.Error()})
		return
	}

	tokens, err := s.authService.RefreshToken(req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "Token refresh failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": tokens})
}

// authMiddleware authenticates requests using JWT
func (s *Server) authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get token from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "Authorization header required"})
			c.Abort()
			return
		}

		// Check Bearer format
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "Invalid authorization format"})
			c.Abort()
			return
		}

		// Validate token
		claims, err := s.authService.ValidateToken(parts[1])
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "Invalid token: " + err.Error()})
			c.Abort()
			return
		}

		// Store user ID in context
		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)

		c.Next()
	}
}

// apiKeyMiddleware authenticates requests using API keys
func (s *Server) apiKeyMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get API key from header
		apiKey := c.GetHeader("X-API-Key")
		if apiKey == "" {
			// Fall back to query parameter
			apiKey = c.Query("api_key")
		}

		if apiKey == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "API key required"})
			c.Abort()
			return
		}

		// Get user by API key
		user, err := s.userRepository.GetByAPIKey(apiKey)
		if err != nil {
			s.logger.Errorf("API key authentication failed: %v", err)
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "Invalid API key"})
			c.Abort()
			return
		}

		if user == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "Invalid API key"})
			c.Abort()
			return
		}

		// Check if user is active
		if !user.IsActive {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "User account is inactive"})
			c.Abort()
			return
		}

		// Store user ID in context
		c.Set("user_id", user.ID)
		c.Set("username", user.Username)

		c.Next()
	}
}

// GetUserID gets the user ID from the context
func GetUserID(c *gin.Context) (int, error) {
	userID, exists := c.Get("user_id")
	if !exists {
		return 0, errors.New("user ID not found in context")
	}

	id, ok := userID.(int)
	if !ok {
		return 0, errors.New("user ID has invalid type")
	}

	return id, nil
}