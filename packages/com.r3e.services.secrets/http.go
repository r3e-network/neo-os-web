package secrets

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// HTTPHandler handles HTTP requests for the secrets service.
type HTTPHandler struct {
	svc *Service
}

// NewHTTPHandler creates a new HTTP handler for the secrets service.
func NewHTTPHandler(svc *Service) *HTTPHandler {
	return &HTTPHandler{svc: svc}
}

// Handle handles secrets requests with path parsing.
func (h *HTTPHandler) Handle(w http.ResponseWriter, r *http.Request, accountID string, rest []string) {
	if len(rest) == 0 {
		h.handleRoot(w, r, accountID)
		return
	}

	if len(rest) != 1 {
		w.WriteHeader(http.StatusNotFound)
		return
	}

	h.handleSecret(w, r, accountID, rest[0])
}

func (h *HTTPHandler) handleRoot(w http.ResponseWriter, r *http.Request, accountID string) {
	switch r.Method {
	case http.MethodGet:
		items, err := h.svc.List(r.Context(), accountID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, http.StatusOK, items)

	case http.MethodPost:
		var payload struct {
			Name  string `json:"name"`
			Value string `json:"value"`
			ACL   *uint8 `json:"acl,omitempty"`
		}
		if err := decodeJSON(r.Body, &payload); err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		opts := CreateOptions{}
		if payload.ACL != nil {
			acl := ACL(*payload.ACL)
			opts.ACL = acl
		}
		meta, err := h.svc.CreateWithOptions(r.Context(), accountID, payload.Name, payload.Value, opts)
		if err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		writeJSON(w, http.StatusCreated, meta)

	default:
		methodNotAllowed(w, http.MethodGet, http.MethodPost)
	}
}

func (h *HTTPHandler) handleSecret(w http.ResponseWriter, r *http.Request, accountID, name string) {
	switch r.Method {
	case http.MethodGet:
		sec, err := h.svc.Get(r.Context(), accountID, name)
		if err != nil {
			writeError(w, http.StatusNotFound, err)
			return
		}
		writeJSON(w, http.StatusOK, sec)

	case http.MethodPut:
		var payload struct {
			Value *string `json:"value,omitempty"`
			ACL   *uint8  `json:"acl,omitempty"`
		}
		if err := decodeJSON(r.Body, &payload); err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		opts := UpdateOptions{}
		if payload.Value != nil {
			opts.Value = payload.Value
		}
		if payload.ACL != nil {
			acl := ACL(*payload.ACL)
			opts.ACL = &acl
		}
		if opts.Value == nil && opts.ACL == nil {
			writeError(w, http.StatusBadRequest, fmt.Errorf("at least one of 'value' or 'acl' is required"))
			return
		}
		meta, err := h.svc.UpdateWithOptions(r.Context(), accountID, name, opts)
		if err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		writeJSON(w, http.StatusOK, meta)

	case http.MethodDelete:
		if err := h.svc.Delete(r.Context(), accountID, name); err != nil {
			writeError(w, http.StatusNotFound, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)

	default:
		methodNotAllowed(w, http.MethodGet, http.MethodPut, http.MethodDelete)
	}
}

// Helper functions

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
