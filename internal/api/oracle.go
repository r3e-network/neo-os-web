package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/willtech-services/service_layer/internal/core/oracle"
	"github.com/willtech-services/service_layer/internal/models"
	"github.com/willtech-services/service_layer/pkg/logger"
)

// OracleHandler handles Oracle API requests
type OracleHandler struct {
	logger        *logger.Logger
	oracleService *oracle.Service
}

// NewOracleHandler creates a new oracle handler
func NewOracleHandler(logger *logger.Logger, oracleService *oracle.Service) *OracleHandler {
	return &OracleHandler{
		logger:        logger,
		oracleService: oracleService,
	}
}

// RegisterRoutes registers the oracle routes
func (h *OracleHandler) RegisterRoutes(router *mux.Router) {
	// Admin API routes
	adminRouter := router.PathPrefix("/api/v1/oracles").Subrouter()
	adminRouter.Use(AuthMiddleware)

	adminRouter.HandleFunc("", h.ListOracles).Methods("GET")
	adminRouter.HandleFunc("", h.CreateOracle).Methods("POST")
	adminRouter.HandleFunc("/{id:[0-9]+}", h.GetOracle).Methods("GET")
	adminRouter.HandleFunc("/{id:[0-9]+}", h.UpdateOracle).Methods("PUT")
	adminRouter.HandleFunc("/{id:[0-9]+}", h.DeleteOracle).Methods("DELETE")
	adminRouter.HandleFunc("/{id:[0-9]+}/requests", h.ListOracleRequests).Methods("GET")
	adminRouter.HandleFunc("/requests/{id:[0-9]+}", h.GetOracleRequest).Methods("GET")
	adminRouter.HandleFunc("/statistics", h.GetOracleStatistics).Methods("GET")

	// Public API routes
	publicRouter := router.PathPrefix("/api/v1/public/oracles").Subrouter()
	publicRouter.Use(APIKeyMiddleware)

	publicRouter.HandleFunc("/request", h.CreateOracleRequest).Methods("POST")
	publicRouter.HandleFunc("/request/{id:[0-9]+}", h.CheckRequestStatus).Methods("GET")
	publicRouter.HandleFunc("/data/{id:[0-9]+}", h.GetHistoricalData).Methods("GET")
}

// ListOracles returns a list of oracles
func (h *OracleHandler) ListOracles(w http.ResponseWriter, r *http.Request) {
	userID := GetUserIDFromContext(r.Context())

	// Get pagination parameters
	offset, limit := GetPaginationParams(r)

	oracles, err := h.oracleService.ListOracles(r.Context(), userID, offset, limit)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Failed to list oracles: "+err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, oracles)
}

// GetOracle returns a specific oracle
func (h *OracleHandler) GetOracle(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, "Invalid oracle ID")
		return
	}

	oracle, err := h.oracleService.GetOracle(r.Context(), id)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Failed to get oracle: "+err.Error())
		return
	}

	if oracle == nil {
		RespondWithError(w, http.StatusNotFound, "Oracle not found")
		return
	}

	RespondWithJSON(w, http.StatusOK, oracle)
}

// CreateOracle creates a new oracle
func (h *OracleHandler) CreateOracle(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Name        string                     `json:"name"`
		Description string                     `json:"description"`
		SourceType  models.OracleDataSourceType `json:"source_type"`
		URL         string                     `json:"url"`
		Method      string                     `json:"method"`
		Headers     map[string]interface{}     `json:"headers"`
		Body        string                     `json:"body"`
		AuthType    models.OracleAuthType      `json:"auth_type"`
		AuthParams  map[string]interface{}     `json:"auth_params"`
		Path        string                     `json:"path"`
		Transform   string                     `json:"transform"`
		Schedule    string                     `json:"schedule"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		RespondWithError(w, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	userID := GetUserIDFromContext(r.Context())

	oracle, err := h.oracleService.CreateOracle(
		r.Context(),
		request.Name,
		request.Description,
		request.SourceType,
		request.URL,
		request.Method,
		request.Headers,
		request.Body,
		request.AuthType,
		request.AuthParams,
		request.Path,
		request.Transform,
		request.Schedule,
		userID,
	)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Failed to create oracle: "+err.Error())
		return
	}

	RespondWithJSON(w, http.StatusCreated, oracle)
}

// UpdateOracle updates an existing oracle
func (h *OracleHandler) UpdateOracle(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, "Invalid oracle ID")
		return
	}

	var request struct {
		Name        string                     `json:"name"`
		Description string                     `json:"description"`
		SourceType  models.OracleDataSourceType `json:"source_type"`
		URL         string                     `json:"url"`
		Method      string                     `json:"method"`
		Headers     map[string]interface{}     `json:"headers"`
		Body        string                     `json:"body"`
		AuthType    models.OracleAuthType      `json:"auth_type"`
		AuthParams  map[string]interface{}     `json:"auth_params"`
		Path        string                     `json:"path"`
		Transform   string                     `json:"transform"`
		Schedule    string                     `json:"schedule"`
		Active      bool                       `json:"active"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		RespondWithError(w, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	userID := GetUserIDFromContext(r.Context())

	oracle, err := h.oracleService.UpdateOracle(
		r.Context(),
		id,
		request.Name,
		request.Description,
		request.SourceType,
		request.URL,
		request.Method,
		request.Headers,
		request.Body,
		request.AuthType,
		request.AuthParams,
		request.Path,
		request.Transform,
		request.Schedule,
		request.Active,
		userID,
	)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Failed to update oracle: "+err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, oracle)
}

// DeleteOracle deletes an oracle
func (h *OracleHandler) DeleteOracle(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, "Invalid oracle ID")
		return
	}

	userID := GetUserIDFromContext(r.Context())

	if err := h.oracleService.DeleteOracle(r.Context(), id, userID); err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Failed to delete oracle: "+err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, map[string]string{"message": "Oracle deleted successfully"})
}

// CreateOracleRequest creates a new oracle data request
func (h *OracleHandler) CreateOracleRequest(w http.ResponseWriter, r *http.Request) {
	var request struct {
		OracleID        int                    `json:"oracle_id"`
		Params          map[string]interface{} `json:"params"`
		CallbackAddress string                 `json:"callback_address"`
		CallbackMethod  string                 `json:"callback_method"`
		GasFee          float64                `json:"gas_fee"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		RespondWithError(w, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	userID := GetUserIDFromContext(r.Context())
	if userID == 0 {
		userID = GetAPIKeyUserIDFromContext(r.Context())
	}

	oracleRequest, err := h.oracleService.CreateOracleRequest(
		r.Context(),
		request.OracleID,
		userID,
		request.Params,
		request.CallbackAddress,
		request.CallbackMethod,
		request.GasFee,
	)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Failed to create oracle request: "+err.Error())
		return
	}

	RespondWithJSON(w, http.StatusCreated, oracleRequest)
}

// GetOracleRequest returns a specific oracle request
func (h *OracleHandler) GetOracleRequest(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, "Invalid request ID")
		return
	}

	request, err := h.oracleService.GetOracleRequest(r.Context(), id)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Failed to get oracle request: "+err.Error())
		return
	}

	if request == nil {
		RespondWithError(w, http.StatusNotFound, "Oracle request not found")
		return
	}

	RespondWithJSON(w, http.StatusOK, request)
}

// ListOracleRequests returns a list of oracle requests for a specific oracle
func (h *OracleHandler) ListOracleRequests(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, "Invalid oracle ID")
		return
	}

	// Get pagination parameters
	offset, limit := GetPaginationParams(r)

	requests, err := h.oracleService.ListOracleRequests(r.Context(), id, offset, limit)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Failed to list oracle requests: "+err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, requests)
}

// CheckRequestStatus checks the status of an oracle request
func (h *OracleHandler) CheckRequestStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, "Invalid request ID")
		return
	}

	request, err := h.oracleService.GetOracleRequest(r.Context(), id)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Failed to get oracle request: "+err.Error())
		return
	}

	if request == nil {
		RespondWithError(w, http.StatusNotFound, "Oracle request not found")
		return
	}

	RespondWithJSON(w, http.StatusOK, request)
}

// GetHistoricalData returns historical oracle data
func (h *OracleHandler) GetHistoricalData(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, "Invalid data ID")
		return
	}

	// For now, we just return the oracle request data
	// In a more advanced implementation, we might have a separate historical data store
	request, err := h.oracleService.GetOracleRequest(r.Context(), id)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Failed to get historical data: "+err.Error())
		return
	}

	if request == nil {
		RespondWithError(w, http.StatusNotFound, "Historical data not found")
		return
	}

	RespondWithJSON(w, http.StatusOK, map[string]interface{}{
		"id":        request.ID,
		"timestamp": request.CreatedAt,
		"data":      request.Result,
	})
}

// GetOracleStatistics returns statistics about the oracle service
func (h *OracleHandler) GetOracleStatistics(w http.ResponseWriter, r *http.Request) {
	stats, err := h.oracleService.GetOracleStatistics(r.Context())
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Failed to get oracle statistics: "+err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, stats)
} 