package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
)

func handleSecrets(ctx context.Context, client *apiClient, args []string) error {
	if len(args) == 0 {
		fmt.Println(`Usage:
  slctl secrets list --account <id>
  slctl secrets create --account <id> --name <name> --value <value>
  slctl secrets get --account <id> --name <name>
  slctl secrets delete --account <id> --name <name>`)
		return nil
	}
	sub := args[0]
	fs := flag.NewFlagSet("secrets "+sub, flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var accountID, name, value string
	fs.StringVar(&accountID, "account", "", "Account ID (required)")
	fs.StringVar(&name, "name", "", "Secret name")
	fs.StringVar(&value, "value", "", "Secret value (create only)")
	if err := fs.Parse(args[1:]); err != nil {
		return err
	}
	if accountID == "" {
		return errors.New("account is required")
	}
	switch sub {
	case "list":
		data, err := client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/secrets", nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "create":
		if name == "" || value == "" {
			return errors.New("name and value are required")
		}
		payload := map[string]any{"name": name, "value": value}
		data, err := client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/secrets", payload)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "get":
		if name == "" {
			return errors.New("name is required")
		}
		data, err := client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/secrets/"+name, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "delete":
		if name == "" {
			return errors.New("name is required")
		}
		_, err := client.request(ctx, http.MethodDelete, "/accounts/"+accountID+"/secrets/"+name, nil)
		return err
	default:
		return fmt.Errorf("unknown secrets subcommand %q", sub)
	}
	return nil
}
