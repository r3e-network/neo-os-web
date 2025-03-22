# API Caching Implementation

## Overview

This document outlines the implementation plan for API caching in the Neo N3 Service Layer. Adding caching to the API layer will significantly improve response times for frequently accessed data, reduce database load, and enhance the overall system performance under load.

## Caching Strategy

We will implement a multi-layered caching approach:

1. **HTTP Response Caching**: Using HTTP cache headers for browser/client-side caching
2. **Server-Side Response Caching**: Caching full API responses
3. **Data Object Caching**: Caching frequently accessed data objects
4. **Query Result Caching**: Caching database query results for expensive operations

## Caching Technologies

### Redis Cache

Redis will be our primary caching solution with the following configuration:

- In-memory storage with persistence
- Key expiration policies based on data type
- Cache eviction policies (LRU - Least Recently Used)
- Support for complex data structures (lists, sets, sorted sets)
- Atomic operations for cache updates

### Local Memory Cache

For high-frequency, low-value data:

- In-memory cache using sync.Map or third-party library (e.g., go-cache)
- Automatic expiration of cached items
- Thread-safe operations
- Low memory footprint

## Cache Key Design

Consistent and meaningful cache key design is essential for effective caching:

### Key Format

`{service}:{entity}:{id}:{operation}:{params}`

Examples:
- `functions:function:123:details`
- `pricefeed:prices:NEO-USD:latest`
- `transactions:list:user-456:pending:page-1`

### Key Components

1. **Service**: The service name (functions, pricefeed, transactions, etc.)
2. **Entity**: The entity type being cached (function, price, transaction, etc.)
3. **ID**: Identifier for the specific entity (if applicable)
4. **Operation**: The operation type (details, list, count, etc.)
5. **Params**: Query parameters or filters (comma-separated)

## Cacheable API Endpoints

Based on performance testing results, we will prioritize caching for the following API endpoints:

### High Priority Endpoints

| Endpoint | Cache Strategy | TTL | Invalidation Triggers |
|----------|---------------|-----|----------------------|
| `GET /api/v1/functions` | Response cache by user | 5 minutes | Function create, update, delete |
| `GET /api/v1/functions/{id}` | Object cache | 10 minutes | Function update, delete |
| `GET /api/v1/price-feeds/current` | Response cache | 30 seconds | Price update |
| `GET /api/v1/transactions?status={status}` | Response cache by user+status | 1 minute | Transaction status change |
| `GET /api/v1/dashboard/metrics` | Response cache | 1 minute | Automatic expiration |

### Medium Priority Endpoints

| Endpoint | Cache Strategy | TTL | Invalidation Triggers |
|----------|---------------|-----|----------------------|
| `GET /api/v1/functions/{id}/executions` | Response cache | 5 minutes | New execution |
| `GET /api/v1/oracles/sources` | Response cache | 15 minutes | Oracle source change |
| `GET /api/v1/triggers` | Response cache by user | 5 minutes | Trigger create, update, delete |
| `GET /api/v1/dashboard/health` | Response cache | 1 minute | Service status change |
| `GET /api/v1/random-numbers/requests` | Response cache by user | 5 minutes | New request |

### Low Priority Endpoints

| Endpoint | Cache Strategy | TTL | Invalidation Triggers |
|----------|---------------|-----|----------------------|
| `GET /api/v1/users/{id}` | Object cache | 30 minutes | User update |
| `GET /api/v1/secrets` (metadata only) | Response cache by user | 10 minutes | Secret create, update, delete |
| `GET /api/v1/price-feeds/history` | Response cache | 1 hour | New price data |
| `GET /api/v1/event-subscriptions` | Response cache by user | 15 minutes | Subscription change |

## Implementation Approach

### 1. Cache Middleware

We will implement a caching middleware for the Gin framework:

```go
// Cache middleware for Gin
func CacheMiddleware(cache *redis.Client, ttl time.Duration, keyFunc func(*gin.Context) string) gin.HandlerFunc {
    return func(c *gin.Context) {
        // Skip caching for non-GET requests
        if c.Request.Method != http.MethodGet {
            c.Next()
            return
        }

        // Generate cache key
        key := keyFunc(c)
        if key == "" {
            c.Next()
            return
        }

        // Try to get from cache
        cachedResponse, err := cache.Get(c, key).Result()
        if err == nil {
            // Cache hit
            var response gin.H
            if err := json.Unmarshal([]byte(cachedResponse), &response); err == nil {
                c.JSON(http.StatusOK, response)
                c.Abort()
                return
            }
        }

        // Set up response recorder
        writer := &responseWriter{ResponseWriter: c.Writer, body: &bytes.Buffer{}}
        c.Writer = writer

        // Process request
        c.Next()

        // Cache response if status code is 200
        if c.Writer.Status() == http.StatusOK {
            response := writer.body.String()
            cache.Set(c, key, response, ttl)
        }
    }
}
```

### 2. Cache Manager

We will create a cache manager to handle different caching scenarios:

```go
// CacheManager provides a unified interface for caching operations
type CacheManager struct {
    redisClient *redis.Client
    localCache  *sync.Map
    logger      *logger.Logger
}

// NewCacheManager creates a new cache manager
func NewCacheManager(redisClient *redis.Client, logger *logger.Logger) *CacheManager {
    return &CacheManager{
        redisClient: redisClient,
        localCache:  &sync.Map{},
        logger:      logger,
    }
}

// Get retrieves a value from cache
func (cm *CacheManager) Get(ctx context.Context, key string) (interface{}, bool) {
    // Try local cache first
    if value, ok := cm.localCache.Load(key); ok {
        return value, true
    }

    // Try Redis cache
    value, err := cm.redisClient.Get(ctx, key).Result()
    if err == nil {
        return value, true
    }

    return nil, false
}

// Set stores a value in cache
func (cm *CacheManager) Set(ctx context.Context, key string, value interface{}, ttl time.Duration, useLocalCache bool) {
    // Store in Redis
    cm.redisClient.Set(ctx, key, value, ttl)

    // Store in local cache if requested
    if useLocalCache {
        cm.localCache.Store(key, value)
    }
}

// Delete removes a value from cache
func (cm *CacheManager) Delete(ctx context.Context, key string) {
    cm.redisClient.Del(ctx, key)
    cm.localCache.Delete(key)
}
```

### 3. HTTP Cache Headers

Implement proper HTTP cache headers for applicable endpoints:

```go
// CacheControlMiddleware sets appropriate Cache-Control headers
func CacheControlMiddleware(maxAge int) gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Next()

        // Don't cache errors
        if c.Writer.Status() != http.StatusOK {
            c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
            return
        }

        // Set cache headers
        c.Header("Cache-Control", fmt.Sprintf("public, max-age=%d", maxAge))
    }
}
```

### 4. Repository Caching

Implement caching at the repository layer for expensive database operations:

```go
// Example of cached repository method
func (r *FunctionRepository) GetByID(ctx context.Context, id string) (*models.Function, error) {
    // Generate cache key
    cacheKey := fmt.Sprintf("functions:function:%s:details", id)

    // Try to get from cache
    if cachedValue, found := r.cacheManager.Get(ctx, cacheKey); found {
        if function, ok := cachedValue.(*models.Function); ok {
            return function, nil
        }
    }

    // Not in cache, get from database
    function, err := r.getFromDatabase(ctx, id)
    if err != nil {
        return nil, err
    }

    // Store in cache
    r.cacheManager.Set(ctx, cacheKey, function, 10*time.Minute, false)

    return function, nil
}
```

### 5. Cache Invalidation

Implement cache invalidation strategies for each cacheable resource:

```go
// Example of cache invalidation in a repository
func (r *FunctionRepository) Update(ctx context.Context, function *models.Function) error {
    // Update in database
    err := r.updateInDatabase(ctx, function)
    if err != nil {
        return err
    }

    // Invalidate caches
    r.cacheManager.Delete(ctx, fmt.Sprintf("functions:function:%s:details", function.ID))
    r.cacheManager.Delete(ctx, fmt.Sprintf("functions:list:user-%d", function.UserID))

    return nil
}
```

## Cache Configuration

### Redis Configuration

```yaml
redis:
  host: localhost
  port: 6379
  password: ""
  db: 0
  pool_size: 100
  min_idle_conns: 10
  max_retries: 3
  dial_timeout: 5s
  read_timeout: 3s
  write_timeout: 3s
```

### Cache Policy Configuration

```yaml
cache:
  enabled: true
  default_ttl: 300  # 5 minutes in seconds
  endpoints:
    - path: "/api/v1/functions"
      ttl: 300
      http_cache: 60
    - path: "/api/v1/price-feeds/current"
      ttl: 30
      http_cache: 10
    - path: "/api/v1/transactions"
      ttl: 60
      http_cache: 0  # No HTTP caching for transactions
  objects:
    function: 600
    price_feed: 60
    transaction: 300
    user: 1800
```

## Cache Monitoring and Metrics

To monitor cache effectiveness, we will implement the following metrics:

1. **Cache Hit Rate**: Percentage of requests served from cache
2. **Cache Miss Rate**: Percentage of requests not found in cache
3. **Cache Response Time**: Time to retrieve data from cache
4. **Cache Size**: Memory usage for cached data
5. **Cache Eviction Rate**: Rate at which items are evicted from cache

These metrics will be exposed through Prometheus and visualized in Grafana dashboards.

## Implementation Plan

### Phase 1: Infrastructure Setup

1. Configure Redis for caching
2. Implement CacheManager
3. Add cache metrics collection
4. Set up cache monitoring

### Phase 2: High-Priority Endpoints

1. Implement caching for high-priority API endpoints
2. Add cache invalidation for these endpoints
3. Test and measure performance improvements
4. Fine-tune cache TTLs based on results

### Phase 3: Object and Query Caching

1. Implement object caching in repositories
2. Add query result caching for expensive operations
3. Implement cache invalidation strategies
4. Measure and validate improvements

### Phase 4: Remaining Endpoints

1. Implement caching for medium and low-priority endpoints
2. Add HTTP cache headers for applicable endpoints
3. Complete cache invalidation implementation
4. Final testing and performance validation

## Testing Strategy

1. **Unit Tests**: Verify cache operations work correctly
2. **Integration Tests**: Ensure cache invalidation works properly across services
3. **Performance Tests**: Measure before/after performance metrics
4. **Load Tests**: Verify cache effectiveness under load
5. **Cache Hit Rate Tests**: Ensure cache hit rates meet targets

## Expected Performance Improvements

Based on industry benchmarks and our performance testing:

1. 60-80% reduction in response time for cached endpoints
2. 30-50% reduction in database load
3. 40-60% increase in overall API throughput
4. Ability to handle 2-3x more concurrent users

## Risks and Mitigations

| Risk | Mitigation Strategy |
|------|---------------------|
| Cache inconsistency | Implement proper invalidation and reasonable TTLs |
| Memory pressure from large cache | Set cache size limits and monitor memory usage |
| Cache stampede (many misses at once) | Implement request collapsing or sliding TTL |
| Over-caching (caching wrong data) | Carefully identify cacheable vs. non-cacheable data |

## Conclusion

Implementing a comprehensive caching strategy for the Neo N3 Service Layer API will significantly improve performance and scalability. The multi-layered approach combining HTTP caching, response caching, and data object caching will provide optimal results for different types of data and access patterns.