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
// CRE

func handleCRE(ctx context.Context, client *apiClient, args []string) error {
	if len(args) == 0 {
		fmt.Println(`Usage:
  slctl cre playbooks --account <id>
  slctl cre executors --account <id>
  slctl cre runs --account <id> [--limit 25]`)
		return nil
	}
	resource := args[0]
	switch resource {
	case "playbooks":
		fs := flag.NewFlagSet("cre playbooks", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" {
			return errors.New("account is required")
		}
		url := fmt.Sprintf("/accounts/%s/cre/playbooks", accountID)
		data, err := client.request(ctx, http.MethodGet, url, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "executors":
		fs := flag.NewFlagSet("cre executors", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" {
			return errors.New("account is required")
		}
		url := fmt.Sprintf("/accounts/%s/cre/executors", accountID)
		data, err := client.request(ctx, http.MethodGet, url, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "runs":
		fs := flag.NewFlagSet("cre runs", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID string
		var limit int
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.IntVar(&limit, "limit", 25, "Number of runs to fetch")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" {
			return errors.New("account is required")
		}
		if limit <= 0 {
			limit = 25
		}
		url := fmt.Sprintf("/accounts/%s/cre/runs?limit=%d", accountID, limit)
		data, err := client.request(ctx, http.MethodGet, url, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	default:
		fmt.Println(`Usage:
  slctl cre playbooks --account <id>
  slctl cre executors --account <id>
  slctl cre runs --account <id> [--limit 25]`)
		return fmt.Errorf("unknown cre subcommand %q", resource)
	}
	return nil
}

// ---------------------------------------------------------------------
// CCIP

func handleCCIP(ctx context.Context, client *apiClient, args []string) error {
	if len(args) == 0 {
		fmt.Println(`Usage:
  slctl ccip lanes --account <id>
  slctl ccip messages --account <id> [--limit 50]`)
		return nil
	}
	switch args[0] {
	case "lanes":
		fs := flag.NewFlagSet("ccip lanes", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" {
			return errors.New("account is required")
		}
		url := fmt.Sprintf("/accounts/%s/ccip/lanes", accountID)
		data, err := client.request(ctx, http.MethodGet, url, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "messages":
		fs := flag.NewFlagSet("ccip messages", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID string
		var limit int
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.IntVar(&limit, "limit", 50, "Number of messages to fetch")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" {
			return errors.New("account is required")
		}
		if limit <= 0 {
			limit = 50
		}
		url := fmt.Sprintf("/accounts/%s/ccip/messages?limit=%d", accountID, limit)
		data, err := client.request(ctx, http.MethodGet, url, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	default:
		fmt.Println(`Usage:
  slctl ccip lanes --account <id>
  slctl ccip messages --account <id> [--limit 50]`)
		return fmt.Errorf("unknown ccip subcommand %q", args[0])
	}
	return nil
}

// ---------------------------------------------------------------------
// VRF

func handleVRF(ctx context.Context, client *apiClient, args []string) error {
	if len(args) == 0 {
		fmt.Println(`Usage:
  slctl vrf keys --account <id>
  slctl vrf requests --account <id> [--limit 50]`)
		return nil
	}
	switch args[0] {
	case "keys":
		fs := flag.NewFlagSet("vrf keys", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" {
			return errors.New("account is required")
		}
		url := fmt.Sprintf("/accounts/%s/vrf/keys", accountID)
		data, err := client.request(ctx, http.MethodGet, url, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "requests":
		fs := flag.NewFlagSet("vrf requests", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID string
		var limit int
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.IntVar(&limit, "limit", 50, "Number of requests to fetch")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" {
			return errors.New("account is required")
		}
		if limit <= 0 {
			limit = 50
		}
		url := fmt.Sprintf("/accounts/%s/vrf/requests?limit=%d", accountID, limit)
		data, err := client.request(ctx, http.MethodGet, url, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	default:
		fmt.Println(`Usage:
  slctl vrf keys --account <id>
  slctl vrf requests --account <id> [--limit 50]`)
		return fmt.Errorf("unknown vrf subcommand %q", args[0])
	}
	return nil
}
