package neoaccounts

import (
	"net/http"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
)

func (s *Service) handleMasterKey(w http.ResponseWriter, r *http.Request) {
	att := s.buildMasterKeyAttestation()
	w.Header().Set("Cache-Control", "public, max-age=60")
	httputil.WriteJSON(w, http.StatusOK, att)
}
