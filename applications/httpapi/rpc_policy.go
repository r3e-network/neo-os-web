package httpapi

import (
	"strings"
	"sync"
	"time"
)

// RPCPolicy governs /system/rpc access (tenancy + rate limiting).
type RPCPolicy struct {
	RequireTenant      bool
	PerTenantPerMinute int
	PerTokenPerMinute  int
	Burst              int
	AllowedMethods     map[string][]string
}

type rpcPolicy struct {
	requireTenant bool
	tenantLimiter *minuteLimiter
	tokenLimiter  *minuteLimiter
	allowed       map[string]map[string]bool
}

// minuteLimiter is a simple fixed-window limiter keyed by identity.
type minuteLimiter struct {
	limit   int
	burst   int
	mu      sync.Mutex
	buckets map[string]bucket
}

type bucket struct {
	count int
	start time.Time
}

func newMinuteLimiter(limit int, burst int) *minuteLimiter {
	if limit <= 0 {
		return nil
	}
	if burst < 0 {
		burst = 0
	}
	return &minuteLimiter{limit: limit, burst: burst, buckets: make(map[string]bucket)}
}

// Allow returns whether the key may proceed and the retry-after duration if limited.
func (l *minuteLimiter) Allow(key string) (bool, time.Duration) {
	if l == nil {
		return true, 0
	}
	if strings.TrimSpace(key) == "" {
		key = "anonymous"
	}
	now := time.Now()
	window := now.Truncate(time.Minute)

	l.mu.Lock()
	defer l.mu.Unlock()

	b := l.buckets[key]
	if b.start.Before(window) {
		b = bucket{start: window, count: 0}
	}
	max := l.limit
	if l.burst > 0 {
		max += l.burst
	}
	if b.count >= max {
		retry := b.start.Add(time.Minute).Sub(now)
		l.buckets[key] = b
		return false, retry
	}
	b.count++
	l.buckets[key] = b
	return true, 0
}

func newRPCPolicy(policy RPCPolicy) *rpcPolicy {
	if policy.RequireTenant || policy.PerTenantPerMinute > 0 || policy.PerTokenPerMinute > 0 {
		if policy.Burst < 0 {
			policy.Burst = 0
		}
		allowed := normalizeAllowed(policy.AllowedMethods)
		return &rpcPolicy{
			requireTenant: policy.RequireTenant,
			tenantLimiter: newMinuteLimiter(policy.PerTenantPerMinute, policy.Burst),
			tokenLimiter:  newMinuteLimiter(policy.PerTokenPerMinute, policy.Burst),
			allowed:       allowed,
		}
	}
	if len(policy.AllowedMethods) == 0 {
		return nil
	}
	return &rpcPolicy{allowed: normalizeAllowed(policy.AllowedMethods)}
}

// allow returns whether the request should proceed plus retry-after and reason.
func (p *rpcPolicy) allow(tenant, token string) (bool, time.Duration, string) {
	if p == nil {
		return true, 0, ""
	}
	if p.requireTenant && strings.TrimSpace(tenant) == "" {
		return false, 0, "tenant-required"
	}
	if ok, retry := p.tenantLimiter.Allow(strings.TrimSpace(tenant)); !ok {
		return false, retry, "tenant-limit"
	}
	if ok, retry := p.tokenLimiter.Allow(strings.TrimSpace(token)); !ok {
		return false, retry, "token-limit"
	}
	return true, 0, ""
}

func (p *rpcPolicy) methodAllowed(chain, method string) bool {
	if p == nil || len(p.allowed) == 0 {
		return true
	}
	chain = strings.ToLower(strings.TrimSpace(chain))
	method = strings.ToLower(strings.TrimSpace(method))
	if chain == "" || method == "" {
		return false
	}
	allowed := p.allowed[chain]
	if len(allowed) == 0 {
		return true
	}
	return allowed[method]
}

func normalizeAllowed(in map[string][]string) map[string]map[string]bool {
	if len(in) == 0 {
		return nil
	}
	out := make(map[string]map[string]bool)
	for chain, methods := range in {
		chainKey := strings.ToLower(strings.TrimSpace(chain))
		if chainKey == "" {
			continue
		}
		for _, m := range methods {
			mKey := strings.ToLower(strings.TrimSpace(m))
			if mKey == "" {
				continue
			}
			if out[chainKey] == nil {
				out[chainKey] = make(map[string]bool)
			}
			out[chainKey][mKey] = true
		}
	}
	return out
}
