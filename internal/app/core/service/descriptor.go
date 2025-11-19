package service

// Layer describes the architectural slice a service belongs to. These map
// loosely to the centralized Chainlink-inspired blueprint (ingress → chain
// adapters → engines → data/external connectors → security/ops).
type Layer string

const (
	LayerIngress  Layer = "ingress"
	LayerAdapter  Layer = "adapter"
	LayerEngine   Layer = "engine"
	LayerData     Layer = "data"
	LayerSecurity Layer = "security"
)

// Descriptor advertises a service's placement and capabilities. It is optional
// and does not change runtime behavior, but allows orchestration layers and
// documentation to reason about modules consistently.
type Descriptor struct {
	Name         string
	Domain       string
	Layer        Layer
	Capabilities []string
}

// WithCapabilities returns a copy of the descriptor with additional
// capabilities appended.
func (d Descriptor) WithCapabilities(caps ...string) Descriptor {
	if len(caps) == 0 {
		return d
	}
	combined := make([]string, 0, len(d.Capabilities)+len(caps))
	combined = append(combined, d.Capabilities...)
	combined = append(combined, caps...)
	d.Capabilities = combined
	return d
}
