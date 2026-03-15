package neoflow

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
	neoflowsupabase "github.com/r3e-network/neo-miniapp-platform/services/automation/supabase"
)

// withRepo wraps a handler that requires the repository to be configured.
func (s *Service) withRepo(fn func(w http.ResponseWriter, r *http.Request, userID string)) func(w http.ResponseWriter, r *http.Request, userID string) {
	return func(w http.ResponseWriter, r *http.Request, userID string) {
		if s.repo == nil {
			httputil.ServiceUnavailable(w, "repository not configured")
			return
		}
		fn(w, r, userID)
	}
}

func (s *Service) handleListTriggers(w http.ResponseWriter, r *http.Request, userID string) {
	triggers, err := s.repo.GetTriggers(r.Context(), userID)
	if err != nil {
		s.Logger().Error(r.Context(), "failed to list triggers", err, nil)
		httputil.WriteErrorResponse(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "internal error", nil)
		return
	}

	responses := make([]TriggerResponse, len(triggers))
	for i := range triggers {
		t := &triggers[i]
		responses[i] = TriggerResponse{
			ID:          t.ID,
			Name:        t.Name,
			TriggerType: t.TriggerType,
			Schedule:    t.Schedule,
			Condition:   t.Condition,
			Action:      t.Action,
			Enabled:     t.Enabled,
			CreatedAt:   t.CreatedAt,
		}
	}

	httputil.WriteJSON(w, http.StatusOK, responses)
}

func (s *Service) handleCreateTrigger(w http.ResponseWriter, r *http.Request, userID string) {
	var req TriggerRequest
	if !httputil.DecodeJSON(w, r, &req) {
		return
	}

	if req.Name == "" || req.TriggerType == "" {
		httputil.BadRequest(w, "name and trigger_type required")
		return
	}
	if len(req.Schedule) > 256 || len(req.Condition) > 4096 || len(req.Action) > 4096 || len(req.Name) > 256 {
		httputil.BadRequest(w, "field exceeds maximum length")
		return
	}

	// Calculate next execution for cron triggers
	var nextExec time.Time
	if req.TriggerType == "cron" && req.Schedule != "" {
		next, err := s.parseNextCronExecution(req.Schedule)
		if err != nil {
			httputil.BadRequest(w, "invalid cron schedule")
			return
		}
		nextExec = next
	}

	trigger := &neoflowsupabase.Trigger{
		ID:            uuid.New().String(),
		UserID:        userID,
		Name:          req.Name,
		TriggerType:   req.TriggerType,
		Schedule:      req.Schedule,
		Condition:     req.Condition,
		Action:        req.Action,
		Enabled:       true,
		NextExecution: nextExec,
		CreatedAt:     time.Now(),
	}

	if err := s.repo.CreateTrigger(r.Context(), trigger); err != nil {
		s.Logger().Error(r.Context(), "failed to persist trigger", err, nil)
		httputil.WriteErrorResponse(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "internal error", nil)
		return
	}

	httputil.WriteJSON(w, http.StatusCreated, TriggerResponse{
		ID:          trigger.ID,
		Name:        trigger.Name,
		TriggerType: trigger.TriggerType,
		Schedule:    trigger.Schedule,
		Action:      trigger.Action,
		Enabled:     trigger.Enabled,
		CreatedAt:   trigger.CreatedAt,
	})
}

func requireTriggerID(w http.ResponseWriter, r *http.Request) (string, bool) {
	id := mux.Vars(r)["id"]
	if _, err := uuid.Parse(id); err != nil {
		httputil.BadRequest(w, "invalid trigger id format")
		return "", false
	}
	return id, true
}

func (s *Service) handleGetTrigger(w http.ResponseWriter, r *http.Request, userID string) {
	id, ok := requireTriggerID(w, r)
	if !ok {
		return
	}
	trigger, err := s.repo.GetTrigger(r.Context(), id, userID)
	if err != nil {
		s.Logger().Warn(r.Context(), "get trigger", map[string]interface{}{"trigger_id": id, "error": err.Error()})
		httputil.NotFound(w, "trigger not found")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, trigger)
}

func (s *Service) handleUpdateTrigger(w http.ResponseWriter, r *http.Request, userID string) {
	id, idOk := requireTriggerID(w, r)
	if !idOk {
		return
	}

	var req TriggerRequest
	if !httputil.DecodeJSON(w, r, &req) {
		return
	}

	if len(req.Schedule) > 256 || len(req.Condition) > 4096 || len(req.Action) > 4096 || len(req.Name) > 256 {
		httputil.BadRequest(w, "field exceeds maximum length")
		return
	}

	trigger, err := s.repo.GetTrigger(r.Context(), id, userID)
	if err != nil {
		s.Logger().Warn(r.Context(), "get trigger for update", map[string]interface{}{"trigger_id": id, "error": err.Error()})
		httputil.NotFound(w, "trigger not found")
		return
	}

	trigger.Name = req.Name
	trigger.TriggerType = req.TriggerType
	trigger.Schedule = req.Schedule
	trigger.Condition = req.Condition
	trigger.Action = req.Action

	if trigger.TriggerType == "cron" && trigger.Schedule != "" {
		next, err := s.parseNextCronExecution(trigger.Schedule)
		if err != nil {
			httputil.BadRequest(w, "invalid cron schedule")
			return
		}
		trigger.NextExecution = next
	}

	if err := s.repo.UpdateTrigger(r.Context(), trigger); err != nil {
		s.Logger().Error(r.Context(), "failed to update trigger", err, nil)
		httputil.WriteErrorResponse(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "internal error", nil)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, trigger)
}

func (s *Service) handleDeleteTrigger(w http.ResponseWriter, r *http.Request, userID string) {
	id, idOk := requireTriggerID(w, r)
	if !idOk {
		return
	}
	if err := s.repo.DeleteTrigger(r.Context(), id, userID); err != nil {
		s.Logger().Warn(r.Context(), "delete trigger", map[string]interface{}{"trigger_id": id, "error": err.Error()})
		httputil.NotFound(w, "trigger not found")
		return
	}
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusNoContent)
}

func (s *Service) handleEnableTrigger(w http.ResponseWriter, r *http.Request, userID string) {
	id, idOk := requireTriggerID(w, r)
	if !idOk {
		return
	}
	if err := s.repo.SetTriggerEnabled(r.Context(), id, userID, true); err != nil {
		s.Logger().Warn(r.Context(), "enable trigger", map[string]interface{}{"trigger_id": id, "error": err.Error()})
		httputil.NotFound(w, "trigger not found")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, StatusResponse{Status: "enabled"})
}

func (s *Service) handleDisableTrigger(w http.ResponseWriter, r *http.Request, userID string) {
	id, idOk := requireTriggerID(w, r)
	if !idOk {
		return
	}
	if err := s.repo.SetTriggerEnabled(r.Context(), id, userID, false); err != nil {
		s.Logger().Warn(r.Context(), "disable trigger", map[string]interface{}{"trigger_id": id, "error": err.Error()})
		httputil.NotFound(w, "trigger not found")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, StatusResponse{Status: "disabled"})
}

func (s *Service) handleListExecutions(w http.ResponseWriter, r *http.Request, userID string) {
	id, idOk := requireTriggerID(w, r)
	if !idOk {
		return
	}
	// Ensure trigger belongs to user
	if _, err := s.repo.GetTrigger(r.Context(), id, userID); err != nil {
		s.Logger().Warn(r.Context(), "get trigger for executions", map[string]interface{}{"trigger_id": id, "error": err.Error()})
		httputil.NotFound(w, "trigger not found")
		return
	}
	limit := httputil.QueryInt(r, "limit", 50)
	if limit > 500 {
		limit = 500
	}
	execs, err := s.repo.GetExecutions(r.Context(), id, limit)
	if err != nil {
		s.Logger().Error(r.Context(), "failed to load executions", err, nil)
		httputil.WriteErrorResponse(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "internal error", nil)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, execs)
}

// handleResumeTrigger re-enqueues a trigger by id (e.g., after restart).
func (s *Service) handleResumeTrigger(w http.ResponseWriter, r *http.Request, userID string) {
	id, idOk := requireTriggerID(w, r)
	if !idOk {
		return
	}
	trigger, err := s.repo.GetTrigger(r.Context(), id, userID)
	if err != nil || trigger == nil {
		httputil.NotFound(w, "trigger not found")
		return
	}
	// Add to scheduler cache for in-memory checks
	s.scheduler.mu.Lock()
	s.scheduler.triggers[trigger.ID] = trigger
	s.scheduler.mu.Unlock()

	httputil.WriteJSON(w, http.StatusOK, StatusResponse{Status: "resumed"})
}
