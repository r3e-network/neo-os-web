package system

import (
	"context"

	core "github.com/R3E-Network/service_layer/internal/app/core/service"
)

// Service represents a lifecycle-managed component. All application modules
// must implement this interface so the system manager can start and stop them
// deterministically.
type Service interface {
	Name() string
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
}

// DescriptorProvider optionally advertises service metadata (layer, capabilities).
type DescriptorProvider interface {
	Descriptor() core.Descriptor
}
