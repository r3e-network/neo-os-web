package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/R3E-Network/service_layer/pkg/logger"
	"github.com/go-redis/redis/v8"
)

// Config represents the cache configuration
type Config struct {
	Enabled       bool                `yaml:"enabled"`
	DefaultTTL    int                 `yaml:"default_ttl"`
	Redis         RedisConfig         `yaml:"redis"`
	EndpointCache []EndpointCacheItem `yaml:"endpoints"`
	ObjectTTLs    map[string]int      `yaml:"objects"`
}

// RedisConfig represents Redis connection configuration
type RedisConfig struct {
	Host           string        `yaml:"host"`
	Port           int           `yaml:"port"`
	Password       string        `yaml:"password"`
	DB             int           `yaml:"db"`
	PoolSize       int           `yaml:"pool_size"`
	MinIdleConns   int           `yaml:"min_idle_conns"`
	MaxRetries     int           `yaml:"max_retries"`
	DialTimeout    time.Duration `yaml:"dial_timeout"`
	ReadTimeout    time.Duration `yaml:"read_timeout"`
	WriteTimeout   time.Duration `yaml:"write_timeout"`
	ConnectTimeout time.Duration `yaml:"connect_timeout"`
}

// EndpointCacheItem represents the caching configuration for an API endpoint
type EndpointCacheItem struct {
	Path      string `yaml:"path"`
	TTL       int    `yaml:"ttl"`
	HTTPCache int    `yaml:"http_cache"`
}

// CacheManager provides a unified interface for caching operations
type CacheManager struct {
	redisClient     *redis.Client
	localCache      *sync.Map
	logger          *logger.Logger
	defaultTTL      time.Duration
	objectTTLs      map[string]time.Duration
	enabled         bool
	metrics         *CacheMetrics
	localCacheItems int32
}

// NewCacheManager creates a new cache manager
func NewCacheManager(cfg *Config, logger *logger.Logger) (*CacheManager, error) {
	if !cfg.Enabled {
		logger.Info("Cache is disabled in configuration")
		return &CacheManager{
			localCache: &sync.Map{},
			logger:     logger,
			enabled:    false,
		}, nil
	}

	// Create Redis client
	redisClient := redis.NewClient(&redis.Options{
		Addr:         fmt.Sprintf("%s:%d", cfg.Redis.Host, cfg.Redis.Port),
		Password:     cfg.Redis.Password,
		DB:           cfg.Redis.DB,
		PoolSize:     cfg.Redis.PoolSize,
		MinIdleConns: cfg.Redis.MinIdleConns,
		MaxRetries:   cfg.Redis.MaxRetries,
		DialTimeout:  cfg.Redis.DialTimeout,
		ReadTimeout:  cfg.Redis.ReadTimeout,
		WriteTimeout: cfg.Redis.WriteTimeout,
	})

	// Test Redis connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := redisClient.Ping(ctx).Result()
	if err != nil {
		logger.Errorf("Failed to connect to Redis: %v", err)
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	// Initialize object TTLs
	objectTTLs := make(map[string]time.Duration)
	for key, ttl := range cfg.ObjectTTLs {
		objectTTLs[key] = time.Duration(ttl) * time.Second
	}

	// Initialize cache metrics
	metrics := NewCacheMetrics()

	logger.Info("Cache manager initialized successfully")
	return &CacheManager{
		redisClient: redisClient,
		localCache:  &sync.Map{},
		logger:      logger,
		defaultTTL:  time.Duration(cfg.DefaultTTL) * time.Second,
		objectTTLs:  objectTTLs,
		enabled:     true,
		metrics:     metrics,
	}, nil
}

// Get retrieves a value from cache
func (cm *CacheManager) Get(ctx context.Context, key string, result interface{}) (bool, error) {
	if !cm.enabled {
		return false, nil
	}

	startTime := time.Now()
	defer func() {
		cm.metrics.CacheRequestDuration.Observe(time.Since(startTime).Seconds())
	}()

	// Try local cache first
	if value, ok := cm.localCache.Load(key); ok {
		item, ok := value.(cachedItem)
		if ok && !item.isExpired() {
			cm.logger.Debug(fmt.Sprintf("Cache hit (local): %s", key))
			err := json.Unmarshal(item.data, result)
			cm.metrics.CacheHits.Inc()
			return true, err
		}
		// Remove expired item
		cm.localCache.Delete(key)
	}

	// Try Redis cache
	value, err := cm.redisClient.Get(ctx, key).Result()
	if err == redis.Nil {
		// Key does not exist
		cm.logger.Debug(fmt.Sprintf("Cache miss: %s", key))
		cm.metrics.CacheMisses.Inc()
		return false, nil
	} else if err != nil {
		// Redis error
		cm.logger.Error(fmt.Sprintf("Redis error when getting %s: %v", key, err))
		cm.metrics.CacheErrors.Inc()
		return false, err
	}

	// Cache hit
	cm.logger.Debug(fmt.Sprintf("Cache hit (redis): %s", key))
	err = json.Unmarshal([]byte(value), result)
	if err != nil {
		cm.logger.Errorf("Failed to unmarshal cached value for %s: %v", key, err)
		cm.metrics.CacheErrors.Inc()
		return false, err
	}

	cm.metrics.CacheHits.Inc()
	return true, nil
}

// Set stores a value in cache
func (cm *CacheManager) Set(ctx context.Context, key string, value interface{}, ttl time.Duration, useLocalCache bool) error {
	if !cm.enabled {
		return nil
	}

	startTime := time.Now()
	defer func() {
		cm.metrics.CacheStoreDuration.Observe(time.Since(startTime).Seconds())
	}()

	// Use default TTL if not specified
	if ttl == 0 {
		ttl = cm.defaultTTL
	}

	// Marshal value to JSON
	jsonData, err := json.Marshal(value)
	if err != nil {
		cm.logger.Errorf("Failed to marshal value for %s: %v", key, err)
		cm.metrics.CacheErrors.Inc()
		return err
	}

	// Store in Redis
	err = cm.redisClient.Set(ctx, key, jsonData, ttl).Err()
	if err != nil {
		cm.logger.Errorf("Failed to store value in Redis for %s: %v", key, err)
		cm.metrics.CacheErrors.Inc()
		return err
	}

	// Store in local cache if requested
	if useLocalCache {
		item := cachedItem{
			data:    jsonData,
			expires: time.Now().Add(ttl),
		}
		cm.localCache.Store(key, item)
	}

	cm.metrics.CacheStores.Inc()
	cm.logger.Debugf("Cached value for %s (TTL: %v)", key, ttl)
	return nil
}

// SetObject stores an object in cache with type-specific TTL
func (cm *CacheManager) SetObject(ctx context.Context, objectType string, objectID string, value interface{}, useLocalCache bool) error {
	if !cm.enabled {
		return nil
	}

	// Generate key
	key := fmt.Sprintf("%s:%s:details", objectType, objectID)

	// Get TTL for this object type
	ttl, ok := cm.objectTTLs[objectType]
	if !ok {
		ttl = cm.defaultTTL
	}

	return cm.Set(ctx, key, value, ttl, useLocalCache)
}

// Delete removes a value from cache
func (cm *CacheManager) Delete(ctx context.Context, key string) error {
	if !cm.enabled {
		return nil
	}

	// Remove from Redis
	err := cm.redisClient.Del(ctx, key).Err()
	if err != nil {
		cm.logger.Errorf("Failed to delete key %s from Redis: %v", key, err)
		return err
	}

	// Remove from local cache
	cm.localCache.Delete(key)

	cm.metrics.CacheDeletes.Inc()
	cm.logger.Debugf("Deleted cache key: %s", key)
	return nil
}

// DeletePattern removes values matching a pattern from cache
func (cm *CacheManager) DeletePattern(ctx context.Context, pattern string) error {
	if !cm.enabled {
		return nil
	}

	// Find keys matching pattern
	keys, err := cm.redisClient.Keys(ctx, pattern).Result()
	if err != nil {
		cm.logger.Errorf("Failed to find keys matching pattern %s: %v", pattern, err)
		return err
	}

	if len(keys) == 0 {
		return nil
	}

	// Delete keys from Redis
	err = cm.redisClient.Del(ctx, keys...).Err()
	if err != nil {
		cm.logger.Errorf("Failed to delete keys matching pattern %s: %v", pattern, err)
		return err
	}

	// Delete from local cache (we need to scan all keys)
	cm.localCache.Range(func(k, v interface{}) bool {
		key, ok := k.(string)
		if ok && matchesPattern(key, pattern) {
			cm.localCache.Delete(key)
		}
		return true
	})

	cm.metrics.CacheDeletes.Add(float64(len(keys)))
	cm.logger.Debugf("Deleted %d cache keys matching pattern: %s", len(keys), pattern)
	return nil
}

// Clear removes all values from cache
func (cm *CacheManager) Clear(ctx context.Context) error {
	if !cm.enabled {
		return nil
	}

	// Clear Redis cache
	err := cm.redisClient.FlushDB(ctx).Err()
	if err != nil {
		cm.logger.Errorf("Failed to clear Redis cache: %v", err)
		return err
	}

	// Clear local cache
	cm.localCache = &sync.Map{}

	cm.logger.Info("Cache cleared")
	return nil
}

// Close closes the cache manager
func (cm *CacheManager) Close() error {
	if cm.redisClient != nil {
		return cm.redisClient.Close()
	}
	return nil
}

// GetObjectTTL returns the TTL for an object type
func (cm *CacheManager) GetObjectTTL(objectType string) time.Duration {
	ttl, ok := cm.objectTTLs[objectType]
	if !ok {
		return cm.defaultTTL
	}
	return ttl
}

// GetDefaultTTL returns the default TTL
func (cm *CacheManager) GetDefaultTTL() time.Duration {
	return cm.defaultTTL
}

// GenerateKey generates a cache key
func GenerateKey(service, entity, id, operation string, params ...string) string {
	if len(params) > 0 {
		return fmt.Sprintf("%s:%s:%s:%s:%s", service, entity, id, operation, strings.Join(params, ","))
	}
	return fmt.Sprintf("%s:%s:%s:%s", service, entity, id, operation)
}

// cachedItem represents an item in the local cache
type cachedItem struct {
	data    []byte
	expires time.Time
}

// isExpired checks if the item is expired
func (i cachedItem) isExpired() bool {
	return time.Now().After(i.expires)
}

// matchesPattern checks if a key matches a Redis-style pattern
func matchesPattern(key, pattern string) bool {
	// This is a simplified version - in production you might want to use a proper
	// Redis pattern matching library or regular expressions
	return strings.HasPrefix(key, strings.Replace(pattern, "*", "", -1))
}

// cleanupLocalCache periodically cleans up expired items from local cache
func (cm *CacheManager) cleanupLocalCache() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		count := 0
		cm.localCache.Range(func(k, v interface{}) bool {
			item, ok := v.(cachedItem)
			if ok && item.isExpired() {
				cm.localCache.Delete(k)
				count++
			}
			return true
		})
		if count > 0 {
			cm.logger.Debugf("Cleaned up %d expired items from local cache", count)
		}
	}
}
