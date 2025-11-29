package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"text/tabwriter"
)

type apiClient struct {
	baseURL      string
	token        string
	refreshToken string
	tenant       string
	http         *http.Client
}

// ensureToken refreshes an access token using the refresh token when no token is provided.
func (c *apiClient) ensureToken(ctx context.Context) error {
	if c == nil {
		return fmt.Errorf("client nil")
	}
	if strings.TrimSpace(c.token) != "" || strings.TrimSpace(c.refreshToken) == "" {
		return nil
	}
	refreshURL := strings.TrimRight(c.baseURL, "/") + "/auth/refresh"
	payload := map[string]string{"refresh_token": c.refreshToken}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, refreshURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("refresh failed (%d): %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}
	var parsed map[string]any
	_ = json.Unmarshal(respBody, &parsed)
	if token, ok := parsed["access_token"].(string); ok && strings.TrimSpace(token) != "" {
		c.token = strings.TrimSpace(token)
		return nil
	}
	if token, ok := parsed["token"].(string); ok && strings.TrimSpace(token) != "" {
		c.token = strings.TrimSpace(token)
		return nil
	}
	return fmt.Errorf("refresh succeeded but access_token not found")
}

type promSample struct {
	metric map[string]string
	value  string
}

// queryPrometheus executes an instant query and returns samples (string-valued).
func queryPrometheus(ctx context.Context, promURL, token, query string) ([]promSample, error) {
	trimmed := strings.TrimSpace(promURL)
	if trimmed == "" {
		return nil, errors.New("prom URL required")
	}
	if !regexp.MustCompile(`^https?://`).MatchString(trimmed) {
		trimmed = "http://" + trimmed
	}
	u, err := url.Parse(trimmed)
	if err != nil {
		return nil, err
	}
	u.Path = "/api/v1/query"
	q := u.Query()
	q.Set("query", query)
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(token) != "" {
		req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(token))
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("prom query %s: %s", u.String(), strings.TrimSpace(string(body)))
	}
	var payload struct {
		Status string `json:"status"`
		Data   struct {
			Result []struct {
				Metric map[string]string `json:"metric"`
				Value  [2]any            `json:"value"`
			} `json:"result"`
		} `json:"data"`
		Error string `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}
	if payload.Status != "success" {
		return nil, fmt.Errorf("prom query failed: %s", payload.Error)
	}
	var out []promSample
	for _, r := range payload.Data.Result {
		valStr := ""
		if len(r.Value) == 2 {
			if s, ok := r.Value[1].(string); ok {
				valStr = s
			}
		}
		out = append(out, promSample{metric: r.Metric, value: valStr})
	}
	return out, nil
}

func reduceFanoutSamples(samples []promSample) map[string]struct {
	OK  float64
	Err float64
} {
	type bucket struct {
		ok  float64
		err float64
	}
	byKind := map[string]*bucket{}
	for _, s := range samples {
		kind := s.metric["kind"]
		if kind == "" {
			kind = "unknown"
		}
		result := s.metric["result"]
		val, _ := strconv.ParseFloat(s.value, 64)
		b, ok := byKind[kind]
		if !ok {
			b = &bucket{}
			byKind[kind] = b
		}
		if strings.EqualFold(result, "error") {
			b.err += val
		} else {
			b.ok += val
		}
	}
	out := make(map[string]struct {
		OK  float64
		Err float64
	}, len(byKind))
	for k, v := range byKind {
		out[k] = struct {
			OK  float64
			Err float64
		}{OK: v.ok, Err: v.err}
	}
	return out
}

func printBusFanoutTable(byKind map[string]struct {
	OK  float64
	Err float64
}) {
	w := tabwriter.NewWriter(os.Stdout, 0, 8, 2, ' ', 0)
	fmt.Fprintln(w, "KIND\tOK\tERROR")
	kinds := make([]string, 0, len(byKind))
	for k := range byKind {
		kinds = append(kinds, k)
	}
	sort.Strings(kinds)
	for _, k := range kinds {
		val := byKind[k]
		fmt.Fprintf(w, "%s\t%.0f\t%.0f\n", k, val.OK, val.Err)
	}
	_ = w.Flush()
}

func (c *apiClient) request(ctx context.Context, method, path string, payload any) ([]byte, error) {
	data, _, err := c.requestWithHeaders(ctx, method, path, payload)
	return data, err
}

// requestRaw sends a request with an arbitrary body and content type.
func (c *apiClient) requestRaw(ctx context.Context, method, path string, body []byte, contentType string) ([]byte, http.Header, error) {
	// Attempt automatic refresh if no token yet but refresh token present.
	if c.token == "" {
		_ = c.ensureToken(ctx)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, nil, err
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	if c.tenant != "" {
		req.Header.Set("X-Tenant-ID", c.tenant)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.Header, err
	}
	if resp.StatusCode >= 300 {
		// If unauthorized and we have a refresh token, attempt a one-time refresh.
		if resp.StatusCode == http.StatusUnauthorized && c.refreshToken != "" {
			if err := c.ensureToken(ctx); err == nil && c.token != "" {
				return c.requestRaw(ctx, method, path, body, contentType)
			}
		}
		msg := strings.TrimSpace(string(data))
		if len(msg) > 0 {
			var parsed map[string]any
			if err := json.Unmarshal(data, &parsed); err == nil {
				if errStr, ok := parsed["error"].(string); ok && errStr != "" {
					msg = errStr
				}
				if code, ok := parsed["code"].(string); ok && code != "" {
					msg = fmt.Sprintf("%s (%s)", msg, code)
				}
			}
		}
		return nil, resp.Header, fmt.Errorf("%s %s: %s (status %d)", method, path, msg, resp.StatusCode)
	}
	return data, resp.Header, nil
}

func (c *apiClient) requestWithHeaders(ctx context.Context, method, path string, payload any) ([]byte, http.Header, error) {
	var body io.Reader
	if payload != nil {
		raw, err := json.Marshal(payload)
		if err != nil {
			return nil, nil, fmt.Errorf("encode payload: %w", err)
		}
		body = bytes.NewReader(raw)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return nil, nil, err
	}
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.Header, err
	}

	if resp.StatusCode >= 300 {
		return nil, resp.Header, fmt.Errorf("%s %s: %s (status %d)", method, path, strings.TrimSpace(string(data)), resp.StatusCode)
	}
	return data, resp.Header, nil
}

// downloadToFile streams the response body into destPath honoring auth headers.
func (c *apiClient) downloadToFile(ctx context.Context, path string, destPath string) (int64, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return 0, err
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return 0, fmt.Errorf("GET %s: %s (status %d)", path, strings.TrimSpace(string(body)), resp.StatusCode)
	}
	if err := os.MkdirAll(filepath.Dir(destPath), 0o755); err != nil {
		return 0, fmt.Errorf("prepare path: %w", err)
	}
	out, err := os.Create(destPath)
	if err != nil {
		return 0, err
	}
	defer out.Close()
	n, err := io.Copy(out, resp.Body)
	if err != nil {
		return n, err
	}
	return n, nil
}
