package main

import (
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/gorilla/mux"

	"github.com/R3E-Network/service_layer/infrastructure/crypto"
	"github.com/R3E-Network/service_layer/infrastructure/database"
	"github.com/R3E-Network/service_layer/infrastructure/httputil"
	"github.com/R3E-Network/service_layer/infrastructure/marble"
	"github.com/R3E-Network/service_layer/infrastructure/runtime"
	"github.com/R3E-Network/service_layer/infrastructure/secrets"
	secretssupabase "github.com/R3E-Network/service_layer/infrastructure/secrets/supabase"
)

func newGatewaySecretsManager(db *database.Repository, m *marble.Marble) *secrets.Manager {
	if db == nil {
		return nil
	}

	var rawKey []byte
	if m != nil {
		if secret, ok := m.Secret(secrets.MasterKeyEnv); ok && len(secret) > 0 {
			rawKey = secret
		}
	}
	if len(rawKey) == 0 {
		rawKey = []byte(strings.TrimSpace(os.Getenv(secrets.MasterKeyEnv)))
	}

	if len(rawKey) == 0 {
		strict := runtime.StrictIdentityMode() || (m != nil && m.IsEnclave())
		if strict {
			log.Fatalf("CRITICAL: %s is required for secrets management in production/SGX mode", secrets.MasterKeyEnv)
		}
		log.Printf("WARNING: %s not set; using ephemeral secrets key (development/testing only)", secrets.MasterKeyEnv)
		generated, err := crypto.GenerateRandomBytes(32)
		if err != nil {
			log.Fatalf("CRITICAL: generate fallback secrets key: %v", err)
		}
		rawKey = generated
	}

	repo := secretssupabase.NewRepository(db)
	manager, err := secrets.NewManager(repo, rawKey)
	if err != nil {
		log.Fatalf("CRITICAL: initialize secrets manager: %v", err)
	}
	return manager
}

func listSecretsHandler(manager *secrets.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if manager == nil {
			httputil.ServiceUnavailable(w, "secrets not configured")
			return
		}

		userID, ok := httputil.RequireUserID(w, r)
		if !ok {
			return
		}

		records, err := manager.ListSecrets(r.Context(), userID)
		if err != nil {
			httputil.InternalError(w, "failed to load secrets")
			return
		}

		httputil.WriteJSON(w, http.StatusOK, records)
	}
}

func upsertSecretHandler(manager *secrets.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if manager == nil {
			httputil.ServiceUnavailable(w, "secrets not configured")
			return
		}

		userID, ok := httputil.RequireUserID(w, r)
		if !ok {
			return
		}

		var input secrets.CreateSecretInput
		if !httputil.DecodeJSON(w, r, &input) {
			return
		}

		audit := &secrets.AuditMeta{
			IPAddress: httputil.ClientIP(r),
			UserAgent: r.UserAgent(),
		}

		record, created, err := manager.UpsertSecret(r.Context(), userID, input, audit)
		if err != nil {
			httputil.BadRequest(w, err.Error())
			return
		}

		status := http.StatusOK
		if created {
			status = http.StatusCreated
		}
		httputil.WriteJSON(w, status, record)
	}
}

func getSecretHandler(manager *secrets.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if manager == nil {
			httputil.ServiceUnavailable(w, "secrets not configured")
			return
		}

		userID, ok := httputil.RequireUserID(w, r)
		if !ok {
			return
		}

		name := mux.Vars(r)["name"]
		if strings.TrimSpace(name) == "" {
			httputil.BadRequest(w, "name required")
			return
		}

		audit := &secrets.AuditMeta{
			IPAddress: httputil.ClientIP(r),
			UserAgent: r.UserAgent(),
		}

		secret, err := manager.GetSecret(r.Context(), userID, name, "", audit)
		if err != nil {
			if err == secrets.ErrNotFound {
				httputil.NotFound(w, "secret not found")
				return
			}
			httputil.InternalError(w, "failed to load secret")
			return
		}

		httputil.WriteJSON(w, http.StatusOK, secret)
	}
}

func deleteSecretHandler(manager *secrets.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if manager == nil {
			httputil.ServiceUnavailable(w, "secrets not configured")
			return
		}

		userID, ok := httputil.RequireUserID(w, r)
		if !ok {
			return
		}

		name := mux.Vars(r)["name"]
		if strings.TrimSpace(name) == "" {
			httputil.BadRequest(w, "name required")
			return
		}

		audit := &secrets.AuditMeta{
			IPAddress: httputil.ClientIP(r),
			UserAgent: r.UserAgent(),
		}

		if err := manager.DeleteSecret(r.Context(), userID, name, audit); err != nil {
			if err == secrets.ErrNotFound {
				httputil.NotFound(w, "secret not found")
				return
			}
			httputil.InternalError(w, "failed to delete secret")
			return
		}

		httputil.WriteJSON(w, http.StatusOK, secrets.DeleteResponse{Deleted: true})
	}
}

func getSecretPermissionsHandler(manager *secrets.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if manager == nil {
			httputil.ServiceUnavailable(w, "secrets not configured")
			return
		}

		userID, ok := httputil.RequireUserID(w, r)
		if !ok {
			return
		}

		name := mux.Vars(r)["name"]
		if strings.TrimSpace(name) == "" {
			httputil.BadRequest(w, "name required")
			return
		}

		allowed, err := manager.GetAllowedServices(r.Context(), userID, name)
		if err != nil {
			httputil.InternalError(w, "failed to load permissions")
			return
		}

		httputil.WriteJSON(w, http.StatusOK, secrets.ServicesResponse{Services: allowed})
	}
}

func setSecretPermissionsHandler(manager *secrets.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if manager == nil {
			httputil.ServiceUnavailable(w, "secrets not configured")
			return
		}

		userID, ok := httputil.RequireUserID(w, r)
		if !ok {
			return
		}

		name := mux.Vars(r)["name"]
		if strings.TrimSpace(name) == "" {
			httputil.BadRequest(w, "name required")
			return
		}

		var body struct {
			Services []string `json:"services"`
		}
		if !httputil.DecodeJSON(w, r, &body) {
			return
		}

		normalized, err := manager.SetAllowedServices(r.Context(), userID, name, body.Services)
		if err != nil {
			httputil.BadRequest(w, err.Error())
			return
		}

		httputil.WriteJSON(w, http.StatusOK, secrets.ServicesResponse{Services: normalized})
	}
}

func auditLogsHandler(manager *secrets.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if manager == nil {
			httputil.ServiceUnavailable(w, "secrets not configured")
			return
		}

		userID, ok := httputil.RequireUserID(w, r)
		if !ok {
			return
		}

		limit := 100
		if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
			if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 1000 {
				limit = parsed
			}
		}

		logs, err := manager.GetAuditLogs(r.Context(), userID, limit)
		if err != nil {
			httputil.InternalError(w, "failed to load audit logs")
			return
		}

		httputil.WriteJSON(w, http.StatusOK, logs)
	}
}

func secretAuditLogsHandler(manager *secrets.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if manager == nil {
			httputil.ServiceUnavailable(w, "secrets not configured")
			return
		}

		userID, ok := httputil.RequireUserID(w, r)
		if !ok {
			return
		}

		name := mux.Vars(r)["name"]
		if strings.TrimSpace(name) == "" {
			httputil.BadRequest(w, "name required")
			return
		}

		limit := 100
		if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
			if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 1000 {
				limit = parsed
			}
		}

		logs, err := manager.GetAuditLogsForSecret(r.Context(), userID, name, limit)
		if err != nil {
			httputil.InternalError(w, "failed to load audit logs")
			return
		}

		httputil.WriteJSON(w, http.StatusOK, logs)
	}
}
