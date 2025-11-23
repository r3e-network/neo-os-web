package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// Config controls the indexer polling loop.
type Config struct {
	RPCURL      string
	Network     string
	StartHeight int64
	PollInterval time.Duration
}

func main() {
	var cfg Config
	flag.StringVar(&cfg.RPCURL, "rpc", envDefault("NEO_RPC_URL", "http://localhost:10332"), "NEO RPC endpoint")
	flag.StringVar(&cfg.Network, "network", envDefault("NEO_NETWORK", "mainnet"), "network label (mainnet|testnet)")
	flag.Int64Var(&cfg.StartHeight, "start-height", 0, "height to start indexing from (0 means current height)")
	flag.DurationVar(&cfg.PollInterval, "poll", durationEnv("NEO_POLL_INTERVAL", 5*time.Second), "poll interval for new blocks")
	flag.Parse()

	log.Printf("neo-indexer (network=%s rpc=%s start=%d poll=%s)", cfg.Network, cfg.RPCURL, cfg.StartHeight, cfg.PollInterval)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	client := newRPCClient(cfg.RPCURL)

	// TODO: wire Postgres store and proper block processing.
	ticker := time.NewTicker(cfg.PollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			height, err := client.getBlockCount(ctx)
			if err != nil {
				log.Printf("neo-indexer: failed to fetch height: %v", err)
				continue
			}
			log.Printf("neo-indexer tick: chain height=%d (stub; persist not implemented)", height)
		case <-ctx.Done():
			return
		}
	}
}

func envDefault(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func durationEnv(key string, def time.Duration) time.Duration {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return def
}

type rpcClient struct {
	url string
}

func newRPCClient(url string) *rpcClient {
	return &rpcClient{url: strings.TrimSpace(url)}
}

type rpcRequest struct {
	JSONRPC string        `json:"jsonrpc"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
	ID      int           `json:"id"`
}

type rpcResponse struct {
	Result json.RawMessage `json:"result"`
	Error  *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func (c *rpcClient) do(ctx context.Context, method string, params []interface{}, out interface{}) error {
	body, _ := json.Marshal(rpcRequest{JSONRPC: "2.0", Method: method, Params: params, ID: 1})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var rpcResp rpcResponse
	if err := json.NewDecoder(resp.Body).Decode(&rpcResp); err != nil {
		return err
	}
	if rpcResp.Error != nil {
		return fmt.Errorf("rpc error %d: %s", rpcResp.Error.Code, rpcResp.Error.Message)
	}
	if out != nil && rpcResp.Result != nil {
		return json.Unmarshal(rpcResp.Result, out)
	}
	return nil
}

func (c *rpcClient) getBlockCount(ctx context.Context) (int64, error) {
	var count int64
	if err := c.do(ctx, "getblockcount", nil, &count); err != nil {
		return 0, err
	}
	return count, nil
}
