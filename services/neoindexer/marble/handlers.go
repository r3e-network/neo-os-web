package neoindexer

import (
	"net/http"
	"strconv"

	"github.com/R3E-Network/service_layer/internal/httputil"
)

// =============================================================================
// HTTP Handlers
// =============================================================================

// RegisterRoutes registers HTTP routes for the NeoIndexer service.
func (s *Service) RegisterRoutes() {
	// NeoIndexer-specific routes
	s.Router().HandleFunc("/status", s.handleStatus).Methods("GET")
	s.Router().HandleFunc("/replay", s.handleReplay).Methods("POST")
	s.Router().HandleFunc("/rpc/health", s.handleRPCHealth).Methods("GET")
}

// handleStatus returns the current indexer status.
func (s *Service) handleStatus(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	status := IndexerStatusResponse{
		Service:            ServiceName,
		Version:            Version,
		ChainID:            s.config.ChainID,
		LastProcessedBlock: s.progress.LastProcessedBlock,
		LastBlockHash:      s.progress.LastBlockHash,
		BlocksProcessed:    s.blocksProcessed,
		EventsPublished:    s.eventsPublished,
		ConfirmationDepth:  s.config.ConfirmationDepth,
		PollInterval:       s.config.PollInterval.String(),
	}
	s.mu.RUnlock()

	httputil.WriteJSON(w, http.StatusOK, status)
}

// handleReplay triggers a replay from a specific block.
func (s *Service) handleReplay(w http.ResponseWriter, r *http.Request) {
	// Parse start block from query parameter
	startBlockStr := r.URL.Query().Get("start_block")
	if startBlockStr == "" {
		httputil.WriteError(w, http.StatusBadRequest, "start_block parameter required")
		return
	}

	startBlock, err := strconv.ParseInt(startBlockStr, 10, 64)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid start_block parameter")
		return
	}

	// Update progress to trigger replay
	s.mu.Lock()
	s.progress.LastProcessedBlock = startBlock - 1
	s.mu.Unlock()

	httputil.WriteJSON(w, http.StatusOK, ReplayResponse{
		Status:     "replay_initiated",
		StartBlock: startBlock,
	})
}

// handleRPCHealth returns the health status of RPC endpoints.
func (s *Service) handleRPCHealth(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	endpoints := make([]RPCEndpointStatus, len(s.rpcEndpoints))
	for i, ep := range s.rpcEndpoints {
		endpoints[i] = RPCEndpointStatus{
			URL:       ep.URL,
			Priority:  ep.Priority,
			Healthy:   ep.Healthy,
			LatencyMS: ep.Latency,
			Active:    i == s.currentRPC,
		}
	}
	currentRPC := s.currentRPC
	s.mu.RUnlock()

	httputil.WriteJSON(w, http.StatusOK, RPCHealthResponse{
		Endpoints:  endpoints,
		CurrentRPC: currentRPC,
	})
}
