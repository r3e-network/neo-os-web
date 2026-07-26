//go:build scripts

package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nspcc-dev/neo-go/pkg/util"
)

func TestSharedAaMaterializationBlockPersistsReport(t *testing.T) {
	reportPath := filepath.Join(t.TempDir(), "blocked.json")
	report := rrReport{
		Action:         "cohort0-materialize-abstract-accounts",
		DryRun:         true,
		Apps:           []rrAppRecord{{AppID: "miniapp-one", Status: "pending"}},
		Transactions:   []rrTxRecord{},
		Balances:       map[string]string{},
		GeneratedAtUTC: "2026-07-24T00:00:00Z",
		RosterSource:   "test",
	}

	err := rrBlockMaterializationReport(reportPath, &report, "abstractAccountCore method not found")
	if err == nil || !strings.Contains(err.Error(), "blocked report flushed") {
		t.Fatalf("expected blocked report error, got %v", err)
	}
	contents, readErr := os.ReadFile(reportPath)
	if readErr != nil {
		t.Fatal(readErr)
	}
	var persisted rrReport
	if err := json.Unmarshal(contents, &persisted); err != nil {
		t.Fatal(err)
	}
	if persisted.Status != "blocked" || persisted.Error != "abstractAccountCore method not found" {
		t.Fatalf("unexpected blocked report: %+v", persisted)
	}
	if persisted.ChainWritesPerformed {
		t.Fatal("blocked dry-run report must prove that no chain write occurred")
	}
	if persisted.Summary.Pending != 1 || len(persisted.NextSteps) != 2 {
		t.Fatalf("blocked report lost roster evidence: %+v", persisted)
	}
}

func TestSharedAaMaterializationWriteGateRequiresReadyPreflight(t *testing.T) {
	tempDir := t.TempDir()
	registry, err := util.Uint160DecodeStringLE(strings.Repeat("11", 20))
	if err != nil {
		t.Fatal(err)
	}
	core, err := util.Uint160DecodeStringLE(strings.Repeat("22", 20))
	if err != nil {
		t.Fatal(err)
	}
	upgradePath := filepath.Join(tempDir, "upgrade.json")
	rosterPath := filepath.Join(tempDir, "roster.json")
	writeJSON := func(path, content string) {
		t.Helper()
		if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	writeJSON(upgradePath, `{
  "evaluation": {"phase": "ready_to_materialize_dry_run", "safe_to_materialize": true},
  "contracts": {
    "registry": {"hash": "0x1111111111111111111111111111111111111111"},
    "abstract_account": {"hash": "0x2222222222222222222222222222222222222222"}
  },
  "chain_writes_performed": false
}`)
	writeJSON(rosterPath, `{
  "source": {"registry_hash": "0x1111111111111111111111111111111111111111"},
  "summary": {
    "roster_total": 2,
    "derived_account_ids": 2,
    "unique_predicted_account_ids": 2,
    "complete": true
  }
}`)
	t.Setenv("PLATFORM_REGISTRY_SHARED_AA_PREFLIGHT_PATH", upgradePath)
	t.Setenv("PLATFORM_REGISTRY_SHARED_AA_ROSTER_PREFLIGHT_PATH", rosterPath)

	if err := rrRequireSharedAaMaterializationPreflight(registry, core); err != nil {
		t.Fatalf("ready preflight rejected: %v", err)
	}

	writeJSON(upgradePath, `{
  "evaluation": {"phase": "upgrade_contracts", "safe_to_materialize": false},
  "contracts": {
    "registry": {"hash": "0x1111111111111111111111111111111111111111"},
    "abstract_account": {"hash": "0x2222222222222222222222222222222222222222"}
  },
  "chain_writes_performed": false
}`)
	if err := rrRequireSharedAaMaterializationPreflight(registry, core); err == nil ||
		!strings.Contains(err.Error(), "not ready") {
		t.Fatalf("expected upgrade phase to fail closed, got %v", err)
	}
}

func TestPlatformOwnedAppIdsUseFeeExemptRegistrationLane(t *testing.T) {
	if !rrIsPlatformOwnedAppID("miniapp-new-game") {
		t.Fatal("miniapp-* must be classified as platform-owned")
	}
	if rrRegistrationMethod("miniapp-new-game") != "registerAppByPlatform" {
		t.Fatal("platform-owned ids must use registerAppByPlatform")
	}
	if rrIsPlatformOwnedAppID("community-game") {
		t.Fatal("custom ids must remain permissionless")
	}
	if rrRegistrationMethod("community-game") != "registerApp" {
		t.Fatal("custom ids must use registerApp")
	}
}
