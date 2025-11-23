package main

import (
	"context"
	"flag"
	"log"
	"os"
	"strings"
	"time"
)

// Config controls the indexer polling loop.
type Config struct {
	RPCURL     string
	Network    string
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

	// TODO: wire Postgres store and RPC client.
	ticker := time.NewTicker(cfg.PollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			log.Printf("neo-indexer tick (stub) - implement RPC fetch + persist")
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
