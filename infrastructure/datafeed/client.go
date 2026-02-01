package datafeed

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Client fetches price data from Chainlink aggregators.
type Client struct {
	httpClient *http.Client
	rpcURL     string
	feeds      []FeedConfig
	network    string
	mu         sync.RWMutex
}

// NewClient creates a new Chainlink datafeed client.
func NewClient(rpcURL string, network string) (*Client, error) {
	if strings.TrimSpace(rpcURL) == "" {
		return nil, fmt.Errorf("chainlink rpc url required")
	}

	return &Client{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		rpcURL:     rpcURL,
		feeds:      GetFeedsForNetwork(network),
		network:    network,
	}, nil
}

// Close closes the client (no-op for HTTP client).
func (c *Client) Close() {}

// jsonRPCRequest represents a JSON-RPC request.
type jsonRPCRequest struct {
	JSONRPC string        `json:"jsonrpc"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
	ID      int           `json:"id"`
}

// jsonRPCResponse represents a JSON-RPC response.
type jsonRPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int             `json:"id"`
	Result  json.RawMessage `json:"result"`
	Error   *jsonRPCError   `json:"error"`
}

type jsonRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// latestRoundData function selector: 0xfeaf968c
const latestRoundDataSelector = "0xfeaf968c"

// ethCall makes an eth_call to the given address with the given data.
func (c *Client) ethCall(ctx context.Context, to string, data string) (string, error) {
	req := jsonRPCRequest{
		JSONRPC: "2.0",
		Method:  "eth_call",
		Params: []interface{}{
			map[string]string{"to": to, "data": data},
			"latest",
		},
		ID: 1,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return "", err
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.rpcURL, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var rpcResp jsonRPCResponse
	if err := json.Unmarshal(respBody, &rpcResp); err != nil {
		return "", err
	}

	if rpcResp.Error != nil {
		return "", fmt.Errorf("RPC error: %s", rpcResp.Error.Message)
	}

	var result string
	if err := json.Unmarshal(rpcResp.Result, &result); err != nil {
		return "", err
	}

	return result, nil
}

// FetchPrice fetches the latest price for a single feed.
func (c *Client) FetchPrice(ctx context.Context, feed FeedConfig) (*PriceData, error) {
	result, err := c.ethCall(ctx, feed.Address, latestRoundDataSelector)
	if err != nil {
		return nil, fmt.Errorf("fetch %s: %w", feed.Symbol, err)
	}

	// Parse the result (remove 0x prefix)
	data := strings.TrimPrefix(result, "0x")
	if len(data) < 320 { // 5 * 64 hex chars
		return nil, fmt.Errorf("invalid response length for %s", feed.Symbol)
	}

	// Decode: roundId, answer, startedAt, updatedAt, answeredInRound
	roundID := new(big.Int)
	roundID.SetString(data[0:64], 16)

	answer := new(big.Int)
	answer.SetString(data[64:128], 16)

	startedAt := new(big.Int)
	startedAt.SetString(data[128:192], 16)

	updatedAt := new(big.Int)
	updatedAt.SetString(data[192:256], 16)

	answeredInRound := new(big.Int)
	answeredInRound.SetString(data[256:320], 16)

	return &PriceData{
		Symbol:     feed.Symbol,
		RoundID:    roundID,
		Price:      answer,
		Timestamp:  time.Unix(updatedAt.Int64(), 0),
		Decimals:   feed.Decimals,
		StartedAt:  time.Unix(startedAt.Int64(), 0),
		AnsweredIn: answeredInRound.Uint64(),
		Category:   feed.Category,
		Base:       feed.Base,
		Quote:      feed.Quote,
	}, nil
}

// FetchAllPrices fetches prices for all configured feeds concurrently.
func (c *Client) FetchAllPrices(ctx context.Context) (*BatchPriceData, error) {
	c.mu.RLock()
	feeds := c.feeds
	c.mu.RUnlock()

	results := make([]PriceData, 0, len(feeds))
	var mu sync.Mutex
	var wg sync.WaitGroup

	sem := make(chan struct{}, 10) // Max 10 concurrent

	for _, feed := range feeds {
		wg.Add(1)
		go func(f FeedConfig) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			price, err := c.FetchPrice(ctx, f)
			mu.Lock()
			if err == nil {
				results = append(results, *price)
			}
			mu.Unlock()
		}(feed)
	}

	wg.Wait()

	return &BatchPriceData{
		Prices:    results,
		FetchedAt: time.Now(),
		Network:   c.network,
	}, nil
}

// GetFeeds returns the configured feeds.
func (c *Client) GetFeeds() []FeedConfig {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.feeds
}
