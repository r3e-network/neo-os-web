package service

import (
	"net/http"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
)

func onlyGetOrHead(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			httputil.WriteErrorResponse(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed", nil)
			return
		}
		next(w, r)
	}
}

// RegisterStandardRoutesOnServeMux registers /health, /ready, and /info on an http.ServeMux.
// This is useful for services that are composed into an existing net/http server.
func (b *BaseService) RegisterStandardRoutesOnServeMux(mux *http.ServeMux) {
	b.RegisterStandardRoutesOnServeMuxWithOptions(mux, RouteOptions{})
}

// RegisterStandardRoutesOnServeMuxWithOptions registers standard routes on an http.ServeMux
// with configurable options. Use SkipInfo: true when the service provides a custom /info.
func (b *BaseService) RegisterStandardRoutesOnServeMuxWithOptions(mux *http.ServeMux, opts RouteOptions) {
	if mux == nil {
		return
	}

	mux.HandleFunc("/health", onlyGetOrHead(HealthHandler(b)))
	mux.HandleFunc("/ready", onlyGetOrHead(ReadinessHandler(b)))
	if !opts.SkipInfo {
		mux.HandleFunc("/info", onlyGetOrHead(InfoHandler(b)))
	}
}
