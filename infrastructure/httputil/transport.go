package httputil

import (
	"crypto/tls"
	"net/http"
)

// DefaultTransportWithMinTLS12 clones http.DefaultTransport (when possible) and
// enforces a modern TLS baseline for outbound calls.
//
// This helper is used by multiple clients (Supabase, chain RPC, external API
// integrations) to avoid duplicating transport-cloning logic and to ensure TLS
// 1.2+ is consistently enforced.
func DefaultTransportWithMinTLS12() http.RoundTripper {
	base, ok := http.DefaultTransport.(*http.Transport)
	if !ok {
		return http.DefaultTransport
	}

	cloned := base.Clone()
	if cloned.TLSClientConfig != nil {
		cloned.TLSClientConfig = cloned.TLSClientConfig.Clone()
		if cloned.TLSClientConfig.MinVersion == 0 || cloned.TLSClientConfig.MinVersion < tls.VersionTLS12 {
			cloned.TLSClientConfig.MinVersion = tls.VersionTLS12
		}
	} else {
		cloned.TLSClientConfig = &tls.Config{MinVersion: tls.VersionTLS12}
	}

	return cloned
}
