package fallback

import (
	"context"
	"sync"
	"time"
)

type Config struct {
	MaxAttempts       int
	BaseDelay         time.Duration
	MaxDelay          time.Duration
	Multiplier        float64
	Jitter            float64
	UseCircuitBreaker bool
}

func DefaultConfig() Config {
	return Config{
		MaxAttempts: 3,
		BaseDelay:   100 * time.Millisecond,
		MaxDelay:    5 * time.Second,
		Multiplier:  2.0,
		Jitter:      0.1,
	}
}

type Func func(ctx context.Context) (interface{}, error)

type Handler struct {
	config Config
	cache  map[string]*cacheEntry
	mu     sync.RWMutex
}

type cacheEntry struct {
	value      interface{}
	expiration time.Time
}

type Result struct {
	Value    interface{}
	Err      error
	Source   string
	Attempts int
}

func NewHandler(cfg Config) *Handler {
	if cfg.MaxAttempts <= 0 {
		cfg.MaxAttempts = 3
	}
	if cfg.BaseDelay <= 0 {
		cfg.BaseDelay = 100 * time.Millisecond
	}
	if cfg.MaxDelay <= 0 {
		cfg.MaxDelay = 5 * time.Second
	}
	if cfg.Multiplier <= 0 {
		cfg.Multiplier = 2.0
	}
	if cfg.Jitter < 0 {
		cfg.Jitter = 0.1
	}

	return &Handler{
		config: cfg,
		cache:  make(map[string]*cacheEntry),
	}
}

func (h *Handler) Execute(ctx context.Context, primary Func, fallbacks ...Func) *Result {
	var lastErr error
	attempts := 0

	for attempt := 0; attempt < len(fallbacks)+1; attempt++ {
		attempts++

		var fn Func
		var source string

		if attempt == 0 {
			fn = primary
			source = "primary"
		} else {
			fn = fallbacks[attempt-1]
			source = "fallback"
		}

		value, err := fn(ctx)
		if err == nil {
			return &Result{
				Value:    value,
				Source:   source,
				Attempts: attempts,
			}
		}

		lastErr = err

		if attempt < len(fallbacks) {
			delay := h.calculateDelay(attempt)
			select {
			case <-ctx.Done():
				return &Result{Err: ctx.Err(), Source: source, Attempts: attempts}
			case <-time.After(delay):
			}
		}
	}

	return &Result{Err: lastErr, Source: "exhausted", Attempts: attempts}
}

func (h *Handler) calculateDelay(attempt int) time.Duration {
	delay := float64(h.config.BaseDelay) * pow(h.config.Multiplier, float64(attempt))
	if delay > float64(h.config.MaxDelay) {
		delay = float64(h.config.MaxDelay)
	}

	jitterRange := delay * h.config.Jitter
	jitter := time.Duration(time.Now().UnixNano()) % time.Duration(2*jitterRange*float64(time.Second))
	delay = delay - jitterRange + float64(jitter)/float64(time.Second)

	if delay < 0 {
		delay = 0
	}

	return time.Duration(delay) * time.Millisecond
}

func pow(base, exp float64) float64 {
	result := 1.0
	expInt := int(exp)
	for expInt > 0 {
		if expInt%2 == 1 {
			result *= base
		}
		base *= base
		expInt /= 2
	}
	return result
}

func (h *Handler) SetCache(key string, value interface{}, ttl time.Duration) {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.cache[key] = &cacheEntry{
		value:      value,
		expiration: time.Now().Add(ttl),
	}
}

func (h *Handler) GetCache(key string) (interface{}, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	entry, ok := h.cache[key]
	if !ok {
		return nil, false
	}

	if time.Now().After(entry.expiration) {
		return nil, false
	}

	return entry.value, true
}

func (h *Handler) Cleanup() {
	h.mu.Lock()
	defer h.mu.Unlock()

	now := time.Now()
	for key, entry := range h.cache {
		if now.After(entry.expiration) {
			delete(h.cache, key)
		}
	}
}
