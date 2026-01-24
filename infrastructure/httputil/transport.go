package httputil

import (
	"crypto/tls"
	"net/http"
)

// SecureCipherSuites returns the list of secure TLS 1.2 cipher suites.
// SECURITY: Only includes AEAD ciphers with forward secrecy (ECDHE).
// TLS 1.3 cipher suites are managed by Go automatically.
func SecureCipherSuites() []uint16 {
	return []uint16{
		// TLS 1.2 AEAD ciphers with ECDHE (forward secrecy)
		tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
		tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
		tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
		tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
		tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256,
		tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256,
	}
}

// SecureTLSConfig returns a secure TLS configuration.
// SECURITY: Enforces TLS 1.2 minimum with secure cipher suites only.
func SecureTLSConfig() *tls.Config {
	return &tls.Config{
		MinVersion:   tls.VersionTLS12,
		CipherSuites: SecureCipherSuites(),
		// SECURITY: Prefer server cipher suite order for TLS 1.2
		// (TLS 1.3 ignores this setting)
		PreferServerCipherSuites: true,
	}
}

// DefaultTransportWithMinTLS12 clones http.DefaultTransport (when possible) and
// enforces a modern TLS baseline for outbound calls.
//
// This helper is used by multiple clients (Supabase, chain RPC, external API
// integrations) to avoid duplicating transport-cloning logic and to ensure TLS
// 1.2+ is consistently enforced.
//
// SECURITY: Restricts cipher suites to AEAD ciphers with forward secrecy.
func DefaultTransportWithMinTLS12() http.RoundTripper {
	base, ok := http.DefaultTransport.(*http.Transport)
	if !ok {
		return http.DefaultTransport
	}

	cloned := base.Clone()
	cloned.TLSClientConfig = SecureTLSConfig()

	return cloned
}
