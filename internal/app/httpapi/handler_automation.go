package httpapi

import (
	"fmt"
	"net/http"
	"strings"
	"time"
)

func (h *handler) accountAutomation(w http.ResponseWriter, r *http.Request, accountID string, rest []string) {
	if h.app.Automation == nil {
		writeError(w, http.StatusNotImplemented, fmt.Errorf("automation service not configured"))
		return
	}

	if len(rest) == 0 || rest[0] != "jobs" {
		w.WriteHeader(http.StatusNotFound)
		return
	}

	switch len(rest) {
	case 1:
		switch r.Method {
		case http.MethodGet:
			jobs, err := h.app.Automation.ListJobs(r.Context(), accountID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, err)
				return
			}
			writeJSON(w, http.StatusOK, jobs)
		case http.MethodPost:
			var payload struct {
				FunctionID  string `json:"function_id"`
				Name        string `json:"name"`
				Schedule    string `json:"schedule"`
				Description string `json:"description"`
			}
			if err := decodeJSON(r.Body, &payload); err != nil {
				writeError(w, http.StatusBadRequest, err)
				return
			}
			job, err := h.app.Automation.CreateJob(r.Context(), accountID, payload.FunctionID, payload.Name, payload.Schedule, payload.Description)
			if err != nil {
				writeError(w, http.StatusBadRequest, err)
				return
			}
			writeJSON(w, http.StatusCreated, job)
		default:
			methodNotAllowed(w, http.MethodGet, http.MethodPost)
		}
	case 2:
		jobID := rest[1]
		switch r.Method {
		case http.MethodGet:
			job, err := h.app.Automation.GetJob(r.Context(), jobID)
			if err != nil {
				writeError(w, http.StatusNotFound, err)
				return
			}
			if job.AccountID != accountID {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			writeJSON(w, http.StatusOK, job)
		case http.MethodPatch:
			job, err := h.app.Automation.GetJob(r.Context(), jobID)
			if err != nil {
				writeError(w, http.StatusNotFound, err)
				return
			}
			if job.AccountID != accountID {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			var payload struct {
				Name        *string `json:"name"`
				Schedule    *string `json:"schedule"`
				Description *string `json:"description"`
				Enabled     *bool   `json:"enabled"`
				NextRun     *string `json:"next_run"`
			}
			if err := decodeJSON(r.Body, &payload); err != nil {
				writeError(w, http.StatusBadRequest, err)
				return
			}

			var nextRun *time.Time
			if payload.NextRun != nil {
				trimmed := strings.TrimSpace(*payload.NextRun)
				if trimmed == "" {
					zero := time.Time{}
					nextRun = &zero
				} else {
					parsed, err := time.Parse(time.RFC3339, trimmed)
					if err != nil {
						writeError(w, http.StatusBadRequest, fmt.Errorf("next_run must be RFC3339 timestamp"))
						return
					}
					nextRun = &parsed
				}
			}

			updated := job
			if payload.Name != nil || payload.Schedule != nil || payload.Description != nil || payload.NextRun != nil {
				updated, err = h.app.Automation.UpdateJob(r.Context(), jobID, payload.Name, payload.Schedule, payload.Description, nextRun)
				if err != nil {
					writeError(w, http.StatusBadRequest, err)
					return
				}
			}

			if payload.Enabled != nil {
				updated, err = h.app.Automation.SetEnabled(r.Context(), updated.ID, *payload.Enabled)
				if err != nil {
					writeError(w, http.StatusBadRequest, err)
					return
				}
			}
			writeJSON(w, http.StatusOK, updated)
		default:
			methodNotAllowed(w, http.MethodGet, http.MethodPatch)
		}
	default:
		w.WriteHeader(http.StatusNotFound)
	}
}
