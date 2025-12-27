package datafeed_test

import (
	"context"
	"testing"
	"time"

	"github.com/R3E-Network/service_layer/infrastructure/datafeed"
)

func TestFetchSinglePrice(t *testing.T) {
	client, err := datafeed.NewClient("", "arbitrum")
	if err != nil {
		t.Fatalf("create client: %v", err)
	}
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Fetch ETH/USD price
	feed := datafeed.FeedConfig{
		Symbol:   "ETH/USD",
		Address:  "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
		Decimals: 8,
	}

	price, err := client.FetchPrice(ctx, feed)
	if err != nil {
		t.Fatalf("fetch price: %v", err)
	}

	t.Logf("ETH/USD: %s (round %d, updated %v)",
		datafeed.FormatPrice(price.Price.Int64(), price.Decimals),
		price.RoundID,
		price.Timestamp)
}

func TestFetchAllPrices(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	client, err := datafeed.NewClient("", "arbitrum")
	if err != nil {
		t.Fatalf("create client: %v", err)
	}
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	batch, err := client.FetchAllPrices(ctx)
	if err != nil {
		t.Fatalf("fetch all: %v", err)
	}

	t.Logf("Fetched %d prices from %s", len(batch.Prices), batch.Network)
	for _, p := range batch.Prices[:5] { // Show first 5
		t.Logf("  %s: %s", p.Symbol,
			datafeed.FormatPrice(p.Price.Int64(), p.Decimals))
	}
}

func TestPrepareForBatchUpdate(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	svc, err := datafeed.NewService(datafeed.ServiceConfig{
		Network:  "arbitrum",
		CacheTTL: 30 * time.Second,
	})
	if err != nil {
		t.Fatalf("create service: %v", err)
	}
	defer svc.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	params, err := svc.PrepareForBatchUpdate(ctx)
	if err != nil {
		t.Fatalf("prepare batch: %v", err)
	}

	t.Logf("Prepared %d feeds for BatchUpdate", len(params.Symbols))
	t.Logf("Batch attestation: %s", params.GetAttestationHashHex())
}
