// Package client provides an HTTP client for the TxProxy service.
package client

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	slhttputil "github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/serviceauth"
	txproxytypes "github.com/r3e-network/neo-miniapp-platform/infrastructure/txproxy/types"
)

// Client is an HTTP client for interacting with TxProxy over the NitroRun mesh.
type Client struct {
	baseURL      string
	httpClient   *http.Client
	serviceID    string
	maxBodyBytes int64
}

// Config holds client configuration.
type Config struct {
	BaseURL string
	// ServiceID identifies the caller. In strict identity mode this is redundant
	// (caller identity is enforced by NitroRun mTLS), but it is still useful for
	// local development and debugging.
	ServiceID string
	Timeout   time.Duration
	// HTTPClient optionally overrides the client used to execute requests.
	// For NitroRun mesh calls, prefer using `nitro.Nitro.HTTPClient()` so
	// requests are sent over verified mTLS.
	HTTPClient *http.Client
	// MaxBodyBytes caps responses to prevent memory exhaustion.
	MaxBodyBytes int64
}

const (
	defaultTimeout     = 30 * time.Second
	defaultMaxBodySize = 1 << 20 // 1MiB
)

// HTTPError captures non-200 responses from TxProxy.
type HTTPError struct {
	*slhttputil.HTTPStatusError
}

type txProxyErrorEnvelope struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

var txProxyConflictCodePattern = regexp.MustCompile(`(?i)"code"\s*:\s*"conflict"`)

func (e *HTTPError) Error() string {
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
func (e *HTTPError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.HTTPStatusError
}

// IsRequestIDConflictError reports whether err indicates a request_id conflict
// returned by TxProxy.
func IsRequestIDConflictError(err error) bool {
	if err == nil {
		return false
	}

	var httpErr *HTTPError
	if errors.As(err, &httpErr) {
		if httpErr.StatusCode != http.StatusConflict {
			return false
		}
		if isTxProxyConflictPayload(httpErr.Body) {
			return true
		}
		body := strings.ToLower(strings.TrimSpace(httpErr.Body))
		if strings.Contains(body, "request_id already used") || hasTxProxyConflictCodeMarker(httpErr.Body) {
			return true
		}
		msg := strings.ToLower(strings.TrimSpace(httpErr.Error()))
		return strings.Contains(msg, "request_id already used") || hasTxProxyConflictCodeMarker(httpErr.Error())
	}

	// Backward compatibility for callers that still return plain text errors.
	msg := strings.ToLower(strings.TrimSpace(err.Error()))
	if !strings.Contains(msg, "request failed:") {
		return false
	}
	if !strings.Contains(msg, "409 conflict") {
		return false
	}
	if isTxProxyConflictPayload(err.Error()) {
		return true
	}
	return strings.Contains(msg, "request_id already used") || hasTxProxyConflictCodeMarker(err.Error())
}

func isTxProxyConflictPayload(raw string) bool {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return false
	}

	if env, ok := parseTxProxyErrorEnvelope(trimmed); ok {
		return strings.EqualFold(strings.TrimSpace(env.Code), "CONFLICT")
	}

	// If raw contains a wrapped JSON object, parse that segment.
	start := strings.Index(trimmed, "{")
	end := strings.LastIndex(trimmed, "}")
	if start < 0 || end <= start {
		return false
	}
	env, ok := parseTxProxyErrorEnvelope(trimmed[start : end+1])
	return ok && strings.EqualFold(strings.TrimSpace(env.Code), "CONFLICT")
}

func parseTxProxyErrorEnvelope(raw string) (txProxyErrorEnvelope, bool) {
	var env txProxyErrorEnvelope
	if strings.TrimSpace(raw) == "" {
		return env, false
	}
	if err := json.Unmarshal([]byte(raw), &env); err != nil {
		return env, false
	}
	return env, true
}

func hasTxProxyConflictCodeMarker(raw string) bool {
	if strings.TrimSpace(raw) == "" {
		return false
	}
	return txProxyConflictCodePattern.MatchString(raw)
}

// New creates a new TxProxy client.
func New(cfg Config) (*Client, error) {
	timeout := cfg.Timeout
	if timeout == 0 {
		timeout = defaultTimeout
	}
	forceTimeout := cfg.Timeout != 0

	baseURL, _, err := slhttputil.NormalizeServiceBaseURL(cfg.BaseURL)
	if err != nil {
		return nil, fmt.Errorf("txproxy: %w", err)
	}

	httpClient := slhttputil.CopyHTTPClientWithTimeoutNoRedirect(cfg.HTTPClient, timeout, forceTimeout)

	maxBodyBytes := cfg.MaxBodyBytes
	if maxBodyBytes <= 0 {
		maxBodyBytes = defaultMaxBodySize
	}

	return &Client{
		baseURL:      baseURL,
		serviceID:    strings.TrimSpace(cfg.ServiceID),
		httpClient:   httpClient,
		maxBodyBytes: maxBodyBytes,
	}, nil
}

// doPost performs a JSON POST request and unmarshals the response into result.
func (c *Client) doPost(ctx context.Context, path string, reqBody, result any) error {
	if c == nil {
		return fmt.Errorf("txproxy: client is nil")
	}
	if c.httpClient == nil {
		return fmt.Errorf("txproxy: http client not configured")
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	requestURL := c.baseURL + path
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, requestURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	if c.serviceID != "" {
		httpReq.Header.Set(serviceauth.ServiceIDHeader, c.serviceID)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		statusErr, readErr := slhttputil.BuildHTTPStatusErrorFromRequest(resp, httpReq, 32<<10)
		httpErr := &HTTPError{
			HTTPStatusError: statusErr,
		}
		if readErr != nil {
			return slhttputil.WrapReadBodyError(httpErr, readErr)
		}
		return httpErr
	}

	respBody, err := slhttputil.ReadAllStrict(resp.Body, c.maxBodyBytes)
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	if err := json.Unmarshal(respBody, result); err != nil {
		return fmt.Errorf("unmarshal response: %w", err)
	}

	return nil
}

// Invoke calls TxProxy /invoke.
func (c *Client) Invoke(ctx context.Context, req *txproxytypes.InvokeRequest) (*txproxytypes.InvokeResponse, error) {
	var result txproxytypes.InvokeResponse
	if err := c.doPost(ctx, "/invoke", req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
