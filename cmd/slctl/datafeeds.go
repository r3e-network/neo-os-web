package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

// ---------------------------------------------------------------------
// Data Feeds

func handleDataFeeds(ctx context.Context, client *apiClient, args []string) error {
	if len(args) == 0 {
		fmt.Println(`Usage:
  slctl datafeeds list --account <id>
  slctl datafeeds create --account <id> --pair <PAIR> --decimals <n> [--description <text>] [--heartbeat-seconds 60] [--threshold-ppm 0] [--signer-set addr1,addr2] [--aggregation median] [--metadata '{"env":"dev"}'] [--tags "tag1,tag2"]
  slctl datafeeds updates --account <id> --feed <id> [--limit 25]
  slctl datafeeds latest --account <id> --feed <id>
  slctl datafeeds submit --account <id> --feed <id> --round <n> --price <value> [--signer <addr>] [--signature <sig>] [--timestamp RFC3339] [--metadata '{"note":"abc"}']`)
		return nil
	}

	switch args[0] {
	case "list":
		fs := flag.NewFlagSet("datafeeds list", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" {
			return errors.New("account is required")
		}
		data, err := client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/datafeeds", nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "create":
		fs := flag.NewFlagSet("datafeeds create", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, pair, description, signerSet, aggregation, metaStr, tagsStr string
		var decimals, thresholdPPM int
		var heartbeatSec int64
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&pair, "pair", "", "Trading pair (e.g. ETH/USD) (required)")
		fs.StringVar(&description, "description", "", "Feed description")
		fs.IntVar(&decimals, "decimals", 0, "Number of decimals (required)")
		fs.Int64Var(&heartbeatSec, "heartbeat-seconds", 0, "Heartbeat in seconds (default 60 if unset)")
		fs.IntVar(&thresholdPPM, "threshold-ppm", 0, "Deviation threshold in ppm (0 to disable)")
		fs.StringVar(&signerSet, "signer-set", "", "Comma/semicolon separated signer addresses")
		fs.StringVar(&aggregation, "aggregation", "", "Aggregation strategy (median|mean|min|max)")
		fs.StringVar(&metaStr, "metadata", "", "Metadata JSON")
		fs.StringVar(&tagsStr, "tags", "", "Comma/semicolon separated tags")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" || pair == "" || decimals <= 0 {
			return errors.New("account, pair, and decimals are required")
		}
		if aggregation != "" {
			if normalized, err := normalizeAggregationFlag(aggregation); err != nil {
				return err
			} else {
				aggregation = normalized
			}
		}
		metadata, err := parseJSONMap(metaStr)
		if err != nil {
			return fmt.Errorf("parse metadata: %w", err)
		}
		payload := map[string]any{
			"pair":              pair,
			"description":       description,
			"decimals":          decimals,
			"heartbeat_seconds": heartbeatSec,
			"threshold_ppm":     thresholdPPM,
			"signer_set":        splitList(signerSet),
			"aggregation":       aggregation,
			"metadata":          metadata,
			"tags":              splitList(tagsStr),
		}
		data, err := client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/datafeeds", payload)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "updates":
		fs := flag.NewFlagSet("datafeeds updates", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, feedID string
		var limit int
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&feedID, "feed", "", "Feed ID (required)")
		fs.IntVar(&limit, "limit", 25, "Limit updates returned")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" || feedID == "" {
			return errors.New("account and feed are required")
		}
		path := fmt.Sprintf("/accounts/%s/datafeeds/%s/updates", accountID, feedID)
		params := url.Values{}
		if limit > 0 {
			params.Set("limit", strconv.Itoa(limit))
		}
		if len(params) > 0 {
			path += "?" + params.Encode()
		}
		data, err := client.request(ctx, http.MethodGet, path, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "latest":
		fs := flag.NewFlagSet("datafeeds latest", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, feedID string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&feedID, "feed", "", "Feed ID (required)")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" || feedID == "" {
			return errors.New("account and feed are required")
		}
		data, err := client.request(ctx, http.MethodGet, fmt.Sprintf("/accounts/%s/datafeeds/%s/latest", accountID, feedID), nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "submit":
		fs := flag.NewFlagSet("datafeeds submit", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, feedID, price, signer, signature, tsRaw, metaStr string
		var roundID int64
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&feedID, "feed", "", "Feed ID (required)")
		fs.Int64Var(&roundID, "round", 0, "Round ID (required)")
		fs.StringVar(&price, "price", "", "Price value (required)")
		fs.StringVar(&signer, "signer", "", "Signer address")
		fs.StringVar(&signature, "signature", "", "Signature payload")
		fs.StringVar(&tsRaw, "timestamp", "", "RFC3339 timestamp (defaults to now)")
		fs.StringVar(&metaStr, "metadata", "", "Metadata JSON")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" || feedID == "" || roundID == 0 || price == "" {
			return errors.New("account, feed, round, and price are required")
		}
		ts, err := parseTimestamp(tsRaw)
		if err != nil {
			return fmt.Errorf("parse timestamp: %w", err)
		}
		metadata, err := parseJSONMap(metaStr)
		if err != nil {
			return fmt.Errorf("parse metadata: %w", err)
		}
		payload := map[string]any{
			"round_id":  roundID,
			"price":     price,
			"timestamp": ts,
			"signer":    signer,
			"signature": signature,
			"metadata":  metadata,
		}
		data, err := client.request(ctx, http.MethodPost, fmt.Sprintf("/accounts/%s/datafeeds/%s/updates", accountID, feedID), payload)
		if err != nil {
			return err
		}
		prettyPrint(data)
	default:
		return fmt.Errorf("unknown datafeeds subcommand %q", args[0])
	}
	return nil
}

// ---------------------------------------------------------------------
// Price Feeds

func handlePriceFeeds(ctx context.Context, client *apiClient, args []string) error {
	if len(args) == 0 {
		fmt.Println(`Usage:
  slctl pricefeeds list --account <id>
  slctl pricefeeds create --account <id> --base <asset> --quote <asset> [--interval "@every 1m"] [--heartbeat "@every 10m"] --deviation <float>
  slctl pricefeeds get --account <id> --feed <id>
  slctl pricefeeds snapshots --account <id> --feed <id>`)
		return nil
	}
	sub := args[0]
	fs := flag.NewFlagSet("pricefeeds "+sub, flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var accountID, feedID, base, quote, interval, heartbeat string
	var deviation float64
	fs.StringVar(&accountID, "account", "", "Account ID (required)")
	fs.StringVar(&feedID, "feed", "", "Feed ID")
	fs.StringVar(&base, "base", "", "Base asset")
	fs.StringVar(&quote, "quote", "", "Quote asset")
	fs.StringVar(&interval, "interval", "", "Update interval")
	fs.StringVar(&heartbeat, "heartbeat", "", "Heartbeat interval")
	fs.Float64Var(&deviation, "deviation", 0, "Deviation percent")
	if err := fs.Parse(args[1:]); err != nil {
		return err
	}
	if accountID == "" {
		return errors.New("account is required")
	}
	switch sub {
	case "list":
		data, err := client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/pricefeeds", nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "create":
		if base == "" || quote == "" || deviation <= 0 {
			return errors.New("base, quote, and positive deviation are required")
		}
		payload := map[string]any{
			"base_asset":         base,
			"quote_asset":        quote,
			"update_interval":    interval,
			"heartbeat_interval": heartbeat,
			"deviation_percent":  deviation,
		}
		data, err := client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/pricefeeds", payload)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "get":
		if feedID == "" {
			return errors.New("feed is required")
		}
		data, err := client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/pricefeeds/"+feedID, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "snapshots":
		if feedID == "" {
			return errors.New("feed is required")
		}
		data, err := client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/pricefeeds/"+feedID+"/snapshots", nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	default:
		return fmt.Errorf("unknown pricefeeds subcommand %q", sub)
	}
	return nil
}

// ---------------------------------------------------------------------
// Randomness

func handleRandom(ctx context.Context, client *apiClient, args []string) error {
	if len(args) == 0 {
		fmt.Println(`Usage:
  slctl random list --account <id> [--limit 10]
  slctl random generate --account <id> [--length 32] [--request-id <id>]`)
		return nil
	}
	sub := args[0]
	switch sub {
	case "generate":
		fs := flag.NewFlagSet("random generate", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID, requestID string
		var length int
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.IntVar(&length, "length", 32, "Number of random bytes (1-1024)")
		fs.StringVar(&requestID, "request-id", "", "Optional request identifier")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" {
			return errors.New("account is required")
		}
		if length <= 0 {
			length = 32
		}
		payload := map[string]any{
			"length": length,
		}
		if strings.TrimSpace(requestID) != "" {
			payload["request_id"] = requestID
		}
		data, err := client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/random", payload)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "list":
		fs := flag.NewFlagSet("random list", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var accountID string
		var limit int
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.IntVar(&limit, "limit", 10, "Number of results to show")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" {
			return errors.New("account is required")
		}
		if limit <= 0 {
			limit = 10
		}
		path := fmt.Sprintf("/accounts/%s/random/requests?limit=%d", accountID, limit)
		data, err := client.request(ctx, http.MethodGet, path, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	default:
		fmt.Println(`Usage:
  slctl random list --account <id> [--limit 10]
  slctl random generate --account <id> [--length 32] [--request-id <id>]`)
		return fmt.Errorf("unknown random subcommand %q", sub)
	}
	return nil
}
