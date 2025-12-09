// Package oraclemarble provides lifecycle management for the oracle service.
package oraclemarble

import (
	"context"
)

// =============================================================================
// Lifecycle
// =============================================================================

// Start starts the Oracle service.
func (s *Service) Start(ctx context.Context) error {
	return s.Service.Start(ctx)
}

// Stop stops the Oracle service.
func (s *Service) Stop() error {
	return s.Service.Stop()
}
