package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

func handleOracle(ctx context.Context, client *apiClient, args []string) error {
	if len(args) == 0 {
		fmt.Println(`Usage:
  slctl oracle sources list --account <id>
  slctl oracle sources create --account <id> --name <name> --url <url> [--method GET] [--description text]
  slctl oracle sources get --account <id> --source <id>
  slctl oracle requests list --account <id> [--limit n] [--status pending|running|failed|succeeded] [--cursor <id>] [--all]
  slctl oracle requests create --account <id> --source <id> [--payload JSON] [--payload-file path] [--alternate <id>[,<id>...]]
  slctl oracle requests retry --account <id> --request <id>

Runner callbacks:
  export ORACLE_RUNNER_TOKENS=runner-1,runner-2   # accepted tokens (also in config files)
  curl -X PATCH /accounts/<id>/oracle/requests/<req> \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Oracle-Runner-Token: runner-1" \
    -d '{"status":"running"}'`)
		return nil
	}
	switch args[0] {
	case "sources":
		if len(args) < 2 {
			return fmt.Errorf("oracle sources requires a subcommand")
		}
		return handleOracleSources(ctx, client, args[1:])
	case "requests":
		if len(args) < 2 {
			return fmt.Errorf("oracle requests requires a subcommand")
		}
		return handleOracleRequests(ctx, client, args[1:])
	default:
		return fmt.Errorf("unknown oracle subcommand %q", args[0])
	}
}

func handleOracleSources(ctx context.Context, client *apiClient, args []string) error {
	sub := args[0]
	fs := flag.NewFlagSet("oracle sources "+sub, flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var accountID, sourceID, name, urlStr, method, description string
	fs.StringVar(&accountID, "account", "", "Account ID (required)")
	fs.StringVar(&sourceID, "source", "", "Source ID")
	fs.StringVar(&name, "name", "", "Source name")
	fs.StringVar(&urlStr, "url", "", "Source URL")
	fs.StringVar(&method, "method", "GET", "HTTP method")
	fs.StringVar(&description, "description", "", "Description")
	if err := fs.Parse(args[1:]); err != nil {
		return err
	}
	if accountID == "" {
		return errors.New("account is required")
	}
	switch sub {
	case "list":
		data, err := client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/oracle/sources", nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "create":
		if name == "" || urlStr == "" {
			return errors.New("name and url are required")
		}
		payload := map[string]any{
			"name":        name,
			"url":         urlStr,
			"method":      method,
			"description": description,
		}
		data, err := client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/oracle/sources", payload)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "get":
		if sourceID == "" {
			return errors.New("source is required")
		}
		data, err := client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/oracle/sources/"+sourceID, nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
	default:
		return fmt.Errorf("unknown oracle sources subcommand %q", sub)
	}
	return nil
}

type floatFlag struct {
	set   bool
	value float64
}

func (f *floatFlag) String() string {
	if !f.set {
		return ""
	}
	return fmt.Sprintf("%f", f.value)
}

func (f *floatFlag) Set(v string) error {
	parsed, err := strconv.ParseFloat(v, 64)
	if err != nil {
		return err
	}
	f.value = parsed
	f.set = true
	return nil
}

type intFlag struct {
	set   bool
	value int
}

func (f *intFlag) String() string {
	if !f.set {
		return ""
	}
	return fmt.Sprintf("%d", f.value)
}

func (f *intFlag) Set(v string) error {
	parsed, err := strconv.Atoi(v)
	if err != nil {
		return err
	}
	f.value = parsed
	f.set = true
	return nil
}

type stringSliceFlag struct {
	values []string
}

func (s *stringSliceFlag) String() string {
	return strings.Join(s.values, ",")
}

func (s *stringSliceFlag) Set(v string) error {
	parts := strings.FieldsFunc(v, func(r rune) bool {
		return r == ',' || r == ';'
	})
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		s.values = append(s.values, p)
	}
	return nil
}

func handleOracleRequests(ctx context.Context, client *apiClient, args []string) error {
	sub := args[0]
	fs := flag.NewFlagSet("oracle requests "+sub, flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var accountID, sourceID, payloadRaw, payloadFile string
	var alternates stringSliceFlag
	var statusFilter string
	var limit int
	var cursor string
	var fetchAll bool
	fs.StringVar(&accountID, "account", "", "Account ID (required)")
	fs.StringVar(&sourceID, "source", "", "Source ID")
	fs.StringVar(&payloadRaw, "payload", "", "Inline JSON payload")
	fs.StringVar(&payloadFile, "payload-file", "", "Path to JSON payload file")
	fs.Var(&alternates, "alternate", "Alternate data source IDs (comma-separated, repeatable)")
	fs.StringVar(&statusFilter, "status", "", "Filter by status (pending,running,failed,succeeded)")
	fs.IntVar(&limit, "limit", 100, "Limit number of requests returned")
	fs.StringVar(&cursor, "cursor", "", "Cursor for pagination (use value from X-Next-Cursor)")
	fs.BoolVar(&fetchAll, "all", false, "Follow cursors until the queue is exhausted")
	if err := fs.Parse(args[1:]); err != nil {
		return err
	}
	if accountID == "" {
		return errors.New("account is required")
	}
	switch sub {
	case "list":
		path := "/accounts/" + accountID + "/oracle/requests"
		params := url.Values{}
		if statusFilter != "" {
			params.Set("status", statusFilter)
		}
		if limit > 0 {
			params.Set("limit", strconv.Itoa(limit))
		}
		if cursor != "" {
			params.Set("cursor", cursor)
		}
		pagePath := path
		if len(params) > 0 {
			pagePath += "?" + params.Encode()
		}
		if !fetchAll {
			data, headers, err := client.requestWithHeaders(ctx, http.MethodGet, pagePath, nil)
			if err != nil {
				return err
			}
			prettyPrint(data)
			if next := headers.Get("X-Next-Cursor"); next != "" {
				fmt.Println("\nNext cursor:", next)
			}
			return nil
		}

		allItems := make([]json.RawMessage, 0)
		nextCursor := cursor
		const maxPages = 100
		for i := 0; i < maxPages; i++ {
			pageParams := url.Values{}
			for k, vals := range params {
				for _, v := range vals {
					pageParams.Add(k, v)
				}
			}
			if nextCursor != "" {
				pageParams.Set("cursor", nextCursor)
			}
			pageURL := path
			if len(pageParams) > 0 {
				pageURL += "?" + pageParams.Encode()
			}
			data, headers, err := client.requestWithHeaders(ctx, http.MethodGet, pageURL, nil)
			if err != nil {
				return err
			}
			var page []json.RawMessage
			if err := json.Unmarshal(data, &page); err != nil {
				return fmt.Errorf("decode page: %w", err)
			}
			allItems = append(allItems, page...)
			nextCursor = headers.Get("X-Next-Cursor")
			if nextCursor == "" || len(page) == 0 {
				break
			}
		}
		combined, err := json.MarshalIndent(allItems, "", "  ")
		if err != nil {
			return fmt.Errorf("encode combined: %w", err)
		}
		fmt.Println(string(combined))
		return nil
	case "create":
		if sourceID == "" {
			return errors.New("source is required")
		}
		payloadBody, err := loadJSONPayload(payloadRaw, payloadFile)
		if err != nil {
			return err
		}
		if len(alternates.values) > 0 {
			if payloadBody == nil {
				payloadBody = make(map[string]any)
			}
			if obj, ok := payloadBody.(map[string]any); ok {
				obj["alternate_source_ids"] = alternates.values
				payloadBody = obj
			} else {
				return fmt.Errorf("payload must be a JSON object when using --alternate")
			}
		}
		requestPayload := map[string]any{
			"data_source_id": sourceID,
		}
		if payloadBody != nil {
			requestPayload["payload"] = payloadBody
		}
		data, err := client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/oracle/requests", requestPayload)
		if err != nil {
			return err
		}
		prettyPrint(data)
	case "retry":
		fs := flag.NewFlagSet("oracle requests retry", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var requestID string
		fs.StringVar(&accountID, "account", "", "Account ID (required)")
		fs.StringVar(&requestID, "request", "", "Request ID (required)")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if accountID == "" || requestID == "" {
			return errors.New("account and request are required")
		}
		body := map[string]any{"status": "retry"}
		data, err := client.request(ctx, http.MethodPatch, "/accounts/"+accountID+"/oracle/requests/"+requestID, body)
		if err != nil {
			return err
		}
		prettyPrint(data)
	default:
		return fmt.Errorf("unknown oracle requests subcommand %q", sub)
	}
	return nil
}
