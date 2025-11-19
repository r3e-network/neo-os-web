package httpapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/R3E-Network/service_layer/internal/app/domain/gasbank"
	gasbanksvc "github.com/R3E-Network/service_layer/internal/app/services/gasbank"
)

func (h *handler) accountGasBank(w http.ResponseWriter, r *http.Request, accountID string, rest []string) {
	if h.app.GasBank == nil {
		writeError(w, http.StatusNotImplemented, fmt.Errorf("gas bank service not configured"))
		return
	}

	switch len(rest) {
	case 0:
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

			accts, err := h.app.GasBank.ListAccounts(r.Context(), accountID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, err)
				return
			}
			writeJSON(w, http.StatusOK, accts)
		case http.MethodPost:
			var payload struct {
				WalletAddress string `json:"wallet_address"`
			}
			if err := decodeJSON(r.Body, &payload); err != nil {
				writeError(w, http.StatusBadRequest, err)
				return
			}
			acct, err := h.app.GasBank.EnsureAccount(r.Context(), accountID, payload.WalletAddress)
			if err != nil {
				status := http.StatusBadRequest
				if errors.Is(err, gasbanksvc.ErrWalletInUse) {
					status = http.StatusConflict
				}
				writeError(w, status, err)
				return
			}
			writeJSON(w, http.StatusOK, acct)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	default:
		action := rest[0]
		switch action {
		case "deposit":
			if r.Method != http.MethodPost {
				w.WriteHeader(http.StatusMethodNotAllowed)
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
			updated, tx, err := h.app.GasBank.Deposit(r.Context(), acct.ID, payload.Amount, payload.TxID, payload.FromAddress, payload.ToAddress)
			if err != nil {
				writeError(w, http.StatusBadRequest, err)
				return
			}
			writeJSON(w, http.StatusOK, struct {
				Account     gasbank.Account     `json:"account"`
				Transaction gasbank.Transaction `json:"transaction"`
			}{
				Account:     updated,
				Transaction: tx,
			})
		case "withdraw":
			if r.Method != http.MethodPost {
				w.WriteHeader(http.StatusMethodNotAllowed)
				return
			}
			var payload struct {
				GasAccountID string  `json:"gas_account_id"`
				Amount       float64 `json:"amount"`
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
			updated, tx, err := h.app.GasBank.Withdraw(r.Context(), accountID, acct.ID, payload.Amount, payload.ToAddress)
			if err != nil {
				writeError(w, http.StatusBadRequest, err)
				return
			}
			writeJSON(w, http.StatusOK, struct {
				Account     gasbank.Account     `json:"account"`
				Transaction gasbank.Transaction `json:"transaction"`
			}{
				Account:     updated,
				Transaction: tx,
			})
		case "transactions":
			if r.Method != http.MethodGet {
				w.WriteHeader(http.StatusMethodNotAllowed)
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
			txs, err := h.app.GasBank.ListTransactions(r.Context(), gasAcct.ID, limit)
			if err != nil {
				writeError(w, http.StatusInternalServerError, err)
				return
			}
			writeJSON(w, http.StatusOK, txs)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}
}

func (h *handler) resolveGasAccount(ctx context.Context, accountID string, gasAccountID string) (gasbank.Account, error) {
	if strings.TrimSpace(gasAccountID) == "" {
		return gasbank.Account{}, fmt.Errorf("gas_account_id is required")
	}

	acct, err := h.app.GasBank.GetAccount(ctx, gasAccountID)
	if err != nil {
		return gasbank.Account{}, err
	}
	if acct.AccountID != accountID {
		return gasbank.Account{}, fmt.Errorf("gas account %s not owned by %s", gasAccountID, accountID)
	}
	return acct, nil
}
