package jam

// Config governs whether the JAM HTTP API is mounted and which stores to use.
type Config struct {
	Enabled bool
	Store   string // "memory" (default) or "postgres"
	PGDSN   string
}
