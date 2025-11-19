package system

import (
	"sort"

	core "github.com/R3E-Network/service_layer/internal/app/core/service"
)

// CollectDescriptors extracts service descriptors, skipping nil entries, and
// sorts them for deterministic presentation (layer + name).
func CollectDescriptors(providers []DescriptorProvider) []core.Descriptor {
	var out []core.Descriptor
	for _, p := range providers {
		if p == nil {
			continue
		}
		out = append(out, p.Descriptor())
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Layer == out[j].Layer {
			return out[i].Name < out[j].Name
		}
		return out[i].Layer < out[j].Layer
	})
	return out
}
