package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
)

func handleFunctions(ctx context.Context, client *apiClient, args []string) error {
	if len(args) == 0 {
		fmt.Println(`Usage:
  slctl functions list --account <id>
  slctl functions create --account <id> --name <name> --source <file> [--description <text>] [--secret name,...]
  slctl functions execute --account <id> --function <id> [--payload JSON] [--payload-file path]
  slctl functions executions --account <id> --function <id> [--limit N]`)
		return nil
	}

	switch args[0] {
	case "list":
		fs := flag.NewFlagSet("functions list", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" {
			return errors.New("account is required")
		}
		data, err := client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/functions", nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "create":
		fs := flag.NewFlagSet("functions create", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, name, sourcePath, description, secretsStr string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&name, "name", "", "Function name (required)")
		fs.StringVar(&sourcePath, "source", "", "Path to function source file (required)")
		fs.StringVar(&description, "description", "", "Optional description text")
		fs.StringVar(&secretsStr, "secrets", "", "Comma separated secret names")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" || name == "" || sourcePath == "" {
			return errors.New("account, name, and source are required")
		}
		sourceBytes, err := os.ReadFile(sourcePath)
		if err != nil {
			return fmt.Errorf("read source file: %w", err)
		}
		var secrets []string
		if secretsStr != "" {
			secrets = splitCommaList(secretsStr)
		}
		payload := map[string]any{
			"name":        name,
			"source":      string(sourceBytes),
			"secrets":     secrets,
			"description": description,
		}
		data, err := client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/functions", payload)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "execute":
		fs := flag.NewFlagSet("functions execute", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, functionID, payloadRaw, payloadFile string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&functionID, "function", "", "Function ID (required)")
		fs.StringVar(&payloadRaw, "payload", "", "Inline JSON payload")
		fs.StringVar(&payloadFile, "payload-file", "", "Path to JSON payload file")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" || functionID == "" {
			return errors.New("account and function are required")
		}
		payload, err := loadJSONPayload(payloadRaw, payloadFile)
		if err != nil {
			return err
		}
		data, err := client.request(ctx, http.MethodPost, fmt.Sprintf("/accounts/%s/functions/%s/execute", accountID, functionID), payload)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "executions":
		fs := flag.NewFlagSet("functions executions", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, functionID string
		var limit int
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&functionID, "function", "", "Function ID (required)")
		fs.IntVar(&limit, "limit", 0, "Limit results (optional)")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" || functionID == "" {
			return errors.New("account and function are required")
		}
		path := fmt.Sprintf("/accounts/%s/functions/%s/executions", accountID, functionID)
		if limit > 0 {
			path += fmt.Sprintf("?limit=%d", limit)
		}
		data, err := client.request(ctx, http.MethodGet, path, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	default:
		return fmt.Errorf("unknown functions subcommand %q", args[0])
	}
	return nil
}
