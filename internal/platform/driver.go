// Package platform provides driver interfaces for the service layer's hardware abstraction layer.
package platform

import (
	"context"
	"io"
	"math/big"
	"time"
)

// Driver is the base interface for all platform drivers.
// Every driver must be nameable, startable, stoppable, and health-checkable.
type Driver interface {
	// Name returns the driver name for identification.
	Name() string

	// Start initializes the driver and establishes connections.
	Start(ctx context.Context) error

	// Stop gracefully shuts down the driver.
	Stop(ctx context.Context) error

	// Ping checks if the driver's connection is healthy.
	Ping(ctx context.Context) error
}

// =====================================================
// Blockchain RPC Drivers
// =====================================================

// ChainID represents a blockchain network identifier.
type ChainID string

const (
	ChainNeoN3       ChainID = "neo-n3"
	ChainNeoX        ChainID = "neo-x"
	ChainEthereum    ChainID = "ethereum"
	ChainPolygon     ChainID = "polygon"
	ChainBSC         ChainID = "bsc"
	ChainAvalanche   ChainID = "avalanche"
	ChainArbitrum    ChainID = "arbitrum"
	ChainOptimism    ChainID = "optimism"
	ChainBase        ChainID = "base"
	ChainSolana      ChainID = "solana"
	ChainBitcoin     ChainID = "bitcoin"
)

// RPCDriver provides blockchain RPC connectivity.
type RPCDriver interface {
	Driver

	// SupportedChains returns the list of supported blockchain networks.
	SupportedChains() []ChainID

	// GetBlockHeight returns the current block height for a chain.
	GetBlockHeight(ctx context.Context, chain ChainID) (uint64, error)

	// GetBlock returns block data by height or hash.
	GetBlock(ctx context.Context, chain ChainID, identifier string) (*Block, error)

	// GetTransaction returns transaction data by hash.
	GetTransaction(ctx context.Context, chain ChainID, txHash string) (*Transaction, error)

	// SendRawTransaction broadcasts a signed transaction.
	SendRawTransaction(ctx context.Context, chain ChainID, rawTx []byte) (string, error)

	// CallContract executes a read-only contract call.
	CallContract(ctx context.Context, chain ChainID, call ContractCall) ([]byte, error)

	// EstimateGas estimates gas for a transaction.
	EstimateGas(ctx context.Context, chain ChainID, call ContractCall) (uint64, error)

	// GetBalance returns the native token balance for an address.
	GetBalance(ctx context.Context, chain ChainID, address string) (*big.Int, error)

	// GetTokenBalance returns the token balance for an address.
	GetTokenBalance(ctx context.Context, chain ChainID, token, address string) (*big.Int, error)

	// SubscribeBlocks subscribes to new block notifications.
	SubscribeBlocks(ctx context.Context, chain ChainID, handler BlockHandler) (Subscription, error)

	// SubscribeLogs subscribes to contract event logs.
	SubscribeLogs(ctx context.Context, chain ChainID, filter LogFilter, handler LogHandler) (Subscription, error)
}

// Block represents a blockchain block.
type Block struct {
	Height       uint64            `json:"height"`
	Hash         string            `json:"hash"`
	ParentHash   string            `json:"parent_hash"`
	Timestamp    time.Time         `json:"timestamp"`
	Transactions []string          `json:"transactions"`
	StateRoot    string            `json:"state_root,omitempty"`
	Extra        map[string]any    `json:"extra,omitempty"`
}

// Transaction represents a blockchain transaction.
type Transaction struct {
	Hash        string         `json:"hash"`
	BlockHash   string         `json:"block_hash"`
	BlockHeight uint64         `json:"block_height"`
	From        string         `json:"from"`
	To          string         `json:"to"`
	Value       *big.Int       `json:"value"`
	Data        []byte         `json:"data"`
	GasUsed     uint64         `json:"gas_used"`
	GasPrice    *big.Int       `json:"gas_price"`
	Status      TxStatus       `json:"status"`
	Logs        []Log          `json:"logs"`
	Timestamp   time.Time      `json:"timestamp"`
}

// TxStatus represents transaction execution status.
type TxStatus string

const (
	TxStatusPending TxStatus = "pending"
	TxStatusSuccess TxStatus = "success"
	TxStatusFailed  TxStatus = "failed"
)

// Log represents a contract event log.
type Log struct {
	Address  string   `json:"address"`
	Topics   []string `json:"topics"`
	Data     []byte   `json:"data"`
	LogIndex uint     `json:"log_index"`
	TxHash   string   `json:"tx_hash"`
	TxIndex  uint     `json:"tx_index"`
}

// ContractCall represents a contract invocation.
type ContractCall struct {
	To       string `json:"to"`
	From     string `json:"from,omitempty"`
	Data     []byte `json:"data"`
	Value    *big.Int `json:"value,omitempty"`
	Gas      uint64   `json:"gas,omitempty"`
	GasPrice *big.Int `json:"gas_price,omitempty"`
}

// LogFilter specifies criteria for log subscription.
type LogFilter struct {
	Addresses []string   `json:"addresses,omitempty"`
	Topics    [][]string `json:"topics,omitempty"`
	FromBlock uint64     `json:"from_block,omitempty"`
	ToBlock   uint64     `json:"to_block,omitempty"`
}

// BlockHandler processes new blocks.
type BlockHandler func(block *Block) error

// LogHandler processes contract logs.
type LogHandler func(log *Log) error

// Subscription represents an active subscription that can be cancelled.
type Subscription interface {
	// Unsubscribe cancels the subscription.
	Unsubscribe() error

	// Err returns the subscription error channel.
	Err() <-chan error
}

// =====================================================
// Storage Drivers
// =====================================================

// StorageDriver provides persistent storage capabilities.
type StorageDriver interface {
	Driver

	// Type returns the storage type (postgres, sqlite, etc.).
	Type() string

	// DB returns the underlying database connection for advanced queries.
	// Use with caution; prefer the typed methods.
	DB() any

	// Transaction executes operations within a database transaction.
	Transaction(ctx context.Context, fn func(tx StorageTx) error) error

	// Migrate runs database migrations.
	Migrate(ctx context.Context) error

	// Stats returns storage statistics.
	Stats() StorageStats
}

// StorageTx represents a storage transaction.
type StorageTx interface {
	// Exec executes a write query.
	Exec(ctx context.Context, query string, args ...any) (int64, error)

	// Query executes a read query.
	Query(ctx context.Context, query string, args ...any) (Rows, error)

	// QueryRow executes a query expecting a single row.
	QueryRow(ctx context.Context, query string, args ...any) Row

	// Commit commits the transaction.
	Commit() error

	// Rollback aborts the transaction.
	Rollback() error
}

// Rows represents query result rows.
type Rows interface {
	// Next advances to the next row.
	Next() bool

	// Scan reads columns into dest.
	Scan(dest ...any) error

	// Close releases the rows.
	Close() error

	// Err returns any error from iteration.
	Err() error
}

// Row represents a single result row.
type Row interface {
	// Scan reads columns into dest.
	Scan(dest ...any) error
}

// StorageStats holds storage metrics.
type StorageStats struct {
	OpenConnections int     `json:"open_connections"`
	InUse           int     `json:"in_use"`
	Idle            int     `json:"idle"`
	MaxOpen         int     `json:"max_open"`
	WaitCount       int64   `json:"wait_count"`
	WaitDuration    time.Duration `json:"wait_duration"`
}

// =====================================================
// Cache Drivers
// =====================================================

// CacheDriver provides caching capabilities.
type CacheDriver interface {
	Driver

	// Get retrieves a value by key.
	Get(ctx context.Context, key string) ([]byte, error)

	// Set stores a value with optional TTL.
	Set(ctx context.Context, key string, value []byte, ttl time.Duration) error

	// Delete removes a key.
	Delete(ctx context.Context, key string) error

	// Exists checks if a key exists.
	Exists(ctx context.Context, key string) (bool, error)

	// GetMulti retrieves multiple values.
	GetMulti(ctx context.Context, keys []string) (map[string][]byte, error)

	// SetMulti stores multiple values.
	SetMulti(ctx context.Context, items map[string][]byte, ttl time.Duration) error

	// Increment atomically increments a counter.
	Increment(ctx context.Context, key string, delta int64) (int64, error)

	// Expire sets expiration on a key.
	Expire(ctx context.Context, key string, ttl time.Duration) error

	// Keys returns keys matching a pattern.
	Keys(ctx context.Context, pattern string) ([]string, error)

	// Flush removes all keys.
	Flush(ctx context.Context) error
}

// =====================================================
// Queue Drivers
// =====================================================

// QueueDriver provides message queue capabilities.
type QueueDriver interface {
	Driver

	// Publish sends a message to a topic.
	Publish(ctx context.Context, topic string, message []byte) error

	// PublishDelayed sends a delayed message.
	PublishDelayed(ctx context.Context, topic string, message []byte, delay time.Duration) error

	// Subscribe registers a consumer for a topic.
	Subscribe(ctx context.Context, topic, group string, handler MessageHandler) (Subscription, error)

	// CreateTopic creates a topic if it doesn't exist.
	CreateTopic(ctx context.Context, topic string) error

	// DeleteTopic removes a topic.
	DeleteTopic(ctx context.Context, topic string) error

	// TopicStats returns topic statistics.
	TopicStats(ctx context.Context, topic string) (*TopicStats, error)
}

// Message represents a queue message.
type Message struct {
	ID        string            `json:"id"`
	Topic     string            `json:"topic"`
	Body      []byte            `json:"body"`
	Timestamp time.Time         `json:"timestamp"`
	Headers   map[string]string `json:"headers,omitempty"`
	Attempts  int               `json:"attempts"`
}

// MessageHandler processes queue messages.
type MessageHandler func(ctx context.Context, msg *Message) error

// TopicStats holds topic metrics.
type TopicStats struct {
	MessageCount    int64 `json:"message_count"`
	ConsumerCount   int   `json:"consumer_count"`
	ProducerCount   int   `json:"producer_count"`
	MessagesPerSec  float64 `json:"messages_per_sec"`
}

// =====================================================
// Crypto Drivers
// =====================================================

// CryptoDriver provides cryptographic operations.
type CryptoDriver interface {
	Driver

	// GenerateKey generates a new key pair.
	GenerateKey(ctx context.Context, algorithm KeyAlgorithm) (*KeyPair, error)

	// Sign signs data with a private key.
	Sign(ctx context.Context, keyID string, data []byte) ([]byte, error)

	// Verify verifies a signature.
	Verify(ctx context.Context, keyID string, data, signature []byte) (bool, error)

	// Encrypt encrypts data with a public key or symmetric key.
	Encrypt(ctx context.Context, keyID string, plaintext []byte) ([]byte, error)

	// Decrypt decrypts data with a private key or symmetric key.
	Decrypt(ctx context.Context, keyID string, ciphertext []byte) ([]byte, error)

	// ImportKey imports an external key.
	ImportKey(ctx context.Context, keyData []byte, algorithm KeyAlgorithm) (*KeyPair, error)

	// ExportPublicKey exports the public portion of a key.
	ExportPublicKey(ctx context.Context, keyID string) ([]byte, error)

	// DeleteKey removes a key.
	DeleteKey(ctx context.Context, keyID string) error

	// ListKeys lists all keys.
	ListKeys(ctx context.Context) ([]KeyInfo, error)
}

// KeyAlgorithm specifies the cryptographic algorithm.
type KeyAlgorithm string

const (
	KeyAlgorithmECDSA_P256    KeyAlgorithm = "ecdsa-p256"
	KeyAlgorithmECDSA_Secp256k1 KeyAlgorithm = "ecdsa-secp256k1"
	KeyAlgorithmEd25519      KeyAlgorithm = "ed25519"
	KeyAlgorithmRSA2048      KeyAlgorithm = "rsa-2048"
	KeyAlgorithmRSA4096      KeyAlgorithm = "rsa-4096"
	KeyAlgorithmAES256       KeyAlgorithm = "aes-256"
)

// KeyPair represents a cryptographic key pair.
type KeyPair struct {
	ID         string       `json:"id"`
	Algorithm  KeyAlgorithm `json:"algorithm"`
	PublicKey  []byte       `json:"public_key,omitempty"`
	PrivateKey []byte       `json:"private_key,omitempty"` // Only for export, never stored
	CreatedAt  time.Time    `json:"created_at"`
}

// KeyInfo provides key metadata without sensitive data.
type KeyInfo struct {
	ID        string       `json:"id"`
	Algorithm KeyAlgorithm `json:"algorithm"`
	CreatedAt time.Time    `json:"created_at"`
	Usage     []string     `json:"usage"` // sign, verify, encrypt, decrypt
}

// =====================================================
// HTTP Client Driver
// =====================================================

// HTTPDriver provides HTTP client capabilities.
type HTTPDriver interface {
	Driver

	// Do executes an HTTP request.
	Do(ctx context.Context, req *HTTPRequest) (*HTTPResponse, error)

	// Get performs a GET request.
	Get(ctx context.Context, url string, headers map[string]string) (*HTTPResponse, error)

	// Post performs a POST request.
	Post(ctx context.Context, url string, body []byte, headers map[string]string) (*HTTPResponse, error)

	// SetTimeout sets the default request timeout.
	SetTimeout(timeout time.Duration)

	// SetRetry configures retry behavior.
	SetRetry(maxRetries int, backoff time.Duration)
}

// HTTPRequest represents an HTTP request.
type HTTPRequest struct {
	Method  string            `json:"method"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers,omitempty"`
	Body    io.Reader         `json:"-"`
	Timeout time.Duration     `json:"timeout,omitempty"`
}

// HTTPResponse represents an HTTP response.
type HTTPResponse struct {
	StatusCode int               `json:"status_code"`
	Headers    map[string]string `json:"headers"`
	Body       []byte            `json:"body"`
	Duration   time.Duration     `json:"duration"`
}

// =====================================================
// Oracle/Data Source Drivers
// =====================================================

// OracleDriver provides external data source connectivity.
type OracleDriver interface {
	Driver

	// FetchPrice fetches a price feed.
	FetchPrice(ctx context.Context, pair string) (*PriceData, error)

	// FetchMultiplePrices fetches multiple price feeds.
	FetchMultiplePrices(ctx context.Context, pairs []string) (map[string]*PriceData, error)

	// FetchCustomData fetches custom data from a URL.
	FetchCustomData(ctx context.Context, url string, params map[string]string) ([]byte, error)

	// RegisterFeed registers a new data feed.
	RegisterFeed(ctx context.Context, feed FeedConfig) error

	// ListFeeds lists registered feeds.
	ListFeeds(ctx context.Context) ([]FeedConfig, error)
}

// PriceData represents price feed data.
type PriceData struct {
	Pair       string    `json:"pair"`
	Price      float64   `json:"price"`
	Bid        float64   `json:"bid,omitempty"`
	Ask        float64   `json:"ask,omitempty"`
	Volume24h  float64   `json:"volume_24h,omitempty"`
	Change24h  float64   `json:"change_24h,omitempty"`
	Timestamp  time.Time `json:"timestamp"`
	Source     string    `json:"source"`
	Confidence float64   `json:"confidence,omitempty"`
}

// FeedConfig configures a data feed.
type FeedConfig struct {
	ID           string        `json:"id"`
	Name         string        `json:"name"`
	Source       string        `json:"source"`
	Endpoint     string        `json:"endpoint"`
	RefreshRate  time.Duration `json:"refresh_rate"`
	Timeout      time.Duration `json:"timeout"`
	Aggregation  string        `json:"aggregation"` // median, mean, weighted
	Enabled      bool          `json:"enabled"`
}

// =====================================================
// Driver Registry
// =====================================================

// Registry manages platform drivers.
type Registry struct {
	rpc     RPCDriver
	storage StorageDriver
	cache   CacheDriver
	queue   QueueDriver
	crypto  CryptoDriver
	http    HTTPDriver
	oracle  OracleDriver
	content ContentDriver
	custom  map[string]Driver
}

// NewRegistry creates a new driver registry.
func NewRegistry() *Registry {
	return &Registry{
		custom: make(map[string]Driver),
	}
}

// SetRPC sets the RPC driver.
func (r *Registry) SetRPC(d RPCDriver) { r.rpc = d }

// RPC returns the RPC driver.
func (r *Registry) RPC() RPCDriver { return r.rpc }

// SetStorage sets the storage driver.
func (r *Registry) SetStorage(d StorageDriver) { r.storage = d }

// Storage returns the storage driver.
func (r *Registry) Storage() StorageDriver { return r.storage }

// SetCache sets the cache driver.
func (r *Registry) SetCache(d CacheDriver) { r.cache = d }

// Cache returns the cache driver.
func (r *Registry) Cache() CacheDriver { return r.cache }

// SetQueue sets the queue driver.
func (r *Registry) SetQueue(d QueueDriver) { r.queue = d }

// Queue returns the queue driver.
func (r *Registry) Queue() QueueDriver { return r.queue }

// SetCrypto sets the crypto driver.
func (r *Registry) SetCrypto(d CryptoDriver) { r.crypto = d }

// Crypto returns the crypto driver.
func (r *Registry) Crypto() CryptoDriver { return r.crypto }

// SetHTTP sets the HTTP driver.
func (r *Registry) SetHTTP(d HTTPDriver) { r.http = d }

// HTTP returns the HTTP driver.
func (r *Registry) HTTP() HTTPDriver { return r.http }

// SetOracle sets the oracle driver.
func (r *Registry) SetOracle(d OracleDriver) { r.oracle = d }

// Oracle returns the oracle driver.
func (r *Registry) Oracle() OracleDriver { return r.oracle }

// SetContent sets the content-addressed storage driver.
func (r *Registry) SetContent(d ContentDriver) { r.content = d }

// Content returns the content-addressed storage driver.
func (r *Registry) Content() ContentDriver { return r.content }

// Register adds a custom driver.
func (r *Registry) Register(name string, d Driver) {
	r.custom[name] = d
}

// Get retrieves a custom driver by name.
func (r *Registry) Get(name string) (Driver, bool) {
	d, ok := r.custom[name]
	return d, ok
}

// StartAll starts all registered drivers.
func (r *Registry) StartAll(ctx context.Context) error {
	drivers := r.allDrivers()
	for _, d := range drivers {
		if d == nil {
			continue
		}
		if err := d.Start(ctx); err != nil {
			return err
		}
	}
	return nil
}

// StopAll stops all registered drivers in reverse order.
func (r *Registry) StopAll(ctx context.Context) error {
	drivers := r.allDrivers()
	var lastErr error
	for i := len(drivers) - 1; i >= 0; i-- {
		if drivers[i] == nil {
			continue
		}
		if err := drivers[i].Stop(ctx); err != nil {
			lastErr = err
		}
	}
	return lastErr
}

// PingAll checks health of all drivers.
func (r *Registry) PingAll(ctx context.Context) map[string]error {
	results := make(map[string]error)
	drivers := r.allDrivers()
	for _, d := range drivers {
		if d == nil {
			continue
		}
		results[d.Name()] = d.Ping(ctx)
	}
	return results
}

func (r *Registry) allDrivers() []Driver {
	result := []Driver{
		r.rpc,
		r.storage,
		r.cache,
		r.queue,
		r.crypto,
		r.http,
		r.oracle,
		r.content,
	}
	for _, d := range r.custom {
		result = append(result, d)
	}
	return result
}

// =====================================================
// Content-Addressed Storage
// =====================================================

// ContentDriver provides content-addressed storage capabilities.
// Aligned with NEO N3 contract patterns using RefHash/PayloadHash for off-chain storage.
// This allows storing large payloads off-chain while referencing them by hash on-chain.
type ContentDriver interface {
	Driver

	// Store saves content and returns its content hash (SHA256).
	// The hash serves as the content's unique identifier.
	Store(ctx context.Context, content []byte) (hash string, err error)

	// Retrieve fetches content by its hash.
	// Returns ErrContentNotFound if the hash doesn't exist.
	Retrieve(ctx context.Context, hash string) ([]byte, error)

	// Exists checks if content with the given hash exists.
	Exists(ctx context.Context, hash string) (bool, error)

	// Delete removes content by hash.
	// Returns nil if content doesn't exist (idempotent).
	Delete(ctx context.Context, hash string) error

	// StoreWithMetadata stores content with associated metadata.
	StoreWithMetadata(ctx context.Context, content []byte, meta ContentMetadata) (hash string, err error)

	// GetMetadata retrieves metadata for a content hash.
	GetMetadata(ctx context.Context, hash string) (*ContentMetadata, error)
}

// ContentMetadata holds metadata about stored content.
type ContentMetadata struct {
	Hash        string            `json:"hash"`
	Size        int64             `json:"size"`
	ContentType string            `json:"content_type,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
	ExpiresAt   *time.Time        `json:"expires_at,omitempty"`
	Labels      map[string]string `json:"labels,omitempty"`
	RefCount    int               `json:"ref_count"` // Number of references to this content
}

// ContentRef represents a reference to content-addressed storage.
// Use this in domain models instead of storing full content.
type ContentRef struct {
	Hash        string `json:"hash"`                   // SHA256 hash of content
	Size        int64  `json:"size,omitempty"`        // Content size in bytes
	ContentType string `json:"content_type,omitempty"` // MIME type if known
}

// IsEmpty returns true if the reference is unset.
func (r ContentRef) IsEmpty() bool {
	return r.Hash == ""
}

// ErrContentNotFound is returned when content hash doesn't exist.
type ErrContentNotFound struct {
	Hash string
}

func (e ErrContentNotFound) Error() string {
	return "content not found: " + e.Hash
}
