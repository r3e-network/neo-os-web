package neogasbank

import (
	"net/http"

	"github.com/R3E-Network/service_layer/infrastructure/httputil"
)

// =============================================================================
// HTTP Handlers
// =============================================================================

// handleGetAccount returns the gas bank account for the authenticated user.
func (s *Service) handleGetAccount(w http.ResponseWriter, r *http.Request) {
	userID, ok := httputil.RequireUserID(w, r)
	if !ok {
		return
	}

	account, err := s.GetAccount(r.Context(), userID)
	if err != nil {
		s.Logger().WithContext(r.Context()).WithError(err).Error("failed to get account")
		httputil.InternalError(w, "failed to get account")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, account)
}

// handleDeductFee deducts a service fee from a user's balance.
// This endpoint is only accessible via service-to-service mTLS.
func (s *Service) handleDeductFee(w http.ResponseWriter, r *http.Request) {
	var req DeductFeeRequest
	if !httputil.DecodeJSON(w, r, &req) {
		return
	}

	// Get service ID from mTLS certificate or header
	serviceID := httputil.GetServiceID(r)
	if serviceID == "" {
		httputil.WriteError(w, http.StatusForbidden, "service authentication required")
		return
	}
	req.ServiceID = serviceID

	resp, err := s.DeductFee(r.Context(), &req)
	if err != nil {
		s.Logger().WithContext(r.Context()).WithError(err).Error("failed to deduct fee")
		httputil.InternalError(w, "failed to deduct fee")
		return
	}

	if !resp.Success {
		httputil.WriteJSON(w, http.StatusPaymentRequired, resp)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, resp)
}

// handleReserveFunds reserves funds for a pending operation.
func (s *Service) handleReserveFunds(w http.ResponseWriter, r *http.Request) {
	var req ReserveFundsRequest
	if !httputil.DecodeJSON(w, r, &req) {
		return
	}

	serviceID := httputil.GetServiceID(r)
	if serviceID == "" {
		httputil.WriteError(w, http.StatusForbidden, "service authentication required")
		return
	}

	resp, err := s.ReserveFunds(r.Context(), &req)
	if err != nil {
		s.Logger().WithContext(r.Context()).WithError(err).Error("failed to reserve funds")
		httputil.InternalError(w, "failed to reserve funds")
		return
	}

	if !resp.Success {
		httputil.WriteJSON(w, http.StatusPaymentRequired, resp)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, resp)
}

// handleReleaseFunds releases or commits reserved funds.
func (s *Service) handleReleaseFunds(w http.ResponseWriter, r *http.Request) {
	var req ReleaseFundsRequest
	if !httputil.DecodeJSON(w, r, &req) {
		return
	}

	serviceID := httputil.GetServiceID(r)
	if serviceID == "" {
		httputil.WriteError(w, http.StatusForbidden, "service authentication required")
		return
	}

	resp, err := s.ReleaseFunds(r.Context(), &req)
	if err != nil {
		s.Logger().WithContext(r.Context()).WithError(err).Error("failed to release funds")
		httputil.InternalError(w, "failed to release funds")
		return
	}

	if !resp.Success {
		httputil.WriteJSON(w, http.StatusBadRequest, resp)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, resp)
}

// handleGetTransactions returns transaction history for the authenticated user.
func (s *Service) handleGetTransactions(w http.ResponseWriter, r *http.Request) {
	userID, ok := httputil.RequireUserID(w, r)
	if !ok {
		return
	}

	account, err := s.db.GetGasBankAccount(r.Context(), userID)
	if err != nil {
		s.Logger().WithContext(r.Context()).WithError(err).Error("failed to get account for transactions")
		httputil.InternalError(w, "failed to get account")
		return
	}

	limit := 50 // Default limit
	txs, err := s.db.GetGasBankTransactions(r.Context(), account.ID, limit)
	if err != nil {
		s.Logger().WithContext(r.Context()).WithError(err).Error("failed to get transactions")
		httputil.InternalError(w, "failed to get transactions")
		return
	}

	// Convert to response format
	result := make([]TransactionInfo, 0, len(txs))
	for _, tx := range txs {
		result = append(result, TransactionInfo{
			ID:           tx.ID,
			TxType:       TransactionType(tx.TxType),
			Amount:       tx.Amount,
			BalanceAfter: tx.BalanceAfter,
			ReferenceID:  tx.ReferenceID,
			CreatedAt:    tx.CreatedAt,
		})
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]any{"transactions": result})
}

// handleGetDeposits returns deposit history for the authenticated user.
func (s *Service) handleGetDeposits(w http.ResponseWriter, r *http.Request) {
	userID, ok := httputil.RequireUserID(w, r)
	if !ok {
		return
	}

	limit := 50 // Default limit
	deposits, err := s.db.GetDepositRequests(r.Context(), userID, limit)
	if err != nil {
		s.Logger().WithContext(r.Context()).WithError(err).Error("failed to get deposits")
		httputil.InternalError(w, "failed to get deposits")
		return
	}

	// Convert to response format
	result := make([]DepositInfo, 0, len(deposits))
	for _, d := range deposits {
		info := DepositInfo{
			ID:            d.ID,
			Amount:        d.Amount,
			TxHash:        d.TxHash,
			FromAddress:   d.FromAddress,
			Status:        DepositStatus(d.Status),
			Confirmations: d.Confirmations,
			CreatedAt:     d.CreatedAt,
		}
		if !d.ConfirmedAt.IsZero() {
			info.ConfirmedAt = &d.ConfirmedAt
		}
		result = append(result, info)
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]any{"deposits": result})
}
