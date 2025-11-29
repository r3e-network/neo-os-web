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
	"os"
	"strconv"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/R3E-Network/service_layer/pkg/version"
)

func handleDashboardLink(client *apiClient, args []string) error {
	fs := flag.NewFlagSet("dashboard-link", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	dashboard := fs.String("dashboard", "http://localhost:8081", "Dashboard base URL")
	if err := fs.Parse(args); err != nil {
		return usageError(err)
	}
	base := strings.TrimRight(*dashboard, "/")
	api := client.baseURL
	values := url.Values{}
	values.Set("api", api)
	if client.token != "" {
		values.Set("token", client.token)
	}
	if client.refreshToken != "" {
		values.Set("refresh_token", client.refreshToken)
	}
	if client.tenant != "" {
		values.Set("tenant", client.tenant)
	}
	link := fmt.Sprintf("%s/?%s", base, values.Encode())
	fmt.Println(link)
	return nil
}

func handleServices(ctx context.Context, client *apiClient, args []string) error {
	if len(args) == 0 || args[0] == "list" {
		data, err := client.request(ctx, http.MethodGet, "/system/descriptors", nil)
		if err != nil {
			return err
		}
		prettyPrint(data)
		return nil
	}
	fmt.Println(`Usage:
  slctl services list`)
	return fmt.Errorf("unknown services subcommand %q", args[0])
}

func handleAudit(ctx context.Context, client *apiClient, args []string) error {
	fs := flag.NewFlagSet("audit", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	limit := fs.Int("limit", 50, "max entries to return")
	offset := fs.Int("offset", 0, "offset for pagination")
	user := fs.String("user", "", "filter by user")
	role := fs.String("role", "", "filter by role")
	tenant := fs.String("tenant", "", "filter by tenant")
	method := fs.String("method", "", "filter by HTTP method (get/post/...)")
	contains := fs.String("contains", "", "path contains substring")
	status := fs.Int("status", 0, "filter by status code")
	format := fs.String("format", "json", "output format: json|table")
	if err := fs.Parse(args); err != nil {
		return usageError(err)
	}
	params := url.Values{}
	if *limit > 0 {
		params.Set("limit", strconv.Itoa(*limit))
	}
	if *offset > 0 {
		params.Set("offset", strconv.Itoa(*offset))
	}
	if v := strings.TrimSpace(*user); v != "" {
		params.Set("user", v)
	}
	if v := strings.TrimSpace(*role); v != "" {
		params.Set("role", v)
	}
	if v := strings.TrimSpace(*tenant); v != "" {
		params.Set("tenant", v)
	}
	if v := strings.TrimSpace(*method); v != "" {
		params.Set("method", v)
	}
	if v := strings.TrimSpace(*contains); v != "" {
		params.Set("contains", v)
	}
	if *status > 0 {
		params.Set("status", strconv.Itoa(*status))
	}
	path := "/admin/audit"
	if enc := params.Encode(); enc != "" {
		path += "?" + enc
	}
	data, err := client.request(ctx, http.MethodGet, path, nil)
	if err != nil {
		return err
	}
	if strings.EqualFold(*format, "table") {
		var entries []struct {
			Time       string `json:"time"`
			User       string `json:"user"`
			Role       string `json:"role"`
			Tenant     string `json:"tenant"`
			Path       string `json:"path"`
			Method     string `json:"method"`
			Status     int    `json:"status"`
			RemoteAddr string `json:"remote_addr"`
			UserAgent  string `json:"user_agent"`
		}
		if err := json.Unmarshal(data, &entries); err != nil {
			return fmt.Errorf("decode audit response: %w", err)
		}
		w := tabwriter.NewWriter(os.Stdout, 0, 8, 2, ' ', 0)
		fmt.Fprintln(w, "TIME\tSTATUS\tMETHOD\tPATH\tUSER\tROLE\tTENANT\tIP\tUA")
		for _, e := range entries {
			fmt.Fprintf(w, "%s\t%d\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n",
				e.Time, e.Status, e.Method, e.Path, e.User, e.Role, e.Tenant, e.RemoteAddr, e.UserAgent)
		}
		_ = w.Flush()
		return nil
	}
	prettyPrint(data)
	return nil
}

// handleHealth inspects oracle/datafeed health for an account.
func handleHealth(ctx context.Context, client *apiClient, args []string) error {
	fs := flag.NewFlagSet("health", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var accountID string
	includeOracle := fs.Bool("oracle", true, "Include oracle health")
	includeDatafeeds := fs.Bool("datafeeds", true, "Include datafeed health")
	fs.StringVar(&accountID, "account", "", "Account ID (required)")
	if err := fs.Parse(args); err != nil {
		return usageError(err)
	}
	if accountID == "" {
		return usageError(errors.New("account is required (use --account)"))
	}

	if *includeOracle {
		data, err := client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/oracle/requests", nil)
		if err != nil {
			return err
		}
		var requests []struct {
			Status    string `json:"status"`
			Attempts  int    `json:"attempts"`
			CreatedAt string `json:"created_at"`
		}
		_ = json.Unmarshal(data, &requests)
		var pending, running, failed, succeeded, maxAttempts int
		var oldestPending time.Time
		for _, req := range requests {
			switch strings.ToLower(req.Status) {
			case "pending":
				pending++
				if t, err := time.Parse(time.RFC3339, req.CreatedAt); err == nil {
					if oldestPending.IsZero() || t.Before(oldestPending) {
						oldestPending = t
					}
				}
			case "running":
				running++
			case "failed":
				failed++
			case "succeeded":
				succeeded++
			}
			if req.Attempts > maxAttempts {
				maxAttempts = req.Attempts
			}
		}
		fmt.Printf("Oracle: pending=%d running=%d failed=%d succeeded=%d max_attempts=%d", pending, running, failed, succeeded, maxAttempts)
		if !oldestPending.IsZero() {
			fmt.Printf(" oldest_pending=%s", time.Since(oldestPending).Round(time.Second))
		}
		fmt.Println()
	}

	if *includeDatafeeds {
		data, err := client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/datafeeds", nil)
		if err != nil {
			return err
		}
		var feeds []struct {
			ID           string   `json:"id"`
			Pair         string   `json:"pair"`
			Heartbeat    int64    `json:"heartbeat"`
			ThresholdPPM int      `json:"threshold_ppm"`
			SignerSet    []string `json:"signer_set"`
			Decimals     int      `json:"decimals"`
		}
		_ = json.Unmarshal(data, &feeds)
		if len(feeds) == 0 {
			fmt.Println("Datafeeds: none configured")
			return nil
		}
		now := time.Now().UTC()
		for _, feed := range feeds {
			fmt.Printf("%s: heartbeat=%d ppm=%d decimals=%d", feed.Pair, feed.Heartbeat, feed.ThresholdPPM, feed.Decimals)
			age := now.Sub(time.Unix(feed.Heartbeat, 0))
			if feed.Heartbeat > 0 {
				fmt.Printf(" heartbeat_at=%s", time.Unix(feed.Heartbeat, 0).Format(time.RFC3339))
			}
			if feed.ThresholdPPM > 0 {
				fmt.Printf(" deviation<=%dppm", feed.ThresholdPPM)
			}
			if age > 0 {
				fmt.Printf(" age=%s", age.Round(time.Second))
			}
			if len(feed.SignerSet) > 0 {
				fmt.Printf(" signers=%d", len(feed.SignerSet))
			}
			fmt.Println()
		}
	}

	return nil
}

func handleVersion(ctx context.Context, client *apiClient) error {
	fmt.Printf("slctl: %s\n", version.FullVersion())
	data, err := client.request(ctx, http.MethodGet, "/system/version", nil)
	if err != nil {
		return err
	}
	var payload struct {
		Version   string `json:"version"`
		Commit    string `json:"commit"`
		BuiltAt   string `json:"built_at"`
		GoVersion string `json:"go_version"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return fmt.Errorf("decode server version: %w", err)
	}
	fmt.Printf("server[%s]: %s (commit %s, built %s, %s)\n", client.baseURL, payload.Version, payload.Commit, payload.BuiltAt, payload.GoVersion)
	return nil
}

func handleTenant(ctx context.Context, client *apiClient, args []string) error {
	fs := flag.NewFlagSet("tenant", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	if err := fs.Parse(args); err != nil {
		return usageError(err)
	}
	if fs.NArg() != 0 {
		return usageError(fmt.Errorf("tenant takes no arguments"))
	}
	data, err := client.request(ctx, http.MethodGet, "/system/tenant", nil)
	if err != nil {
		return err
	}
	prettyPrint(data)
	return nil
}
