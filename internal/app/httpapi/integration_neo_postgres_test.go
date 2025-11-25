//go:build integration && postgres

package httpapi

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	app "github.com/R3E-Network/service_layer/internal/app"
	"github.com/R3E-Network/service_layer/internal/app/auth"
	"github.com/R3E-Network/service_layer/internal/app/jam"
	"github.com/R3E-Network/service_layer/internal/app/storage/postgres"
	"github.com/R3E-Network/service_layer/internal/platform/database"
	"github.com/R3E-Network/service_layer/internal/platform/migrations"
	"github.com/joho/godotenv"
)

// Integration coverage for NEO endpoints backed by Postgres + manifest on disk.
func TestIntegrationNeoPostgres(t *testing.T) {
	_ = godotenv.Load()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping Postgres integration")
	}

	ctx := context.Background()
	db, err := database.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	if err := migrations.Apply(ctx, db); err != nil {
		t.Fatalf("apply migrations: %v", err)
	}

	// Seed NEO tables
	now := time.Now().UTC()
	mustExec(t, db, `DELETE FROM neo_transaction_executions`)
	mustExec(t, db, `DELETE FROM neo_notifications`)
	mustExec(t, db, `DELETE FROM neo_transactions`)
	mustExec(t, db, `DELETE FROM neo_storage_diffs`)
	mustExec(t, db, `DELETE FROM neo_storage`)
	mustExec(t, db, `DELETE FROM neo_blocks`)

	mustExec(t, db, `
		INSERT INTO neo_blocks(height, hash, state_root, prev_hash, next_hash, block_time, size, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$6)
	`, int64(10), "0xhash", "0xroot", "0xprev", "0xnext", now, int64(100))
	mustExec(t, db, `
		INSERT INTO neo_transactions(hash, height, ordinal, type, sender, net_fee, sys_fee, size, vm_state, gas_consumed, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
	`, "0xtx", int64(10), 0, "ContractTransaction", "0xsender", 1.0, 2.0, 120, "HALT", 3.0, now)
	mustExec(t, db, `
		INSERT INTO neo_notifications(tx_hash, contract, event, exec_index, state, created_at)
		VALUES ($1,$2,$3,$4,$5,$6)
	`, "0xtx", "0xdead", "Transfer", 0, json.RawMessage(`["from","to",1]`), now)
	mustExec(t, db, `
		INSERT INTO neo_transaction_executions(tx_hash, exec_index, vm_state, gas_consumed, stack, notifications, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
	`, "0xtx", 0, "HALT", 3.0, json.RawMessage(`[]`), json.RawMessage(`[{"contract":"0xdead","event":"Transfer"}]`), now)
	mustExec(t, db, `
		INSERT INTO neo_storage(height, contract, kv, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$4)
	`, int64(10), "0xdead", json.RawMessage(`[{"key":"00","value":"ff"}]`), now)
	mustExec(t, db, `
		INSERT INTO neo_storage_diffs(height, contract, kv_diff, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$4)
	`, int64(10), "0xdead", json.RawMessage(`[{"key":"00","value":"ff"}]`), now)

	// Write manifest to temp dir
	snapDir := t.TempDir()
	manifest := neoSnapshot{
		Network:   "mainnet",
		Height:    10,
		StateRoot: "0xroot",
		KVPath:    "block-10-kv.tar.gz",
		KVHash:    "abc",
	}
	data, _ := json.Marshal(manifest)
	if err := os.WriteFile(filepath.Join(snapDir, "block-10.json"), data, 0o644); err != nil {
		t.Fatalf("write manifest: %v", err)
	}
	if err := os.WriteFile(filepath.Join(snapDir, "block-10-kv.tar.gz"), []byte("kv-bundle"), 0o644); err != nil {
		t.Fatalf("write kv bundle: %v", err)
	}

	pgStore := postgres.New(db)
	stores := app.Stores{
		Accounts:         pgStore,
		Functions:        pgStore,
		Triggers:         pgStore,
		GasBank:          pgStore,
		Automation:       pgStore,
		PriceFeeds:       pgStore,
		DataFeeds:        pgStore,
		DataStreams:      pgStore,
		DataLink:         pgStore,
		DTA:              pgStore,
		Confidential:     pgStore,
		Oracle:           pgStore,
		Secrets:          pgStore,
		CRE:              pgStore,
		CCIP:             pgStore,
		VRF:              pgStore,
		WorkspaceWallets: pgStore,
	}
	appInstance, err := app.New(stores, nil)
	if err != nil {
		t.Fatalf("new application: %v", err)
	}
	if err := appInstance.Start(ctx); err != nil {
		t.Fatalf("start application: %v", err)
	}
	t.Cleanup(func() { _ = appInstance.Stop(context.Background()) })

	tokens := []string{"dev-token"}
	authMgr := auth.NewManager("integration-secret", []auth.User{{Username: "admin", Password: "pass", Role: "admin"}})
	auditBuf := newAuditLog(10, nil)
	handler := NewHandler(appInstance, jam.Config{}, tokens, authMgr, auditBuf, newNeoReader(db, snapDir, ""), nil)
	handler = wrapWithAuth(handler, tokens, nil, authMgr)
	handler = wrapWithAudit(handler, auditBuf)
	handler = wrapWithCORS(handler)

	srv := httptest.NewServer(handler)
	defer srv.Close()
	client := srv.Client()

	authz := map[string]string{"Authorization": "Bearer dev-token"}

	// Status
	resp := doWithHeaders(t, client, srv.URL+"/neo/status", http.MethodGet, nil, authz)
	if resp.Code != http.StatusOK {
		t.Fatalf("status code: %d", resp.Code)
	}

	// Blocks list
	resp = doWithHeaders(t, client, srv.URL+"/neo/blocks?limit=5", http.MethodGet, nil, authz)
	if resp.Code != http.StatusOK {
		t.Fatalf("blocks code: %d", resp.Code)
	}
	var blocks []neoBlock
	_ = json.Unmarshal(resp.Body.Bytes(), &blocks)
	if len(blocks) != 1 || blocks[0].Height != 10 {
		t.Fatalf("unexpected blocks: %+v", blocks)
	}

	// Block detail
	resp = doWithHeaders(t, client, srv.URL+"/neo/blocks/10", http.MethodGet, nil, authz)
	if resp.Code != http.StatusOK {
		t.Fatalf("block detail code: %d", resp.Code)
	}
	var detail neoBlockDetail
	_ = json.Unmarshal(resp.Body.Bytes(), &detail)
	if detail.Block.Height != 10 || len(detail.Transactions) != 1 {
		t.Fatalf("unexpected detail: %+v", detail)
	}

	// Snapshots list/detail
	resp = doWithHeaders(t, client, srv.URL+"/neo/snapshots", http.MethodGet, nil, authz)
	if resp.Code != http.StatusOK {
		t.Fatalf("snapshots code: %d", resp.Code)
	}
	resp = doWithHeaders(t, client, srv.URL+"/neo/snapshots/10", http.MethodGet, nil, authz)
	if resp.Code != http.StatusOK {
		t.Fatalf("snapshot detail code: %d", resp.Code)
	}
	resp = doWithHeaders(t, client, srv.URL+"/neo/snapshots/10/kv", http.MethodGet, nil, authz)
	if resp.Code != http.StatusOK {
		t.Fatalf("snapshot kv code: %d", resp.Code)
	}
	if ct := resp.Header().Get("Content-Type"); ct != "application/gzip" {
		t.Fatalf("snapshot kv content-type: %s", ct)
	}
	if !bytes.Equal(resp.Body.Bytes(), []byte("kv-bundle")) {
		t.Fatalf("snapshot kv body mismatch: %s", string(resp.Body.Bytes()))
	}

	// Storage
	resp = doWithHeaders(t, client, srv.URL+"/neo/storage/10", http.MethodGet, nil, authz)
	if resp.Code != http.StatusOK {
		t.Fatalf("storage code: %d", resp.Code)
	}
	var storage []neoStorage
	_ = json.Unmarshal(resp.Body.Bytes(), &storage)
	if len(storage) != 1 || storage[0].Contract != "0xdead" {
		t.Fatalf("unexpected storage: %+v", storage)
	}

	resp = doWithHeaders(t, client, srv.URL+"/neo/storage-diff/10", http.MethodGet, nil, authz)
	if resp.Code != http.StatusOK {
		t.Fatalf("storage diff code: %d", resp.Code)
	}
	var diffs []neoStorageDiff
	_ = json.Unmarshal(resp.Body.Bytes(), &diffs)
	if len(diffs) != 1 || diffs[0].Contract != "0xdead" {
		t.Fatalf("unexpected diffs: %+v", diffs)
	}

	resp = doWithHeaders(t, client, srv.URL+"/neo/storage-summary/10", http.MethodGet, nil, authz)
	if resp.Code != http.StatusOK {
		t.Fatalf("storage summary code: %d", resp.Code)
	}
	var summary []neoStorageSummary
	_ = json.Unmarshal(resp.Body.Bytes(), &summary)
	if len(summary) != 1 || summary[0].Contract != "0xdead" || summary[0].KVEntries != 1 || summary[0].DiffEntries != 1 {
		t.Fatalf("unexpected storage summary: %+v", summary)
	}
}

func mustExec(t *testing.T, db *sql.DB, q string, args ...any) {
	t.Helper()
	if _, err := db.ExecContext(context.Background(), q, args...); err != nil {
		t.Fatalf("exec %s: %v", q, err)
	}
}
