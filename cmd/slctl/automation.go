package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
)

func handleAutomation(ctx context.Context, client *apiClient, args []string) error {
	if len(args) == 0 {
		fmt.Println(`Usage:
  slctl automation jobs list --account <id>
  slctl automation jobs create --account <id> --function <id> --name <name> --schedule <cron> [--description text]
  slctl automation jobs get --account <id> --job <id>
  slctl automation jobs set-enabled --account <id> --job <id> --enabled <true|false>`)
		return nil
	}
	if args[0] != "jobs" {
		return fmt.Errorf("unknown automation subcommand %q", args[0])
	}
	if len(args) < 2 {
		return fmt.Errorf("automation jobs requires a subcommand")
	}
	switch args[1] {
	case "list":
		fs := flag.NewFlagSet("automation jobs list", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		if err := fs.Parse(args[2:]); err != nil {
			return err
		}
		if accountID == "" {
			return errors.New("account is required")
		}
		data, err := client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/automation/jobs", nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "create":
		fs := flag.NewFlagSet("automation jobs create", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, functionID, name, schedule, description string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&functionID, "function", "", "Function ID (required)")
		fs.StringVar(&name, "name", "", "Job name (required)")
		fs.StringVar(&schedule, "schedule", "", "Cron schedule (required)")
		fs.StringVar(&description, "description", "", "Description")
		if err := fs.Parse(args[2:]); err != nil {
			return err
		}
		if accountID == "" || functionID == "" || name == "" || schedule == "" {
			return errors.New("account, function, name, and schedule are required")
		}
		payload := map[string]any{
			"function_id": functionID,
			"name":        name,
			"schedule":    schedule,
			"description": description,
		}
		data, err := client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/automation/jobs", payload)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "get":
		fs := flag.NewFlagSet("automation jobs get", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, jobID string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&jobID, "job", "", "Job ID (required)")
		if err := fs.Parse(args[2:]); err != nil {
			return err
		}
		if accountID == "" || jobID == "" {
			return errors.New("account and job are required")
		}
		data, err := client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/automation/jobs/"+jobID, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "set-enabled":
		fs := flag.NewFlagSet("automation jobs set-enabled", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, jobID string
		var enabled bool
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&jobID, "job", "", "Job ID (required)")
		fs.BoolVar(&enabled, "enabled", false, "Enable or disable the job")
		if err := fs.Parse(args[2:]); err != nil {
			return err
		}
		if accountID == "" || jobID == "" {
			return errors.New("account and job are required")
		}
		payload := map[string]any{"enabled": enabled}
		data, err := client.request(ctx, http.MethodPatch, "/accounts/"+accountID+"/automation/jobs/"+jobID, payload)
		if err != nil {
			return err
		}
		prettyPrint(data)
	default:
		return fmt.Errorf("unknown automation jobs subcommand %q", args[1])
	}
	return nil
}
