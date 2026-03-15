package neorequests

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
)

const defaultHTTPBodyLimit = 1 << 20 // 1 MiB

// UpstreamHTTPError captures non-200 responses returned by upstream services.
type UpstreamHTTPError struct {
	*httputil.HTTPStatusError
}

func (e *UpstreamHTTPError) Error() string {
	if e == nil {
		return "request failed"
	}
	if e.HTTPStatusError == nil {
		return "request failed"
	}
	if strings.TrimSpace(e.HTTPStatusError.Body) == "" {
		return fmt.Sprintf("request failed: %s", strings.TrimSpace(e.HTTPStatusError.Status))
	}
	return fmt.Sprintf("request failed: %s - %s", strings.TrimSpace(e.HTTPStatusError.Status), strings.TrimSpace(e.HTTPStatusError.Body))
}

// Unwrap exposes the shared HTTP status error for generic classification.
func (e *UpstreamHTTPError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.HTTPStatusError
}

// IsUpstreamStatusError reports whether err wraps an upstream HTTP error with
// the specified status code.
func IsUpstreamStatusError(err error, statusCode int) bool {
	return httputil.IsHTTPStatusError(err, statusCode)
}

func (s *Service) postJSON(ctx context.Context, url, userID string, body any) ([]byte, error) {
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
		statusErr, readErr := httputil.BuildHTTPStatusErrorFromRequest(resp, req, 32<<10)
		httpErr := &UpstreamHTTPError{HTTPStatusError: statusErr}
		if readErr != nil {
			return nil, httputil.WrapReadBodyError(httpErr, readErr)
		}
		return nil, httpErr
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
