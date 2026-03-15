//go:build scripts

// Check that miniapp_stats_rollup RPC executes successfully against Supabase.
//
// Optional env:
//
//	STATS_ROLLUP_DATE=2026-02-26
package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/database"
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

	client, err := database.NewClient(database.Config{
		URL:        supabaseURL,
		ServiceKey: serviceKey,
	})
	if err != nil {
		fatal("create database client: %v", err)
	}
	repo := database.NewRepository(client)

	rollupDate := strings.TrimSpace(os.Getenv("STATS_ROLLUP_DATE"))
	if rollupDate == "" {
		rollupDate = time.Now().UTC().Format("2006-01-02")
	}

	fmt.Printf("Checking miniapp_stats_rollup for date %s...\n", rollupDate)
	payload := map[string]string{"p_date": rollupDate}
	if _, err := repo.RequestRPC(ctx, http.MethodPost, "rpc/miniapp_stats_rollup", payload, ""); err != nil {
		fatal("miniapp_stats_rollup failed: %v", err)
	}
	fmt.Println("miniapp_stats_rollup check passed.")
}

func fatal(format string, args ...any) {
	fmt.Printf("ERROR: "+format+"\n", args...)
	os.Exit(1)
}
