package txproxy

import (
	"net/http"
	"strings"

	"github.com/nspcc-dev/neo-go/pkg/core/transaction"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
)

func (s *Service) handleInvoke(w http.ResponseWriter, r *http.Request) {
	var req InvokeRequest
	if !httputil.DecodeJSON(w, r, &req) {
		return
	}

	reqID := strings.TrimSpace(req.RequestID)
	if reqID == "" {
		httputil.BadRequest(w, "request_id required")
		return
	}

	contractHash := strings.TrimSpace(req.ContractHash)
	method := canonicalizeMethodName(req.Method)
	if contractHash == "" || method == "" {
		httputil.BadRequest(w, "contract_hash and method required")
		return
	}

	// Validate allowlist and policy BEFORE marking request as seen
	// This prevents DoS via invalid requests consuming request_ids
	if s.allowlist == nil || !s.allowlist.Allows(contractHash, method) {
		httputil.WriteErrorResponse(w, r, http.StatusForbidden, "FORBIDDEN", "contract/method not allowed", nil)
		return
	}

	if status, msg := s.checkIntentPolicy(contractHash, method, req.Intent, req.Params); status != 0 {
		httputil.WriteErrorResponse(w, r, status, statusToCode(status), msg, nil)
		return
	}

	if s.chainClient == nil || s.signer == nil {
		httputil.WriteErrorResponse(w, r, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "chain signing is not configured", nil)
		return
	}

	// Mark request as seen only after all validations pass
	if !s.replayGuard.MarkSeen(r.Context(), reqID) {
		httputil.WriteErrorResponse(w, r, http.StatusConflict, "CONFLICT", "request_id already used", nil)
		return
	}

	txRes, err := s.chainClient.InvokeFunctionWithSignerAndWait(
		r.Context(),
		normalizeContractHash(contractHash),
		method,
		req.Params,
		s.signer,
		transaction.CalledByEntry,
		req.Wait,
	)
	if err != nil {
		s.Logger().Error(r.Context(), "failed to invoke contract", err, nil)
		httputil.WriteErrorResponse(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "internal error", nil)
		return
	}

	resp := InvokeResponse{
		RequestID: reqID,
	}
	if txRes != nil {
		resp.TxHash = txRes.TxHash
		resp.VMState = txRes.VMState
		if txRes.AppLog != nil && len(txRes.AppLog.Executions) > 0 {
			resp.Exception = txRes.AppLog.Executions[0].Exception
		}
	}

	httputil.WriteJSON(w, http.StatusOK, resp)
}

func statusToCode(status int) string {
	switch status {
	case http.StatusBadRequest:
		return "BAD_REQUEST"
	case http.StatusUnauthorized:
		return "UNAUTHORIZED"
	case http.StatusForbidden:
		return "FORBIDDEN"
	case http.StatusNotFound:
		return "NOT_FOUND"
	case http.StatusConflict:
		return "CONFLICT"
	case http.StatusTooManyRequests:
		return "RATE_LIMITED"
	default:
		return "INTERNAL_ERROR"
	}
}
