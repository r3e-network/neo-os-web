// Package client provides a client for the NeoGasBank service.
// Other TEE services use this client to deduct service fees from user balances.
package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	defaultTimeout = 10 * time.Second
)

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

	httpClient := cfg.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: defaultTimeout}
	}

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

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	// Check HTTP status code before parsing response
	if resp.StatusCode != http.StatusOK {
		// Try to parse error response
		var errResp struct {
			Error string `json:"error"`
		}
		if json.Unmarshal(respBody, &errResp) == nil && errResp.Error != "" {
			return nil, fmt.Errorf("deduct fee failed (HTTP %d): %s", resp.StatusCode, errResp.Error)
		}
		return nil, fmt.Errorf("deduct fee failed with status %d: %s", resp.StatusCode, string(respBody))
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
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/account", nil)
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
		return nil, fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	respBody, err := io.ReadAll(resp.Body)
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
func (c *Client) CheckBalance(ctx context.Context, userID string, requiredAmount int64) (bool, int64, error) {
	account, err := c.GetAccount(ctx, userID)
	if err != nil {
		return false, 0, err
	}

	return account.Available >= requiredAmount, account.Available, nil
}
