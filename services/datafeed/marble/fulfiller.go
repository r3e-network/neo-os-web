// Package neofeeds provides chain push logic for the price feed aggregation service.
package neofeeds

import (
	"context"
	"fmt"
	"math/big"
	"time"
)

// =============================================================================
// Chain Push Logic (Push/Auto-Update Pattern)
// =============================================================================

// DefaultFeeds defines the default price feeds (for backward compatibility).
var DefaultFeeds = []string{
	"BTC-USD",
	"ETH-USD",
	"NEO-USD",
	"GAS-USD",
	"NEO-GAS",
}

// pushPricesToChain fetches all configured prices and pushes them on-chain.
func (s *Service) pushPricesToChain(ctx context.Context) {
	if s == nil {
		return
	}

	// Preferred path: anchor to the platform PriceFeed contract.
	if s.priceFeed != nil && s.priceFeedHash != "" && s.chainSigner != nil {
		s.pushPricesToPriceFeed(ctx)
		return
	}

	// Legacy path (kept for backward compatibility): NeoFeedsService push pattern.
	if s.teeFulfiller == nil || s.neoFeedsHash == "" {
		return
	}

	enabledFeeds := s.GetEnabledFeeds()
	if len(enabledFeeds) == 0 {
		return
	}

	feedIDs := make([]string, 0, len(enabledFeeds))
	prices := make([]*big.Int, 0, len(enabledFeeds))
	timestamps := make([]uint64, 0, len(enabledFeeds))

	for i := range enabledFeeds {
		feed := &enabledFeeds[i]
		pair := feed.Pair
		if pair == "" {
			pair = feedIDToPair(feed.ID)
		}

		price, err := s.GetPrice(ctx, pair)
		if err != nil {
			continue
		}

		// Use Unix seconds to match on-chain Runtime.Time (seconds, not milliseconds)
		timestampSecs := price.Timestamp.Unix()
		if timestampSecs < 0 {
			continue
		}

		feedIDs = append(feedIDs, feed.ID)
		prices = append(prices, big.NewInt(price.Price))
		timestamps = append(timestamps, uint64(timestampSecs))
	}

	if len(feedIDs) == 0 {
		return
	}

	if _, err := s.teeFulfiller.UpdatePrices(ctx, s.neoFeedsHash, feedIDs, prices, timestamps); err != nil {
		s.Logger().WithContext(ctx).WithError(err).WithFields(map[string]interface{}{
			"feeds": len(feedIDs),
		}).Warn("failed to push prices on-chain")
	}
}

// PushSinglePrice pushes a single price update on-chain.
func (s *Service) PushSinglePrice(ctx context.Context, feedID string) error {
	if s.priceFeed != nil && s.priceFeedHash != "" && s.chainSigner != nil {
		price, err := s.GetPrice(ctx, feedID)
		if err != nil {
			return fmt.Errorf("get price: %w", err)
		}
		if price == nil {
			return fmt.Errorf("price unavailable for %s", feedID)
		}

		timestampSecs := price.Timestamp.Unix()
		if timestampSecs < 0 {
			return fmt.Errorf("invalid timestamp for feed %s", feedID)
		}

		sourceSetID := sourceSetIDFromSources(price.Sources)

		s.publishMu.Lock()
		state := s.publishState[feedID]
		if state == nil {
			state = &pricePublishState{}
			s.publishState[feedID] = state
		}
		next := state.lastRoundID + 1
		if next <= 0 {
			next = 1
		}
		s.publishMu.Unlock()

		if _, err := s.priceFeed.Update(ctx, s.chainSigner, feedID, big.NewInt(next), big.NewInt(price.Price), uint64(timestampSecs), s.attestationHash, sourceSetID, true); err != nil {
			return err
		}

		s.publishMu.Lock()
		state = s.publishState[feedID]
		if state == nil {
			state = &pricePublishState{}
			s.publishState[feedID] = state
		}
		state.lastRoundID = next
		state.lastPublishedPrice = price.Price
		state.lastPublishedAt = time.Now()
		state.publishTimes = append(state.publishTimes, state.lastPublishedAt)
		s.publishMu.Unlock()

		return nil
	}

	if s.teeFulfiller == nil || s.neoFeedsHash == "" {
		return fmt.Errorf("chain push not configured")
	}

	pair := feedIDToPair(feedID)
	latest, err := s.GetPrice(ctx, pair)
	if err != nil {
		return fmt.Errorf("get price: %w", err)
	}

	timestampSecs := latest.Timestamp.Unix()
	if timestampSecs < 0 {
		return fmt.Errorf("invalid timestamp for feed %s", feedID)
	}

	_, err = s.teeFulfiller.UpdatePrice(
		ctx,
		s.neoFeedsHash,
		feedID,
		big.NewInt(latest.Price),
		uint64(timestampSecs),
	)
	return err
}

// feedIDToPair converts a feed ID to a trading pair format.
// e.g., "BTC-USD" -> "BTCUSD"
func feedIDToPair(feedID string) string {
	pair := make([]rune, 0, len(feedID))
	for _, c := range feedID {
		switch {
		case c >= '0' && c <= '9':
			pair = append(pair, c)
		case c >= 'A' && c <= 'Z':
			pair = append(pair, c)
		case c >= 'a' && c <= 'z':
			pair = append(pair, c)
		}
	}
	return string(pair)
}
