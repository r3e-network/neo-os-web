package jam

import (
	"encoding/hex"
	"strings"
	"testing"
)

func TestWorkPackageValidateAndHash(t *testing.T) {
	pkg := WorkPackage{
		ID:        "pkg-1",
		ServiceID: "svc-1",
		Items: []WorkItem{
			{ID: "it-1", PackageID: "pkg-1", Kind: "demo", ParamsHash: "abc"},
		},
	}

	if err := pkg.ValidateBasic(); err != nil {
		t.Fatalf("expected valid package, got %v", err)
	}
	hash, err := pkg.Hash()
	if err != nil {
		t.Fatalf("hash failed: %v", err)
	}
	if _, err := hex.DecodeString(hash); err != nil {
		t.Fatalf("hash is not hex: %v", err)
	}
}

func TestWorkPackageValidateFails(t *testing.T) {
	pkg := WorkPackage{
		ID:        "pkg-1",
		ServiceID: "svc-1",
		Items: []WorkItem{
			{ID: "", PackageID: "", Kind: "demo", ParamsHash: ""},
		},
	}
	err := pkg.ValidateBasic()
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "missing") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestWorkReportValidateAndHash(t *testing.T) {
	report := WorkReport{
		ID:               "rep-1",
		PackageID:        "pkg-1",
		ServiceID:        "svc-1",
		RefineOutputHash: "deadbeef",
	}
	if err := report.ValidateBasic(); err != nil {
		t.Fatalf("expected valid report, got %v", err)
	}
	hash, err := report.Hash()
	if err != nil {
		t.Fatalf("hash failed: %v", err)
	}
	if _, err := hex.DecodeString(hash); err != nil {
		t.Fatalf("hash is not hex: %v", err)
	}
}
