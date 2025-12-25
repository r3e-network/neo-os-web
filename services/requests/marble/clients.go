package neorequests

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/R3E-Network/service_layer/infrastructure/httputil"
)

const defaultHTTPBodyLimit = 1 << 20 // 1 MiB

func (s *Service) postJSON(ctx context.Context, url string, userID string, body any) ([]byte, error) {
	if s == nil || s.httpClient == nil {
		return nil, fmt.Errorf("http client not configured")
	}
	if strings.TrimSpace(url) == "" {
		return nil, fmt.Errorf("service URL not configured")
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(url, "/"), bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if userID != "" {
		req.Header.Set("X-User-ID", userID)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, truncated, readErr := httputil.ReadAllWithLimit(resp.Body, 32<<10)
		if readErr != nil {
			return nil, fmt.Errorf("request failed: %s (failed to read body: %v)", resp.Status, readErr)
		}
		msg := strings.TrimSpace(string(body))
		if truncated {
			msg += "...(truncated)"
		}
		if msg == "" {
			msg = resp.Status
		}
		return nil, fmt.Errorf("request failed: %s", msg)
	}

	respBody, err := httputil.ReadAllStrict(resp.Body, defaultHTTPBodyLimit)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	return respBody, nil
}

func joinURL(base, path string) string {
	base = strings.TrimRight(strings.TrimSpace(base), "/")
	if base == "" {
		return ""
	}
	path = strings.TrimSpace(path)
	if path == "" {
		return base
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return base + path
}
