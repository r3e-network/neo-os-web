package app

import (
	"net/http"
	"testing"
	"time"
)

type fakeEnv map[string]string

func (f fakeEnv) Lookup(key string) string {
	return f[key]
}

func TestResolveBuilderOptions_FromEnvironment(t *testing.T) {
	env := fakeEnv{
		"TEE_MODE":             "mock",
		"RANDOM_SIGNING_KEY":   "abc",
		"PRICEFEED_FETCH_URL":  " https://example.com ",
		"PRICEFEED_FETCH_KEY":  "token",
		"GASBANK_RESOLVER_URL": "https://gas",
		"GASBANK_RESOLVER_KEY": "resolver",
		"CRE_HTTP_RUNNER":      "true",
		"BUS_MAX_BYTES":        "2048",
	}
	resolved := resolveBuilderOptions(WithEnvironment(env))
	if resolved.runtime.teeMode != "mock" {
		t.Fatalf("expected tee mode 'mock', got %q", resolved.runtime.teeMode)
	}
	if resolved.runtime.randomSigningKey != "abc" {
		t.Fatalf("unexpected random signing key: %q", resolved.runtime.randomSigningKey)
	}
	if !resolved.runtime.creHTTPRunner {
		t.Fatalf("cre HTTP runner flag not propagated")
	}
	if resolved.runtime.priceFeedFetchURL != "https://example.com" {
		t.Fatalf("price feed URL not trimmed: %q", resolved.runtime.priceFeedFetchURL)
	}
	if resolved.runtime.gasBankResolverKey != "resolver" {
		t.Fatalf("gas bank resolver key not captured")
	}
	if resolved.runtime.busMaxBytes != 2048 {
		t.Fatalf("bus max bytes not captured, got %d", resolved.runtime.busMaxBytes)
	}
}

func TestResolveBuilderOptions_WithRuntimeConfigOverridesEnv(t *testing.T) {
	env := fakeEnv{"TEE_MODE": "mock"}
	cfg := RuntimeConfig{TEEMode: "hardware", CREHTTPRunner: true}
	resolved := resolveBuilderOptions(WithEnvironment(env), WithRuntimeConfig(cfg))
	if resolved.runtime.teeMode != "hardware" {
		t.Fatalf("expected override to win, got %q", resolved.runtime.teeMode)
	}
	if !resolved.runtime.creHTTPRunner {
		t.Fatalf("expected CRE HTTP runner flag from runtime config")
	}
}

func TestResolveBuilderOptions_CustomHTTPClient(t *testing.T) {
	client := &http.Client{Timeout: time.Second}
	resolved := resolveBuilderOptions(WithHTTPClient(client))
	if resolved.httpClient != client {
		t.Fatalf("custom http client not applied")
	}
}
