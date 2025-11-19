package random

import "time"

// Result represents a generated random value.
type Result struct {
	Value     []byte
	CreatedAt time.Time
	Signature []byte
	PublicKey []byte
	RequestID string
	Counter   uint64
	Length    int
}
