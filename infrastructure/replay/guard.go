// Package replay provides shared replay protection for services.
package replay

import (
	"context"
	"strings"
	"sync"
	"time"
)

// DBChecker abstracts the database operations needed for replay protection.
type DBChecker interface {
	MarkRequestSeen(ctx context.Context, serviceID, requestID string, windowSeconds int) (bool, error)
	CleanupSeenRequests(ctx context.Context, serviceID string) (int, error)
}

// LoggerFunc is called to log warnings during replay operations.
type LoggerFunc func(msg string, err error)

// Guard provides replay protection using an in-memory map with optional
// database backing. It is safe for concurrent use.
type Guard struct {
	serviceID    string
	replayWindow time.Duration

	mu   sync.Mutex
	seen map[string]time.Time

	db     DBChecker
	logger LoggerFunc
}

// Option configures a Guard.
type Option func(*Guard)

// WithDB enables database-backed replay checking.
func WithDB(db DBChecker) Option {
	return func(g *Guard) { g.db = db }
}

// WithLogger sets the warning logger.
func WithLogger(fn LoggerFunc) Option {
	return func(g *Guard) { g.logger = fn }
}

// New creates a Guard for the given service with the specified replay window.
func New(serviceID string, window time.Duration, opts ...Option) *Guard {
	g := &Guard{
		serviceID:    serviceID,
		replayWindow: window,
		seen:         make(map[string]time.Time),
	}
	for _, o := range opts {
		o(g)
	}
	return g
}

// MarkSeen returns true if the request is new, false if it is a replay or
// the check failed (conservative). When a DB is configured, it delegates
// there first; on DB error it falls back to in-memory as best-effort.
func (g *Guard) MarkSeen(ctx context.Context, requestID string) bool {
	requestID = strings.TrimSpace(requestID)
	if requestID == "" {
		return false
	}

	if g.db != nil {
		windowSeconds := int(g.replayWindow.Seconds())
		seen, err := g.db.MarkRequestSeen(ctx, g.serviceID, requestID, windowSeconds)
		if err != nil {
			if g.logger != nil {
				g.logger("replay check failed on DB; rejecting request as potentially seen", err)
			}
			g.markSeenInMemory(requestID) // best-effort local tracking
			return false
		}
		return seen
	}
	return g.markSeenInMemory(requestID)
}

func (g *Guard) markSeenInMemory(requestID string) bool {
	now := time.Now()
	g.mu.Lock()
	defer g.mu.Unlock()

	if until, ok := g.seen[requestID]; ok && now.Before(until) {
		return false
	}

	// Prevent unbounded growth under high request volume.
	if len(g.seen) >= 100_000 {
		for k, until := range g.seen {
			if now.After(until) {
				delete(g.seen, k)
			}
		}
		// Hard cap: if cleanup didn't free enough space, reset the map
		// to prevent OOM in a 512MB heap environment.
		if len(g.seen) >= 100_000 {
			g.seen = make(map[string]time.Time, 1024)
		}
	}

	g.seen[requestID] = now.Add(g.replayWindow)
	return true
}

// Cleanup removes expired entries from both the database (if configured)
// and the in-memory map.
func (g *Guard) Cleanup(ctx context.Context) {
	if g.db != nil {
		dbCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()
		if _, err := g.db.CleanupSeenRequests(dbCtx, g.serviceID); err != nil {
			if g.logger != nil {
				g.logger("failed to cleanup seen requests in DB", err)
			}
		}
	}
	g.cleanupInMemory()
}

func (g *Guard) cleanupInMemory() {
	now := time.Now()
	g.mu.Lock()
	defer g.mu.Unlock()

	for key, until := range g.seen {
		if now.After(until) {
			delete(g.seen, key)
		}
	}
}
