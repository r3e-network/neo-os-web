//go:build scripts

package main

import (
	"strings"
	"testing"
)

func TestSharedAAActionSpecs(t *testing.T) {
	cases := map[string]struct {
		target string
		method string
	}{
		"propose-registrar": {target: "aa", method: "proposePlatformRegistrar"},
		"confirm-registrar": {target: "aa", method: "confirmPlatformRegistrar"},
		"cancel-registrar":  {target: "aa", method: "cancelPlatformRegistrar"},
		"propose-core":      {target: "registry", method: "proposeAbstractAccountCore"},
		"set-core":          {target: "registry", method: "setAbstractAccountCore"},
		"cancel-core":       {target: "registry", method: "cancelAbstractAccountCore"},
	}
	for action, want := range cases {
		got, err := saaAction(action)
		if err != nil {
			t.Fatalf("%s: %v", action, err)
		}
		if got.Target != want.target || got.Method != want.method {
			t.Fatalf("%s: got %#v, want target=%s method=%s", action, got, want.target, want.method)
		}
	}
}

func TestSharedAAActionRejectsUnknownAction(t *testing.T) {
	if _, err := saaAction("update-both"); err == nil {
		t.Fatal("unknown governance action must fail closed")
	}
}

func TestSharedAADryRunRequiresPublicSigner(t *testing.T) {
	if _, err := saaParseHash(""); err == nil {
		t.Fatal("dry-run must require a public signer identity")
	}
}

func TestSharedAAActionParamsOnlyProposalActionsCarryHash(t *testing.T) {
	registry, err := saaParseHash("0x13ef519c362973f9a34648a9eac5b71250b2a80a")
	if err != nil {
		t.Fatal(err)
	}
	aa, err := saaParseHash("0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2")
	if err != nil {
		t.Fatal(err)
	}
	if got := saaActionParams("propose-registrar", registry, aa); len(got) != 1 || got[0].Value != registry {
		t.Fatalf("unexpected registrar params: %#v", got)
	}
	if got := saaActionParams("propose-core", registry, aa); len(got) != 1 || got[0].Value != aa {
		t.Fatalf("unexpected core params: %#v", got)
	}
	if got := saaActionParams("confirm-registrar", registry, aa); len(got) != 0 {
		t.Fatalf("confirm action must not carry params: %#v", got)
	}
}

func TestSharedAAStatusBlocksMissingGovernanceABI(t *testing.T) {
	report := saaReport{Validation: map[string]any{"governance_abi_ready": false}}
	steps := saaStatusNextSteps(report)
	joined := strings.Join(steps, " ")
	if !strings.Contains(joined, "upgrade AA and Registry") || !strings.Contains(joined, "governance_abi_ready=true") {
		t.Fatalf("status must explain the ABI blocker: %v", steps)
	}
}
