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
// DTA

func handleDTA(ctx context.Context, client *apiClient, args []string) error {
	if len(args) == 0 {
		fmt.Println(`Usage:
  slctl dta products --account <id>
  slctl dta orders --account <id> [--limit 50]`)
		return nil
	}
	switch args[0] {
	case "products":
		fs := flag.NewFlagSet("dta products", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" {
			return errors.New("account is required")
		}
		url := fmt.Sprintf("/accounts/%s/dta/products", accountID)
		data, err := client.request(ctx, http.MethodGet, url, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "orders":
		fs := flag.NewFlagSet("dta orders", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID string
		var limit int
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.IntVar(&limit, "limit", 50, "Number of orders to fetch")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" {
			return errors.New("account is required")
		}
		if limit <= 0 {
			limit = 50
		}
		url := fmt.Sprintf("/accounts/%s/dta/orders?limit=%d", accountID, limit)
		data, err := client.request(ctx, http.MethodGet, url, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	default:
		fmt.Println(`Usage:
  slctl dta products --account <id>
  slctl dta orders --account <id> [--limit 50]`)
		return fmt.Errorf("unknown dta subcommand %q", args[0])
	}
	return nil
}
