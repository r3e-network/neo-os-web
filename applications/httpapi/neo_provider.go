package httpapi

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

type neoProvider interface {
	Status(ctx context.Context) (neoStatus, error)
	ListBlocks(ctx context.Context, limit, offset int) ([]neoBlock, error)
	GetBlock(ctx context.Context, height int64) (neoBlockDetail, error)
	ListSnapshots(ctx context.Context, limit int) ([]neoSnapshot, error)
	GetSnapshot(ctx context.Context, height int64) (neoSnapshot, error)
	ListStorage(ctx context.Context, height int64) ([]neoStorage, error)
	ListStorageDiff(ctx context.Context, height int64) ([]neoStorageDiff, error)
	StorageSummary(ctx context.Context, height int64) ([]neoStorageSummary, error)
	SnapshotBundlePath(ctx context.Context, height int64, diff bool) (string, error)
}

type neoStatus struct {
	Enabled         bool      `json:"enabled"`
	LatestHeight    int64     `json:"latest_height"`
	LatestHash      string    `json:"latest_hash,omitempty"`
	LatestStateRoot string    `json:"latest_state_root,omitempty"`
	StableHeight    int64     `json:"stable_height,omitempty"`
	StableHash      string    `json:"stable_hash,omitempty"`
	StableStateRoot string    `json:"stable_state_root,omitempty"`
	BlockCount      int64     `json:"block_count"`
	TxCount         int64     `json:"tx_count"`
	SnapshotCount   int       `json:"snapshot_count"`
	LastIndexedAt   time.Time `json:"last_indexed_at,omitempty"`
	NodeHeight      int64     `json:"node_height,omitempty"`
	NodeLag         int64     `json:"node_lag,omitempty"`
	NodeError       string    `json:"node_error,omitempty"`
}

type neoBlock struct {
	Height    int64      `json:"height"`
	Hash      string     `json:"hash"`
	StateRoot string     `json:"state_root,omitempty"`
	PrevHash  string     `json:"prev_hash,omitempty"`
	NextHash  string     `json:"next_hash,omitempty"`
	BlockTime *time.Time `json:"block_time,omitempty"`
	Size      int64      `json:"size,omitempty"`
	TxCount   int        `json:"tx_count"`
}

type neoBlockDetail struct {
	Block        neoBlock          `json:"block"`
	Transactions []neoTransaction  `json:"transactions"`
	Executions   []neoExecutionRef `json:"executions"`
}

type neoTransaction struct {
	Hash          string            `json:"hash"`
	Ordinal       int               `json:"ordinal"`
	Type          string            `json:"type,omitempty"`
	Sender        string            `json:"sender,omitempty"`
	NetFee        float64           `json:"net_fee,omitempty"`
	SysFee        float64           `json:"sys_fee,omitempty"`
	Size          int               `json:"size,omitempty"`
	VMState       string            `json:"vm_state,omitempty"`
	Exception     string            `json:"exception,omitempty"`
	GasConsumed   float64           `json:"gas_consumed,omitempty"`
	Stack         json.RawMessage   `json:"stack,omitempty"`
	Notifications []neoNotification `json:"notifications,omitempty"`
	Executions    []neoExecution    `json:"executions,omitempty"`
}

type neoExecution struct {
	Index         int               `json:"index"`
	VMState       string            `json:"vm_state,omitempty"`
	Exception     string            `json:"exception,omitempty"`
	GasConsumed   float64           `json:"gas_consumed,omitempty"`
	Stack         json.RawMessage   `json:"stack,omitempty"`
	Notifications []neoNotification `json:"notifications,omitempty"`
}

type neoExecutionRef struct {
	TxHash string `json:"tx_hash"`
	Index  int    `json:"index"`
	State  string `json:"state,omitempty"`
}

type neoNotification struct {
	Contract  string          `json:"contract,omitempty"`
	Event     string          `json:"event,omitempty"`
	ExecIndex int             `json:"exec_index,omitempty"`
	State     json.RawMessage `json:"state,omitempty"`
}

type neoSnapshot struct {
	Network       string    `json:"network"`
	Height        int64     `json:"height"`
	StateRoot     string    `json:"state_root"`
	Generated     time.Time `json:"generated_at"`
	KVPath        string    `json:"kv_path,omitempty"`
	KVURL         string    `json:"kv_url,omitempty"`
	KVHash        string    `json:"kv_sha256,omitempty"`
	KVBytes       int64     `json:"kv_bytes,omitempty"`
	KVDiffPath    string    `json:"kv_diff_path,omitempty"`
	KVDiffURL     string    `json:"kv_diff_url,omitempty"`
	KVDiffHash    string    `json:"kv_diff_sha256,omitempty"`
	KVDiffBytes   int64     `json:"kv_diff_bytes,omitempty"`
	Contracts     []string  `json:"contracts,omitempty"`
	SourceRPC     string    `json:"rpc_url,omitempty"`
	Signature     string    `json:"signature,omitempty"`
	SigningPubKey string    `json:"signing_public_key,omitempty"`
}

type neoStorage struct {
	Contract string          `json:"contract"`
	KV       json.RawMessage `json:"kv"`
}

type neoStorageDiff struct {
	Contract string          `json:"contract"`
	KVDiff   json.RawMessage `json:"kv_diff"`
}

type neoStorageSummary struct {
	Contract    string `json:"contract"`
	KVEntries   int    `json:"kv_entries"`
	DiffEntries int    `json:"diff_entries,omitempty"`
}

type neoReader struct {
	db          *sql.DB
	snapshotDir string
	rpcURL      string
	stableBuf   int64
}

const (
	metaStableHeightKey = "stable_height"
	metaStableHashKey   = "stable_hash"
)

func newNeoReader(db *sql.DB, snapshotDir string, rpcURL string) neoProvider {
	if db == nil {
		return nil
	}
	dir := strings.TrimSpace(snapshotDir)
	if dir == "" {
		dir = "./snapshots"
	}
	return &neoReader{
		db:          db,
		snapshotDir: dir,
		rpcURL:      strings.TrimSpace(rpcURL),
		stableBuf:   stableBufferFromEnv(),
	}
}

func (n *neoReader) Status(ctx context.Context) (neoStatus, error) {
	if n == nil || n.db == nil {
		return neoStatus{Enabled: false}, fmt.Errorf("neo indexer not configured")
	}
	var status neoStatus
	status.Enabled = true
	if err := n.db.QueryRowContext(ctx, `SELECT COALESCE(MAX(height), 0), COUNT(*) FROM neo_blocks`).Scan(&status.LatestHeight, &status.BlockCount); err != nil {
		return status, err
	}
	if err := n.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM neo_transactions`).Scan(&status.TxCount); err != nil {
		return status, err
	}
	var latestHash, latestRoot sql.NullString
	var indexedAt sql.NullTime
	if err := n.db.QueryRowContext(ctx, `
		SELECT hash, state_root, block_time FROM neo_blocks ORDER BY height DESC LIMIT 1
	`).Scan(&latestHash, &latestRoot, &indexedAt); err != nil && err != sql.ErrNoRows {
		return status, err
	}
	status.LatestHash = latestHash.String
	status.LatestStateRoot = latestRoot.String
	status.StableHeight = status.LatestHeight
	status.StableHash = status.LatestHash
	status.StableStateRoot = status.LatestStateRoot
	if indexedAt.Valid {
		status.LastIndexedAt = indexedAt.Time
	}
	// Prefer persisted stable height/hash if recorded by the indexer.
	if stableHeight, stableHash, ok := n.loadStableMeta(ctx); ok && stableHeight >= 0 {
		status.StableHeight = stableHeight
		if stableHash != "" {
			status.StableHash = stableHash
		}
		if stableHeight > 0 {
			var sroot sql.NullString
			if err := n.db.QueryRowContext(ctx, `SELECT state_root FROM neo_blocks WHERE height = $1`, stableHeight).Scan(&sroot); err == nil && sroot.Valid {
				status.StableStateRoot = sroot.String
			}
		}
	}
	snapshots, _ := n.ListSnapshots(ctx, 0)
	status.SnapshotCount = len(snapshots)
	if n.rpcURL != "" {
		nodeHeight, nodeErr := fetchRPCHeight(ctx, n.rpcURL)
		if nodeErr != nil {
			status.NodeError = nodeErr.Error()
		} else {
			status.NodeHeight = nodeHeight
			if status.LatestHeight > 0 && nodeHeight > 0 {
				status.NodeLag = nodeHeight - status.LatestHeight
			}
		}
	}
	// Heuristic stable height: latest minus max(node lag, configured buffer).
	if status.LatestHeight > 0 {
		buffer := n.stableBuf
		if status.NodeLag > buffer {
			buffer = status.NodeLag
		}
		if buffer > status.LatestHeight {
			buffer = status.LatestHeight
		}
		if buffer > 0 {
			stableHeight := status.LatestHeight - buffer
			status.StableHeight = stableHeight
			if stableHeight != status.LatestHeight && stableHeight >= 0 {
				var shash, sroot sql.NullString
				if err := n.db.QueryRowContext(ctx, `SELECT hash, state_root FROM neo_blocks WHERE height = $1`, stableHeight).Scan(&shash, &sroot); err == nil {
					if shash.Valid {
						status.StableHash = shash.String
					}
					if sroot.Valid {
						status.StableStateRoot = sroot.String
					}
				}
			}
		} else {
			// if buffer is zero, treat latest as stable
			status.StableHeight = status.LatestHeight
			status.StableHash = status.LatestHash
			status.StableStateRoot = status.LatestStateRoot
		}
	}
	return status, nil
}

func (n *neoReader) ListBlocks(ctx context.Context, limit, offset int) ([]neoBlock, error) {
	if n == nil || n.db == nil {
		return nil, fmt.Errorf("neo indexer not configured")
	}
	if limit <= 0 {
		limit = 20
	}
	if limit > 200 {
		limit = 200
	}
	rows, err := n.db.QueryContext(ctx, `
		SELECT b.height, b.hash, b.state_root, b.prev_hash, b.next_hash, b.block_time, b.size,
			(SELECT COUNT(*) FROM neo_transactions t WHERE t.height = b.height) AS tx_count
		FROM neo_blocks b
		ORDER BY b.height DESC
		LIMIT $1 OFFSET $2
	`, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var blocks []neoBlock
	for rows.Next() {
		var blk neoBlock
		var timeVal sql.NullTime
		if err := rows.Scan(&blk.Height, &blk.Hash, &blk.StateRoot, &blk.PrevHash, &blk.NextHash, &timeVal, &blk.Size, &blk.TxCount); err != nil {
			return nil, err
		}
		if timeVal.Valid {
			t := timeVal.Time
			blk.BlockTime = &t
		}
		blocks = append(blocks, blk)
	}
	return blocks, rows.Err()
}

func (n *neoReader) GetBlock(ctx context.Context, height int64) (neoBlockDetail, error) {
	var detail neoBlockDetail
	if n == nil || n.db == nil {
		return detail, fmt.Errorf("neo indexer not configured")
	}
	var blk neoBlock
	var timeVal sql.NullTime
	err := n.db.QueryRowContext(ctx, `
		SELECT height, hash, state_root, prev_hash, next_hash, block_time, size
		FROM neo_blocks WHERE height = $1
	`, height).Scan(&blk.Height, &blk.Hash, &blk.StateRoot, &blk.PrevHash, &blk.NextHash, &timeVal, &blk.Size)
	if err != nil {
		return detail, err
	}
	if timeVal.Valid {
		t := timeVal.Time
		blk.BlockTime = &t
	}
	txs, err := n.loadTransactions(ctx, height)
	if err != nil {
		return detail, err
	}
	detail.Block = blk
	detail.Transactions = txs
	detail.Executions = collectExecutionRefs(txs)
	detail.Block.TxCount = len(txs)
	return detail, nil
}

func (n *neoReader) ListStorage(ctx context.Context, height int64) ([]neoStorage, error) {
	if n == nil || n.db == nil {
		return nil, fmt.Errorf("neo indexer not configured")
	}
	rows, err := n.db.QueryContext(ctx, `
		SELECT contract, kv
		FROM neo_storage
		WHERE height = $1
		ORDER BY contract ASC
	`, height)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []neoStorage
	for rows.Next() {
		var ns neoStorage
		if err := rows.Scan(&ns.Contract, &ns.KV); err != nil {
			return nil, err
		}
		items = append(items, ns)
	}
	return items, rows.Err()
}

func (n *neoReader) ListStorageDiff(ctx context.Context, height int64) ([]neoStorageDiff, error) {
	if n == nil || n.db == nil {
		return nil, fmt.Errorf("neo indexer not configured")
	}
	rows, err := n.db.QueryContext(ctx, `
		SELECT contract, kv_diff
		FROM neo_storage_diffs
		WHERE height = $1
		ORDER BY contract ASC
	`, height)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []neoStorageDiff
	for rows.Next() {
		var ns neoStorageDiff
		if err := rows.Scan(&ns.Contract, &ns.KVDiff); err != nil {
			return nil, err
		}
		items = append(items, ns)
	}
	return items, rows.Err()
}

// StorageSummary returns per-contract counts of full KV and diff entries for a block height.
func (n *neoReader) StorageSummary(ctx context.Context, height int64) ([]neoStorageSummary, error) {
	if n == nil || n.db == nil {
		return nil, fmt.Errorf("neo indexer not configured")
	}
	summary := make(map[string]neoStorageSummary)

	kvRows, err := n.db.QueryContext(ctx, `
		SELECT contract, COALESCE(jsonb_array_length(kv), 0) AS kv_len
		FROM neo_storage
		WHERE height = $1
	`, height)
	if err != nil {
		return nil, err
	}
	defer kvRows.Close()
	for kvRows.Next() {
		var contract string
		var kvLen int
		if err := kvRows.Scan(&contract, &kvLen); err != nil {
			return nil, err
		}
		summary[contract] = neoStorageSummary{Contract: contract, KVEntries: kvLen}
	}
	if err := kvRows.Err(); err != nil {
		return nil, err
	}

	diffRows, err := n.db.QueryContext(ctx, `
		SELECT contract, COALESCE(jsonb_array_length(kv_diff), 0) AS diff_len
		FROM neo_storage_diffs
		WHERE height = $1
	`, height)
	if err != nil {
		return nil, err
	}
	defer diffRows.Close()
	for diffRows.Next() {
		var contract string
		var diffLen int
		if err := diffRows.Scan(&contract, &diffLen); err != nil {
			return nil, err
		}
		entry := summary[contract]
		entry.Contract = contract
		entry.DiffEntries = diffLen
		summary[contract] = entry
	}
	if err := diffRows.Err(); err != nil {
		return nil, err
	}

	if len(summary) == 0 {
		return nil, nil
	}
	contracts := make([]string, 0, len(summary))
	for contract := range summary {
		contracts = append(contracts, contract)
	}
	sort.Strings(contracts)

	out := make([]neoStorageSummary, 0, len(summary))
	for _, contract := range contracts {
		out = append(out, summary[contract])
	}
	return out, nil
}

func fetchRPCHeight(ctx context.Context, rpcURL string) (int64, error) {
	body, _ := json.Marshal(struct {
		JSONRPC string        `json:"jsonrpc"`
		Method  string        `json:"method"`
		Params  []interface{} `json:"params"`
		ID      int           `json:"id"`
	}{
		JSONRPC: "2.0",
		Method:  "getblockcount",
		Params:  []interface{}{},
		ID:      1,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, rpcURL, bytes.NewReader(body))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	var rpcResp rpcResponse
	if err := json.NewDecoder(resp.Body).Decode(&rpcResp); err != nil {
		return 0, err
	}
	if rpcResp.Error != nil {
		return 0, fmt.Errorf("rpc error %d: %s", rpcResp.Error.Code, rpcResp.Error.Message)
	}
	var count int64
	if err := json.Unmarshal(rpcResp.Result, &count); err != nil {
		return 0, err
	}
	return count, nil
}

func (n *neoReader) loadTransactions(ctx context.Context, height int64) ([]neoTransaction, error) {
	rows, err := n.db.QueryContext(ctx, `
		SELECT hash, ordinal, type, sender, net_fee, sys_fee, size, vm_state, exception, gas_consumed, stack
		FROM neo_transactions
		WHERE height = $1
		ORDER BY ordinal ASC
	`, height)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var txs []neoTransaction
	for rows.Next() {
		var tx neoTransaction
		var stackBytes []byte
		if err := rows.Scan(&tx.Hash, &tx.Ordinal, &tx.Type, &tx.Sender, &tx.NetFee, &tx.SysFee, &tx.Size, &tx.VMState, &tx.Exception, &tx.GasConsumed, &stackBytes); err != nil {
			return nil, err
		}
		tx.Stack = stackBytes
		notifications, err := n.loadNotifications(ctx, tx.Hash)
		if err != nil {
			return nil, err
		}
		tx.Notifications = notifications
		execs, err := n.loadExecutions(ctx, tx.Hash)
		if err != nil {
			return nil, err
		}
		tx.Executions = execs
		txs = append(txs, tx)
	}
	return txs, rows.Err()
}

func (n *neoReader) loadNotifications(ctx context.Context, txHash string) ([]neoNotification, error) {
	rows, err := n.db.QueryContext(ctx, `
		SELECT contract, event, exec_index, state
		FROM neo_notifications
		WHERE tx_hash = $1
		ORDER BY exec_index ASC, id ASC
	`, txHash)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var notes []neoNotification
	for rows.Next() {
		var nn neoNotification
		if err := rows.Scan(&nn.Contract, &nn.Event, &nn.ExecIndex, &nn.State); err != nil {
			return nil, err
		}
		notes = append(notes, nn)
	}
	return notes, rows.Err()
}

func (n *neoReader) loadExecutions(ctx context.Context, txHash string) ([]neoExecution, error) {
	rows, err := n.db.QueryContext(ctx, `
		SELECT exec_index, vm_state, exception, gas_consumed, stack, notifications
		FROM neo_transaction_executions
		WHERE tx_hash = $1
		ORDER BY exec_index ASC
	`, txHash)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var execs []neoExecution
	for rows.Next() {
		var ex neoExecution
		var stackBytes, notesBytes []byte
		if err := rows.Scan(&ex.Index, &ex.VMState, &ex.Exception, &ex.GasConsumed, &stackBytes, &notesBytes); err != nil {
			return nil, err
		}
		ex.Stack = stackBytes
		if len(notesBytes) > 0 {
			var notes []neoNotification
			if err := json.Unmarshal(notesBytes, &notes); err == nil {
				ex.Notifications = notes
			}
		}
		execs = append(execs, ex)
	}
	return execs, rows.Err()
}

func collectExecutionRefs(txs []neoTransaction) []neoExecutionRef {
	var refs []neoExecutionRef
	for _, tx := range txs {
		for _, ex := range tx.Executions {
			refs = append(refs, neoExecutionRef{TxHash: tx.Hash, Index: ex.Index, State: ex.VMState})
		}
	}
	return refs
}

func (n *neoReader) ListSnapshots(ctx context.Context, limit int) ([]neoSnapshot, error) {
	if n == nil {
		return nil, fmt.Errorf("neo indexer not configured")
	}
	entries, err := filepath.Glob(filepath.Join(n.snapshotDir, "block-*.json"))
	if err != nil {
		return nil, err
	}
	sort.Slice(entries, func(i, j int) bool {
		return extractHeight(entries[i]) > extractHeight(entries[j])
	})
	if limit > 0 && len(entries) > limit {
		entries = entries[:limit]
	}
	var snapshots []neoSnapshot
	for _, path := range entries {
		snap, err := readSnapshotManifest(path)
		if err != nil {
			continue
		}
		if snap.KVURL == "" && snap.KVPath != "" {
			snap.KVURL = fmt.Sprintf("/neo/snapshots/%d/kv", snap.Height)
		}
		if snap.KVDiffURL == "" && snap.KVDiffPath != "" {
			snap.KVDiffURL = fmt.Sprintf("/neo/snapshots/%d/kv-diff", snap.Height)
		}
		snapshots = append(snapshots, snap)
	}
	return snapshots, nil
}

func (n *neoReader) GetSnapshot(ctx context.Context, height int64) (neoSnapshot, error) {
	if n == nil {
		return neoSnapshot{}, fmt.Errorf("neo indexer not configured")
	}
	manifestPath := filepath.Join(n.snapshotDir, fmt.Sprintf("block-%d.json", height))
	snap, err := readSnapshotManifest(manifestPath)
	if err != nil {
		return neoSnapshot{}, err
	}
	if snap.KVURL == "" && snap.KVPath != "" {
		snap.KVURL = fmt.Sprintf("/neo/snapshots/%d/kv", snap.Height)
	}
	if snap.KVDiffURL == "" && snap.KVDiffPath != "" {
		snap.KVDiffURL = fmt.Sprintf("/neo/snapshots/%d/kv-diff", snap.Height)
	}
	return snap, nil
}

func (n *neoReader) SnapshotBundlePath(ctx context.Context, height int64, diff bool) (string, error) {
	if n == nil {
		return "", fmt.Errorf("neo indexer not configured")
	}
	snap, err := n.GetSnapshot(ctx, height)
	if err != nil {
		return "", err
	}
	path := snap.KVPath
	if diff {
		path = snap.KVDiffPath
	}
	if strings.TrimSpace(path) == "" {
		return "", fmt.Errorf("snapshot bundle not recorded for height %d (diff=%v)", height, diff)
	}
	if !filepath.IsAbs(path) {
		path = filepath.Join(n.snapshotDir, path)
	}
	return path, nil
}

func extractHeight(path string) int64 {
	base := filepath.Base(path)
	trim := strings.TrimPrefix(base, "block-")
	trim = strings.TrimSuffix(trim, ".json")
	h, _ := strconv.ParseInt(trim, 10, 64)
	return h
}

func readSnapshotManifest(path string) (neoSnapshot, error) {
	var snap neoSnapshot
	data, err := os.ReadFile(path)
	if err != nil {
		return snap, err
	}
	if err := json.Unmarshal(data, &snap); err != nil {
		return snap, err
	}
	return snap, nil
}

func stableBufferFromEnv() int64 {
	val := strings.TrimSpace(os.Getenv("NEO_STABLE_BUFFER"))
	if val == "" {
		return 12
	}
	if n, err := strconv.ParseInt(val, 10, 64); err == nil && n >= 0 {
		return n
	}
	return 12
}

func (n *neoReader) loadStableMeta(ctx context.Context) (int64, string, bool) {
	if n == nil || n.db == nil {
		return 0, "", false
	}
	var height int64
	if err := n.db.QueryRowContext(ctx, `SELECT value::BIGINT FROM neo_meta WHERE key = $1`, metaStableHeightKey).Scan(&height); err != nil {
		return 0, "", false
	}
	var hash string
	_ = n.db.QueryRowContext(ctx, `SELECT value FROM neo_meta WHERE key = $1`, metaStableHashKey).Scan(&hash)
	return height, hash, true
}

type rpcResponse struct {
	Result json.RawMessage `json:"result"`
	Error  *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}
