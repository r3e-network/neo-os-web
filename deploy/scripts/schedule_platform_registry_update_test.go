//go:build scripts

package main

import (
	"errors"
	"strings"
	"testing"

	"github.com/nspcc-dev/neo-go/pkg/encoding/address"
)

func TestRegistryUpdateDryRunTruthy(t *testing.T) {
	for _, value := range []string{"1", "true", "YES", "on"} {
		if !ruTruthy(value) {
			t.Fatalf("expected %q to enable dry-run flag", value)
		}
	}
	for _, value := range []string{"0", "false", "off", ""} {
		if ruTruthy(value) {
			t.Fatalf("expected %q to keep dry-run flag disabled", value)
		}
	}
}

func TestRegistryUpdateSignerIdentityAcceptsAddressAndHash(t *testing.T) {
	addressValue := "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs"
	hash, err := ruParseSignerIdentity(addressValue)
	if err != nil {
		t.Fatalf("parse address: %v", err)
	}
	if address.Uint160ToString(hash) != addressValue {
		t.Fatalf("address round-trip mismatch: %s", address.Uint160ToString(hash))
	}

	hashValue := "0x" + hash.StringLE()
	parsed, err := ruParseSignerIdentity(hashValue)
	if err != nil {
		t.Fatalf("parse hash: %v", err)
	}
	if parsed != hash {
		t.Fatalf("hash round-trip mismatch: %s", ruHashString(parsed))
	}
}

func TestRegistryUpdateSignerIdentityRejectsMissingIdentity(t *testing.T) {
	if _, err := ruParseSignerIdentity(""); err == nil {
		t.Fatal("missing public signer identity must fail closed")
	}
}

func TestRegistryUpdateProbeNeverReschedulesExistingTimelocks(t *testing.T) {
	tests := []struct {
		state     string
		exception string
		want      string
	}{
		{state: "HALT", want: "matured"},
		{state: "FAULT", exception: "ABORTMSG: timelock active", want: "pending"},
		{state: "FAULT", exception: "ABORTMSG: no upgrade scheduled", want: "none"},
		{state: "FAULT", exception: "ABORTMSG: upgrade data mismatch", want: "conflict"},
		{state: "FAULT", exception: "unexpected failure", want: "unknown"},
	}

	for _, tt := range tests {
		if got := ruClassifyUpdateProbe(tt.state, tt.exception); got != tt.want {
			t.Fatalf("classify state=%q exception=%q: got %q, want %q", tt.state, tt.exception, got, tt.want)
		}
	}
}

func TestRegistryUpdateLittleEndianInteger(t *testing.T) {
	value := ruLittleEndianInteger([]byte{0x2a, 0x53, 0x64, 0x79, 0x9f, 0x01})
	if value.String() != "1784448045866" {
		t.Fatalf("unexpected little-endian value: %s", value.String())
	}
}

func TestRegistryUpdateRecordsPendingStorage(t *testing.T) {
	report := ruReport{Validation: map[string]any{}}
	ruRecordPendingUpdate(&report, ruPendingUpdate{
		Hash:            "0xdeadbeef",
		ExecuteAfterMS:  "1784448045866",
		ExecuteAfterUTC: "2026-07-19T08:00:45Z",
	})
	if report.Validation["existing_update_storage_hash"] != "0xdeadbeef" {
		t.Fatalf("pending hash was not recorded: %#v", report.Validation)
	}
	if report.Validation["existing_update_execute_after_ms"] != "1784448045866" {
		t.Fatalf("pending timestamp was not recorded: %#v", report.Validation)
	}
	if report.Validation["existing_update_execute_after_utc"] != "2026-07-19T08:00:45Z" {
		t.Fatalf("pending UTC timestamp was not recorded: %#v", report.Validation)
	}
}

func TestRegistryUpdateReportStartsEmpty(t *testing.T) {
	report := ruReport{Validation: map[string]any{}}
	ruRecordPendingUpdate(&report, ruPendingUpdate{})
	if len(report.Validation) != 0 {
		t.Fatalf("empty pending state should not create validation fields: %#v", report.Validation)
	}
}

func TestRegistryUpdateStatusFailsClosedOnUnknownStorage(t *testing.T) {
	steps := ruStatusNextSteps(ruPendingUpdate{}, errors.New("RPC timeout"))
	joined := strings.Join(steps, " ")
	if strings.Contains(joined, "schedule:") {
		t.Fatalf("unknown storage state must not recommend scheduling: %s", joined)
	}
	if !strings.Contains(joined, "do not schedule") {
		t.Fatalf("unknown storage state must stop all update actions: %s", joined)
	}
}

func TestRegistryUpdateStatusRequiresInspectionForPendingStorage(t *testing.T) {
	steps := ruStatusNextSteps(ruPendingUpdate{Hash: "0xdeadbeef"}, nil)
	joined := strings.Join(steps, " ")
	if strings.Contains(joined, "schedule:") {
		t.Fatalf("pending storage must not recommend scheduling: %s", joined)
	}
	if !strings.Contains(joined, "inspect") {
		t.Fatalf("pending storage must require artifact inspection: %s", joined)
	}
}

func TestRegistryUpdateDigestUsesNefThenManifestBytes(t *testing.T) {
	if got := ruUpdateDigest([]byte("nef"), []byte("manifest")); got != "0xe73232db5edad85acbc26e474eb017ab30a8de3f80bf33e5f3ef7fa8eae7c33a" {
		t.Fatalf("unexpected update digest: %s", got)
	}
}
