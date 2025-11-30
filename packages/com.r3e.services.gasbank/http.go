package gasbank

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// HTTPHandler handles HTTP requests for the gasbank service.
type HTTPHandler struct {
	svc *Service
}

// NewHTTPHandler creates a new HTTP handler for the gasbank service.
func NewHTTPHandler(svc *Service) *HTTPHandler {
	return &HTTPHandler{svc: svc}
}

// Handle handles gasbank requests with path parsing.
func (h *HTTPHandler) Handle(w http.ResponseWriter, r *http.Request, accountID string, rest []string) {
	switch len(rest) {
	case 0:
		h.handleRoot(w, r, accountID)
	default:
		h.handleAction(w, r, accountID, rest)
	}
}

func (h *HTTPHandler) handleRoot(w http.ResponseWriter, r *http.Request, accountID string) {
	switch r.Method {
	case http.MethodGet:
		gasID := r.URL.Query().Get("gas_account_id")
		if strings.TrimSpace(gasID) != "" {
			acct, err := h.resolveGasAccount(r.Context(), accountID, gasID)
			if err != nil {
				writeError(w, http.StatusNotFound, err)
				return
			}
			writeJSON(w, http.StatusOK, acct)
			return
		}
		accts, err := h.svc.ListAccounts(r.Context(), accountID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, http.StatusOK, accts)

	case http.MethodPost:
		var payload struct {
			WalletAddress         string   `json:"wallet_address"`
			MinBalance            *float64 `json:"min_balance"`
			DailyLimit            *float64 `json:"daily_limit"`
			NotificationThreshold *float64 `json:"notification_threshold"`
			RequiredApprovals     *int     `json:"required_approvals"`
		}
		if err := decodeJSON(r.Body, &payload); err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		acct, err := h.svc.EnsureAccountWithOptions(r.Context(), accountID, EnsureAccountOptions{
			WalletAddress:         payload.WalletAddress,
			MinBalance:            payload.MinBalance,
			DailyLimit:            payload.DailyLimit,
			NotificationThreshold: payload.NotificationThreshold,
			RequiredApprovals:     payload.RequiredApprovals,
		})
		if err != nil {
			status := http.StatusBadRequest
			if errors.Is(err, ErrWalletInUse) {
				status = http.StatusConflict
			}
			writeError(w, status, err)
			return
		}
		writeJSON(w, http.StatusOK, acct)

	default:
		methodNotAllowed(w, http.MethodGet, http.MethodPost)
	}
}

func (h *HTTPHandler) handleAction(w http.ResponseWriter, r *http.Request, accountID string, rest []string) {
	action := rest[0]

	switch action {
	case "summary":
		h.handleSummary(w, r, accountID)
	case "approvals":
		h.handleApprovals(w, r, accountID, rest[1:])
	case "deposit":
		h.handleDeposit(w, r, accountID)
	case "withdraw":
		h.handleWithdraw(w, r, accountID)
	case "transactions":
		h.handleTransactions(w, r, accountID)
	case "deposits":
		h.handleDeposits(w, r, accountID)
	case "withdrawals":
		h.handleWithdrawals(w, r, accountID, rest[1:])
	case "deadletters":
		h.handleDeadLetters(w, r, accountID, rest[1:])
	default:
		w.WriteHeader(http.StatusNotFound)
	}
}

func (h *HTTPHandler) handleSummary(w http.ResponseWriter, r *http.Request, accountID string) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, http.MethodGet)
		return
	}
	summary, err := h.svc.Summary(r.Context(), accountID)
	if err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "account_id") {
			status = http.StatusBadRequest
		}
		writeError(w, status, err)
		return
	}
	writeJSON(w, http.StatusOK, summary)
}

func (h *HTTPHandler) handleApprovals(w http.ResponseWriter, r *http.Request, accountID string, rest []string) {
	if len(rest) < 1 {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	txID := rest[0]

	switch r.Method {
	case http.MethodGet:
		approvals, err := h.svc.ListApprovals(r.Context(), txID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, http.StatusOK, approvals)

	case http.MethodPost:
		var payload struct {
			Approver  string `json:"approver"`
			Approve   bool   `json:"approve"`
			Signature string `json:"signature"`
			Note      string `json:"note"`
		}
		if err := decodeJSON(r.Body, &payload); err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		if strings.TrimSpace(payload.Approver) == "" {
			writeError(w, http.StatusBadRequest, fmt.Errorf("approver is required"))
			return
		}
		recorded, tx, err := h.svc.SubmitApproval(r.Context(), txID, payload.Approver, payload.Signature, payload.Note, payload.Approve)
		if err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		writeJSON(w, http.StatusOK, struct {
			Approval    WithdrawalApproval `json:"approval"`
			Transaction Transaction        `json:"transaction"`
		}{
			Approval:    recorded,
			Transaction: tx,
		})

	default:
		methodNotAllowed(w, http.MethodGet, http.MethodPost)
	}
}

func (h *HTTPHandler) handleDeposit(w http.ResponseWriter, r *http.Request, accountID string) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w, http.MethodPost)
		return
	}
	var payload struct {
		GasAccountID string  `json:"gas_account_id"`
		Amount       float64 `json:"amount"`
		TxID         string  `json:"tx_id"`
		FromAddress  string  `json:"from_address"`
		ToAddress    string  `json:"to_address"`
	}
	if err := decodeJSON(r.Body, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if strings.TrimSpace(payload.GasAccountID) == "" {
		writeError(w, http.StatusBadRequest, fmt.Errorf("gas_account_id is required"))
		return
	}
	if payload.Amount <= 0 {
		writeError(w, http.StatusBadRequest, fmt.Errorf("amount must be positive"))
		return
	}
	acct, err := h.resolveGasAccount(r.Context(), accountID, payload.GasAccountID)
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	updated, tx, err := h.svc.Deposit(r.Context(), acct.ID, payload.Amount, payload.TxID, payload.FromAddress, payload.ToAddress)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, struct {
		Account     GasBankAccount `json:"account"`
		Transaction Transaction    `json:"transaction"`
	}{
		Account:     updated,
		Transaction: tx,
	})
}

func (h *HTTPHandler) handleWithdraw(w http.ResponseWriter, r *http.Request, accountID string) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w, http.MethodPost)
		return
	}
	var payload struct {
		GasAccountID string  `json:"gas_account_id"`
		Amount       float64 `json:"amount"`
		ToAddress    string  `json:"to_address"`
		ScheduleAt   string  `json:"schedule_at"`
	}
	if err := decodeJSON(r.Body, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if strings.TrimSpace(payload.GasAccountID) == "" {
		writeError(w, http.StatusBadRequest, fmt.Errorf("gas_account_id is required"))
		return
	}
	if payload.Amount <= 0 {
		writeError(w, http.StatusBadRequest, fmt.Errorf("amount must be positive"))
		return
	}
	acct, err := h.resolveGasAccount(r.Context(), accountID, payload.GasAccountID)
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	var schedulePtr *time.Time
	if strings.TrimSpace(payload.ScheduleAt) != "" {
		t, err := time.Parse(time.RFC3339, payload.ScheduleAt)
		if err != nil {
			writeError(w, http.StatusBadRequest, fmt.Errorf("invalid schedule_at: %w", err))
			return
		}
		schedulePtr = &t
	}
	updated, tx, err := h.svc.WithdrawWithOptions(r.Context(), accountID, acct.ID, WithdrawOptions{
		Amount:     payload.Amount,
		ToAddress:  payload.ToAddress,
		ScheduleAt: schedulePtr,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, struct {
		Account     GasBankAccount `json:"account"`
		Transaction Transaction    `json:"transaction"`
	}{
		Account:     updated,
		Transaction: tx,
	})
}

func (h *HTTPHandler) handleTransactions(w http.ResponseWriter, r *http.Request, accountID string) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, http.MethodGet)
		return
	}
	gasAcct, err := h.resolveGasAccount(r.Context(), accountID, r.URL.Query().Get("gas_account_id"))
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	limit, err := parseLimitParam(r.URL.Query().Get("limit"), 25)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	txType := strings.TrimSpace(r.URL.Query().Get("type"))
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	txs, err := h.svc.ListTransactionsFiltered(r.Context(), gasAcct.ID, txType, status, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, txs)
}

func (h *HTTPHandler) handleDeposits(w http.ResponseWriter, r *http.Request, accountID string) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, http.MethodGet)
		return
	}
	gasAcct, err := h.resolveGasAccount(r.Context(), accountID, r.URL.Query().Get("gas_account_id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	limit, err := parseLimitParam(r.URL.Query().Get("limit"), 25)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	txs, err := h.svc.ListTransactionsFiltered(r.Context(), gasAcct.ID, TransactionDeposit, "", limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, txs)
}

func (h *HTTPHandler) handleWithdrawals(w http.ResponseWriter, r *http.Request, accountID string, rest []string) {
	if len(rest) == 0 {
		if r.Method != http.MethodGet {
			methodNotAllowed(w, http.MethodGet)
			return
		}
		gasAcctID := strings.TrimSpace(r.URL.Query().Get("gas_account_id"))
		if gasAcctID == "" {
			writeError(w, http.StatusBadRequest, fmt.Errorf("gas_account_id is required"))
			return
		}
		gasAcct, err := h.resolveGasAccount(r.Context(), accountID, gasAcctID)
		if err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		limit, err := parseLimitParam(r.URL.Query().Get("limit"), 25)
		if err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		status := strings.TrimSpace(r.URL.Query().Get("status"))
		txs, err := h.svc.ListTransactionsFiltered(r.Context(), gasAcct.ID, TransactionWithdrawal, status, limit)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, http.StatusOK, txs)
		return
	}

	txID := rest[0]

	// Handle /withdrawals/{txID}/attempts
	if len(rest) >= 2 && rest[1] == "attempts" {
		if r.Method != http.MethodGet {
			methodNotAllowed(w, http.MethodGet)
			return
		}
		limit, err := parseLimitParam(r.URL.Query().Get("limit"), 25)
		if err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		attempts, err := h.svc.ListSettlementAttempts(r.Context(), accountID, txID, limit)
		if err != nil {
			status := http.StatusBadRequest
			if strings.Contains(strings.ToLower(err.Error()), "not owned") || strings.Contains(strings.ToLower(err.Error()), "not found") {
				status = http.StatusNotFound
			}
			writeError(w, status, err)
			return
		}
		writeJSON(w, http.StatusOK, attempts)
		return
	}

	// Handle /withdrawals/{txID}
	switch r.Method {
	case http.MethodGet:
		tx, err := h.svc.GetWithdrawal(r.Context(), accountID, txID)
		if err != nil {
			status := http.StatusBadRequest
			if strings.Contains(strings.ToLower(err.Error()), "not owned") || strings.Contains(strings.ToLower(err.Error()), "not a withdrawal") {
				status = http.StatusNotFound
			}
			writeError(w, status, err)
			return
		}
		writeJSON(w, http.StatusOK, tx)

	case http.MethodPatch:
		var payload struct {
			Action string `json:"action"`
			Reason string `json:"reason"`
		}
		if err := decodeJSON(r.Body, &payload); err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		switch strings.ToLower(strings.TrimSpace(payload.Action)) {
		case "cancel":
			tx, err := h.svc.CancelWithdrawal(r.Context(), accountID, txID, strings.TrimSpace(payload.Reason))
			if err != nil {
				writeError(w, http.StatusBadRequest, err)
				return
			}
			writeJSON(w, http.StatusOK, tx)
		default:
			writeError(w, http.StatusBadRequest, fmt.Errorf("unsupported action %q", payload.Action))
		}

	default:
		methodNotAllowed(w, http.MethodGet, http.MethodPatch)
	}
}

func (h *HTTPHandler) handleDeadLetters(w http.ResponseWriter, r *http.Request, accountID string, rest []string) {
	if len(rest) == 0 {
		if r.Method != http.MethodGet {
			methodNotAllowed(w, http.MethodGet)
			return
		}
		limit, err := parseLimitParam(r.URL.Query().Get("limit"), 25)
		if err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		items, err := h.svc.ListDeadLetters(r.Context(), accountID, limit)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, http.StatusOK, items)
		return
	}

	txID := rest[0]

	// Handle /deadletters/{txID}/retry
	if len(rest) >= 2 && rest[1] == "retry" {
		if r.Method != http.MethodPost {
			methodNotAllowed(w, http.MethodPost)
			return
		}
		tx, err := h.svc.RetryDeadLetter(r.Context(), accountID, txID)
		if err != nil {
			status := http.StatusBadRequest
			if strings.Contains(strings.ToLower(err.Error()), "not found") {
				status = http.StatusNotFound
			}
			writeError(w, status, err)
			return
		}
		writeJSON(w, http.StatusOK, tx)
		return
	}

	// Handle DELETE /deadletters/{txID}
	if r.Method != http.MethodDelete {
		methodNotAllowed(w, http.MethodDelete)
		return
	}
	if err := h.svc.DeleteDeadLetter(r.Context(), accountID, txID); err != nil {
		status := http.StatusBadRequest
		if strings.Contains(strings.ToLower(err.Error()), "not found") {
			status = http.StatusNotFound
		}
		writeError(w, status, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *HTTPHandler) resolveGasAccount(ctx context.Context, accountID string, gasAccountID string) (GasBankAccount, error) {
	if strings.TrimSpace(gasAccountID) == "" {
		return GasBankAccount{}, fmt.Errorf("gas_account_id is required")
	}
	acct, err := h.svc.GetAccount(ctx, gasAccountID)
	if err != nil {
		return GasBankAccount{}, err
	}
	if acct.AccountID != accountID {
		return GasBankAccount{}, fmt.Errorf("gas account %s not owned by %s", gasAccountID, accountID)
	}
	return acct, nil
}

// Helper functions

func parseLimitParam(value string, defaultLimit int) (int, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return defaultLimit, nil
	}
	limit, err := strconv.Atoi(value)
	if err != nil || limit <= 0 {
		return 0, fmt.Errorf("limit must be a positive integer")
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
