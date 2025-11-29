package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
)

func handleAccounts(ctx context.Context, client *apiClient, args []string) error {
	if len(args) == 0 {
		fmt.Println(`Usage:
  slctl accounts list
  slctl accounts create --owner <owner> [--metadata key=value,...]
  slctl accounts get <account-id>
  slctl accounts delete <account-id>`)
		return nil
	}

	switch args[0] {
	case "list":
		data, err := client.request(ctx, http.MethodGet, "/accounts", nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "create":
		fs := flag.NewFlagSet("accounts create", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var owner string
		var metadataStr string
		fs.StringVar(&owner, "owner", "", "Account owner (required)")
		fs.StringVar(&metadataStr, "metadata", "", "Comma separated metadata key=value pairs")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if owner == "" {
			return errors.New("owner is required")
		}
		metadata, err := parseKeyValue(metadataStr)
		if err != nil {
			return fmt.Errorf("metadata: %w", err)
		}
		payload := map[string]any{
			"owner": owner,
		}
		if len(metadata) > 0 {
			payload["metadata"] = metadata
		}
		data, err := client.request(ctx, http.MethodPost, "/accounts", payload)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "get":
		if len(args) < 2 {
			return errors.New("account id required")
		}
		data, err := client.request(ctx, http.MethodGet, "/accounts/"+args[1], nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "delete":
		if len(args) < 2 {
			return errors.New("account id required")
		}
		_, err := client.request(ctx, http.MethodDelete, "/accounts/"+args[1], nil)
		return err
	default:
		return fmt.Errorf("unknown accounts subcommand %q", args[0])
	}
	return nil
}

// ---------------------------------------------------------------------
// Functions

func handleWorkspaceWallets(ctx context.Context, client *apiClient, args []string) error {
	if len(args) == 0 {
		fmt.Println(`Usage:
  slctl workspace-wallets list --account <id> [--limit 50]`)
		return nil
	}
	if args[0] != "list" {
		fmt.Println(`Usage:
  slctl workspace-wallets list --account <id> [--limit 50]`)
		return fmt.Errorf("unknown workspace-wallets subcommand %q", args[0])
	}
	fs := flag.NewFlagSet("workspace-wallets list", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var accountID string
	var limit int
	fs.StringVar(&accountID, "account", "", "Account ID (required)")
	fs.IntVar(&limit, "limit", 50, "Number of wallets to fetch")
	if err := fs.Parse(args[1:]); err != nil {
		return err
	}
	if accountID == "" {
		return errors.New("account is required")
	}
	if limit <= 0 {
		limit = 50
	}
	url := fmt.Sprintf("/accounts/%s/workspace-wallets?limit=%d", accountID, limit)
	data, err := client.request(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	prettyPrint(data)
	return nil
}
