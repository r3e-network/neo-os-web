package jam

import "strings"

// Config governs whether the JAM HTTP API is mounted and which stores to use.
type Config struct {
	Enabled             bool
	Store               string // "memory" (default) or "postgres"
	PGDSN               string
	AuthRequired        bool
	AllowedTokens       []string
	RateLimitPerMinute  int
	MaxPreimageBytes    int64
	MaxPendingPackages  int
	LegacyListResponse  bool
	AccumulatorsEnabled bool
	AccumulatorHash     string
}

// Normalize fills defaults and trims whitespace.
func (c *Config) Normalize() {
	c.Store = strings.TrimSpace(strings.ToLower(c.Store))
	if c.Store == "" {
		c.Store = "memory"
	}
	c.PGDSN = strings.TrimSpace(c.PGDSN)
	c.AllowedTokens = trimStrings(c.AllowedTokens)
	if c.RateLimitPerMinute == 0 {
		c.RateLimitPerMinute = 60
	}
	if c.MaxPreimageBytes == 0 {
		c.MaxPreimageBytes = 10 * 1024 * 1024
	}
	if c.MaxPendingPackages == 0 {
		c.MaxPendingPackages = 100
	}
	c.AccumulatorHash = strings.TrimSpace(strings.ToLower(c.AccumulatorHash))
	if c.AccumulatorHash == "" {
		c.AccumulatorHash = "blake3-256"
	}
}

func trimStrings(in []string) []string {
	var out []string
	for _, s := range in {
		if t := strings.TrimSpace(s); t != "" {
			out = append(out, t)
		}
	}
	return out
}
