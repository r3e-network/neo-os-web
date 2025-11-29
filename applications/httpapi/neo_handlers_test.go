package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	app "github.com/R3E-Network/service_layer/applications"
	"github.com/R3E-Network/service_layer/applications/jam"
)

type stubNeoProvider struct {
	status    neoStatus
	blocks    []neoBlock
	detail    neoBlockDetail
	snapshots []neoSnapshot
	err       error
	storage   []neoStorage
	summary   []neoStorageSummary
}

func (s *stubNeoProvider) Status(ctx context.Context) (neoStatus, error) {
	if s.err != nil {
		return neoStatus{}, s.err
	}
	return s.status, nil
}

func (s *stubNeoProvider) ListBlocks(_ context.Context, limit, offset int) ([]neoBlock, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.blocks, nil
}

func (s *stubNeoProvider) GetBlock(_ context.Context, _ int64) (neoBlockDetail, error) {
	if s.err != nil {
		return neoBlockDetail{}, s.err
	}
	return s.detail, nil
}

func (s *stubNeoProvider) ListSnapshots(_ context.Context, _ int) ([]neoSnapshot, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.snapshots, nil
}

func (s *stubNeoProvider) GetSnapshot(_ context.Context, _ int64) (neoSnapshot, error) {
	if s.err != nil {
		return neoSnapshot{}, s.err
	}
	if len(s.snapshots) > 0 {
		return s.snapshots[0], nil
	}
	return neoSnapshot{}, os.ErrNotExist
}

func (s *stubNeoProvider) ListStorage(_ context.Context, _ int64) ([]neoStorage, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.storage, nil
}

func (s *stubNeoProvider) ListStorageDiff(_ context.Context, _ int64) ([]neoStorageDiff, error) {
	if s.err != nil {
		return nil, s.err
	}
	return []neoStorageDiff{{Contract: "0xdead", KVDiff: json.RawMessage(`[{"key":"00","value":"ff"}]`)}}, nil
}

func (s *stubNeoProvider) StorageSummary(_ context.Context, _ int64) ([]neoStorageSummary, error) {
	if s.err != nil {
		return nil, s.err
	}
	if len(s.summary) > 0 {
		return s.summary, nil
	}
	return []neoStorageSummary{{Contract: "0xdead", KVEntries: 1, DiffEntries: 1}}, nil
}

func (s *stubNeoProvider) SnapshotBundlePath(_ context.Context, _ int64, _ bool) (string, error) {
	if s.err != nil {
		return "", s.err
	}
	return "", os.ErrNotExist
}

func TestNeoEndpointsUnavailable(t *testing.T) {
	application, err := app.New(app.NewMemoryStoresForTest(), nil)
	if err != nil {
		t.Fatalf("new app: %v", err)
	}
	handler := wrapWithAuth(NewHandler(application, jam.Config{}, []string{"t"}, nil, newAuditLog(10, nil), nil, nil), []string{"t"}, testLogger, nil)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/neo/status", nil)
	req.Header.Set("Authorization", "Bearer t")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", resp.StatusCode)
	}
}

func TestNeoEndpointsHappyPath(t *testing.T) {
	application, err := app.New(app.NewMemoryStoresForTest(), nil)
	if err != nil {
		t.Fatalf("new app: %v", err)
	}
	now := time.Now().UTC()
	stub := &stubNeoProvider{
		status: neoStatus{Enabled: true, LatestHeight: 12, LatestHash: "0xabc", LatestStateRoot: "0xroot"},
		blocks: []neoBlock{{Height: 12, Hash: "0xabc", StateRoot: "0xroot", BlockTime: &now, TxCount: 1}},
		detail: neoBlockDetail{
			Block: neoBlock{Height: 12, Hash: "0xabc", StateRoot: "0xroot", BlockTime: &now, TxCount: 1},
			Transactions: []neoTransaction{
				{
					Hash:        "0xtx",
					Ordinal:     0,
					Type:        "ContractTransaction",
					VMState:     "HALT",
					GasConsumed: 1.23,
					Notifications: []neoNotification{
						{Contract: "0xdead", Event: "Transfer", ExecIndex: 0},
					},
				},
			},
		},
		snapshots: []neoSnapshot{{Network: "mainnet", Height: 12, StateRoot: "0xroot", Generated: now, KVPath: "block-12-kv.tar.gz"}},
		storage:   []neoStorage{{Contract: "0xdead", KV: json.RawMessage(`[{"key":"00","value":"ff"}]`)}},
	}
	handler := wrapWithAuth(NewHandler(application, jam.Config{}, []string{"t"}, nil, newAuditLog(10, nil), stub, nil), []string{"t"}, testLogger, nil)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	client := http.DefaultClient
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/neo/status", nil)
	req.Header.Set("Authorization", "Bearer t")
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("status request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status code: %d", resp.StatusCode)
	}
	var status neoStatus
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		t.Fatalf("decode status: %v", err)
	}
	if status.LatestHeight != 12 || status.LatestHash != "0xabc" {
		t.Fatalf("unexpected status payload: %+v", status)
	}
	// checkpoint should behave the same
	req, _ = http.NewRequest(http.MethodGet, srv.URL+"/neo/checkpoint", nil)
	req.Header.Set("Authorization", "Bearer t")
	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("checkpoint request: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("checkpoint status %d", resp.StatusCode)
	}

	req, _ = http.NewRequest(http.MethodGet, srv.URL+"/neo/blocks", nil)
	req.Header.Set("Authorization", "Bearer t")
	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("blocks request: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("blocks status %d", resp.StatusCode)
	}
	var blocks []neoBlock
	if err := json.NewDecoder(resp.Body).Decode(&blocks); err != nil {
		t.Fatalf("decode blocks: %v", err)
	}
	if len(blocks) != 1 || blocks[0].Hash != "0xabc" {
		t.Fatalf("unexpected blocks payload: %+v", blocks)
	}
	resp.Body.Close()

	req, _ = http.NewRequest(http.MethodGet, srv.URL+"/neo/blocks/12", nil)
	req.Header.Set("Authorization", "Bearer t")
	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("block detail request: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("block detail status %d", resp.StatusCode)
	}
	var detail neoBlockDetail
	if err := json.NewDecoder(resp.Body).Decode(&detail); err != nil {
		t.Fatalf("decode detail: %v", err)
	}
	if detail.Block.Height != 12 || len(detail.Transactions) != 1 {
		t.Fatalf("unexpected detail: %+v", detail)
	}
	resp.Body.Close()

	req, _ = http.NewRequest(http.MethodGet, srv.URL+"/neo/snapshots", nil)
	req.Header.Set("Authorization", "Bearer t")
	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("snapshots request: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("snapshots status %d", resp.StatusCode)
	}
	var snaps []neoSnapshot
	if err := json.NewDecoder(resp.Body).Decode(&snaps); err != nil {
		t.Fatalf("decode snapshots: %v", err)
	}
	if len(snaps) != 1 || snaps[0].Height != 12 {
		t.Fatalf("unexpected snapshots: %+v", snaps)
	}
	resp.Body.Close()

	req, _ = http.NewRequest(http.MethodGet, srv.URL+"/neo/storage/12", nil)
	req.Header.Set("Authorization", "Bearer t")
	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("storage request: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("storage status %d", resp.StatusCode)
	}
	var storage []neoStorage
	if err := json.NewDecoder(resp.Body).Decode(&storage); err != nil {
		t.Fatalf("decode storage: %v", err)
	}
	if len(storage) != 1 || storage[0].Contract != "0xdead" {
		t.Fatalf("unexpected storage: %+v", storage)
	}
	resp.Body.Close()

	req, _ = http.NewRequest(http.MethodGet, srv.URL+"/neo/storage-diff/12", nil)
	req.Header.Set("Authorization", "Bearer t")
	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("storage diff request: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("storage diff status %d", resp.StatusCode)
	}
	var diffs []neoStorageDiff
	if err := json.NewDecoder(resp.Body).Decode(&diffs); err != nil {
		t.Fatalf("decode storage diff: %v", err)
	}
	if len(diffs) == 0 {
		t.Fatalf("expected diff results")
	}

	req, _ = http.NewRequest(http.MethodGet, srv.URL+"/neo/storage-summary/12", nil)
	req.Header.Set("Authorization", "Bearer t")
	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("storage summary request: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("storage summary status %d", resp.StatusCode)
	}
	var summary []neoStorageSummary
	if err := json.NewDecoder(resp.Body).Decode(&summary); err != nil {
		t.Fatalf("decode storage summary: %v", err)
	}
	if len(summary) != 1 || summary[0].Contract != "0xdead" || summary[0].KVEntries != 1 || summary[0].DiffEntries != 1 {
		t.Fatalf("unexpected summary: %+v", summary)
	}
}
