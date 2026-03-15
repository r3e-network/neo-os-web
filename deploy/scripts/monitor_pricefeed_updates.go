//go:build scripts

// Monitor on-chain PriceFeed updates for configured symbols.
//
// Usage:
//
//	set -a; source .env; set +a
//	go run -tags=scripts scripts/monitor_pricefeed_updates.go
//
// Optional env:
//
//	PRICEFEED_SYMBOLS=BTC-USD,ETH-USD,NEO-USD
//	PRICEFEED_MONITOR_DURATION=5m
//	PRICEFEED_MONITOR_INTERVAL=5s
//	PRICEFEED_MAX_STALENESS=15m
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

type feedSnapshot struct {
	round *big.Int
	price *big.Int
	ts    uint64
}

func main() {
	ctx := context.Background()

	rpcURL := envOrDefault("NEO_RPC_URL", "https://testnet1.neo.coz.io:443")
	hash := strings.TrimSpace(os.Getenv("CONTRACT_PRICEFEED_HASH"))
	if hash == "" {
		fatal("CONTRACT_PRICEFEED_HASH is required")
	}

	magic := uint32(894710606) // N3 testnet
	if raw := strings.TrimSpace(os.Getenv("NEO_NETWORK_MAGIC")); raw != "" {
		parsed, err := strconv.ParseUint(raw, 10, 32)
		if err != nil {
			fatal("invalid NEO_NETWORK_MAGIC %q: %v", raw, err)
		}
		magic = uint32(parsed)
	}

	symbols := splitCSV(envOrDefault("PRICEFEED_SYMBOLS", "BTC-USD,ETH-USD,NEO-USD,GAS-USD"))
	if len(symbols) == 0 {
		fatal("PRICEFEED_SYMBOLS is empty")
	}

	monitorDuration := parseDurationOrDefault("PRICEFEED_MONITOR_DURATION", 3*time.Minute)
	interval := parseDurationOrDefault("PRICEFEED_MONITOR_INTERVAL", 5*time.Second)
	maxStaleness := parseDurationOrDefault("PRICEFEED_MAX_STALENESS", 15*time.Minute)

	client, err := chain.NewClient(chain.Config{
		RPCURL:    rpcURL,
		NetworkID: magic,
		Timeout:   20 * time.Second,
	})
	if err != nil {
		fatal("connect chain client: %v", err)
	}
	feed := chain.NewPriceFeedContract(client, hash)

	fmt.Println("Monitoring PriceFeed updates")
	fmt.Printf("RPC: %s\n", rpcURL)
	fmt.Printf("Contract: %s\n", hash)
	fmt.Printf("Symbols: %s\n", strings.Join(symbols, ", "))
	fmt.Printf("Duration: %s | Interval: %s | Max staleness: %s\n", monitorDuration, interval, maxStaleness)

	snapshots := make(map[string]feedSnapshot, len(symbols))
	updateCounts := make(map[string]int, len(symbols))

	now := time.Now().UTC()
	for _, symbol := range symbols {
		rec, err := feed.GetLatest(ctx, symbol)
		if err != nil {
			fatal("initial getLatest(%s): %v", symbol, err)
		}
		snapshots[symbol] = toSnapshot(rec)
		fmt.Printf("INIT %-8s round=%s price=%s ts=%s\n", symbol, asDec(rec.RoundID), asDec(rec.Price), formatTimestamp(rec.Timestamp))

		age := now.Sub(time.Unix(int64(rec.Timestamp), 0))
		if rec.Timestamp == 0 || age > maxStaleness {
			fmt.Printf("WARN %-8s stale on-chain record (age=%s)\n", symbol, age.Truncate(time.Second))
		}
	}

	deadline := time.Now().Add(monitorDuration)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for time.Now().Before(deadline) {
		<-ticker.C
		now = time.Now().UTC()

		for _, symbol := range symbols {
			rec, err := feed.GetLatest(ctx, symbol)
			if err != nil {
				fmt.Printf("WARN %-8s getLatest failed: %v\n", symbol, err)
				continue
			}

			prev := snapshots[symbol]
			curr := toSnapshot(rec)
			snapshots[symbol] = curr

			roundAdvanced := curr.round.Cmp(prev.round) > 0
			age := now.Sub(time.Unix(int64(curr.ts), 0))
			if roundAdvanced {
				updateCounts[symbol]++
				fmt.Printf(
					"UPD  %-8s round %s -> %s | price %s -> %s | change=%s bps | age=%s\n",
					symbol,
					prev.round.String(),
					curr.round.String(),
					prev.price.String(),
					curr.price.String(),
					changeBPSString(prev.price, curr.price),
					age.Truncate(time.Second),
				)
			}
			if curr.ts == 0 || age > maxStaleness {
				fmt.Printf("WARN %-8s stale on-chain record (age=%s)\n", symbol, age.Truncate(time.Second))
			}
		}
	}

	fmt.Println("\nSummary")
	totalUpdates := 0
	for _, symbol := range symbols {
		count := updateCounts[symbol]
		totalUpdates += count
		final := snapshots[symbol]
		fmt.Printf(" - %-8s updates=%d final_round=%s final_ts=%s\n", symbol, count, final.round.String(), formatTimestamp(final.ts))
	}
	if totalUpdates == 0 {
		fmt.Println("No round updates observed in window (can be normal if market movement never crossed the configured threshold).")
	}
}

func toSnapshot(rec *chain.PriceFeedRecord) feedSnapshot {
	if rec == nil {
		return feedSnapshot{
			round: big.NewInt(0),
			price: big.NewInt(0),
			ts:    0,
		}
	}

	round := big.NewInt(0)
	if rec.RoundID != nil {
		round = new(big.Int).Set(rec.RoundID)
	}
	price := big.NewInt(0)
	if rec.Price != nil {
		price = new(big.Int).Set(rec.Price)
	}

	return feedSnapshot{
		round: round,
		price: price,
		ts:    rec.Timestamp,
	}
}

func asDec(v *big.Int) string {
	if v == nil {
		return "0"
	}
	return v.String()
}

func changeBPSString(oldPrice, newPrice *big.Int) string {
	if oldPrice == nil || newPrice == nil || oldPrice.Sign() <= 0 || newPrice.Sign() <= 0 {
		return "n/a"
	}
	diff := new(big.Int).Sub(newPrice, oldPrice)
	diff.Abs(diff)

	n := new(big.Int).Mul(diff, big.NewInt(10000))
	n.Div(n, oldPrice)
	return n.String()
}

func formatTimestamp(ts uint64) string {
	if ts == 0 {
		return "0"
	}
	return time.Unix(int64(ts), 0).UTC().Format(time.RFC3339)
}

func parseDurationOrDefault(key string, fallback time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(raw)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func splitCSV(raw string) []string {
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
