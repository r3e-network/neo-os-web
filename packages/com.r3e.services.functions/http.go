package functions

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
)

// HTTPHandler handles HTTP requests for the functions service.
type HTTPHandler struct {
	svc *Service
}

// NewHTTPHandler creates a new HTTP handler for the functions service.
func NewHTTPHandler(svc *Service) *HTTPHandler {
	return &HTTPHandler{svc: svc}
}

// Handle handles functions requests with path parsing.
func (h *HTTPHandler) Handle(w http.ResponseWriter, r *http.Request, accountID string, rest []string) {
	if len(rest) == 0 {
		h.handleRoot(w, r, accountID)
		return
	}

	switch rest[0] {
	case "executions":
		h.handleExecutionLookup(w, r, accountID, rest[1:])
	default:
		functionID := rest[0]
		if len(rest) < 2 {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		switch rest[1] {
		case "execute":
			h.handleExecute(w, r, accountID, functionID)
		case "executions":
			h.handleFunctionExecutions(w, r, accountID, functionID, rest[2:])
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}
}

func (h *HTTPHandler) handleRoot(w http.ResponseWriter, r *http.Request, accountID string) {
	switch r.Method {
	case http.MethodPost:
		var payload struct {
			Name        string   `json:"name"`
			Description string   `json:"description"`
			Source      string   `json:"source"`
			Secrets     []string `json:"secrets"`
		}
		if err := decodeJSON(r.Body, &payload); err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}

		def := Definition{
			AccountID:   accountID,
			Name:        payload.Name,
			Description: payload.Description,
			Source:      payload.Source,
			Secrets:     payload.Secrets,
		}
		created, err := h.svc.Create(r.Context(), def)
		if err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		writeJSON(w, http.StatusCreated, created)

	case http.MethodGet:
		funcs, err := h.svc.List(r.Context(), accountID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, http.StatusOK, funcs)

	default:
		methodNotAllowed(w, http.MethodPost, http.MethodGet)
	}
}

func (h *HTTPHandler) handleExecute(w http.ResponseWriter, r *http.Request, accountID, functionID string) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w, http.MethodPost)
		return
	}
	def, err := h.svc.Get(r.Context(), functionID)
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	if def.AccountID != accountID {
		w.WriteHeader(http.StatusForbidden)
		return
	}
	var payload map[string]any
	if err := decodeJSON(r.Body, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	result, err := h.svc.Execute(r.Context(), functionID, payload)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *HTTPHandler) handleFunctionExecutions(w http.ResponseWriter, r *http.Request, accountID, functionID string, rest []string) {
	def, err := h.svc.Get(r.Context(), functionID)
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	if def.AccountID != accountID {
		w.WriteHeader(http.StatusForbidden)
		return
	}

	switch len(rest) {
	case 0:
		if r.Method != http.MethodGet {
			methodNotAllowed(w, http.MethodGet)
			return
		}
		limit, err := parseLimitParam(r.URL.Query().Get("limit"), 25)
		if err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		execs, err := h.svc.ListExecutions(r.Context(), functionID, limit)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, http.StatusOK, execs)
	case 1:
		if r.Method != http.MethodGet {
			methodNotAllowed(w, http.MethodGet)
			return
		}
		exec, err := h.svc.GetExecution(r.Context(), rest[0])
		if err != nil {
			writeError(w, http.StatusNotFound, err)
			return
		}
		if exec.AccountID != accountID {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		writeJSON(w, http.StatusOK, exec)
	default:
		w.WriteHeader(http.StatusNotFound)
	}
}

func (h *HTTPHandler) handleExecutionLookup(w http.ResponseWriter, r *http.Request, accountID string, rest []string) {
	if len(rest) != 1 {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	if r.Method != http.MethodGet {
		methodNotAllowed(w, http.MethodGet)
		return
	}
	exec, err := h.svc.GetExecution(r.Context(), rest[0])
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	if exec.AccountID != accountID {
		w.WriteHeader(http.StatusForbidden)
		return
	}
	writeJSON(w, http.StatusOK, exec)
}

// Helper functions

func parseLimitParam(value string, defaultLimit int) (int, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return defaultLimit, nil
	}
	limit, err := strconv.Atoi(value)
	if err != nil || limit <= 0 {
		return defaultLimit, nil
	}
	if limit > 1000 {
		limit = 1000
	}
	return limit, nil
}

func decodeJSON(body io.ReadCloser, dst interface{}) error {
	defer body.Close()
	dec := json.NewDecoder(body)
	dec.DisallowUnknownFields()
	return dec.Decode(dst)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, err error) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
}

func methodNotAllowed(w http.ResponseWriter, allowed ...string) {
	w.Header().Set("Allow", strings.Join(allowed, ", "))
	w.WriteHeader(http.StatusMethodNotAllowed)
}
