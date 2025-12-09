// Package confidential provides HTTP handlers for the confidential compute service.
package confidentialmarble

import (
	"net/http"

	"github.com/R3E-Network/service_layer/internal/httputil"
)

// =============================================================================
// HTTP Handlers
// =============================================================================

func (s *Service) handleExecute(w http.ResponseWriter, r *http.Request) {
	userID, ok := httputil.RequireUserID(w, r)
	if !ok {
		return
	}

	var req ExecuteRequest
	if !httputil.DecodeJSON(w, r, &req) {
		return
	}

	if req.Script == "" {
		httputil.BadRequest(w, "script required")
		return
	}

	if req.EntryPoint == "" {
		req.EntryPoint = "main"
	}

	result, err := s.Execute(r.Context(), userID, &req)
	if err != nil {
		httputil.InternalError(w, err.Error())
		return
	}

	httputil.WriteJSON(w, http.StatusOK, result)
}

func (s *Service) handleGetJob(w http.ResponseWriter, r *http.Request) {
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "not found"})
}

func (s *Service) handleListJobs(w http.ResponseWriter, r *http.Request) {
	httputil.WriteJSON(w, http.StatusOK, []interface{}{})
}
