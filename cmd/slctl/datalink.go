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
// DataLink

func handleDataLink(ctx context.Context, client *apiClient, args []string) error {
	if len(args) == 0 {
		fmt.Println(`Usage:
  slctl datalink channels --account <id>
  slctl datalink channel-create --account <id> --name <name> --endpoint <url> [--signers w1,w2] [--status active] [--metadata '{"env":"dev"}']
  slctl datalink deliveries --account <id> [--limit 50]
  slctl datalink deliver --account <id> --channel <id> --payload '{"foo":"bar"}' [--metadata '{"trace":"abc"}']`)
		return nil
	}
	switch args[0] {
	case "channels":
		fs := flag.NewFlagSet("datalink channels", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" {
			return errors.New("account is required")
		}
		url := fmt.Sprintf("/accounts/%s/datalink/channels", accountID)
		data, err := client.request(ctx, http.MethodGet, url, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "channel-create":
		fs := flag.NewFlagSet("datalink channel-create", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, name, endpoint, signerSet, status, metaStr string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&name, "name", "", "Channel name (required)")
		fs.StringVar(&endpoint, "endpoint", "", "Endpoint URL (required)")
		fs.StringVar(&signerSet, "signers", "", "Comma/semicolon separated signer wallets")
		fs.StringVar(&status, "status", "", "Channel status (inactive|active|suspended)")
		fs.StringVar(&metaStr, "metadata", "", "Metadata JSON")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" || name == "" || endpoint == "" {
			return errors.New("account, name, and endpoint are required")
		}
		metadata, err := parseJSONMap(metaStr)
		if err != nil {
			return fmt.Errorf("parse metadata: %w", err)
		}
		payload := map[string]any{
			"name":       name,
			"endpoint":   endpoint,
			"status":     status,
			"signer_set": splitList(signerSet),
			"metadata":   metadata,
		}
		url := fmt.Sprintf("/accounts/%s/datalink/channels", accountID)
		data, err := client.request(ctx, http.MethodPost, url, payload)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "deliveries":
		fs := flag.NewFlagSet("datalink deliveries", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID string
		var limit int
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.IntVar(&limit, "limit", 50, "Number of deliveries to fetch")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" {
			return errors.New("account is required")
		}
		if limit <= 0 {
			limit = 50
		}
		url := fmt.Sprintf("/accounts/%s/datalink/deliveries?limit=%d", accountID, limit)
		data, err := client.request(ctx, http.MethodGet, url, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "deliver":
		fs := flag.NewFlagSet("datalink deliver", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, channelID, payloadStr, metaStr string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&channelID, "channel", "", "Channel ID (required)")
		fs.StringVar(&payloadStr, "payload", "", "JSON payload (required)")
		fs.StringVar(&metaStr, "metadata", "", "JSON metadata map")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" || channelID == "" {
			return errors.New("account and channel are required")
		}
		payload, err := parseJSONMap(payloadStr)
		if err != nil {
			return fmt.Errorf("parse payload: %w", err)
		}
		if payload == nil {
			return errors.New("payload is required")
		}
		metadata, err := parseJSONMap(metaStr)
		if err != nil {
			return fmt.Errorf("parse metadata: %w", err)
		}
		body := map[string]any{
			"payload":  payload,
			"metadata": metadata,
		}
		url := fmt.Sprintf("/accounts/%s/datalink/channels/%s/deliveries", accountID, channelID)
		data, err := client.request(ctx, http.MethodPost, url, body)
		if err != nil {
			return err
		}
		prettyPrint(data)
	default:
		fmt.Println(`Usage:
  slctl datalink channels --account <id>
  slctl datalink channel-create --account <id> --name <name> --endpoint <url> [--signers w1,w2] [--status active] [--metadata '{"env":"dev"}']
  slctl datalink deliveries --account <id> [--limit 50]
  slctl datalink deliver --account <id> --channel <id> --payload '{"foo":"bar"}' [--metadata '{"trace":"abc"}']`)
		return fmt.Errorf("unknown datalink subcommand %q", args[0])
	}
	return nil
}
