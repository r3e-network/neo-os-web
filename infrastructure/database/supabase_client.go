// Package database provides Supabase database integration.
package database

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

	"github.com/R3E-Network/service_layer/infrastructure/httputil"
	"github.com/R3E-Network/service_layer/infrastructure/runtime"
)

// Client wraps the Supabase REST API client.
type Client struct {
	url        string
	serviceKey string
	httpClient *http.Client
}

// Config holds database configuration.
type Config struct {
	URL        string
	ServiceKey string
}

// NewClient creates a new Supabase client.
func NewClient(cfg Config) (*Client, error) {
	url := cfg.URL
	if url == "" {
		url = os.Getenv("SUPABASE_URL")
	}

	key := cfg.ServiceKey
	if key == "" {
		key = os.Getenv("SUPABASE_SERVICE_KEY")
	}

	isDev := runtime.IsDevelopmentOrTesting()
	strict := runtime.StrictIdentityMode()

	usingMockURL := false
	if url == "" {
		if strict {
			return nil, fmt.Errorf("SUPABASE_URL is required")
		}
		// Allow running without database in development/testing mode
		if isDev {
			url = "http://localhost:54321" // Mock URL for development
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

	if strict {
		normalizedURL, _, err := httputil.NormalizeBaseURL(url, httputil.BaseURLOptions{RequireHTTPSInStrictMode: true})
		if err != nil {
			return nil, fmt.Errorf("SUPABASE_URL must be a valid https URL: %w", err)
		}
		url = normalizedURL
	}

	transport := httputil.DefaultTransportWithMinTLS12()

	return &Client{
		url:        url,
		serviceKey: key,
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
	url := fmt.Sprintf("%s/rest/v1/%s", c.url, table)
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
	req.Header.Set("Prefer", "return=representation")

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
