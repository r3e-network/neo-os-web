package pricefeed

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/willtech-services/service_layer/internal/config"
	"github.com/willtech-services/service_layer/pkg/logger"
)

// BaseFetcher provides common functionality for price fetchers
type BaseFetcher struct {
	config *config.Config
	logger *logger.Logger
	client *http.Client
}

// NewBaseFetcher creates a new base fetcher
func NewBaseFetcher(cfg *config.Config, log *logger.Logger) *BaseFetcher {
	return &BaseFetcher{
		config: cfg,
		logger: log,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// BinanceFetcher fetches prices from Binance
type BinanceFetcher struct {
	*BaseFetcher
}

// NewBinanceFetcher creates a new Binance fetcher
func NewBinanceFetcher(cfg *config.Config, log *logger.Logger) *BinanceFetcher {
	return &BinanceFetcher{
		BaseFetcher: NewBaseFetcher(cfg, log),
	}
}

// FetchPrice fetches a price from Binance
func (f *BinanceFetcher) FetchPrice(ctx context.Context, baseToken, quoteToken string) (float64, error) {
	// Binance uses different symbols for Neo N3 tokens
	symbolMap := map[string]string{
		"NEO": "NEO",
		"GAS": "GAS",
		"FLM": "FLM",
		"USD": "USDT", // Binance typically uses USDT for USD
	}

	base := symbolMap[baseToken]
	if base == "" {
		base = baseToken
	}

	quote := symbolMap[quoteToken]
	if quote == "" {
		quote = quoteToken
	}

	symbol := fmt.Sprintf("%s%s", base, quote)
	url := fmt.Sprintf("https://api.binance.com/api/v3/ticker/price?symbol=%s", symbol)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return 0, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := f.client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch price from Binance: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return 0, fmt.Errorf("failed to fetch price from Binance: %s (status: %d)", string(body), resp.StatusCode)
	}

	var result struct {
		Symbol string `json:"symbol"`
		Price  string `json:"price"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, fmt.Errorf("failed to decode Binance response: %w", err)
	}

	price, err := strconv.ParseFloat(result.Price, 64)
	if err != nil {
		return 0, fmt.Errorf("failed to parse Binance price: %w", err)
	}

	return price, nil
}

// CoinGeckoFetcher fetches prices from CoinGecko
type CoinGeckoFetcher struct {
	*BaseFetcher
}

// NewCoinGeckoFetcher creates a new CoinGecko fetcher
func NewCoinGeckoFetcher(cfg *config.Config, log *logger.Logger) *CoinGeckoFetcher {
	return &CoinGeckoFetcher{
		BaseFetcher: NewBaseFetcher(cfg, log),
	}
}

// FetchPrice fetches a price from CoinGecko
func (f *CoinGeckoFetcher) FetchPrice(ctx context.Context, baseToken, quoteToken string) (float64, error) {
	// CoinGecko uses different IDs for Neo N3 tokens
	idMap := map[string]string{
		"NEO": "neo",
		"GAS": "gas",
		"FLM": "flamingo-finance",
		"USD": "usd",
	}

	baseID := idMap[baseToken]
	if baseID == "" {
		baseID = strings.ToLower(baseToken)
	}

	quoteID := idMap[quoteToken]
	if quoteID == "" {
		quoteID = strings.ToLower(quoteToken)
	}

	url := fmt.Sprintf("https://api.coingecko.com/api/v3/simple/price?ids=%s&vs_currencies=%s", baseID, quoteID)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return 0, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := f.client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch price from CoinGecko: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return 0, fmt.Errorf("failed to fetch price from CoinGecko: %s (status: %d)", string(body), resp.StatusCode)
	}

	var result map[string]map[string]float64

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, fmt.Errorf("failed to decode CoinGecko response: %w", err)
	}

	price, ok := result[baseID][quoteID]
	if !ok {
		return 0, fmt.Errorf("price not found in CoinGecko response")
	}

	return price, nil
}

// CoinMarketCapFetcher fetches prices from CoinMarketCap
type CoinMarketCapFetcher struct {
	*BaseFetcher
}

// NewCoinMarketCapFetcher creates a new CoinMarketCap fetcher
func NewCoinMarketCapFetcher(cfg *config.Config, log *logger.Logger) *CoinMarketCapFetcher {
	return &CoinMarketCapFetcher{
		BaseFetcher: NewBaseFetcher(cfg, log),
	}
}

// FetchPrice fetches a price from CoinMarketCap
func (f *CoinMarketCapFetcher) FetchPrice(ctx context.Context, baseToken, quoteToken string) (float64, error) {
	// CoinMarketCap requires an API key
	apiKey := f.config.Services.PriceFeed.CoinMarketCapAPIKey
	if apiKey == "" {
		return 0, fmt.Errorf("CoinMarketCap API key not configured")
	}

	// CoinMarketCap uses different symbols
	symbolMap := map[string]string{
		"NEO": "NEO",
		"GAS": "GAS",
		"FLM": "FLM",
		"USD": "USD",
	}

	base := symbolMap[baseToken]
	if base == "" {
		base = baseToken
	}

	quote := symbolMap[quoteToken]
	if quote == "" {
		quote = quoteToken
	}

	url := fmt.Sprintf("https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=%s&convert=%s", base, quote)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return 0, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("X-CMC_PRO_API_KEY", apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := f.client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch price from CoinMarketCap: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return 0, fmt.Errorf("failed to fetch price from CoinMarketCap: %s (status: %d)", string(body), resp.StatusCode)
	}

	var result struct {
		Data map[string]struct {
			Quote map[string]struct {
				Price float64 `json:"price"`
			} `json:"quote"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, fmt.Errorf("failed to decode CoinMarketCap response: %w", err)
	}

	token, ok := result.Data[base]
	if !ok {
		return 0, fmt.Errorf("token %s not found in CoinMarketCap response", base)
	}

	quoteData, ok := token.Quote[quote]
	if !ok {
		return 0, fmt.Errorf("quote %s not found in CoinMarketCap response", quote)
	}

	return quoteData.Price, nil
}

// HuobiFetcher fetches prices from Huobi
type HuobiFetcher struct {
	*BaseFetcher
}

// NewHuobiFetcher creates a new Huobi fetcher
func NewHuobiFetcher(cfg *config.Config, log *logger.Logger) *HuobiFetcher {
	return &HuobiFetcher{
		BaseFetcher: NewBaseFetcher(cfg, log),
	}
}

// FetchPrice fetches a price from Huobi
func (f *HuobiFetcher) FetchPrice(ctx context.Context, baseToken, quoteToken string) (float64, error) {
	// Huobi uses different symbols
	symbolMap := map[string]string{
		"NEO": "neo",
		"GAS": "gas",
		"FLM": "flm",
		"USD": "usdt", // Huobi typically uses USDT for USD
	}

	base := symbolMap[baseToken]
	if base == "" {
		base = strings.ToLower(baseToken)
	}

	quote := symbolMap[quoteToken]
	if quote == "" {
		quote = strings.ToLower(quoteToken)
	}

	symbol := fmt.Sprintf("%s%s", base, quote)
	url := fmt.Sprintf("https://api.huobi.pro/market/detail/merged?symbol=%s", symbol)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return 0, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := f.client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch price from Huobi: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return 0, fmt.Errorf("failed to fetch price from Huobi: %s (status: %d)", string(body), resp.StatusCode)
	}

	var result struct {
		Status string `json:"status"`
		Tick   struct {
			Close float64 `json:"close"`
		} `json:"tick"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, fmt.Errorf("failed to decode Huobi response: %w", err)
	}

	if result.Status != "ok" {
		return 0, fmt.Errorf("Huobi returned error status: %s", result.Status)
	}

	return result.Tick.Close, nil
}

// OKXFetcher fetches prices from OKX
type OKXFetcher struct {
	*BaseFetcher
}

// NewOKXFetcher creates a new OKX fetcher
func NewOKXFetcher(cfg *config.Config, log *logger.Logger) *OKXFetcher {
	return &OKXFetcher{
		BaseFetcher: NewBaseFetcher(cfg, log),
	}
}

// FetchPrice fetches a price from OKX
func (f *OKXFetcher) FetchPrice(ctx context.Context, baseToken, quoteToken string) (float64, error) {
	// OKX uses different symbols
	symbolMap := map[string]string{
		"NEO": "NEO",
		"GAS": "GAS",
		"FLM": "FLM",
		"USD": "USDT", // OKX typically uses USDT for USD
	}

	base := symbolMap[baseToken]
	if base == "" {
		base = baseToken
	}

	quote := symbolMap[quoteToken]
	if quote == "" {
		quote = quoteToken
	}

	instId := fmt.Sprintf("%s-%s", base, quote)
	url := fmt.Sprintf("https://www.okx.com/api/v5/market/ticker?instId=%s", url.QueryEscape(instId))

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return 0, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := f.client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch price from OKX: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return 0, fmt.Errorf("failed to fetch price from OKX: %s (status: %d)", string(body), resp.StatusCode)
	}

	var result struct {
		Code string `json:"code"`
		Data []struct {
			Last string `json:"last"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, fmt.Errorf("failed to decode OKX response: %w", err)
	}

	if result.Code != "0" {
		return 0, fmt.Errorf("OKX returned error code: %s", result.Code)
	}

	if len(result.Data) == 0 {
		return 0, fmt.Errorf("no data found in OKX response")
	}

	price, err := strconv.ParseFloat(result.Data[0].Last, 64)
	if err != nil {
		return 0, fmt.Errorf("failed to parse OKX price: %w", err)
	}

	return price, nil
} 