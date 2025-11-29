// Package auth provides Supabase GoTrue-based authentication.
// This replaces the custom JWT manager with Supabase's authentication service.
package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/R3E-Network/service_layer/pkg/supabase"
	"github.com/golang-jwt/jwt/v5"
)

var (
	ErrUnauthorised    = errors.New("unauthorized")
	ErrInvalidToken    = errors.New("invalid token")
	ErrUserNotFound    = errors.New("user not found")
	ErrInvalidPassword = errors.New("invalid password")
)

// SupabaseAuth wraps Supabase GoTrue for authentication.
type SupabaseAuth struct {
	client    *supabase.Client
	jwtSecret []byte
	aud       string
}

// NewSupabaseAuth creates a new Supabase-based auth manager.
func NewSupabaseAuth(client *supabase.Client, jwtSecret, aud string) *SupabaseAuth {
	return &SupabaseAuth{
		client:    client,
		jwtSecret: []byte(strings.TrimSpace(jwtSecret)),
		aud:       strings.TrimSpace(aud),
	}
}

// SignUp creates a new user account via GoTrue.
func (a *SupabaseAuth) SignUp(ctx context.Context, email, password string, metadata map[string]interface{}) (*supabase.AuthResponse, error) {
	if a.client == nil {
		return nil, errors.New("supabase client not configured")
	}
	return a.client.SignUp(ctx, email, password, metadata)
}

// SignIn authenticates a user via GoTrue.
func (a *SupabaseAuth) SignIn(ctx context.Context, email, password string) (*supabase.AuthResponse, error) {
	if a.client == nil {
		return nil, errors.New("supabase client not configured")
	}
	return a.client.SignIn(ctx, email, password)
}

// RefreshToken exchanges a refresh token for a new access token.
func (a *SupabaseAuth) RefreshToken(ctx context.Context, refreshToken string) (*supabase.AuthResponse, error) {
	if a.client == nil {
		return nil, errors.New("supabase client not configured")
	}
	return a.client.RefreshToken(ctx, refreshToken)
}

// GetUser retrieves the current user from an access token.
func (a *SupabaseAuth) GetUser(ctx context.Context, accessToken string) (*supabase.User, error) {
	if a.client == nil {
		return nil, errors.New("supabase client not configured")
	}
	return a.client.GetUser(ctx, accessToken)
}

// SignOut invalidates the user's session.
func (a *SupabaseAuth) SignOut(ctx context.Context, accessToken string) error {
	if a.client == nil {
		return errors.New("supabase client not configured")
	}
	return a.client.SignOut(ctx, accessToken)
}

// ValidateToken validates a Supabase JWT and returns claims.
func (a *SupabaseAuth) ValidateToken(tokenString string) (*TokenClaims, error) {
	if len(a.jwtSecret) == 0 {
		return nil, errors.New("jwt secret not configured")
	}

	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return a.jwtSecret, nil
	})
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidToken, err)
	}

	if !token.Valid {
		return nil, ErrInvalidToken
	}

	mapClaims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, ErrInvalidToken
	}

	// Validate audience if configured
	if a.aud != "" {
		if aud, ok := mapClaims["aud"].(string); ok {
			if !strings.EqualFold(aud, a.aud) {
				return nil, fmt.Errorf("%w: invalid audience", ErrInvalidToken)
			}
		}
	}

	return parseMapClaims(mapClaims), nil
}

// TokenClaims represents parsed JWT claims from Supabase.
type TokenClaims struct {
	Sub         string                 `json:"sub"`          // User ID
	Email       string                 `json:"email"`        // User email
	Role        string                 `json:"role"`         // User role
	TenantID    string                 `json:"tenant_id"`    // Tenant ID (custom claim)
	Aud         string                 `json:"aud"`          // Audience
	Exp         int64                  `json:"exp"`          // Expiration
	Iat         int64                  `json:"iat"`          // Issued at
	AppMetadata map[string]interface{} `json:"app_metadata"` // App metadata
}

// IsExpired checks if the token has expired.
func (c *TokenClaims) IsExpired() bool {
	return time.Now().Unix() > c.Exp
}

// IsAdmin checks if the user has admin role.
func (c *TokenClaims) IsAdmin() bool {
	return c.Role == "service_role" || c.Role == "admin" || c.Role == "supabase_admin"
}

func parseMapClaims(m jwt.MapClaims) *TokenClaims {
	c := &TokenClaims{}

	if sub, ok := m["sub"].(string); ok {
		c.Sub = sub
	}
	if email, ok := m["email"].(string); ok {
		c.Email = email
	}
	if role, ok := m["role"].(string); ok {
		c.Role = role
	}
	if aud, ok := m["aud"].(string); ok {
		c.Aud = aud
	}
	if exp, ok := m["exp"].(float64); ok {
		c.Exp = int64(exp)
	}
	if iat, ok := m["iat"].(float64); ok {
		c.Iat = int64(iat)
	}

	// Extract tenant from custom claim or app_metadata
	if tenant, ok := m["tenant_id"].(string); ok {
		c.TenantID = tenant
	} else if appMeta, ok := m["app_metadata"].(map[string]interface{}); ok {
		c.AppMetadata = appMeta
		if tenant, ok := appMeta["tenant_id"].(string); ok {
			c.TenantID = tenant
		}
	}

	return c
}

// InviteUser sends an invite email to a new user (admin only).
func (a *SupabaseAuth) InviteUser(ctx context.Context, email string, metadata map[string]interface{}) (*supabase.User, error) {
	if a.client == nil {
		return nil, errors.New("supabase client not configured")
	}
	return a.client.InviteUser(ctx, email, metadata)
}
