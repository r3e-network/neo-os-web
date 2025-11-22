package jam

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
)

type autoRefiner struct{}

func (autoRefiner) Refine(_ context.Context, pkg WorkPackage, _ PreimageStore) (WorkReport, error) {
	return WorkReport{
		ID:               uuid.NewString(),
		PackageID:        pkg.ID,
		ServiceID:        pkg.ServiceID,
		RefineOutputHash: "hash",
	}, nil
}

type autoAttestor struct{}

func (autoAttestor) Attest(_ context.Context, _ WorkReport) (Attestation, error) {
	return Attestation{WorkerID: "attestor-1"}, nil
}

type countingAccumulator struct {
	count int
}

func (c *countingAccumulator) Accumulate(_ context.Context, _ WorkReport, _ []Message) error {
	c.count++
	return nil
}

func TestHTTPHandlerEndToEnd(t *testing.T) {
	store := NewInMemoryStore()
	preimages := NewMemPreimageStore()
	accum := &countingAccumulator{}
	engine := Engine{
		Preimages:   preimages,
		Refiner:     autoRefiner{},
		Attestors:   []Attestor{autoAttestor{}},
		Accumulator: accum,
		Threshold:   1,
	}
	coord := Coordinator{Store: store, Engine: engine}
	handler := NewHTTPHandler(store, preimages, coord)
	server := httptest.NewServer(handler)
	defer server.Close()

	// Upload preimage.
	content := []byte("demo")
	sum := sha256.Sum256(content)
	hash := hex.EncodeToString(sum[:])
	req, _ := http.NewRequest(http.MethodPut, server.URL+"/jam/preimages/"+hash, bytes.NewReader(content))
	req.Header.Set("Content-Type", "text/plain")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("preimage put err: %v", err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("preimage status %d", resp.StatusCode)
	}
	resp.Body.Close()

	// Submit a package.
	payload := map[string]any{
		"service_id": "svc-1",
		"items": []map[string]any{
			{"kind": "demo", "params_hash": "abc123"},
		},
	}
	body, _ := json.Marshal(payload)
	resp, err = http.Post(server.URL+"/jam/packages", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("post package err: %v", err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("package status %d", resp.StatusCode)
	}
	var pkgResp WorkPackage
	if err := json.NewDecoder(resp.Body).Decode(&pkgResp); err != nil {
		t.Fatalf("decode package: %v", err)
	}
	resp.Body.Close()
	if pkgResp.ID == "" || len(pkgResp.Items) != 1 {
		t.Fatalf("bad package response: %+v", pkgResp)
	}

	// Process next package.
	resp, err = http.Post(server.URL+"/jam/process", "application/json", nil)
	if err != nil {
		t.Fatalf("process err: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("process status %d", resp.StatusCode)
	}
	resp.Body.Close()

	// Fetch package and report.
	resp, err = http.Get(server.URL + "/jam/packages/" + pkgResp.ID)
	if err != nil {
		t.Fatalf("get package: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("get package status %d", resp.StatusCode)
	}
	var pkgFetched WorkPackage
	if err := json.NewDecoder(resp.Body).Decode(&pkgFetched); err != nil {
		t.Fatalf("decode pkg fetched: %v", err)
	}
	resp.Body.Close()
	if pkgFetched.Status != PackageStatusApplied {
		t.Fatalf("expected applied status, got %s", pkgFetched.Status)
	}

	resp, err = http.Get(server.URL + "/jam/packages/" + pkgResp.ID + "/report")
	if err != nil {
		t.Fatalf("get report: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("report status %d", resp.StatusCode)
	}
	var reportPayload struct {
		Report       WorkReport    `json:"report"`
		Attestations []Attestation `json:"attestations"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&reportPayload); err != nil {
		t.Fatalf("decode report: %v", err)
	}
	resp.Body.Close()
	if reportPayload.Report.PackageID != pkgResp.ID {
		t.Fatalf("report package mismatch")
	}
	if len(reportPayload.Attestations) != 1 {
		t.Fatalf("expected 1 attestation")
	}
	if accum.count != 1 {
		t.Fatalf("accumulator not called")
	}
}
