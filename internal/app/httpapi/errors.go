package httpapi

import "fmt"

var (
	ErrNeoUnavailable = fmt.Errorf("neo indexer not configured")
	ErrInvalidHeight  = fmt.Errorf("height must be a positive integer")
	ErrMissingHeight  = fmt.Errorf("height path parameter required")
)
