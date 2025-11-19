package runtime

import (
	"testing"

	"github.com/R3E-Network/service_layer/internal/config"
)

func TestDetermineListenAddrUsesDefaults(t *testing.T) {
	cfg := config.New()
	cfg.Server.Host = ""
	cfg.Server.Port = 0

	addr := determineListenAddr(cfg)
	if addr != "0.0.0.0:8080" {
		t.Fatalf("expected default addr, got %s", addr)
	}

	cfg.Server.Host = "127.0.0.1 "
	cfg.Server.Port = 9090
	if got := determineListenAddr(cfg); got != "127.0.0.1:9090" {
		t.Fatalf("unexpected addr %s", got)
	}
}

func TestSplitAndTrim(t *testing.T) {
	cases := map[string][]string{
		"":                 nil,
		"   ":              nil,
		"token1":           {"token1"},
		"token1, token2  ": {"token1", "token2"},
	}

	for input, expected := range cases {
		if got := splitAndTrim(input); len(got) != len(expected) {
			t.Fatalf("splitAndTrim(%q) length mismatch: %v vs %v", input, got, expected)
		}
	}
}

func TestResolveAPITokensReadsEnvAndConfig(t *testing.T) {
	cfg := config.New()
	cfg.Auth.Tokens = []string{" config "}
	t.Setenv("API_TOKENS", "alpha, beta")
	t.Setenv("API_TOKEN", "gamma")
	tokens := resolveAPITokens(cfg)
	if len(tokens) != 4 {
		t.Fatalf("expected 4 tokens, got %d", len(tokens))
	}
	if tokens[0] != "config" || tokens[1] != "alpha" || tokens[3] != "gamma" {
		t.Fatalf("unexpected tokens %v", tokens)
	}
}

func TestResolveAPITokensTrimsConfig(t *testing.T) {
	cfg := config.New()
	cfg.Auth.Tokens = []string{"  token-one  ", ""}
	tokens := resolveAPITokens(cfg)
	if len(tokens) != 1 || tokens[0] != "token-one" {
		t.Fatalf("expected trimmed config tokens, got %v", tokens)
	}
}

func TestWithAPITokensOption(t *testing.T) {
	builder := defaultBuilderOptions()
	option := WithAPITokens([]string{" alpha ", "", "beta"})
	option(&builder)
	if len(builder.tokens) != 2 || builder.tokens[0] != "alpha" {
		t.Fatalf("tokens not cleaned: %v", builder.tokens)
	}
}

func TestWithRunMigrationsOption(t *testing.T) {
	builder := defaultBuilderOptions()
	WithRunMigrations(false)(&builder)
	if builder.runMigrations == nil || *builder.runMigrations {
		t.Fatalf("expected runMigrations to be false")
	}
}

func TestResolveSecretEncryptionKeyPrefersEnv(t *testing.T) {
	cfg := config.New()
	cfg.Security.SecretEncryptionKey = "config"
	t.Setenv("SECRET_ENCRYPTION_KEY", "env-value")
	defer t.Setenv("SECRET_ENCRYPTION_KEY", "")
	if key := resolveSecretEncryptionKey(cfg); key != "env-value" {
		t.Fatalf("expected env key to win, got %q", key)
	}
}

func TestResolveSecretEncryptionKeyFallsBackToConfig(t *testing.T) {
	cfg := config.New()
	cfg.Security.SecretEncryptionKey = "  config-key "
	t.Setenv("SECRET_ENCRYPTION_KEY", "")
	if key := resolveSecretEncryptionKey(cfg); key != "config-key" {
		t.Fatalf("expected config key, got %q", key)
	}
}
