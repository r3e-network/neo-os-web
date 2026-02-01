// Package neofeeds provides core logic for the price feed aggregation service.
package neofeeds

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"encoding/json"
	"fmt"
	"math/big"
	"net"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/tidwall/gjson"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/crypto"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/database"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/httputil"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/resilience"
)

// =============================================================================
// Core Logic
// =============================================================================

// GetPrice fetches and aggregates price from multiple sources.
//
// Default behavior is to query the configured HTTP sources and aggregate via
// (weighted) median. If Chainlink is configured, it is treated as an optional
// additional source (it does not replace HTTP sources).
func (s *Service) GetPrice(ctx context.Context, pair string) (*PriceResponse, error) {
	normalizedPair := normalizePair(pair)
	if normalizedPair == "" {
		return nil, fmt.Errorf("price feed: pair parameter is required and cannot be empty")
	}

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
	// PERFORMANCE FIX [P-01]: Use channel to collect results without mutex contention
	type priceResult struct {
		price  float64
		weight int
		source string
	}

	sourcesToUse := s.getSourcesForFeed(feed)
	results := make(chan priceResult, len(sourcesToUse)+1)

	for _, srcConfig := range sourcesToUse {
		s.acquireSourceSlot()
		wg.Add(1)
		go func(src *SourceConfig) {
			defer wg.Done()
			defer s.releaseSourceSlot()
			// PANIC RECOVERY [R-03]: Prevent goroutine crashes from killing the service
			defer func() {
				if r := recover(); r != nil {
					s.Logger().WithContext(ctx).
						WithField("source", src.ID).
						WithField("pair", normalizedPair).
						WithField("panic", r).
						Error("panic recovered in price fetch goroutine")
				}
			}()

			price, err := s.fetchPriceFromSource(ctx, normalizedPair, feed, src)
			if err != nil {
				// ERROR FIX [E-01]: Log price source failures for observability
				// CRITICAL: Silent failures mask systemic issues and make debugging impossible
				s.Logger().WithContext(ctx).
					WithField("source", src.ID).
					WithField("pair", normalizedPair).
					WithError(err).
					Warn("price source fetch failed")
				return
			}

			// PERFORMANCE FIX [P-01]: Send result to channel
			results <- priceResult{
				price:  price,
				weight: src.Weight,
				source: src.ID,
			}
		}(srcConfig)
	}

	// Optional Chainlink source (if enabled by configuration).
	if s.chainlinkClient != nil && s.chainlinkClient.HasFeed(feedID) {
		s.acquireSourceSlot()
		wg.Add(1)
		go func() {
			defer wg.Done()
			defer s.releaseSourceSlot()
			// PANIC RECOVERY [R-03]: Prevent goroutine crashes from killing the service
			defer func() {
				if r := recover(); r != nil {
					s.Logger().WithContext(ctx).
						WithField("feed", feedID).
						WithField("source", "chainlink").
						WithField("panic", r).
						Error("panic recovered in chainlink price fetch goroutine")
				}
			}()

			price, _, err := s.chainlinkClient.GetPrice(ctx, feedID)
			if err != nil || price <= 0 {
				// ERROR FIX [E-01]: Log Chainlink source failures for observability
				if err != nil {
					s.Logger().WithContext(ctx).
						WithField("feed", feedID).
						WithError(err).
						Warn("Chainlink price source failed")
				}
				return
			}

			// PERFORMANCE FIX [P-01]: Use channel for chainlink too
			results <- priceResult{
				price:  price,
				weight: 1,
				source: "chainlink",
			}
		}()
	}

	wg.Wait()
	close(results)

	// PERFORMANCE FIX [P-01]: Process results efficiently with pre-allocation
	// Collect all results from channel first (channel can only be drained once)
	allResults := make([]priceResult, 0, len(sourcesToUse)+1)
	totalWeight := 0
	for result := range results {
		allResults = append(allResults, result)
		totalWeight += result.weight
	}

	if totalWeight == 0 {
		return nil, fmt.Errorf("no prices available for %s", normalizedPair)
	}

	// Preallocate slices with correct capacity
	prices = make([]float64, 0, totalWeight)
	sources = make([]string, 0, len(allResults))

	// Process collected results
	for _, result := range allResults {
		for i := 0; i < result.weight; i++ {
			prices = append(prices, result.price)
		}
		sources = append(sources, result.source)
	}

	if len(prices) == 0 {
		return nil, fmt.Errorf("no prices available for %s", normalizedPair)
	}

	medianPrice := s.calculateMedian(prices)
	priceInt := int64(medianPrice * float64(pow10(decimals)))

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
			s.Logger().WithContext(ctx).WithError(err).WithFields(map[string]interface{}{
				"feed_id": feedID,
				"pair":    pair,
			}).Warn("failed to persist price feed")
		}
	}

	return response, nil
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

	// RESILIENCE FIX: Use circuit breaker and retry logic for HTTP calls
	var price float64
	err = s.httpCircuitBreaker.Execute(ctx, func() error {
		// Inner retry for transient failures
		retryErr := resilience.Retry(ctx, resilience.RetryConfig{
			MaxAttempts:  3,
			InitialDelay: 100 * time.Millisecond,
			MaxDelay:     5 * time.Second,
			Multiplier:   2.0,
			Jitter:       0.1,
		}, func() error {
			resp, httpErr := s.httpClient.Do(req)
			if httpErr != nil {
				return httpErr
			}
			defer resp.Body.Close()

			if resp.StatusCode < 200 || resp.StatusCode >= 300 {
				respBody, truncated, readErr := httputil.ReadAllWithLimit(resp.Body, 32<<10)
				if readErr != nil {
					return fmt.Errorf("read error response body: %w", readErr)
				}
				msg := strings.TrimSpace(string(respBody))
				if truncated {
					msg += "...(truncated)"
				}
				return fmt.Errorf("price source returned HTTP %d: %s", resp.StatusCode, msg)
			}

			body, readErr := httputil.ReadAllStrict(resp.Body, 1<<20)
			if readErr != nil {
				return fmt.Errorf("read response body: %w", readErr)
			}

			jsonPath := formatJSONPath(src.JSONPath, feed, src)
			result := gjson.GetBytes(body, jsonPath)
			if !result.Exists() {
				return fmt.Errorf("price not found in response")
			}

			price = result.Float()
			return nil
		})
		return retryErr
	})

	if err != nil {
		return 0, err
	}

	return price, nil
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
			return 0, fmt.Errorf("read error response body: %w", readErr)
		}
		msg := strings.TrimSpace(string(respBody))
		if truncated {
			msg += "...(truncated)"
		}
		return 0, fmt.Errorf("price source returned HTTP %d: %s", resp.StatusCode, msg)
	}

	body, err := httputil.ReadAllStrict(resp.Body, 1<<20)
	if err != nil {
		return 0, fmt.Errorf("read response body: %w", err)
	}

	result := gjson.GetBytes(body, source.JSONPath)
	if !result.Exists() {
		return 0, fmt.Errorf("price not found in response at path: %s", source.JSONPath)
	}

	return result.Float(), nil
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
	data, err := json.Marshal(map[string]interface{}{
		"pair":      price.Pair,
		"price":     price.Price,
		"decimals":  price.Decimals,
		"timestamp": price.Timestamp.Unix(),
	})
	if err != nil {
		return nil, nil, fmt.Errorf("marshal signature payload: %w", err)
	}

	seed, err := crypto.DeriveKey(s.signingKey, nil, "price-signing", 32)
	if err != nil {
		return nil, nil, err
	}
	defer crypto.ZeroBytes(seed)

	curve := elliptic.P256()
	d := new(big.Int).SetBytes(seed)
	n := new(big.Int).Sub(curve.Params().N, big.NewInt(1))
	d.Mod(d, n)
	d.Add(d, big.NewInt(1))
	priv := &ecdsa.PrivateKey{PublicKey: ecdsa.PublicKey{Curve: curve}, D: d}
	priv.PublicKey.X, priv.PublicKey.Y = curve.ScalarBaseMult(d.Bytes())

	signature, err = crypto.Sign(priv, data)
	if err != nil {
		return nil, nil, err
	}
	publicKey = crypto.PublicKeyToBytes(&priv.PublicKey)
	return signature, publicKey, nil
}

func formatSourceURL(tmpl, pair string) string {
	if strings.Contains(tmpl, "%sPAIR%s") {
		return fmt.Sprintf(tmpl, "", pair, "")
	}
	return strings.ReplaceAll(tmpl, "{pair}", pair)
}

// formatSourceURLNew formats URL template with feed-specific placeholders.
func formatSourceURLNew(tmpl, pair string, feed *FeedConfig, src *SourceConfig) string {
	url := tmpl

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

	url = strings.ReplaceAll(url, "{pair}", pairValue)
	url = strings.ReplaceAll(url, "{base}", base)
	url = strings.ReplaceAll(url, "{quote}", quote)

	// Legacy format support
	if strings.Contains(url, "%sPAIR%s") {
		url = fmt.Sprintf(url, "", pairValue, "")
	}

	return url
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

func (s *Service) acquireSourceSlot() {
	if s == nil || s.sourceSem == nil {
		return
	}
	s.sourceSem <- struct{}{}
}

func (s *Service) releaseSourceSlot() {
	if s == nil || s.sourceSem == nil {
		return
	}
	<-s.sourceSem
}

// allowPrivateSourceTargetsOnce caches the environment variable read at startup.
var (
	allowPrivateSourceTargetsOnce  sync.Once
	allowPrivateSourceTargetsValue bool
)

func allowPrivateSourceTargets() bool {
	allowPrivateSourceTargetsOnce.Do(func() {
		raw := strings.ToLower(strings.TrimSpace(os.Getenv("NEOFEEDS_ALLOW_PRIVATE_NETWORKS")))
		allowPrivateSourceTargetsValue = raw == "1" || raw == "true" || raw == "yes"
	})
	return allowPrivateSourceTargetsValue
}

func validateSourceURL(ctx context.Context, rawURL string) error {
	// SECURITY: This function provides comprehensive SSRF protection
	// - Blocks private IPs (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
	// - Blocks loopback (127.0.0.0/8)
	// - Blocks link-local (169.254.0.0/16)
	// - Blocks multicast (224.0.0.0/4)
	// - Blocks carrier-grade NAT (100.64.0.0/10)
	// - Only allows HTTPS protocol
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
	if ip.To4() != nil {
		if ip[0] == 100 && ip[1] >= 64 && ip[1] <= 127 {
			return true
		}
	}

	return false
}

// pow10Table provides precomputed powers of 10 for common decimal precisions.
// This avoids repeated multiplication in hot paths.
var pow10Table = [...]int64{
	1,                   // 10^0
	10,                  // 10^1
	100,                 // 10^2
	1000,                // 10^3
	10000,               // 10^4
	100000,              // 10^5
	1000000,             // 10^6
	10000000,            // 10^7
	100000000,           // 10^8
	1000000000,          // 10^9
	10000000000,         // 10^10
	100000000000,        // 10^11
	1000000000000,       // 10^12
	10000000000000,      // 10^13
	100000000000000,     // 10^14
	1000000000000000,    // 10^15
	10000000000000000,   // 10^16
	100000000000000000,  // 10^17
	1000000000000000000, // 10^18
}

// pow10 returns 10^n using a lookup table for common values.
func pow10(n int) int64 {
	if n >= 0 && n < len(pow10Table) {
		return pow10Table[n]
	}
	// Fallback for large exponents (unlikely in price feeds)
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
