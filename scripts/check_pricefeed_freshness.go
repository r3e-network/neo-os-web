//go:build scripts

// Check on-chain PriceFeed freshness and fail when non-exempt symbols are stale.
//
// Optional env:
//
//	PRICEFEED_WATCH_SYMBOLS=BTC-USD,ETH-USD,SOL-USD,XRP-USD,DOGE-USD,GAS-USD,NEO-USD
//	PRICEFEED_WATCH_MAX_STALENESS=30m
//	PRICEFEED_WATCH_EXEMPT_SYMBOLS=USDT-USD,USDC-USD
//	PRICEFEED_WATCH_DURATION=0s
//	PRICEFEED_WATCH_POLL_INTERVAL=10s
//	PRICEFEED_WATCH_REQUIRE_PROGRESS_SYMBOLS=BTC-USD,ETH-USD
package main

import (
	"context"
	"fmt"
	"math/big"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/chain"
)

type snapshot struct {
	round *big.Int
	ts    uint64
}

func main() {
	ctx := context.Background()

	rpcURL := envOrDefault("NEO_RPC_URL", "https://testnet1.neo.coz.io:443")
	priceFeedHash := strings.TrimSpace(os.Getenv("CONTRACT_PRICEFEED_HASH"))
	if priceFeedHash == "" {
		fatal("CONTRACT_PRICEFEED_HASH is required")
	}

	magic := uint32(894710606)
	if raw := strings.TrimSpace(os.Getenv("NEO_NETWORK_MAGIC")); raw != "" {
		parsed, err := strconv.ParseUint(raw, 10, 32)
		if err != nil {
			fatal("invalid NEO_NETWORK_MAGIC %q: %v", raw, err)
		}
		magic = uint32(parsed)
	}

	symbols := splitCSV(envOrDefault("PRICEFEED_WATCH_SYMBOLS", "BTC-USD,ETH-USD,SOL-USD,XRP-USD,DOGE-USD,GAS-USD,NEO-USD"))
	if len(symbols) == 0 {
		fatal("PRICEFEED_WATCH_SYMBOLS is empty")
	}

	exemptSymbols := splitCSV(os.Getenv("PRICEFEED_WATCH_EXEMPT_SYMBOLS"))
	exemptSet := make(map[string]struct{}, len(exemptSymbols))
	for _, symbol := range exemptSymbols {
		exemptSet[symbol] = struct{}{}
	}

	maxStaleness := parseDurationOrDefault("PRICEFEED_WATCH_MAX_STALENESS", 30*time.Minute)
	duration := parseDurationOrDefault("PRICEFEED_WATCH_DURATION", 0)
	interval := parseDurationOrDefault("PRICEFEED_WATCH_POLL_INTERVAL", 10*time.Second)
	requireProgressSymbols := splitCSV(os.Getenv("PRICEFEED_WATCH_REQUIRE_PROGRESS_SYMBOLS"))

	client, err := chain.NewClient(chain.Config{
		RPCURL:    rpcURL,
		NetworkID: magic,
		Timeout:   20 * time.Second,
	})
	if err != nil {
		fatal("create chain client: %v", err)
	}
	contract := chain.NewPriceFeedContract(client, priceFeedHash)

	fmt.Println("PriceFeed freshness check")
	fmt.Printf("RPC: %s\n", rpcURL)
	fmt.Printf("Contract: %s\n", priceFeedHash)
	fmt.Printf("Symbols: %s\n", strings.Join(symbols, ", "))
	fmt.Printf("Max staleness: %s\n", maxStaleness)
	if len(exemptSymbols) > 0 {
		fmt.Printf("Exempt symbols: %s\n", strings.Join(exemptSymbols, ", "))
	}

	failed := false
	initial := make(map[string]snapshot, len(symbols))
	now := time.Now().UTC()

	for _, symbol := range symbols {
		rec, err := contract.GetLatest(ctx, symbol)
		if err != nil {
			fmt.Printf("FAIL %-8s fetch failed: %v\n", symbol, err)
			failed = true
			continue
		}

		round := big.NewInt(0)
		if rec.RoundID != nil {
			round = new(big.Int).Set(rec.RoundID)
		}
		initial[symbol] = snapshot{round: round, ts: rec.Timestamp}

		age := now.Sub(time.Unix(int64(rec.Timestamp), 0))
		_, exempt := exemptSet[symbol]
		if rec.Timestamp == 0 || age > maxStaleness {
			if exempt {
				fmt.Printf("WARN %-8s stale but exempt (round=%s age=%s)\n", symbol, round.String(), age.Truncate(time.Second))
			} else {
				fmt.Printf("FAIL %-8s stale (round=%s age=%s)\n", symbol, round.String(), age.Truncate(time.Second))
				failed = true
			}
		} else {
			fmt.Printf("OK   %-8s round=%s age=%s\n", symbol, round.String(), age.Truncate(time.Second))
		}
	}

	if duration > 0 && len(requireProgressSymbols) > 0 {
		fmt.Printf("Progress check: duration=%s interval=%s symbols=%s\n", duration, interval, strings.Join(requireProgressSymbols, ", "))

		progressSeen := make(map[string]bool, len(requireProgressSymbols))
		deadline := time.Now().Add(duration)
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for time.Now().Before(deadline) {
			<-ticker.C
			for _, symbol := range requireProgressSymbols {
				if progressSeen[symbol] {
					continue
				}
				rec, err := contract.GetLatest(ctx, symbol)
				if err != nil {
					continue
				}

				currentRound := big.NewInt(0)
				if rec.RoundID != nil {
					currentRound = rec.RoundID
				}
				if start, ok := initial[symbol]; ok && currentRound.Cmp(start.round) > 0 {
					progressSeen[symbol] = true
					fmt.Printf("UPD  %-8s round %s -> %s\n", symbol, start.round.String(), currentRound.String())
				}
			}
		}

		for _, symbol := range requireProgressSymbols {
			if !progressSeen[symbol] {
				fmt.Printf("FAIL %-8s no round progress observed in %s\n", symbol, duration)
				failed = true
			}
		}
	}

	if failed {
		os.Exit(1)
	}
	fmt.Println("Freshness check passed.")
}

func splitCSV(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		v := strings.ToUpper(strings.TrimSpace(part))
		if v != "" {
			out = append(out, v)
		}
	}
	return out
}

func parseDurationOrDefault(key string, fallback time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	d, err := time.ParseDuration(raw)
	if err != nil || d < 0 {
		return fallback
	}
	return d
}

func envOrDefault(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func fatal(format string, args ...interface{}) {
	fmt.Printf("ERROR: "+format+"\n", args...)
	os.Exit(1)
}
