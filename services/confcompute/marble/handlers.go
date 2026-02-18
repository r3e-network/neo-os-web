// Package neocompute provides HTTP handlers for the neocompute service.
package neocompute

import (
	"net/http"

	"github.com/gorilla/mux"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
)

func isValidEntryPoint(s string) bool {
	for i, r := range s {
		if r == '_' || (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') {
			continue
		}
		if i > 0 && r >= '0' && r <= '9' {
			continue
		}
		return false
	}
	return len(s) > 0
}

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
	} else if len(req.EntryPoint) > 128 || !isValidEntryPoint(req.EntryPoint) {
		httputil.BadRequest(w, "invalid entry point")
		return
	}

	result, err := s.Execute(r.Context(), userID, &req)
	if err != nil {
		s.Logger().Error(r.Context(), "failed to execute script", err, nil)
		httputil.InternalError(w, "internal error")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, result)
}

func (s *Service) handleGetJob(w http.ResponseWriter, r *http.Request) {
	userID, ok := httputil.RequireUserID(w, r)
	if !ok {
		return
	}

	jobID := mux.Vars(r)["id"]
	if jobID == "" {
		httputil.BadRequest(w, "job id required")
		return
	}

	job := s.getJob(userID, jobID)
	if job == nil {
		httputil.NotFound(w, "job not found")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, job)
}

func (s *Service) handleListJobs(w http.ResponseWriter, r *http.Request) {
	userID, ok := httputil.RequireUserID(w, r)
	if !ok {
		return
	}

	jobs := s.listJobs(userID)
	if jobs == nil {
		jobs = []*ExecuteResponse{}
	}

	httputil.WriteJSON(w, http.StatusOK, jobs)
}
