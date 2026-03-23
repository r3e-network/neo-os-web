//go:build scripts

// Check that miniapp_stats_rollup RPC executes successfully against Supabase.
//
// Optional env:
//
//	STATS_ROLLUP_DATE=2026-02-26
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	supabaseURL := strings.TrimSpace(os.Getenv("SUPABASE_URL"))
	serviceKey := strings.TrimSpace(os.Getenv("SUPABASE_SERVICE_KEY"))
	if serviceKey == "" {
		serviceKey = strings.TrimSpace(os.Getenv("SUPABASE_SERVICE_ROLE_KEY"))
	}
	if supabaseURL == "" {
		fatal("SUPABASE_URL is required")
	}
	if serviceKey == "" {
		fatal("SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY is required")
	}

	rollupDate := strings.TrimSpace(os.Getenv("STATS_ROLLUP_DATE"))
	if rollupDate == "" {
		rollupDate = time.Now().UTC().Format("2006-01-02")
	}

	fmt.Printf("Checking miniapp_stats_rollup for date %s...\n", rollupDate)
	payload := map[string]string{"p_date": rollupDate}
	if err := callStatsRollupRPC(ctx, supabaseURL, serviceKey, payload); err != nil {
		fatal("miniapp_stats_rollup failed: %v", err)
	}
	fmt.Println("miniapp_stats_rollup check passed.")
}

func callStatsRollupRPC(ctx context.Context, supabaseURL, serviceKey string, payload map[string]string) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	url := strings.TrimRight(strings.TrimSpace(supabaseURL), "/") + "/rest/v1/rpc/miniapp_stats_rollup"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", serviceKey)
	req.Header.Set("Authorization", "Bearer "+serviceKey)
	req.Header.Set("Prefer", "return=minimal")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 32<<10))
		message := strings.TrimSpace(string(raw))
		if message == "" {
			message = resp.Status
		}
		return fmt.Errorf("rpc status %d: %s", resp.StatusCode, message)
	}

	return nil
}

func fatal(format string, args ...any) {
	fmt.Printf("ERROR: "+format+"\n", args...)
	os.Exit(1)
}
