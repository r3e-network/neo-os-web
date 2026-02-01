package ratelimit

import (
	"context"
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type Config struct {
	RequestsPerSecond float64
	Burst             int
	Window            time.Duration
}

func DefaultConfig() Config {
	return Config{
		RequestsPerSecond: 100,
		Burst:             200,
		Window:            time.Second,
	}
}

type RateLimiter struct {
	limiter   *rate.Limiter
	perMinute *rate.Limiter
	mu        sync.RWMutex
	config    Config
}

func New(cfg Config) *RateLimiter {
	if cfg.RequestsPerSecond <= 0 {
		cfg.RequestsPerSecond = 100
	}
	if cfg.Burst <= 0 {
		cfg.Burst = int(cfg.RequestsPerSecond * 2)
	}

	return &RateLimiter{
		limiter:   rate.NewLimiter(rate.Limit(cfg.RequestsPerSecond), cfg.Burst),
		perMinute: rate.NewLimiter(rate.Limit(cfg.RequestsPerSecond*60), cfg.Burst*2),
		config:    cfg,
	}
}

func (r *RateLimiter) Allow() bool {
	return r.limiter.Allow()
}

func (r *RateLimiter) AllowN(now time.Time, n int) bool {
	return r.limiter.AllowN(now, n)
}

func (r *RateLimiter) Wait(ctx context.Context) error {
	return r.limiter.Wait(ctx)
}

func (r *RateLimiter) LimitExceeded() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return !r.limiter.Allow()
}

func (r *RateLimiter) PerMinuteLimitExceeded() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return !r.perMinute.Allow()
}

func (r *RateLimiter) Reset() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.limiter = rate.NewLimiter(rate.Limit(r.config.RequestsPerSecond), r.config.Burst)
	r.perMinute = rate.NewLimiter(rate.Limit(r.config.RequestsPerSecond*60), r.config.Burst*2)
}

type RateLimitedClient struct {
	client  *http.Client
	limiter *RateLimiter
}

func NewRateLimitedClient(client *http.Client, cfg Config) *RateLimitedClient {
	return &RateLimitedClient{
		client:  client,
		limiter: New(cfg),
	}
}

func (c *RateLimitedClient) Do(req *http.Request) (*http.Response, error) {
	if err := c.limiter.Wait(req.Context()); err != nil {
		return nil, err
	}
	return c.client.Do(req)
}

func (c *RateLimitedClient) Allow() bool {
	return c.limiter.Allow()
}

func (c *RateLimitedClient) LimitExceeded() bool {
	return c.limiter.LimitExceeded()
}
