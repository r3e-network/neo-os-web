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
// DataStreams

func handleDataStreams(ctx context.Context, client *apiClient, args []string) error {
	if len(args) == 0 {
		fmt.Println(`Usage:
  slctl datastreams streams --account <id>
  slctl datastreams create --account <id> --name <name> --symbol <symbol> [--description <desc>] [--frequency "1s"] [--sla-ms 50] [--status active] [--metadata '{"env":"dev"}']
  slctl datastreams frames --account <id> --stream <id> [--limit 20]
  slctl datastreams publish --account <id> --stream <id> --sequence <n> [--payload '{"price":123}'] [--latency-ms 10] [--status delivered] [--metadata '{"trace":"abc"}']`)
		return nil
	}
	switch args[0] {
	case "streams":
		fs := flag.NewFlagSet("datastreams streams", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" {
			return errors.New("account is required")
		}
		url := fmt.Sprintf("/accounts/%s/datastreams", accountID)
		data, err := client.request(ctx, http.MethodGet, url, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "create":
		fs := flag.NewFlagSet("datastreams create", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, name, symbol, description, frequency, status, metaStr string
		var slaMs int
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&name, "name", "", "Stream name (required)")
		fs.StringVar(&symbol, "symbol", "", "Symbol/identifier (required)")
		fs.StringVar(&description, "description", "", "Description")
		fs.StringVar(&frequency, "frequency", "", "Update frequency (e.g. 1s)")
		fs.IntVar(&slaMs, "sla-ms", 0, "SLA in milliseconds")
		fs.StringVar(&status, "status", "", "Stream status (active|inactive|suspended)")
		fs.StringVar(&metaStr, "metadata", "", "Metadata JSON")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" || name == "" || symbol == "" {
			return errors.New("account, name, and symbol are required")
		}
		metadata, err := parseJSONMap(metaStr)
		if err != nil {
			return fmt.Errorf("parse metadata: %w", err)
		}
		payload := map[string]any{
			"name":        name,
			"symbol":      symbol,
			"description": description,
			"frequency":   frequency,
			"sla_ms":      slaMs,
			"status":      status,
			"metadata":    metadata,
		}
		url := fmt.Sprintf("/accounts/%s/datastreams", accountID)
		data, err := client.request(ctx, http.MethodPost, url, payload)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "frames":
		fs := flag.NewFlagSet("datastreams frames", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, streamID string
		var limit int
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&streamID, "stream", "", "Stream ID (required)")
		fs.IntVar(&limit, "limit", 20, "Number of frames to fetch")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" || streamID == "" {
			return errors.New("account and stream are required")
		}
		if limit <= 0 {
			limit = 20
		}
		url := fmt.Sprintf("/accounts/%s/datastreams/%s/frames?limit=%d", accountID, streamID, limit)
		data, err := client.request(ctx, http.MethodGet, url, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "publish":
		fs := flag.NewFlagSet("datastreams publish", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, streamID, status, payloadStr, metaStr string
		var sequence, latency int
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&streamID, "stream", "", "Stream ID (required)")
		fs.IntVar(&sequence, "sequence", 0, "Sequence number (required)")
		fs.IntVar(&latency, "latency-ms", 0, "Latency in milliseconds")
		fs.StringVar(&status, "status", "", "Frame status")
		fs.StringVar(&payloadStr, "payload", "", "JSON payload")
		fs.StringVar(&metaStr, "metadata", "", "JSON metadata")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" || streamID == "" || sequence <= 0 {
			return errors.New("account, stream, and positive sequence are required")
		}
		payload, err := parseJSONMap(payloadStr)
		if err != nil {
			return fmt.Errorf("parse payload: %w", err)
		}
		metadata, err := parseJSONMap(metaStr)
		if err != nil {
			return fmt.Errorf("parse metadata: %w", err)
		}
		body := map[string]any{
			"sequence":   sequence,
			"payload":    payload,
			"latency_ms": latency,
			"status":     status,
			"metadata":   metadata,
		}
		url := fmt.Sprintf("/accounts/%s/datastreams/%s/frames", accountID, streamID)
		data, err := client.request(ctx, http.MethodPost, url, body)
		if err != nil {
			return err
		}
		prettyPrint(data)
	default:
		fmt.Println(`Usage:
  slctl datastreams streams --account <id>
  slctl datastreams create --account <id> --name <name> --symbol <symbol> [--description <desc>] [--frequency "1s"] [--sla-ms 50] [--status active] [--metadata '{"env":"dev"}']
  slctl datastreams frames --account <id> --stream <id> [--limit 20]
  slctl datastreams publish --account <id> --stream <id> --sequence <n> [--payload '{"price":123}'] [--latency-ms 10] [--status delivered] [--metadata '{"trace":"abc"}']`)
		return fmt.Errorf("unknown datastreams subcommand %q", args[0])
	}
	return nil
}
