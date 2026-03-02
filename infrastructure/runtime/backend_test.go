package runtime

import "testing"

func TestBackendDefaultsToNitro(t *testing.T) {
	t.Setenv("TEE_BACKEND", "")
	t.Setenv("NITRO_ATTESTATION_DOCUMENT_B64", "")

	if got := Backend(); got != TEENitro {
		t.Fatalf("Backend() = %q, want %q", got, TEENitro)
	}
}

func TestBackendLegacySimulationAliasFallsBackToNitro(t *testing.T) {
	t.Setenv("TEE_BACKEND", "simulation")
	if got := Backend(); got != TEENitro {
		t.Fatalf("Backend() = %q, want %q", got, TEENitro)
	}
}

func TestBackendNitroFromEvidence(t *testing.T) {
	t.Setenv("TEE_BACKEND", "")
	t.Setenv("NITRO_ATTESTATION_DOCUMENT_B64", "abc")
	if got := Backend(); got != TEENitro {
		t.Fatalf("Backend() = %q, want %q", got, TEENitro)
	}
}
