package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func dummyHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
}

func TestCORS_WildcardWithCredentials_BlocksWildcardOrigin(t *testing.T) {
	m := NewCORSMiddleware(&CORSConfig{
		AllowedOrigins:   []string{"*"},
		AllowCredentials: true,
	})
	handler := m.Handler(dummyHandler())

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got == "*" {
		t.Error("wildcard origin must not be returned when credentials are enabled")
	}
	if got := rec.Header().Get("Access-Control-Allow-Credentials"); got == "true" {
		if ao := rec.Header().Get("Access-Control-Allow-Origin"); ao == "*" || ao == "" {
			t.Error("credentials header must not be set with wildcard or missing origin")
		}
	}
}

func TestCORS_ExplicitOriginWithCredentials(t *testing.T) {
	const allowed = "https://app.example.com"
	m := NewCORSMiddleware(&CORSConfig{
		AllowedOrigins:   []string{allowed},
		AllowCredentials: true,
	})
	handler := m.Handler(dummyHandler())

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.Header.Set("Origin", allowed)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != allowed {
		t.Errorf("expected origin %q, got %q", allowed, got)
	}
	if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != "true" {
		t.Errorf("expected credentials true, got %q", got)
	}
}

func TestCORS_WildcardWithoutCredentials(t *testing.T) {
	m := NewCORSMiddleware(&CORSConfig{
		AllowedOrigins:   []string{"*"},
		AllowCredentials: false,
	})
	handler := m.Handler(dummyHandler())

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.Header.Set("Origin", "https://any.example.com")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://any.example.com" {
		t.Errorf("expected origin echo for wildcard, got %q", got)
	}
	if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != "" {
		t.Errorf("expected no credentials header, got %q", got)
	}
}

func TestCORS_WildcardCredentials_Preflight(t *testing.T) {
	m := NewCORSMiddleware(&CORSConfig{
		AllowedOrigins:   []string{"*"},
		AllowCredentials: true,
	})
	handler := m.Handler(dummyHandler())

	req := httptest.NewRequest(http.MethodOptions, "/api/test", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got == "*" {
		t.Error("preflight must not return wildcard origin with credentials")
	}
}

func TestCORS_WildcardCredentials_DisallowedOriginNotReflected(t *testing.T) {
	// Only "*" in the list, credentials on => allowAll forced false,
	// and "*" won't match as a literal origin, so unknown origins are blocked.
	m := NewCORSMiddleware(&CORSConfig{
		AllowedOrigins:   []string{"*"},
		AllowCredentials: true,
	})
	handler := m.Handler(dummyHandler())

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.Header.Set("Origin", "https://attacker.example.com")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("expected no allow-origin header for blocked origin, got %q", got)
	}
}
