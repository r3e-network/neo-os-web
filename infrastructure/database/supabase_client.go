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
	"strings"
	"time"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/httputil"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/runtime"
)

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
	allowInsecure := strings.EqualFold(os.Getenv("SUPABASE_ALLOW_INSECURE"), "true")
	if allowInsecure && !isDev {
		return nil, fmt.Errorf("SUPABASE_ALLOW_INSECURE is only supported in development/testing")
	}

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
			if allowHTTPInStrict {
				return nil, fmt.Errorf("SUPABASE_URL must be a valid URL: %w", err)
			}
			return nil, fmt.Errorf("SUPABASE_URL must be a valid https URL (set SUPABASE_ALLOW_INSECURE=true for dev/test): %w", err)
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

// request makes an HTTP request to the Supabase REST API.
func (c *Client) request(ctx context.Context, method, table string, body interface{}, query string) ([]byte, error) {
	var url string
	if c.restPrefix == "" {
		url = fmt.Sprintf("%s/%s", c.url, table)
	} else {
		url = fmt.Sprintf("%s%s/%s", c.url, c.restPrefix, table)
	}
	if query != "" {
		url += "?" + query
	}

	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("marshal body: %w", err)
		}
		reqBody = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", c.serviceKey)
	req.Header.Set("Authorization", "Bearer "+c.serviceKey)
	prefer := "return=representation"
	if method == http.MethodPost && strings.Contains(query, "on_conflict=") {
		prefer = "return=representation,resolution=merge-duplicates"
	}
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

// Insert inserts a record into the specified table.
func (c *Client) Insert(ctx context.Context, table string, data interface{}) ([]byte, error) {
	return c.request(ctx, http.MethodPost, table, data, "")
}

// Update updates records in the specified table matching the query.
func (c *Client) Update(ctx context.Context, table string, data interface{}, query string) ([]byte, error) {
	return c.request(ctx, http.MethodPatch, table, data, query)
}

// Select retrieves records from the specified table.
func (c *Client) Select(ctx context.Context, table string, query string) ([]byte, error) {
	return c.request(ctx, http.MethodGet, table, nil, query)
}

// Delete removes records from the specified table matching the query.
func (c *Client) Delete(ctx context.Context, table string, query string) ([]byte, error) {
	return c.request(ctx, http.MethodDelete, table, nil, query)
}

// Upsert inserts or updates a record in the specified table.
func (c *Client) Upsert(ctx context.Context, table string, data interface{}, onConflict string) ([]byte, error) {
	query := ""
	if onConflict != "" {
		query = "on_conflict=" + onConflict
	}
	return c.request(ctx, http.MethodPost, table, data, query)
}
