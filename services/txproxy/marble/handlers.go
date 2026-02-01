package txproxy

import (
	"net/http"
	"strings"

	"github.com/nspcc-dev/neo-go/pkg/core/transaction"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/httputil"
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

	contractAddress := strings.TrimSpace(req.ContractAddress)
	method := canonicalizeMethodName(req.Method)
	if contractAddress == "" || method == "" {
		httputil.BadRequest(w, "contract_address and method required")
		return
	}

	// Validate allowlist and policy BEFORE marking request as seen
	// This prevents DoS via invalid requests consuming request_ids
	if s.allowlist == nil || !s.allowlist.Allows(contractAddress, method) {
		httputil.WriteError(w, http.StatusForbidden, "contract/method not allowed")
		return
	}

	if status, msg := s.checkIntentPolicy(contractAddress, method, req.Intent, req.Params); status != 0 {
		httputil.WriteError(w, status, msg)
		return
	}

	if s.chainClient == nil || s.signer == nil {
		httputil.WriteError(w, http.StatusServiceUnavailable, "chain signing is not configured")
		return
	}

	// Mark request as seen only after all validations pass
	if !s.markSeen(reqID) {
		httputil.WriteError(w, http.StatusConflict, "request_id already used")
		return
	}

	txRes, err := s.chainClient.InvokeFunctionWithSignerAndWait(
		r.Context(),
		normalizeContractAddress(contractAddress),
		method,
		req.Params,
		s.signer,
		transaction.CalledByEntry,
		req.Wait,
	)
	if err != nil {
		// SECURITY: Do not leak internal error details to client
		s.Logger().WithContext(r.Context()).WithError(err).Error("chain invocation failed")
		httputil.InternalError(w, "chain invocation failed")
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
