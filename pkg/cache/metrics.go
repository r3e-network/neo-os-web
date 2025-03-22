package cache

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// CacheMetrics contains cache-related metrics
type CacheMetrics struct {
	CacheHits            prometheus.Counter
	CacheMisses          prometheus.Counter
	CacheStores          prometheus.Counter
	CacheDeletes         prometheus.Counter
	CacheErrors          prometheus.Counter
	CacheSize            prometheus.Gauge
	CacheRequestDuration prometheus.Histogram
	CacheStoreDuration   prometheus.Histogram
}

// NewCacheMetrics creates a new CacheMetrics instance
func NewCacheMetrics() *CacheMetrics {
	return &CacheMetrics{
		CacheHits: promauto.NewCounter(prometheus.CounterOpts{
			Name: "cache_hits_total",
			Help: "Total number of cache hits",
		}),
		CacheMisses: promauto.NewCounter(prometheus.CounterOpts{
			Name: "cache_misses_total",
			Help: "Total number of cache misses",
		}),
		CacheStores: promauto.NewCounter(prometheus.CounterOpts{
			Name: "cache_stores_total",
			Help: "Total number of cache stores",
		}),
		CacheDeletes: promauto.NewCounter(prometheus.CounterOpts{
			Name: "cache_deletes_total",
			Help: "Total number of cache deletes",
		}),
		CacheErrors: promauto.NewCounter(prometheus.CounterOpts{
			Name: "cache_errors_total",
			Help: "Total number of cache errors",
		}),
		CacheSize: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "cache_size_bytes",
			Help: "Current size of the cache in bytes",
		}),
		CacheRequestDuration: promauto.NewHistogram(prometheus.HistogramOpts{
			Name:    "cache_request_duration_seconds",
			Help:    "Duration of cache get operations in seconds",
			Buckets: prometheus.DefBuckets,
		}),
		CacheStoreDuration: promauto.NewHistogram(prometheus.HistogramOpts{
			Name:    "cache_store_duration_seconds",
			Help:    "Duration of cache set operations in seconds",
			Buckets: prometheus.DefBuckets,
		}),
	}
}