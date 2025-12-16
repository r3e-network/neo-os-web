package main

import (
	"net/http"

	"github.com/gorilla/mux"

	"github.com/R3E-Network/service_layer/internal/database"
)

// requirePrimaryWalletMiddleware enforces that the authenticated user has a bound
// primary wallet before using service-layer (proxied) endpoints.
//
// This supports OAuth-first onboarding: users can sign up with OAuth, but must
// bind a Neo N3 address before accessing the on-chain service layer.
func requirePrimaryWalletMiddleware(db *database.Repository) mux.MiddlewareFunc {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if db == nil {
				jsonError(w, "database not configured", http.StatusServiceUnavailable)
				return
			}

			userID := r.Header.Get("X-User-ID")
			if userID == "" {
				jsonError(w, "missing user id", http.StatusUnauthorized)
				return
			}

			wallets, err := db.GetUserWallets(r.Context(), userID)
			if err != nil {
				jsonError(w, "failed to validate wallet binding", http.StatusInternalServerError)
				return
			}

			for _, wallet := range wallets {
				if wallet.IsPrimary && wallet.Verified {
					next.ServeHTTP(w, r)
					return
				}
			}

			// 428 makes it explicit this is a required onboarding step.
			jsonError(w, "primary wallet binding required", http.StatusPreconditionRequired)
		})
	}
}
