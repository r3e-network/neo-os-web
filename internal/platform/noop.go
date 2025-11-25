// Package platform provides noop driver implementations for testing and placeholders.
package platform

import (
	"context"
	"errors"
	"io"
	"math/big"
	"time"
)

// ErrNotImplemented is returned by noop drivers when functionality is not implemented.
var ErrNotImplemented = errors.New("driver method not implemented")

// =====================================================
// Noop RPC Driver
// =====================================================

// NoopRPCDriver is a no-op implementation of RPCDriver for testing.
// All methods return ErrNotImplemented or sensible zero values.
type NoopRPCDriver struct {
	name string
}

// NewNoopRPCDriver creates a new noop RPC driver.
func NewNoopRPCDriver() *NoopRPCDriver {
	return &NoopRPCDriver{name: "noop-rpc"}
}

func (d *NoopRPCDriver) Name() string                    { return d.name }
func (d *NoopRPCDriver) Start(ctx context.Context) error { return nil }
func (d *NoopRPCDriver) Stop(ctx context.Context) error  { return nil }
func (d *NoopRPCDriver) Ping(ctx context.Context) error  { return nil }

func (d *NoopRPCDriver) SupportedChains() []ChainID {
	return []ChainID{}
}

func (d *NoopRPCDriver) GetBlockHeight(ctx context.Context, chain ChainID) (uint64, error) {
	return 0, ErrNotImplemented
}

func (d *NoopRPCDriver) GetBlock(ctx context.Context, chain ChainID, identifier string) (*Block, error) {
	return nil, ErrNotImplemented
}

func (d *NoopRPCDriver) GetTransaction(ctx context.Context, chain ChainID, txHash string) (*Transaction, error) {
	return nil, ErrNotImplemented
}

func (d *NoopRPCDriver) SendRawTransaction(ctx context.Context, chain ChainID, rawTx []byte) (string, error) {
	return "", ErrNotImplemented
}

func (d *NoopRPCDriver) CallContract(ctx context.Context, chain ChainID, call ContractCall) ([]byte, error) {
	return nil, ErrNotImplemented
}

func (d *NoopRPCDriver) EstimateGas(ctx context.Context, chain ChainID, call ContractCall) (uint64, error) {
	return 0, ErrNotImplemented
}

func (d *NoopRPCDriver) GetBalance(ctx context.Context, chain ChainID, address string) (*big.Int, error) {
	return big.NewInt(0), nil
}

func (d *NoopRPCDriver) GetTokenBalance(ctx context.Context, chain ChainID, token, address string) (*big.Int, error) {
	return big.NewInt(0), nil
}

func (d *NoopRPCDriver) SubscribeBlocks(ctx context.Context, chain ChainID, handler BlockHandler) (Subscription, error) {
	return nil, ErrNotImplemented
}

func (d *NoopRPCDriver) SubscribeLogs(ctx context.Context, chain ChainID, filter LogFilter, handler LogHandler) (Subscription, error) {
	return nil, ErrNotImplemented
}

// =====================================================
// Noop Storage Driver
// =====================================================

// NoopStorageDriver is a no-op implementation of StorageDriver for testing.
type NoopStorageDriver struct {
	name string
}

// NewNoopStorageDriver creates a new noop storage driver.
func NewNoopStorageDriver() *NoopStorageDriver {
	return &NoopStorageDriver{name: "noop-storage"}
}

func (d *NoopStorageDriver) Name() string                    { return d.name }
func (d *NoopStorageDriver) Start(ctx context.Context) error { return nil }
func (d *NoopStorageDriver) Stop(ctx context.Context) error  { return nil }
func (d *NoopStorageDriver) Ping(ctx context.Context) error  { return nil }

func (d *NoopStorageDriver) Type() string {
	return "noop"
}

func (d *NoopStorageDriver) DB() any {
	return nil
}

func (d *NoopStorageDriver) Transaction(ctx context.Context, fn func(tx StorageTx) error) error {
	return ErrNotImplemented
}

func (d *NoopStorageDriver) Migrate(ctx context.Context) error {
	return ErrNotImplemented
}

func (d *NoopStorageDriver) Stats() StorageStats {
	return StorageStats{}
}

// =====================================================
// Noop Cache Driver
// =====================================================

// NoopCacheDriver is a no-op implementation of CacheDriver for testing.
type NoopCacheDriver struct {
	name string
}

// NewNoopCacheDriver creates a new noop cache driver.
func NewNoopCacheDriver() *NoopCacheDriver {
	return &NoopCacheDriver{name: "noop-cache"}
}

func (d *NoopCacheDriver) Name() string                    { return d.name }
func (d *NoopCacheDriver) Start(ctx context.Context) error { return nil }
func (d *NoopCacheDriver) Stop(ctx context.Context) error  { return nil }
func (d *NoopCacheDriver) Ping(ctx context.Context) error  { return nil }

func (d *NoopCacheDriver) Get(ctx context.Context, key string) ([]byte, error) {
	return nil, ErrNotImplemented
}

func (d *NoopCacheDriver) Set(ctx context.Context, key string, value []byte, ttl time.Duration) error {
	return ErrNotImplemented
}

func (d *NoopCacheDriver) Delete(ctx context.Context, key string) error {
	return ErrNotImplemented
}

func (d *NoopCacheDriver) Exists(ctx context.Context, key string) (bool, error) {
	return false, nil
}

func (d *NoopCacheDriver) GetMulti(ctx context.Context, keys []string) (map[string][]byte, error) {
	return make(map[string][]byte), nil
}

func (d *NoopCacheDriver) SetMulti(ctx context.Context, items map[string][]byte, ttl time.Duration) error {
	return ErrNotImplemented
}

func (d *NoopCacheDriver) Increment(ctx context.Context, key string, delta int64) (int64, error) {
	return 0, ErrNotImplemented
}

func (d *NoopCacheDriver) Expire(ctx context.Context, key string, ttl time.Duration) error {
	return ErrNotImplemented
}

func (d *NoopCacheDriver) Keys(ctx context.Context, pattern string) ([]string, error) {
	return []string{}, nil
}

func (d *NoopCacheDriver) Flush(ctx context.Context) error {
	return nil
}

// =====================================================
// Noop Queue Driver
// =====================================================

// NoopQueueDriver is a no-op implementation of QueueDriver for testing.
type NoopQueueDriver struct {
	name string
}

// NewNoopQueueDriver creates a new noop queue driver.
func NewNoopQueueDriver() *NoopQueueDriver {
	return &NoopQueueDriver{name: "noop-queue"}
}

func (d *NoopQueueDriver) Name() string                    { return d.name }
func (d *NoopQueueDriver) Start(ctx context.Context) error { return nil }
func (d *NoopQueueDriver) Stop(ctx context.Context) error  { return nil }
func (d *NoopQueueDriver) Ping(ctx context.Context) error  { return nil }

func (d *NoopQueueDriver) Publish(ctx context.Context, topic string, message []byte) error {
	return ErrNotImplemented
}

func (d *NoopQueueDriver) PublishDelayed(ctx context.Context, topic string, message []byte, delay time.Duration) error {
	return ErrNotImplemented
}

func (d *NoopQueueDriver) Subscribe(ctx context.Context, topic, group string, handler MessageHandler) (Subscription, error) {
	return nil, ErrNotImplemented
}

func (d *NoopQueueDriver) CreateTopic(ctx context.Context, topic string) error {
	return ErrNotImplemented
}

func (d *NoopQueueDriver) DeleteTopic(ctx context.Context, topic string) error {
	return ErrNotImplemented
}

func (d *NoopQueueDriver) TopicStats(ctx context.Context, topic string) (*TopicStats, error) {
	return &TopicStats{}, nil
}

// =====================================================
// Noop Crypto Driver
// =====================================================

// NoopCryptoDriver is a no-op implementation of CryptoDriver for testing.
type NoopCryptoDriver struct {
	name string
}

// NewNoopCryptoDriver creates a new noop crypto driver.
func NewNoopCryptoDriver() *NoopCryptoDriver {
	return &NoopCryptoDriver{name: "noop-crypto"}
}

func (d *NoopCryptoDriver) Name() string                    { return d.name }
func (d *NoopCryptoDriver) Start(ctx context.Context) error { return nil }
func (d *NoopCryptoDriver) Stop(ctx context.Context) error  { return nil }
func (d *NoopCryptoDriver) Ping(ctx context.Context) error  { return nil }

func (d *NoopCryptoDriver) GenerateKey(ctx context.Context, algorithm KeyAlgorithm) (*KeyPair, error) {
	return nil, ErrNotImplemented
}

func (d *NoopCryptoDriver) Sign(ctx context.Context, keyID string, data []byte) ([]byte, error) {
	return nil, ErrNotImplemented
}

func (d *NoopCryptoDriver) Verify(ctx context.Context, keyID string, data, signature []byte) (bool, error) {
	return false, ErrNotImplemented
}

func (d *NoopCryptoDriver) Encrypt(ctx context.Context, keyID string, plaintext []byte) ([]byte, error) {
	return nil, ErrNotImplemented
}

func (d *NoopCryptoDriver) Decrypt(ctx context.Context, keyID string, ciphertext []byte) ([]byte, error) {
	return nil, ErrNotImplemented
}

func (d *NoopCryptoDriver) ImportKey(ctx context.Context, keyData []byte, algorithm KeyAlgorithm) (*KeyPair, error) {
	return nil, ErrNotImplemented
}

func (d *NoopCryptoDriver) ExportPublicKey(ctx context.Context, keyID string) ([]byte, error) {
	return nil, ErrNotImplemented
}

func (d *NoopCryptoDriver) DeleteKey(ctx context.Context, keyID string) error {
	return ErrNotImplemented
}

func (d *NoopCryptoDriver) ListKeys(ctx context.Context) ([]KeyInfo, error) {
	return []KeyInfo{}, nil
}

// =====================================================
// Noop HTTP Driver
// =====================================================

// NoopHTTPDriver is a no-op implementation of HTTPDriver for testing.
type NoopHTTPDriver struct {
	name    string
	timeout time.Duration
}

// NewNoopHTTPDriver creates a new noop HTTP driver.
func NewNoopHTTPDriver() *NoopHTTPDriver {
	return &NoopHTTPDriver{name: "noop-http", timeout: 30 * time.Second}
}

func (d *NoopHTTPDriver) Name() string                    { return d.name }
func (d *NoopHTTPDriver) Start(ctx context.Context) error { return nil }
func (d *NoopHTTPDriver) Stop(ctx context.Context) error  { return nil }
func (d *NoopHTTPDriver) Ping(ctx context.Context) error  { return nil }

func (d *NoopHTTPDriver) Do(ctx context.Context, req *HTTPRequest) (*HTTPResponse, error) {
	return &HTTPResponse{
		StatusCode: 503,
		Headers:    make(map[string]string),
		Body:       []byte{},
		Duration:   0,
	}, ErrNotImplemented
}

func (d *NoopHTTPDriver) Get(ctx context.Context, url string, headers map[string]string) (*HTTPResponse, error) {
	return d.Do(ctx, &HTTPRequest{
		Method:  "GET",
		URL:     url,
		Headers: headers,
		Body:    nil,
	})
}

func (d *NoopHTTPDriver) Post(ctx context.Context, url string, body []byte, headers map[string]string) (*HTTPResponse, error) {
	return d.Do(ctx, &HTTPRequest{
		Method:  "POST",
		URL:     url,
		Headers: headers,
		Body:    io.NopCloser(nil),
	})
}

func (d *NoopHTTPDriver) SetTimeout(timeout time.Duration) {
	d.timeout = timeout
}

func (d *NoopHTTPDriver) SetRetry(maxRetries int, backoff time.Duration) {
	// noop
}

// =====================================================
// Noop Oracle Driver
// =====================================================

// NoopOracleDriver is a no-op implementation of OracleDriver for testing.
type NoopOracleDriver struct {
	name string
}

// NewNoopOracleDriver creates a new noop oracle driver.
func NewNoopOracleDriver() *NoopOracleDriver {
	return &NoopOracleDriver{name: "noop-oracle"}
}

func (d *NoopOracleDriver) Name() string                    { return d.name }
func (d *NoopOracleDriver) Start(ctx context.Context) error { return nil }
func (d *NoopOracleDriver) Stop(ctx context.Context) error  { return nil }
func (d *NoopOracleDriver) Ping(ctx context.Context) error  { return nil }

func (d *NoopOracleDriver) FetchPrice(ctx context.Context, pair string) (*PriceData, error) {
	return nil, ErrNotImplemented
}

func (d *NoopOracleDriver) FetchMultiplePrices(ctx context.Context, pairs []string) (map[string]*PriceData, error) {
	return make(map[string]*PriceData), nil
}

func (d *NoopOracleDriver) FetchCustomData(ctx context.Context, url string, params map[string]string) ([]byte, error) {
	return nil, ErrNotImplemented
}

func (d *NoopOracleDriver) RegisterFeed(ctx context.Context, feed FeedConfig) error {
	return ErrNotImplemented
}

func (d *NoopOracleDriver) ListFeeds(ctx context.Context) ([]FeedConfig, error) {
	return []FeedConfig{}, nil
}

// =====================================================
// Noop Content Driver
// =====================================================

// NoopContentDriver is a no-op implementation of ContentDriver for testing.
// All operations return ErrNotImplemented except basic lifecycle methods.
type NoopContentDriver struct {
	name string
}

// NewNoopContentDriver creates a new noop content driver.
func NewNoopContentDriver() *NoopContentDriver {
	return &NoopContentDriver{name: "noop-content"}
}

func (d *NoopContentDriver) Name() string                    { return d.name }
func (d *NoopContentDriver) Start(ctx context.Context) error { return nil }
func (d *NoopContentDriver) Stop(ctx context.Context) error  { return nil }
func (d *NoopContentDriver) Ping(ctx context.Context) error  { return nil }

func (d *NoopContentDriver) Store(ctx context.Context, content []byte) (string, error) {
	return "", ErrNotImplemented
}

func (d *NoopContentDriver) Retrieve(ctx context.Context, hash string) ([]byte, error) {
	return nil, ErrContentNotFound{Hash: hash}
}

func (d *NoopContentDriver) Exists(ctx context.Context, hash string) (bool, error) {
	return false, nil
}

func (d *NoopContentDriver) Delete(ctx context.Context, hash string) error {
	return nil // Idempotent delete
}

func (d *NoopContentDriver) StoreWithMetadata(ctx context.Context, content []byte, meta ContentMetadata) (string, error) {
	return "", ErrNotImplemented
}

func (d *NoopContentDriver) GetMetadata(ctx context.Context, hash string) (*ContentMetadata, error) {
	return nil, ErrContentNotFound{Hash: hash}
}
