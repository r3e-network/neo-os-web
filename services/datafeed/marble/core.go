// Package neofeeds provides core logic for the price feed aggregation service.
package neofeeds

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/tidwall/gjson"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/crypto"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/database"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
)

// =============================================================================
// Core Logic
// =============================================================================

// maxPriceCacheEntries caps the number of cached price responses. When exceeded,
// the oldest entries are evicted to keep memory bounded.
const maxPriceCacheEntries = 1000

// priceCacheEntry holds a cached PriceResponse and the time it was fetched.
type priceCacheEntry struct {
	response  *PriceResponse
	fetchedAt time.Time
}

// GetPrice fetches and aggregates price from multiple sources.
//
// Default behavior is to query the configured HTTP sources and aggregate via
// (weighted) median. If Chainlink is configured, it is treated as an optional
// additional source (it does not replace HTTP sources).
func (s *Service) GetPrice(ctx context.Context, pair string) (*PriceResponse, error) {
	normalizedPair := normalizePair(pair)
	if normalizedPair == "" {
		return nil, fmt.Errorf("pair required")
	}

	// Check price cache before hitting upstream sources.
	s.priceCacheMu.RLock()
	if entry, ok := s.priceCache[normalizedPair]; ok && time.Since(entry.fetchedAt) < s.priceCacheTTL {
		s.priceCacheMu.RUnlock()
		return entry.response, nil
	}
	s.priceCacheMu.RUnlock()

	// Deduplicate concurrent upstream fetches for the same pair via singleflight.
	// Use DoChan so each caller can respect its own context cancellation
	// independently of the goroutine that wins the flight.
	ch := s.priceFlight.DoChan(normalizedPair, func() (interface{}, error) {
		// Detach from the winner's context so cancellation of one caller
		// does not abort the shared fetch for all waiters.
		detached := context.WithoutCancel(ctx)

		// Re-check cache inside singleflight: another goroutine may have
		// populated it between the outer check and winning the flight.
		s.priceCacheMu.RLock()
		if entry, ok := s.priceCache[normalizedPair]; ok && time.Since(entry.fetchedAt) < s.priceCacheTTL {
			s.priceCacheMu.RUnlock()
			return entry.response, nil
		}
		s.priceCacheMu.RUnlock()

		return s.fetchAndCachePrice(detached, normalizedPair, pair)
	})

	select {
	case result := <-ch:
		if result.Err != nil {
			return nil, result.Err
		}
		resp, ok := result.Val.(*PriceResponse)
		if !ok {
			return nil, fmt.Errorf("unexpected price response type %T", result.Val)
		}
		return resp, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// fetchAndCachePrice performs the actual upstream fetch, aggregation, signing,
// caching, and DB persistence. It is called from within singleflight.Do so
// concurrent requests for the same pair share a single in-flight fetch.
func (s *Service) fetchAndCachePrice(ctx context.Context, normalizedPair, originalPair string) (*PriceResponse, error) {
	// Try to find feed config for this pair (supports legacy BTC/USD inputs).
	feed := s.findFeedByPair(normalizedPair)

	feedID := normalizedPair
	responsePair := normalizedPair
	if feed != nil {
		feedID = feed.ID
		responsePair = feed.ID
	}

	var prices []float64
	var sources []string
	decimals := 8
	if feed != nil && feed.Decimals > 0 {
		decimals = feed.Decimals
	}

	var wg sync.WaitGroup
	var mu sync.Mutex

	sourcesToUse := s.getSourcesForFeed(feed)

	for _, srcConfig := range sourcesToUse {
		if !s.acquireSourceSlot(ctx) {
			break // context canceled, stop launching goroutines
		}
		wg.Add(1)
		go func(src *SourceConfig) {
			defer func() {
				if r := recover(); r != nil {
					s.Logger().WithField("panic", r).Error("price fetch panicked")
				}
			}()
			defer wg.Done()
			defer s.releaseSourceSlot()

			price, err := s.fetchPriceFromSource(ctx, normalizedPair, feed, src)
			if err != nil {
				s.Logger().WithContext(ctx).WithError(err).WithField("source", src.ID).Warn("failed to fetch price from source")
				return
			}
			if price == 0 {
				s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
					"source": src.ID,
					"pair":   normalizedPair,
				}).Warn("skipping zero price from source (likely non-numeric JSON response)")
				return
			}

			mu.Lock()
			for i := 0; i < src.Weight; i++ {
				prices = append(prices, price)
			}
			sources = append(sources, src.ID)
			mu.Unlock()
		}(srcConfig)
	}

	// Optional Chainlink source (if enabled by configuration).
	if s.chainlinkClient != nil && s.chainlinkClient.HasFeed(feedID) {
		if s.acquireSourceSlot(ctx) {
			wg.Add(1)
			go func() {
				defer func() {
					if r := recover(); r != nil {
						s.Logger().WithField("panic", r).Error("chainlink price fetch panicked")
					}
				}()
				defer wg.Done()
				defer s.releaseSourceSlot()

				price, _, err := s.chainlinkClient.GetPrice(ctx, feedID)
				if err != nil || price <= 0 {
					return
				}

				mu.Lock()
				prices = append(prices, price)
				sources = append(sources, "chainlink")
				mu.Unlock()
			}()
		}
	}

	wg.Wait()

	if len(prices) == 0 {
		return nil, fmt.Errorf("no prices available for %s", normalizedPair)
	}

	medianPrice := s.calculateMedian(prices)
	rawPrice := medianPrice * float64(pow10(decimals))
	if rawPrice > float64(math.MaxInt64) || rawPrice < float64(math.MinInt64) || math.IsNaN(rawPrice) || math.IsInf(rawPrice, 0) {
		return nil, fmt.Errorf("price overflow for %s: %g", normalizedPair, rawPrice)
	}
	priceInt := int64(rawPrice)

	response := &PriceResponse{
		FeedID:    feedID,
		Pair:      responsePair,
		Price:     priceInt,
		Decimals:  decimals,
		Timestamp: time.Now(),
		Sources:   sources,
	}

	if len(s.signingKey) > 0 {
		sig, pub, err := s.signPrice(response)
		if err != nil {
			return nil, fmt.Errorf("sign price: %w", err)
		}
		response.Signature = append([]byte{}, sig...)
		response.PublicKey = append([]byte{}, pub...)
	}

	// Cache the successful response.
	s.priceCacheMu.Lock()
	if len(s.priceCache) >= maxPriceCacheEntries {
		s.evictOldestCacheEntryLocked()
	}
	s.priceCache[normalizedPair] = &priceCacheEntry{
		response:  response,
		fetchedAt: time.Now(),
	}
	s.priceCacheMu.Unlock()

	if s.DB() != nil {
		if err := s.DB().CreatePriceFeed(ctx, &database.PriceFeed{
			ID:        uuid.New().String(),
			FeedID:    feedID,
			Pair:      responsePair,
			Price:     priceInt,
			Decimals:  response.Decimals,
			Timestamp: response.Timestamp,
			Sources:   response.Sources,
			Signature: response.Signature,
		}); err != nil {
			fields := map[string]interface{}{
				"feed_id": feedID,
				"pair":    originalPair,
			}
			if isDuplicatePriceFeedError(err) {
				// feed_id is unique in price_feeds, so repeated snapshots are
				// expected to collide. Treat duplicates as idempotent.
				s.Logger().WithContext(ctx).WithError(err).WithFields(fields).Debug("price feed already exists; skipping create")
			} else {
				s.Logger().WithContext(ctx).WithError(err).WithFields(fields).Warn("failed to persist price feed")
			}
		}
	}

	return response, nil
}

// evictOldestCacheEntryLocked removes the cache entry with the oldest fetchedAt.
// Caller must hold s.priceCacheMu write lock.
func (s *Service) evictOldestCacheEntryLocked() {
	var oldestKey string
	var oldestTime time.Time
	first := true
	for k, v := range s.priceCache {
		if first || v.fetchedAt.Before(oldestTime) {
			oldestKey = k
			oldestTime = v.fetchedAt
			first = false
		}
	}
	if oldestKey != "" {
		delete(s.priceCache, oldestKey)
	}
}

func isDuplicatePriceFeedError(err error) bool {
	if err == nil {
		return false
	}

	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate") && strings.Contains(msg, "23505")
}

// findFeedByPair finds a feed config by pair or feed ID.
func (s *Service) findFeedByPair(pair string) *FeedConfig {
	query := normalizePair(pair)
	if query == "" {
		return nil
	}

	for i := range s.config.Feeds {
		f := &s.config.Feeds[i]
		if strings.EqualFold(f.Pair, query) || strings.EqualFold(f.ID, query) {
			return f
		}

		// Defensive: allow matching even if config contains legacy delimiters.
		if normalizePair(f.Pair) == query || normalizePair(f.ID) == query {
			return f
		}
	}
	return nil
}

// getSourcesForFeed returns sources to use for a feed.
func (s *Service) getSourcesForFeed(feed *FeedConfig) []*SourceConfig {
	if feed != nil && len(feed.Sources) > 0 {
		sources := make([]*SourceConfig, 0, len(feed.Sources))
		for _, srcID := range feed.Sources {
			if src := s.sources[srcID]; src != nil {
				sources = append(sources, src)
			}
		}
		return sources
	}
	// Return all sources if no feed config
	sources := make([]*SourceConfig, 0, len(s.sources))
	for _, src := range s.sources {
		sources = append(sources, src)
	}
	return sources
}

// fetchPriceFromSource fetches price from a single source.
func (s *Service) fetchPriceFromSource(ctx context.Context, pair string, feed *FeedConfig, src *SourceConfig) (float64, error) {
	if src != nil && strings.EqualFold(strings.TrimSpace(src.ID), "yahoo") && feed != nil {
		return s.fetchYahooPrice(ctx, pair, feed, src)
	}

	url := formatSourceURLNew(src.URL, pair, feed, src)

	timeout := src.Timeout
	if timeout <= 0 {
		timeout = 10 * time.Second
	}

	requestCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	if s.strictMode && !allowPrivateSourceTargets() {
		if err := validateSourceURL(requestCtx, url); err != nil {
			return 0, err
		}
	}

	req, err := http.NewRequestWithContext(requestCtx, http.MethodGet, url, http.NoBody)
	if err != nil {
		return 0, err
	}

	for k, v := range src.Headers {
		req.Header.Set(k, resolveEnvVar(v))
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, truncated, readErr := httputil.ReadAllWithLimit(resp.Body, 32<<10)
		if readErr != nil {
			return 0, readErr
		}
		msg := strings.TrimSpace(string(respBody))
		if truncated {
			msg += "...(truncated)"
		}
		return 0, fmt.Errorf("price source returned HTTP %d: %s", resp.StatusCode, msg)
	}

	body, err := httputil.ReadAllStrict(resp.Body, 1<<20)
	if err != nil {
		return 0, err
	}

	jsonPath := formatJSONPath(src.JSONPath, feed, src)
	result := gjson.GetBytes(body, jsonPath)
	if !result.Exists() {
		return 0, fmt.Errorf("price not found in response")
	}

	price, err := parsePriceResult(result)
	if err != nil {
		return 0, err
	}
	return price, nil
}

func (s *Service) fetchYahooPrice(ctx context.Context, pair string, feed *FeedConfig, src *SourceConfig) (float64, error) {
	symbol := yahooSymbolForFeed(pair, feed, src)
	if symbol == "" {
		return 0, fmt.Errorf("yahoo symbol not resolved")
	}

	prices, err := s.getYahooQuoteMap(ctx, src)
	if err != nil {
		return 0, err
	}

	price, ok := prices[symbol]
	if !ok || price <= 0 {
		return 0, fmt.Errorf("price not found in yahoo response for %s", symbol)
	}

	return price, nil
}

func (s *Service) getYahooQuoteMap(ctx context.Context, src *SourceConfig) (map[string]float64, error) {
	s.yahooCacheMu.Lock()
	defer s.yahooCacheMu.Unlock()

	now := time.Now()
	if len(s.yahooQuoteCache) > 0 && now.Sub(s.yahooCacheFetchedAt) < s.yahooCacheTTL {
		return clonePriceMap(s.yahooQuoteCache), nil
	}
	if len(s.yahooQuoteCache) == 0 && !s.yahooRetryAfter.IsZero() && now.Before(s.yahooRetryAfter) {
		return nil, fmt.Errorf("yahoo refresh backoff active")
	}

	prices, err := s.refreshYahooQuoteMap(ctx, src)
	if err != nil {
		s.yahooRetryAfter = now.Add(s.yahooCacheTTL)
		// Prefer stale cache over hard failure when upstream temporarily limits us.
		if len(s.yahooQuoteCache) > 0 {
			return clonePriceMap(s.yahooQuoteCache), nil
		}
		return nil, err
	}

	s.yahooQuoteCache = prices
	s.yahooCacheFetchedAt = now
	s.yahooRetryAfter = time.Time{}
	return clonePriceMap(s.yahooQuoteCache), nil
}

func (s *Service) refreshYahooQuoteMap(ctx context.Context, src *SourceConfig) (map[string]float64, error) {
	symbols := s.yahooQuoteSymbols()
	if len(symbols) == 0 {
		return nil, fmt.Errorf("no yahoo symbols configured")
	}

	url := buildYahooBatchURL(src, symbols)
	timeout := 10 * time.Second
	if src != nil && src.Timeout > 0 {
		timeout = src.Timeout
	}

	requestCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(requestCtx, http.MethodGet, url, http.NoBody)
	if err != nil {
		return nil, err
	}
	if src != nil {
		for k, v := range src.Headers {
			req.Header.Set(k, resolveEnvVar(v))
		}
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, truncated, readErr := httputil.ReadAllWithLimit(resp.Body, 32<<10)
		if readErr != nil {
			return nil, readErr
		}
		msg := strings.TrimSpace(string(respBody))
		if truncated {
			msg += "...(truncated)"
		}
		return nil, fmt.Errorf("price source returned HTTP %d: %s", resp.StatusCode, msg)
	}

	body, err := httputil.ReadAllStrict(resp.Body, 1<<20)
	if err != nil {
		return nil, err
	}

	items := gjson.GetBytes(body, "quoteResponse.result").Array()
	if len(items) == 0 {
		return nil, fmt.Errorf("price not found in response")
	}

	prices := make(map[string]float64, len(items))
	for _, item := range items {
		symbol := strings.ToUpper(strings.TrimSpace(item.Get("symbol").String()))
		price := item.Get("regularMarketPrice").Float()
		if symbol == "" || price <= 0 {
			continue
		}
		prices[symbol] = price
	}
	if len(prices) == 0 {
		return nil, fmt.Errorf("price not found in response")
	}

	return prices, nil
}

func (s *Service) yahooQuoteSymbols() []string {
	feeds := s.GetEnabledFeeds()
	if len(feeds) == 0 {
		return nil
	}

	seen := make(map[string]struct{}, len(feeds))
	symbols := make([]string, 0, len(feeds))
	for i := range feeds {
		feed := feeds[i]
		if !feedUsesSource(feed, "yahoo") {
			continue
		}

		symbol := strings.ToUpper(strings.TrimSpace(feed.Base))
		if symbol == "" {
			base, _ := parseBaseQuoteFromPair(feed.ID)
			symbol = strings.ToUpper(strings.TrimSpace(base))
		}
		if symbol == "" {
			continue
		}
		if _, ok := seen[symbol]; ok {
			continue
		}
		seen[symbol] = struct{}{}
		symbols = append(symbols, symbol)
	}
	sort.Strings(symbols)
	return symbols
}

func feedUsesSource(feed FeedConfig, sourceID string) bool {
	for _, src := range feed.Sources {
		if strings.EqualFold(strings.TrimSpace(src), strings.TrimSpace(sourceID)) {
			return true
		}
	}
	return false
}

func yahooSymbolForFeed(pair string, feed *FeedConfig, src *SourceConfig) string {
	symbol := ""
	if feed != nil {
		symbol = strings.TrimSpace(feed.Base)
	}
	if symbol == "" {
		base, _ := parseBaseQuoteFromPair(pair)
		symbol = base
	}
	if src != nil {
		if override := strings.TrimSpace(src.BaseOverride); override != "" {
			symbol = override
		}
	}
	return strings.ToUpper(strings.TrimSpace(symbol))
}

func buildYahooBatchURL(src *SourceConfig, symbols []string) string {
	joined := strings.Join(symbols, ",")
	escaped := url.QueryEscape(joined)

	template := ""
	if src != nil {
		template = strings.TrimSpace(src.URL)
	}
	if template == "" {
		template = "https://query1.finance.yahoo.com/v7/finance/quote?symbols={symbols}"
	}

	switch {
	case strings.Contains(template, "{symbols}"):
		return strings.ReplaceAll(template, "{symbols}", escaped)
	case strings.Contains(template, "{base}"):
		url := strings.ReplaceAll(template, "{base}", escaped)
		url = strings.ReplaceAll(url, "{quote}", "")
		url = strings.ReplaceAll(url, "{pair}", escaped)
		return url
	default:
		sep := "?"
		if strings.Contains(template, "?") {
			sep = "&"
		}
		return template + sep + "symbols=" + escaped
	}
}

func clonePriceMap(in map[string]float64) map[string]float64 {
	out := make(map[string]float64, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}

func (s *Service) fetchPrice(ctx context.Context, pair string, source PriceSource) (float64, error) {
	url := formatSourceURL(source.URL, pair)

	requestCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(requestCtx, http.MethodGet, url, http.NoBody)
	if err != nil {
		return 0, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, truncated, readErr := httputil.ReadAllWithLimit(resp.Body, 32<<10)
		if readErr != nil {
			return 0, readErr
		}
		msg := strings.TrimSpace(string(respBody))
		if truncated {
			msg += "...(truncated)"
		}
		return 0, fmt.Errorf("price source returned HTTP %d: %s", resp.StatusCode, msg)
	}

	body, err := httputil.ReadAllStrict(resp.Body, 1<<20)
	if err != nil {
		return 0, err
	}

	result := gjson.GetBytes(body, source.JSONPath)
	if !result.Exists() {
		return 0, fmt.Errorf("price not found in response")
	}

	price, err := parsePriceResult(result)
	if err != nil {
		return 0, err
	}
	return price, nil
}

func (s *Service) calculateMedian(prices []float64) float64 {
	sort.Float64s(prices)
	n := len(prices)
	if n%2 == 0 {
		return (prices[n/2-1] + prices[n/2]) / 2
	}
	return prices[n/2]
}

func (s *Service) signPrice(price *PriceResponse) (signature, publicKey []byte, err error) {
	if s.signingPrivKey == nil {
		return nil, nil, fmt.Errorf("signing key not initialized")
	}

	data, err := json.Marshal(map[string]interface{}{
		"pair":      price.Pair,
		"price":     price.Price,
		"decimals":  price.Decimals,
		"timestamp": price.Timestamp.Unix(),
	})
	if err != nil {
		return nil, nil, fmt.Errorf("marshal signature payload: %w", err)
	}

	signature, err = crypto.Sign(s.signingPrivKey, data)
	if err != nil {
		return nil, nil, err
	}
	return signature, s.signingPubKey, nil
}

func formatSourceURL(tmpl, pair string) string {
	safe := url.QueryEscape(pair)
	if strings.Contains(tmpl, "%sPAIR%s") {
		return strings.ReplaceAll(tmpl, "%sPAIR%s", safe)
	}
	return strings.ReplaceAll(tmpl, "{pair}", safe)
}

// formatSourceURLNew formats URL template with feed-specific placeholders.
func formatSourceURLNew(tmpl, pair string, feed *FeedConfig, src *SourceConfig) string {
	u := tmpl

	base := ""
	quote := ""
	if feed != nil {
		base = strings.TrimSpace(feed.Base)
		quote = strings.TrimSpace(feed.Quote)
	}
	if base == "" || quote == "" {
		parsedBase, parsedQuote := parseBaseQuoteFromPair(pair)
		if base == "" {
			base = parsedBase
		}
		if quote == "" {
			quote = parsedQuote
		}
	}

	base = strings.ToUpper(strings.TrimSpace(base))
	quote = strings.ToUpper(strings.TrimSpace(quote))

	if src != nil {
		if v := strings.TrimSpace(src.BaseOverride); v != "" {
			base = strings.ToUpper(v)
		}
		if v := strings.TrimSpace(src.QuoteOverride); v != "" {
			quote = strings.ToUpper(v)
		}
	}

	pairValue := strings.TrimSpace(pair)
	if feed != nil && strings.TrimSpace(feed.Pair) != "" {
		pairValue = strings.TrimSpace(feed.Pair)
	}
	if src != nil && strings.TrimSpace(src.PairTemplate) != "" {
		pairValue = strings.TrimSpace(src.PairTemplate)
		pairValue = strings.ReplaceAll(pairValue, "{base}", base)
		pairValue = strings.ReplaceAll(pairValue, "{quote}", quote)
	}

	safePair := url.QueryEscape(pairValue)
	safeBase := url.QueryEscape(base)
	safeQuote := url.QueryEscape(quote)

	u = strings.ReplaceAll(u, "{pair}", safePair)
	u = strings.ReplaceAll(u, "{base}", safeBase)
	u = strings.ReplaceAll(u, "{quote}", safeQuote)

	// Legacy format support
	if strings.Contains(u, "%sPAIR%s") {
		u = strings.ReplaceAll(u, "%sPAIR%s", safePair)
	}

	return u
}

// formatJSONPath formats JSON path with feed-specific placeholders.
func formatJSONPath(tmpl string, feed *FeedConfig, src *SourceConfig) string {
	if tmpl == "" {
		return tmpl
	}

	base := ""
	quote := ""
	if feed != nil {
		base = strings.TrimSpace(feed.Base)
		quote = strings.TrimSpace(feed.Quote)
	}
	base = strings.ToUpper(base)
	quote = strings.ToUpper(quote)

	if src != nil {
		if v := strings.TrimSpace(src.BaseOverride); v != "" {
			base = strings.ToUpper(v)
		}
		if v := strings.TrimSpace(src.QuoteOverride); v != "" {
			quote = strings.ToUpper(v)
		}
	}

	path := tmpl
	if base != "" {
		path = strings.ReplaceAll(path, "{base}", base)
	}
	if quote != "" {
		path = strings.ReplaceAll(path, "{quote}", quote)
	}
	return path
}

func parsePriceResult(result gjson.Result) (float64, error) {
	switch result.Type {
	case gjson.Number:
		price := result.Float()
		if price <= 0 || math.IsNaN(price) || math.IsInf(price, 0) {
			return 0, fmt.Errorf("price not found in response")
		}
		return price, nil
	default:
		raw := strings.TrimSpace(result.String())
		if raw == "" {
			return 0, fmt.Errorf("price not found in response")
		}

		normalized := normalizeNumericString(raw)
		if normalized == "" {
			return 0, fmt.Errorf("price not found in response")
		}

		price, err := strconv.ParseFloat(normalized, 64)
		if err != nil || price <= 0 || math.IsNaN(price) || math.IsInf(price, 0) {
			return 0, fmt.Errorf("price not found in response")
		}
		return price, nil
	}
}

func normalizeNumericString(raw string) string {
	var b strings.Builder
	b.Grow(len(raw))

	dotSeen := false
	signWritten := false
	for i, r := range raw {
		switch {
		case r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == '.' && !dotSeen:
			b.WriteRune(r)
			dotSeen = true
		case (r == '-' || r == '+') && !signWritten && i == 0:
			b.WriteRune(r)
			signWritten = true
		}
	}

	return strings.TrimSpace(b.String())
}

func (s *Service) acquireSourceSlot(ctx context.Context) bool {
	if s == nil || s.sourceSem == nil {
		return true
	}
	select {
	case s.sourceSem <- struct{}{}:
		return true
	case <-ctx.Done():
		return false
	}
}

func (s *Service) releaseSourceSlot() {
	if s == nil || s.sourceSem == nil {
		return
	}
	<-s.sourceSem
}

func allowPrivateSourceTargets() bool {
	raw := strings.ToLower(strings.TrimSpace(os.Getenv("NEOFEEDS_ALLOW_PRIVATE_NETWORKS")))
	return raw == "1" || raw == "true" || raw == "yes"
}

func validateSourceURL(ctx context.Context, rawURL string) error {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return fmt.Errorf("invalid source url")
	}
	if parsed.User != nil {
		return fmt.Errorf("source url must not include userinfo")
	}

	host := strings.ToLower(strings.TrimSuffix(parsed.Hostname(), "."))
	if host == "" {
		return fmt.Errorf("source url must include hostname")
	}
	if host == "localhost" || strings.HasSuffix(host, ".localhost") {
		return fmt.Errorf("source hostname not allowed in strict identity mode")
	}

	if ip := net.ParseIP(host); ip != nil {
		if isDisallowedSourceIP(ip) {
			return fmt.Errorf("source target IP not allowed in strict identity mode")
		}
		return nil
	}

	lookupCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	addrs, err := net.DefaultResolver.LookupIPAddr(lookupCtx, host)
	if err != nil {
		return fmt.Errorf("failed to resolve source hostname: %w", err)
	}
	if len(addrs) == 0 {
		return fmt.Errorf("failed to resolve source hostname: no addresses found")
	}

	for _, addr := range addrs {
		if isDisallowedSourceIP(addr.IP) {
			return fmt.Errorf("source hostname resolves to a private or local IP which is not allowed in strict identity mode")
		}
	}
	return nil
}

func isDisallowedSourceIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsMulticast() || ip.IsUnspecified() {
		return true
	}
	if ip.IsPrivate() {
		return true
	}

	// Carrier-grade NAT (RFC 6598): 100.64.0.0/10
	if ip4 := ip.To4(); ip4 != nil {
		if ip4[0] == 100 && ip4[1] >= 64 && ip4[1] <= 127 {
			return true
		}
	}

	return false
}

// pow10 returns 10^n. For n > 18 it returns math.MaxInt64 to avoid silent overflow
// (int64 max is ~9.2e18, i.e. just under 10^19).
func pow10(n int) int64 {
	if n > 18 {
		return math.MaxInt64
	}
	result := int64(1)
	for i := 0; i < n; i++ {
		result *= 10
	}
	return result
}

// resolveEnvVar resolves ${VAR_NAME} placeholders with environment values.
func resolveEnvVar(value string) string {
	if strings.HasPrefix(value, "${") && strings.HasSuffix(value, "}") {
		envKey := value[2 : len(value)-1]
		if envVal := os.Getenv(envKey); envVal != "" {
			return envVal
		}
	}
	return value
}
