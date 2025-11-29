package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// ---------------------------------------------------------------------
// Gas Bank

func handleGasBank(ctx context.Context, client *apiClient, args []string) error {
	if len(args) == 0 {
		fmt.Println(`Usage:
  slctl gasbank summary --account <id>
  slctl gasbank ensure --account <id> [--wallet address]
  slctl gasbank list --account <id>
  slctl gasbank deposit --account <id> --gas-account <id> --amount <float> [--tx-id id] [--from addr] [--to addr]
  slctl gasbank withdraw --account <id> --gas-account <id> --amount <float> [--to addr]
  slctl gasbank transactions --account <id> --gas-account <id> [--status <status>] [--type <type>] [--limit N]
  slctl gasbank deposits list --account <id> --gas-account <id> [--limit N]
  slctl gasbank withdrawals list --account <id> --gas-account <id> [--status <status>] [--limit N]
  slctl gasbank approvals list --account <id> --transaction <id>
  slctl gasbank approvals submit --account <id> --transaction <id> --approver <id> [--approve] [--note text]
  slctl gasbank settlement deadletters list|retry|delete ...`)
		return nil
	}
	switch args[0] {
	case "summary":
		fs := flag.NewFlagSet("gasbank summary", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" {
			return errors.New("account is required")
		}
		data, err := client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/gasbank/summary", nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
		return nil
	case "ensure":
		fs := flag.NewFlagSet("gasbank ensure", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, wallet string
		var minBalance, dailyLimit, notificationThreshold floatFlag
		var requiredApprovals intFlag
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&wallet, "wallet", "", "Wallet address")
		fs.Var(&minBalance, "min-balance", "Minimum balance threshold")
		fs.Var(&dailyLimit, "daily-limit", "Daily withdrawal limit")
		fs.Var(&notificationThreshold, "notification-threshold", "Notification threshold for balances")
		fs.Var(&requiredApprovals, "required-approvals", "Required approvals for withdrawals")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" {
			return errors.New("account is required")
		}
		payload := map[string]any{"wallet_address": wallet}
		if minBalance.set {
			payload["min_balance"] = minBalance.value
		}
		if dailyLimit.set {
			payload["daily_limit"] = dailyLimit.value
		}
		if notificationThreshold.set {
			payload["notification_threshold"] = notificationThreshold.value
		}
		if requiredApprovals.set {
			payload["required_approvals"] = requiredApprovals.value
		}
		data, err := client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/gasbank", payload)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "list":
		fs := flag.NewFlagSet("gasbank list", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" {
			return errors.New("account is required")
		}
		data, err := client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/gasbank", nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "deposit":
		fs := flag.NewFlagSet("gasbank deposit", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, gasAccountID, txID, from, to string
		var amount float64
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&gasAccountID, "gas-account", "", "Gas account ID (required)")
		fs.Float64Var(&amount, "amount", 0, "Amount to deposit (required)")
		fs.StringVar(&txID, "tx-id", "", "Blockchain transaction ID")
		fs.StringVar(&from, "from", "", "From address")
		fs.StringVar(&to, "to", "", "To address")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" || gasAccountID == "" || amount <= 0 {
			return errors.New("account, gas-account, and positive amount are required")
		}
		payload := map[string]any{
			"gas_account_id": gasAccountID,
			"amount":         amount,
			"tx_id":          txID,
			"from_address":   from,
			"to_address":     to,
		}
		data, err := client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/gasbank/deposit", payload)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "withdraw":
		fs := flag.NewFlagSet("gasbank withdraw", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, gasAccountID, to, scheduleAt string
		var amount float64
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&gasAccountID, "gas-account", "", "Gas account ID (required)")
		fs.Float64Var(&amount, "amount", 0, "Amount to withdraw (required)")
		fs.StringVar(&to, "to", "", "Destination address")
		fs.StringVar(&scheduleAt, "schedule-at", "", "Schedule time (RFC3339)")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" || gasAccountID == "" || amount <= 0 {
			return errors.New("account, gas-account, and positive amount are required")
		}
		payload := map[string]any{
			"gas_account_id": gasAccountID,
			"amount":         amount,
			"to_address":     to,
		}
		if strings.TrimSpace(scheduleAt) != "" {
			payload["schedule_at"] = scheduleAt
		}
		data, err := client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/gasbank/withdraw", payload)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "transactions":
		fs := flag.NewFlagSet("gasbank transactions", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, gasAccountID, status, txType string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&gasAccountID, "gas-account", "", "Gas account ID (required)")
		fs.StringVar(&status, "status", "", "Filter by transaction status")
		fs.StringVar(&txType, "type", "", "Filter by transaction type")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" || gasAccountID == "" {
			return errors.New("account and gas-account are required")
		}
		path := fmt.Sprintf("/accounts/%s/gasbank/transactions?gas_account_id=%s", accountID, gasAccountID)
		if strings.TrimSpace(status) != "" {
			path += "&status=" + url.QueryEscape(status)
		}
		if strings.TrimSpace(txType) != "" {
			path += "&type=" + url.QueryEscape(txType)
		}
		data, err := client.request(ctx, http.MethodGet, path, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "deposits":
		if len(args) < 2 {
			return fmt.Errorf("gasbank deposits requires a subcommand")
		}
		return handleGasBankDeposits(ctx, client, args[1:])
	case "withdrawals":
		if len(args) < 2 {
			return fmt.Errorf("gasbank withdrawals requires a subcommand")
		}
		return handleGasBankWithdrawals(ctx, client, args[1:])
	case "settlement":
		if len(args) < 2 {
			return fmt.Errorf("gasbank settlement requires a subcommand")
		}
		return handleGasBankSettlement(ctx, client, args[1:])
	case "approvals":
		if len(args) < 2 {
			return fmt.Errorf("gasbank approvals requires a subcommand")
		}
		return handleGasBankApprovals(ctx, client, args[1:])
	default:
		return fmt.Errorf("unknown gasbank subcommand %q", args[0])
	}
	return nil
}

func handleGasBankApprovals(ctx context.Context, client *apiClient, args []string) error {
	switch args[0] {
	case "list":
		fs := flag.NewFlagSet("gasbank approvals list", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, transactionID string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&transactionID, "transaction", "", "Transaction ID (required)")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" || transactionID == "" {
			return errors.New("account and transaction are required")
		}
		path := fmt.Sprintf("/accounts/%s/gasbank/approvals/%s", accountID, transactionID)
		data, err := client.request(ctx, http.MethodGet, path, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "submit":
		fs := flag.NewFlagSet("gasbank approvals submit", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, transactionID, approver, note, signature string
		approve := fs.Bool("approve", false, "Approve (default false = reject)")
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&transactionID, "transaction", "", "Transaction ID (required)")
		fs.StringVar(&approver, "approver", "", "Approver identifier (required)")
		fs.StringVar(&note, "note", "", "Optional note")
		fs.StringVar(&signature, "signature", "", "Optional signature")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" || transactionID == "" || approver == "" {
			return errors.New("account, transaction, and approver are required")
		}
		payload := map[string]any{
			"approver":  approver,
			"approve":   *approve,
			"note":      note,
			"signature": signature,
		}
		path := fmt.Sprintf("/accounts/%s/gasbank/approvals/%s", accountID, transactionID)
		data, err := client.request(ctx, http.MethodPost, path, payload)
		if err != nil {
			return err
		}
		prettyPrint(data)
	default:
		return fmt.Errorf("unknown gasbank approvals subcommand %q", args[0])
	}
	return nil
}

func handleGasBankDeposits(ctx context.Context, client *apiClient, args []string) error {
	switch args[0] {
	case "list":
		fs := flag.NewFlagSet("gasbank deposits list", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, gasAccountID string
		var limit int
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&gasAccountID, "gas-account", "", "Gas account ID (required)")
		fs.IntVar(&limit, "limit", 25, "Maximum deposits to return")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" || gasAccountID == "" {
			return errors.New("account and gas-account are required")
		}
		path := fmt.Sprintf("/accounts/%s/gasbank/deposits?gas_account_id=%s&limit=%d", accountID, gasAccountID, limit)
		data, err := client.request(ctx, http.MethodGet, path, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	default:
		return fmt.Errorf("unknown gasbank deposits subcommand %q", args[0])
	}
	return nil
}

func handleGasBankWithdrawals(ctx context.Context, client *apiClient, args []string) error {
	switch args[0] {
	case "list":
		fs := flag.NewFlagSet("gasbank withdrawals list", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, gasAccountID, status string
		var limit int
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&gasAccountID, "gas-account", "", "Gas account ID (required)")
		fs.StringVar(&status, "status", "", "Filter by withdrawal status")
		fs.IntVar(&limit, "limit", 25, "Maximum withdrawals to return")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" || gasAccountID == "" {
			return errors.New("account and gas-account are required")
		}
		path := fmt.Sprintf("/accounts/%s/gasbank/withdrawals?gas_account_id=%s&limit=%d", accountID, gasAccountID, limit)
		if strings.TrimSpace(status) != "" {
			path += "&status=" + url.QueryEscape(status)
		}
		data, err := client.request(ctx, http.MethodGet, path, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "get":
		fs := flag.NewFlagSet("gasbank withdrawals get", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, transactionID string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&transactionID, "transaction", "", "Transaction ID (required)")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" || transactionID == "" {
			return errors.New("account and transaction are required")
		}
		path := fmt.Sprintf("/accounts/%s/gasbank/withdrawals/%s", accountID, transactionID)
		data, err := client.request(ctx, http.MethodGet, path, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "cancel":
		fs := flag.NewFlagSet("gasbank withdrawals cancel", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, transactionID, reason string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&transactionID, "transaction", "", "Transaction ID (required)")
		fs.StringVar(&reason, "reason", "", "Cancellation reason")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" || transactionID == "" {
			return errors.New("account and transaction are required")
		}
		path := fmt.Sprintf("/accounts/%s/gasbank/withdrawals/%s", accountID, transactionID)
		payload := map[string]any{"action": "cancel", "reason": reason}
		data, err := client.request(ctx, http.MethodPatch, path, payload)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "attempts":
		fs := flag.NewFlagSet("gasbank withdrawals attempts", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, transactionID string
		var limit int
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&transactionID, "transaction", "", "Transaction ID (required)")
		fs.IntVar(&limit, "limit", 25, "Maximum attempts to return")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" || transactionID == "" {
			return errors.New("account and transaction are required")
		}
		path := fmt.Sprintf("/accounts/%s/gasbank/withdrawals/%s/attempts?limit=%d", accountID, transactionID, limit)
		data, err := client.request(ctx, http.MethodGet, path, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	default:
		return fmt.Errorf("unknown gasbank withdrawals subcommand %q", args[0])
	}
	return nil
}

func handleGasBankSettlement(ctx context.Context, client *apiClient, args []string) error {
	switch args[0] {
	case "deadletters":
		if len(args) < 2 {
			return fmt.Errorf("gasbank settlement deadletters requires a subcommand")
		}
		return handleGasBankDeadLetters(ctx, client, args[1:])
	default:
		return fmt.Errorf("unknown gasbank settlement subcommand %q", args[0])
	}
}

func handleGasBankDeadLetters(ctx context.Context, client *apiClient, args []string) error {
	switch args[0] {
	case "list":
		fs := flag.NewFlagSet("gasbank settlement deadletters list", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID string
		var limit int
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.IntVar(&limit, "limit", 25, "Maximum dead letters to return")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" {
			return errors.New("account is required")
		}
		path := fmt.Sprintf("/accounts/%s/gasbank/deadletters?limit=%d", accountID, limit)
		data, err := client.request(ctx, http.MethodGet, path, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "retry":
		fs := flag.NewFlagSet("gasbank settlement deadletters retry", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, transactionID string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&transactionID, "transaction", "", "Transaction ID (required)")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" || transactionID == "" {
			return errors.New("account and transaction are required")
		}
		path := fmt.Sprintf("/accounts/%s/gasbank/deadletters/%s/retry", accountID, transactionID)
		data, err := client.request(ctx, http.MethodPost, path, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "delete":
		fs := flag.NewFlagSet("gasbank settlement deadletters delete", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, transactionID string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&transactionID, "transaction", "", "Transaction ID (required)")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" || transactionID == "" {
			return errors.New("account and transaction are required")
		}
		path := fmt.Sprintf("/accounts/%s/gasbank/deadletters/%s", accountID, transactionID)
		if _, err := client.request(ctx, http.MethodDelete, path, nil); err != nil {
			return err
		}
		fmt.Println("Dead letter deleted.")
	default:
		return fmt.Errorf("unknown gasbank settlement deadletters subcommand %q", args[0])
	}
	return nil
}
