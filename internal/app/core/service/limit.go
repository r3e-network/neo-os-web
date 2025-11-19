package service

const (
	// DefaultListLimit is the standard default page size used across services.
	DefaultListLimit = 25
	// MaxListLimit is the standard maximum page size used across services.
	MaxListLimit = 500
)

// ClampLimit returns a sane list limit using the provided default and maximum.
// Non-positive values yield the default; values above max clamp to max.
func ClampLimit(limit, defaultLimit, max int) int {
	if defaultLimit <= 0 {
		defaultLimit = DefaultListLimit
	}
	if max <= 0 {
		max = defaultLimit
	}
	if limit <= 0 {
		return defaultLimit
	}
	if limit > max {
		return max
	}
	return limit
}
