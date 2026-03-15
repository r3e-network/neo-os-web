// Package client provides a client for the NeoGasBank service.
// Other TEE services use this client to deduct service fees from user balances.
package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
)

const (
	defaultTimeout = 10 * time.Second
)

// HTTPError captures non-200 responses from NeoGasBank.
type HTTPError = httputil.HTTPStatusError

// IsHTTPStatusError reports whether err wraps a NeoGasBank HTTPError with the
// specified status code.
func IsHTTPStatusError(err error, statusCode int) bool {
	return httputil.IsHTTPStatusError(err, statusCode)
}

// Client is a client for the NeoGasBank service.
type Client struct {
	baseURL    string
	httpClient *http.Client
}

// Config holds client configuration.
type Config struct {
	BaseURL    string
	HTTPClient *http.Client
}

// New creates a new GasBank client.
func New(cfg Config) (*Client, error) {
	if cfg.BaseURL == "" {
		return nil, fmt.Errorf("gasbank client: base URL is required")
	}

	httpClient := httputil.CopyHTTPClientWithTimeoutNoRedirect(cfg.HTTPClient, defaultTimeout, false)

	return &Client{
		baseURL:    cfg.BaseURL,
		httpClient: httpClient,
	}, nil
}

// DeductFeeRequest is the request for deducting service fees.
type DeductFeeRequest struct {
	UserID      string `json:"user_id"`
	Amount      int64  `json:"amount"`
	ServiceID   string `json:"service_id"`
	ReferenceID string `json:"reference_id"`
	Description string `json:"description,omitempty"`
}

// DeductFeeResponse is the response for deducting service fees.
type DeductFeeResponse struct {
	Success       bool   `json:"success"`
	TransactionID string `json:"transaction_id,omitempty"`
	BalanceAfter  int64  `json:"balance_after"`
	Error         string `json:"error,omitempty"`
}

// DeductFee deducts a service fee from a user's gas bank balance.
func (c *Client) DeductFee(ctx context.Context, req *DeductFeeRequest) (*DeductFeeResponse, error) {
	if req == nil {
		return nil, fmt.Errorf("request cannot be nil")
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/deduct", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		httpErr, readErr := httputil.BuildHTTPStatusErrorFromRequest(resp, httpReq, 64<<10)
		if readErr != nil {
			return nil, httputil.WrapReadBodyError(httpErr, readErr)
		}
		httpErr.Body = extractErrorBody([]byte(httpErr.Body))
		return nil, httpErr
	}

	respBody, err := httputil.ReadAllStrict(resp.Body, 64<<10)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var result DeductFeeResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	return &result, nil
}

// GetAccountResponse is the response for getting account info.
type GetAccountResponse struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Balance   int64     `json:"balance"`
	Reserved  int64     `json:"reserved"`
	Available int64     `json:"available"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// GetAccount retrieves a user's gas bank account.
func (c *Client) GetAccount(ctx context.Context, userID string) (*GetAccountResponse, error) {
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/account", http.NoBody)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("X-User-ID", userID)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		httpErr, readErr := httputil.BuildHTTPStatusErrorFromRequest(resp, httpReq, 64<<10)
		if readErr != nil {
			return nil, httputil.WrapReadBodyError(httpErr, readErr)
		}
		httpErr.Body = extractErrorBody([]byte(httpErr.Body))
		return nil, httpErr
	}

	respBody, err := httputil.ReadAllStrict(resp.Body, 64<<10)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var result GetAccountResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	return &result, nil
}

// CheckBalance checks if a user has sufficient balance for a given amount.
func (c *Client) CheckBalance(ctx context.Context, userID string, requiredAmount int64) (hasSufficient bool, available int64, err error) {
	account, err := c.GetAccount(ctx, userID)
	if err != nil {
		return false, 0, err
	}

	return account.Available >= requiredAmount, account.Available, nil
}

func extractErrorBody(raw []byte) string {
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" {
		return ""
	}

	var payload struct {
		Error   string `json:"error"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(raw, &payload); err == nil {
		if msg := strings.TrimSpace(payload.Error); msg != "" {
			return msg
		}
		if msg := strings.TrimSpace(payload.Message); msg != "" {
			return msg
		}
	}

	return trimmed
}
