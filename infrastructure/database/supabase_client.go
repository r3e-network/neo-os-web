// Package database provides Supabase database integration.
package database

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/runtime"
)

// validTableName matches safe PostgREST table names (letters, digits, underscores).
// Unlike field names, table names must not contain dots.
var validTableName = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)

// validateTable panics if table contains characters that could inject PostgREST operators.
// Panic is appropriate because invalid table names are always programmer errors.
func validateTable(table string) string {
	if !validTableName.MatchString(table) {
		panic(fmt.Sprintf("invalid table name: %q", table))
	}
	return table
}

// Client wraps the Supabase REST API client.
type Client struct {
	url        string
	serviceKey string
	restPrefix string
	httpClient *http.Client
}

// Config holds database configuration.
type Config struct {
	URL        string
	ServiceKey string
	RestPrefix string
}

// NewClient creates a new Supabase client.
func NewClient(cfg Config) (*Client, error) {
	baseURL := cfg.URL
	if baseURL == "" {
		baseURL = os.Getenv("SUPABASE_URL")
	}

	key := cfg.ServiceKey
	if key == "" {
		key = os.Getenv("SUPABASE_SERVICE_KEY")
	}

	isDev := runtime.IsDevelopmentOrTesting()
	strict := runtime.StrictIdentityMode()
	allowInsecure := strings.EqualFold(os.Getenv("SUPABASE_ALLOW_INSECURE"), "true") || strings.EqualFold(os.Getenv("SUPABASE_ALLOW_INSECURE"), "1")
	// If allow insecure is explicitly set, just use it for testing, don't fail.
	

	usingMockURL := false
	if baseURL == "" {
		if strict {
			return nil, fmt.Errorf("SUPABASE_URL is required")
		}
		// Allow running without database in development/testing mode
		if isDev {
			baseURL = "http://localhost:54321" // Mock URL for development
			usingMockURL = true
		} else {
			return nil, fmt.Errorf("SUPABASE_URL is required")
		}
	}

	if key == "" {
		if strict {
			return nil, fmt.Errorf("SUPABASE_SERVICE_KEY is required")
		}
		if usingMockURL {
			key = ""
		} else {
			return nil, fmt.Errorf("SUPABASE_SERVICE_KEY is required")
		}
	}

	allowHTTPInStrict := allowInsecure
	isClusterLocal := false
	if parsed, err := url.Parse(strings.TrimSpace(baseURL)); err == nil {
		host := strings.ToLower(parsed.Hostname())
		if host == "localhost" || host == "127.0.0.1" ||
			strings.HasSuffix(host, ".svc.cluster.local") ||
			strings.HasSuffix(host, ".cluster.local") {
			isClusterLocal = true
		}
	}
	if !allowHTTPInStrict && isDev {
		allowHTTPInStrict = isClusterLocal
	}

	restPrefix := strings.TrimSpace(cfg.RestPrefix)
	restPrefixSet := restPrefix != ""
	if !restPrefixSet {
		restPrefix = strings.TrimSpace(os.Getenv("SUPABASE_REST_PREFIX"))
		restPrefixSet = restPrefix != ""
	}
	if !restPrefixSet {
		if isDev && isClusterLocal {
			restPrefix = ""
		} else {
			restPrefix = "/rest/v1"
		}
	}
	restPrefix = strings.TrimRight(restPrefix, "/")
	if restPrefix == "/" {
		restPrefix = ""
	}
	if restPrefix != "" && !strings.HasPrefix(restPrefix, "/") {
		restPrefix = "/" + restPrefix
	}

	if strict {
		normalizedURL, _, err := httputil.NormalizeBaseURL(baseURL, httputil.BaseURLOptions{
			RequireHTTPSInStrictMode: !allowHTTPInStrict,
		})
		if err != nil {
			if isDev || allowHTTPInStrict {
				normalizedURL = strings.Replace(normalizedURL, "https://", "http://", 1)
			} else {
				return nil, fmt.Errorf("SUPABASE_URL must be a valid https URL (set SUPABASE_ALLOW_INSECURE=true for dev/test): %w", err)
			}
		}
		baseURL = normalizedURL
	}

	transport := httputil.DefaultTransportWithMinTLS12()

	return &Client{
		url:        baseURL,
		serviceKey: key,
		restPrefix: restPrefix,
		httpClient: &http.Client{
			Timeout:   30 * time.Second,
			Transport: transport,
		},
	}, nil
}

const (
	maxSupabaseResponseBytes  = 8 << 20  // 8 MiB
	maxSupabaseErrorBodyBytes = 32 << 10 // 32 KiB
)

// doRequest is the shared core for all Supabase REST API calls.
// It handles URL construction, body marshaling, header setting, and response reading.
func (c *Client) doRequest(ctx context.Context, method, reqURL, prefer string, body interface{}) ([]byte, error) {
	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("marshal body: %w", err)
		}
		reqBody = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequestWithContext(ctx, method, reqURL, reqBody)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", c.serviceKey)
	req.Header.Set("Authorization", "Bearer "+c.serviceKey)
	req.Header.Set("Prefer", prefer)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, truncated, readErr := httputil.ReadAllWithLimit(resp.Body, maxSupabaseErrorBodyBytes)
		if readErr != nil {
			return nil, fmt.Errorf("read error response: %w", readErr)
		}
		msg := strings.TrimSpace(string(respBody))
		if truncated {
			msg += "...(truncated)"
		}
		return nil, fmt.Errorf("supabase API error %d: %s", resp.StatusCode, msg)
	}

	respBody, err := httputil.ReadAllStrict(resp.Body, maxSupabaseResponseBytes)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	return respBody, nil
}

// buildEndpointURL constructs the full URL for an endpoint with optional query string.
// It prepends restPrefix when configured.
func (c *Client) buildEndpointURL(path, query string) string {
	u := c.url
	if c.restPrefix != "" {
		u += c.restPrefix
	}
	u += "/" + strings.TrimPrefix(path, "/")
	if query != "" {
		u += "?" + query
	}
	return u
}

// buildTableURL constructs the full URL for a table endpoint with optional query string.
func (c *Client) buildTableURL(table, query string) string {
	return c.buildEndpointURL(table, query)
}

// request makes an HTTP request to the Supabase REST API.
func (c *Client) request(ctx context.Context, method, table string, body interface{}, query string) ([]byte, error) {
	return c.doRequest(ctx, method, c.buildTableURL(validateTable(table), query), "return=representation", body)
}

// buildRPCURL constructs the full URL for an RPC endpoint with optional query string.
func (c *Client) buildRPCURL(functionName, query string) string {
	return c.buildEndpointURL("rpc/"+functionName, query)
}

// requestRPC makes an HTTP request to a Supabase RPC endpoint.
func (c *Client) requestRPC(ctx context.Context, method, rpcPath string, body interface{}, query string) ([]byte, error) {
	trimmed := strings.TrimPrefix(strings.TrimSpace(rpcPath), "/")
	if !strings.HasPrefix(trimmed, "rpc/") {
		panic(fmt.Sprintf("invalid rpc path: %q", rpcPath))
	}
	functionName := strings.TrimPrefix(trimmed, "rpc/")
	if !validTableName.MatchString(functionName) {
		panic(fmt.Sprintf("invalid rpc function name: %q", functionName))
	}
	return c.doRequest(ctx, method, c.buildRPCURL(functionName, query), "", body)
}

// requestUpsert makes a POST request with Prefer: resolution=merge-duplicates
// for atomic upsert operations. The onConflict parameter specifies the
// conflict target columns (e.g., "account_id,token_type").
func (c *Client) requestUpsert(ctx context.Context, table string, body interface{}, onConflict, query string) ([]byte, error) {
	params := "on_conflict=" + url.QueryEscape(onConflict)
	if query != "" {
		params += "&" + query
	}
	return c.doRequest(ctx, http.MethodPost, c.buildTableURL(validateTable(table), params), "resolution=merge-duplicates,return=representation", body)
}
