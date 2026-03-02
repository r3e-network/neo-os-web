package runtime

import "testing"

func TestBackendDefaultsToNitro(t *testing.T) {
	t.Setenv("TEE_BACKEND", "")
	t.Setenv("NITRO_ATTESTATION_DOCUMENT_B64", "")
	t.Setenv("SGX_QUOTE_B64", "")
	t.Setenv("SGX_QUOTE", "")
	t.Setenv("OE_SIMULATION", "")

	if got := Backend(); got != TEENitro {
		t.Fatalf("Backend() = %q, want %q", got, TEENitro)
	}
}

func TestBackendExplicitSimulation(t *testing.T) {
	t.Setenv("TEE_BACKEND", "simulation")
	if got := Backend(); got != TEESim {
		t.Fatalf("Backend() = %q, want %q", got, TEESim)
	}
}

func TestBackendLegacySGXAliasToNitro(t *testing.T) {
	t.Setenv("TEE_BACKEND", "sgx")
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

func TestBackendNitroFromLegacySignals(t *testing.T) {
	t.Setenv("TEE_BACKEND", "")
	t.Setenv("NITRO_ATTESTATION_DOCUMENT_B64", "")
	t.Setenv("SGX_QUOTE_B64", "legacy")
	if got := Backend(); got != TEENitro {
		t.Fatalf("Backend() = %q, want %q", got, TEENitro)
	}
}
