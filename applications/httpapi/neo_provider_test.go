package httpapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
)

func writeManifest(t *testing.T, dir string, snap neoSnapshot) {
	t.Helper()
	path := filepath.Join(dir, "block-"+strconv.FormatInt(snap.Height, 10)+".json")
	data, err := json.Marshal(snap)
	if err != nil {
		t.Fatalf("marshal manifest: %v", err)
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatalf("write manifest: %v", err)
	}
}

func TestNeoReaderStatusBlocksAndStorage(t *testing.T) {
	oldBuf := os.Getenv("NEO_STABLE_BUFFER")
	t.Cleanup(func() { _ = os.Setenv("NEO_STABLE_BUFFER", oldBuf) })
	_ = os.Setenv("NEO_STABLE_BUFFER", "0")

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	dir := t.TempDir()
	now := time.Now().UTC()
	writeManifest(t, dir, neoSnapshot{Network: "mainnet", Height: 5, StateRoot: "0xroot", KVPath: "block-5-kv.tar.gz", KVHash: "abc"})

	reader := newNeoReader(db, dir, "")
	ctx := context.Background()

	// Status expectations
	mock.ExpectQuery(`SELECT COALESCE\(MAX\(height\), 0\), COUNT\(\*\) FROM neo_blocks`).
		WillReturnRows(sqlmock.NewRows([]string{"max", "count"}).AddRow(int64(10), int64(11)))
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM neo_transactions`).
		WillReturnRows(sqlmock.NewRows([]string{"cnt"}).AddRow(int64(3)))
	mock.ExpectQuery(`SELECT hash, state_root, block_time FROM neo_blocks ORDER BY height DESC LIMIT 1`).
		WillReturnRows(sqlmock.NewRows([]string{"hash", "state_root", "block_time"}).AddRow("0xhash", "0xroot", now))
	mock.ExpectQuery(`SELECT value::BIGINT FROM neo_meta WHERE key = \$1`).
		WithArgs("stable_height").
		WillReturnError(sql.ErrNoRows)

	status, err := reader.Status(ctx)
	if err != nil {
		t.Fatalf("status: %v", err)
	}
	if status.LatestHeight != 10 || status.BlockCount != 11 || status.TxCount != 3 {
		t.Fatalf("unexpected status: %+v", status)
	}
	if status.SnapshotCount != 1 {
		t.Fatalf("expected 1 snapshot, got %d", status.SnapshotCount)
	}
	if status.StableHeight != status.LatestHeight {
		t.Fatalf("expected stable height to mirror latest when buffer=0: %d vs %d", status.StableHeight, status.LatestHeight)
	}
	snaps, err := reader.ListSnapshots(ctx, 10)
	if err != nil || len(snaps) != 1 {
		t.Fatalf("expected snapshot list: %v len=%d", err, len(snaps))
	}
	if snaps[0].KVURL == "" || snaps[0].KVURL != "/neo/snapshots/5/kv" {
		t.Fatalf("expected derived kv url, got %+v", snaps[0])
	}

	// Blocks list
	mock.ExpectQuery(`FROM neo_blocks b`).
		WillReturnRows(sqlmock.NewRows([]string{"height", "hash", "state_root", "prev_hash", "next_hash", "block_time", "size", "tx_count"}).
			AddRow(int64(10), "0xhash", "0xroot", "0xprev", "0xnext", now, int64(80), 2))

	blocks, err := reader.ListBlocks(ctx, 5, 0)
	if err != nil {
		t.Fatalf("list blocks: %v", err)
	}
	if len(blocks) != 1 || blocks[0].Hash != "0xhash" {
		t.Fatalf("unexpected blocks: %+v", blocks)
	}

	// Block detail + txs
	mock.ExpectQuery(`SELECT height, hash, state_root, prev_hash, next_hash, block_time, size FROM neo_blocks WHERE height = \$1`).
		WithArgs(int64(10)).
		WillReturnRows(sqlmock.NewRows([]string{"height", "hash", "state_root", "prev_hash", "next_hash", "block_time", "size"}).
			AddRow(int64(10), "0xhash", "0xroot", "0xprev", "0xnext", now, int64(80)))
	mock.ExpectQuery(`SELECT hash, ordinal, type, sender, net_fee, sys_fee, size, vm_state, exception, gas_consumed, stack FROM neo_transactions`).
		WithArgs(int64(10)).
		WillReturnRows(sqlmock.NewRows([]string{"hash", "ordinal", "type", "sender", "net_fee", "sys_fee", "size", "vm_state", "exception", "gas_consumed", "stack"}).
			AddRow("0xtx", 0, "ContractTransaction", "sender", 1.0, 2.0, 120, "HALT", "", 3.0, []byte(`[]`)))
	mock.ExpectQuery(`FROM neo_notifications WHERE tx_hash`).
		WithArgs("0xtx").
		WillReturnRows(sqlmock.NewRows([]string{"contract", "event", "exec_index", "state"}))
	mock.ExpectQuery(`FROM neo_transaction_executions WHERE tx_hash`).
		WithArgs("0xtx").
		WillReturnRows(sqlmock.NewRows([]string{"exec_index", "vm_state", "exception", "gas_consumed", "stack", "notifications"}))

	detail, err := reader.GetBlock(ctx, 10)
	if err != nil {
		t.Fatalf("get block: %v", err)
	}
	if detail.Block.Height != 10 || len(detail.Transactions) != 1 {
		t.Fatalf("unexpected block detail: %+v", detail)
	}

	// Storage
	mock.ExpectQuery(`FROM neo_storage`).WithArgs(int64(10)).
		WillReturnRows(sqlmock.NewRows([]string{"contract", "kv"}).AddRow("0xdead", json.RawMessage(`[{"key":"00","value":"ff"}]`)))
	storage, err := reader.ListStorage(ctx, 10)
	if err != nil {
		t.Fatalf("list storage: %v", err)
	}
	if len(storage) != 1 || storage[0].Contract != "0xdead" {
		t.Fatalf("unexpected storage: %+v", storage)
	}

	// Storage diffs
	mock.ExpectQuery(`FROM neo_storage_diffs`).WithArgs(int64(10)).
		WillReturnRows(sqlmock.NewRows([]string{"contract", "kv_diff"}).AddRow("0xdead", json.RawMessage(`[{"key":"00","value":"ff"}]`)))
	diffs, err := reader.ListStorageDiff(ctx, 10)
	if err != nil {
		t.Fatalf("list storage diff: %v", err)
	}
	if len(diffs) != 1 || diffs[0].Contract != "0xdead" {
		t.Fatalf("unexpected diffs: %+v", diffs)
	}

	// Storage summary counts
	mock.ExpectQuery(`jsonb_array_length\(kv\)`).WithArgs(int64(10)).
		WillReturnRows(sqlmock.NewRows([]string{"contract", "kv_len"}).AddRow("0xdead", 1))
	mock.ExpectQuery(`jsonb_array_length\(kv_diff\)`).WithArgs(int64(10)).
		WillReturnRows(sqlmock.NewRows([]string{"contract", "diff_len"}).AddRow("0xdead", 2))
	summary, err := reader.StorageSummary(ctx, 10)
	if err != nil {
		t.Fatalf("storage summary: %v", err)
	}
	if len(summary) != 1 || summary[0].Contract != "0xdead" || summary[0].KVEntries != 1 || summary[0].DiffEntries != 2 {
		t.Fatalf("unexpected summary: %+v", summary)
	}

	// Snapshot bundle path should join snapshotDir
	path, err := reader.SnapshotBundlePath(ctx, 5, false)
	if err != nil {
		t.Fatalf("bundle path: %v", err)
	}
	if want := filepath.Join(dir, "block-5-kv.tar.gz"); path != want {
		t.Fatalf("expected bundle path %s got %s", want, path)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}
