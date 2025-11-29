package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
)

// ---------------------------------------------------------------------
// Confidential Compute

func handleConfCompute(ctx context.Context, client *apiClient, args []string) error {
	if len(args) == 0 {
		fmt.Println(`Usage:
  slctl confcompute enclaves --account <id> [--limit 50]`)
		return nil
	}
	if args[0] != "enclaves" {
		fmt.Println(`Usage:
  slctl confcompute enclaves --account <id> [--limit 50]`)
		return fmt.Errorf("unknown confcompute subcommand %q", args[0])
	}
	fs := flag.NewFlagSet("confcompute enclaves", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var accountID string
	var limit int
	fs.StringVar(&accountID, "account", "", "Account ID (required)")
	fs.IntVar(&limit, "limit", 50, "Number of enclaves to fetch")
	if err := fs.Parse(args[1:]); err != nil {
		return err
	}
	if accountID == "" {
		return errors.New("account is required")
	}
	if limit <= 0 {
		limit = 50
	}
	url := fmt.Sprintf("/accounts/%s/confcompute/enclaves?limit=%d", accountID, limit)
	data, err := client.request(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	prettyPrint(data)
	return nil
}
