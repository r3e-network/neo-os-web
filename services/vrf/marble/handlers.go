package neovrf

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/crypto"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
)

func (s *Service) registerRoutes() {
	s.Router().HandleFunc("/random", s.handleRandom).Methods(http.MethodPost)
	s.Router().HandleFunc("/pubkey", s.handlePubKey).Methods(http.MethodGet)
}

func (s *Service) handleRandom(w http.ResponseWriter, r *http.Request) {
	if _, ok := httputil.RequireUserID(w, r); !ok {
		return
	}

	var input RandomRequest
	if !httputil.DecodeJSONOptional(w, r, &input) {
		return
	}

	requestID := strings.TrimSpace(input.RequestID)
	if len(requestID) > 128 {
		httputil.BadRequest(w, "request_id too long")
		return
	}
	if requestID == "" {
		requestID = uuid.New().String()
	}
	if !s.replayGuard.MarkSeen(r.Context(), requestID) {
		httputil.WriteErrorResponse(w, r, http.StatusConflict, "CONFLICT", "request_id already used", nil)
		return
	}

	if s.privateKey == nil {
		s.replayGuard.UnmarkSeen(r.Context(), requestID)
		httputil.ServiceUnavailable(w, "signing key not configured")
		return
	}

	signature, err := crypto.Sign(s.privateKey, []byte(requestID))
	if err != nil {
		s.replayGuard.UnmarkSeen(r.Context(), requestID)
		s.Logger().Error(r.Context(), "failed to sign VRF request", err, nil)
		httputil.WriteErrorResponse(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "internal error", nil)
		return
	}
	if len(signature) == 0 {
		s.replayGuard.UnmarkSeen(r.Context(), requestID)
		s.Logger().Error(r.Context(), "crypto.Sign returned empty signature", nil, nil)
		httputil.WriteErrorResponse(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "internal error", nil)
		return
	}

	randomness := crypto.Hash256(signature)

	resp := RandomResponse{
		RequestID:  requestID,
		Randomness: fmt.Sprintf("%x", randomness),
		Timestamp:  time.Now().Unix(),
	}
	if len(signature) > 0 {
		resp.Signature = fmt.Sprintf("%x", signature)
	}
	if len(s.publicKey) > 0 {
		resp.PublicKey = fmt.Sprintf("%x", s.publicKey)
	}
	if len(s.attestationHash) > 0 {
		resp.AttestationHash = fmt.Sprintf("%x", s.attestationHash)
	}

	httputil.WriteJSON(w, http.StatusOK, resp)
}

func (s *Service) handlePubKey(w http.ResponseWriter, r *http.Request) {
	if len(s.publicKey) == 0 {
		httputil.ServiceUnavailable(w, "public key not available")
		return
	}

	resp := PublicKeyResponse{
		PublicKey: fmt.Sprintf("%x", s.publicKey),
	}
	if len(s.attestationHash) > 0 {
		resp.AttestationHash = fmt.Sprintf("%x", s.attestationHash)
	}

	httputil.WriteJSON(w, http.StatusOK, resp)
}
