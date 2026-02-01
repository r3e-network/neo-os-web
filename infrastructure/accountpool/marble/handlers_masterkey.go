package neoaccounts

import (
	"net/http"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/httputil"
)

func (s *Service) handleMasterKey(w http.ResponseWriter, r *http.Request) {
	att := s.buildMasterKeyAttestation()
	w.Header().Set("Cache-Control", "public, max-age=60")
	httputil.WriteJSON(w, http.StatusOK, att)
}
