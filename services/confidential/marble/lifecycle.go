// Package confidentialmarble provides lifecycle management for the confidential compute service.
package confidentialmarble

import (
	"context"
)

// =============================================================================
// Lifecycle
// =============================================================================

// Start starts the Confidential Compute service.
func (s *Service) Start(ctx context.Context) error {
	return s.Service.Start(ctx)
}

// Stop stops the Confidential Compute service.
func (s *Service) Stop() error {
	return s.Service.Stop()
}
