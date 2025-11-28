package runtime

import (
	"testing"
	"time"

	appauth "github.com/R3E-Network/service_layer/internal/app/auth"
	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/golang-jwt/jwt/v5"
)

func TestBuildAuthStackFallsBackToSupabaseSecret(t *testing.T) {
	cfg := config.New()
	cfg.Auth.SupabaseJWTSecret = "sup-secret"
	cfg.Auth.SupabaseGoTrueURL = "http://localhost:9999"
	cfg.Auth.Users = []config.UserSpec{{Username: "alice", Password: "pass", Role: "user"}}

	authMgr, validator := buildAuthStack(cfg)
	if authMgr == nil || validator == nil {
		t.Fatalf("expected auth manager and validator when users and supabase secret are configured")
	}

	user, err := authMgr.Authenticate("alice", "pass")
	if err != nil {
		t.Fatalf("authenticate: %v", err)
	}
	token, _, err := authMgr.Issue(user, time.Hour)
	if err != nil {
		t.Fatalf("issue token: %v", err)
	}
	if _, err := validator.Validate(token); err != nil {
		t.Fatalf("expected token to validate via supabase-backed validator: %v", err)
	}
}

func TestBuildAuthStackSupabaseAdminRolesFromEnv(t *testing.T) {
	cfg := config.New()
	cfg.Auth.SupabaseJWTSecret = "sup-secret"
	cfg.Auth.SupabaseJWTAud = "authenticated"
	cfg.Auth.SupabaseGoTrueURL = "http://localhost:9999"
	t.Setenv("SUPABASE_ADMIN_ROLES", "service_role")

	_, validator := buildAuthStack(cfg)
	if validator == nil {
		t.Fatalf("expected validator when supabase secret is set")
	}

	claims := &appauth.Claims{
		Username: "svc",
		Role:     "service_role",
		RegisteredClaims: jwt.RegisteredClaims{
			Audience:  jwt.ClaimStrings{cfg.Auth.SupabaseJWTAud},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(cfg.Auth.SupabaseJWTSecret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	mapped, err := validator.Validate(token)
	if err != nil {
		t.Fatalf("validate: %v", err)
	}
	if mapped.Role != "admin" {
		t.Fatalf("expected role mapped to admin via env admin roles, got %s", mapped.Role)
	}
}
