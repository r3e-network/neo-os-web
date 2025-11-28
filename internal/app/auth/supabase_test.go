package auth

import (
	"crypto/rand"
	"crypto/rsa"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestNewSupabaseManagerRequiresSecret(t *testing.T) {
	if mgr := NewSupabaseManager("", ""); mgr != nil {
		t.Fatalf("expected nil manager when secret is empty")
	}
}

func TestSupabaseManagerValidate(t *testing.T) {
	secret := "supabase-secret"
	claims := &Claims{
		Username: "alice",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	mgr := NewSupabaseManager(secret, "")
	got, err := mgr.Validate(token)
	if err != nil {
		t.Fatalf("validate: %v", err)
	}
	if got.Username != "alice" {
		t.Fatalf("unexpected claims: %+v", got)
	}
}

func TestSupabaseManagerAudienceCheck(t *testing.T) {
	secret := "supabase-secret"
	claims := &Claims{
		Username: "alice",
		RegisteredClaims: jwt.RegisteredClaims{
			Audience:  jwt.ClaimStrings{"authenticated"},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	mgr := NewSupabaseManager(secret, "authenticated")
	if _, err := mgr.Validate(token); err != nil {
		t.Fatalf("expected audience to pass, got %v", err)
	}

	mgr = NewSupabaseManager(secret, "other")
	if _, err := mgr.Validate(token); err == nil {
		t.Fatalf("expected audience mismatch to fail")
	}
}

func TestSupabaseManagerRejectsNonHMAC(t *testing.T) {
	secret := "supabase-secret"
	claims := &Claims{
		Username: "alice",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	priv, err := rsa.GenerateKey(rand.Reader, 1024)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodRS256, claims).SignedString(priv)
	if err != nil {
		t.Fatalf("sign rsa token: %v", err)
	}

	mgr := NewSupabaseManager(secret, "")
	if _, err := mgr.Validate(token); err == nil {
		t.Fatalf("expected non-HMAC signing method to be rejected")
	}
}
