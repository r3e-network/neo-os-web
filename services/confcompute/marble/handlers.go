// Package neocompute provides HTTP handlers for the neocompute service.
package neocompute

import (
	"context"
	"net/http"

	"github.com/gorilla/mux"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/httputil"
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
		s.Logger().WithContext(r.Context()).WithError(err).Error("failed to execute compute")
		httputil.InternalError(w, "failed to execute compute")
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

func (s *Service) handleListJobs() http.HandlerFunc {
	return httputil.HandleNoBodyWithUserAuth(s.Logger(), func(_ context.Context, userID string) ([]*ExecuteResponse, error) {
		jobs := s.listJobs(userID)
		if jobs == nil {
			jobs = []*ExecuteResponse{}
		}
		return jobs, nil
	})
}
