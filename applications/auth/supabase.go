package auth

import (
	"errors"
	"fmt"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

// SupabaseManager validates Supabase-issued JWTs (HS256).
type SupabaseManager struct {
	secret []byte
	aud    string
}

func NewSupabaseManager(secret, aud string) JWTManager {
	secret = strings.TrimSpace(secret)
	aud = strings.TrimSpace(aud)
	if secret == "" {
		return nil
	}
	return &SupabaseManager{secret: []byte(secret), aud: aud}
}

// Validate implements JWTManager, accepting HS256 JWTs and optional audience check.
func (m *SupabaseManager) Validate(tokenString string) (*Claims, error) {
	if m == nil || len(m.secret) == 0 {
		return nil, errors.New("supabase jwt secret not configured")
	}
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method %v", t.Header["alg"])
		}
		return m.secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	if m.aud != "" && claims.Audience != nil {
		validAud := false
		for _, a := range claims.Audience {
			if strings.EqualFold(strings.TrimSpace(a), m.aud) {
				validAud = true
				break
			}
		}
		if !validAud {
			return nil, fmt.Errorf("invalid audience")
		}
	}
	return claims, nil
}
