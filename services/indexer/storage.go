package indexer

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

// Storage provides database operations for the indexer.
// Uses ISOLATED Supabase credentials (INDEXER_ prefix).
type Storage struct {
	db  *sql.DB
	cfg *Config
}

// NewStorage creates a new storage instance with isolated credentials.
func NewStorage(cfg *Config) (*Storage, error) {
	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("invalid config: %w", err)
	}

	db, err := sql.Open("postgres", cfg.GetPostgresDSN())
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	return &Storage{db: db, cfg: cfg}, nil
}

// Close closes the database connection.
func (s *Storage) Close() error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}

// =============================================================================
// Transaction Operations
// =============================================================================

// SaveTransaction inserts or updates a transaction.
func (s *Storage) SaveTransaction(ctx context.Context, tx *Transaction) error {
	query := `
		INSERT INTO indexer_transactions (
			hash, network, block_index, block_time, size, version, nonce,
			sender, system_fee, network_fee, valid_until_block, script,
			vm_state, gas_consumed, exception, signers_json, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
		ON CONFLICT (hash) DO UPDATE SET
			vm_state = EXCLUDED.vm_state,
			gas_consumed = EXCLUDED.gas_consumed,
			exception = EXCLUDED.exception
	`
	_, err := s.db.ExecContext(ctx, query,
		tx.Hash, tx.Network, tx.BlockIndex, tx.BlockTime, tx.Size, tx.Version, tx.Nonce,
		tx.Sender, tx.SystemFee, tx.NetworkFee, tx.ValidUntilBlock, tx.Script,
		tx.VMState, tx.GasConsumed, tx.Exception, tx.SignersJSON, time.Now().UTC(),
	)
	return err
}

// GetTransaction retrieves a transaction by hash.
func (s *Storage) GetTransaction(ctx context.Context, hash string) (*Transaction, error) {
	query := `
		SELECT hash, network, block_index, block_time, size, version, nonce,
			sender, system_fee, network_fee, valid_until_block, script,
			vm_state, gas_consumed, exception, signers_json, created_at
		FROM indexer_transactions WHERE hash = $1
	`
	tx := &Transaction{}
	err := s.db.QueryRowContext(ctx, query, hash).Scan(
		&tx.Hash, &tx.Network, &tx.BlockIndex, &tx.BlockTime, &tx.Size, &tx.Version, &tx.Nonce,
		&tx.Sender, &tx.SystemFee, &tx.NetworkFee, &tx.ValidUntilBlock, &tx.Script,
		&tx.VMState, &tx.GasConsumed, &tx.Exception, &tx.SignersJSON, &tx.CreatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return tx, err
}

// GetTransactionsByAddress retrieves transactions for an address.
func (s *Storage) GetTransactionsByAddress(ctx context.Context, address string, limit, offset int) ([]*Transaction, error) {
	query := `
		SELECT t.hash, t.network, t.block_index, t.block_time, t.size, t.version, t.nonce,
			t.sender, t.system_fee, t.network_fee, t.valid_until_block, t.script,
			t.vm_state, t.gas_consumed, t.exception, t.signers_json, t.created_at
		FROM indexer_transactions t
		JOIN indexer_address_txs a ON t.hash = a.tx_hash
		WHERE a.address = $1
		ORDER BY t.block_time DESC
		LIMIT $2 OFFSET $3
	`
	rows, err := s.db.QueryContext(ctx, query, address, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var txs []*Transaction
	for rows.Next() {
		tx := &Transaction{}
		if err := rows.Scan(
			&tx.Hash, &tx.Network, &tx.BlockIndex, &tx.BlockTime, &tx.Size, &tx.Version, &tx.Nonce,
			&tx.Sender, &tx.SystemFee, &tx.NetworkFee, &tx.ValidUntilBlock, &tx.Script,
			&tx.VMState, &tx.GasConsumed, &tx.Exception, &tx.SignersJSON, &tx.CreatedAt,
		); err != nil {
			return nil, err
		}
		txs = append(txs, tx)
	}
	return txs, rows.Err()
}

// =============================================================================
// Opcode Trace Operations
// =============================================================================

// SaveOpcodeTraces batch inserts opcode traces for a transaction.
func (s *Storage) SaveOpcodeTraces(ctx context.Context, traces []*OpcodeTrace) error {
	if len(traces) == 0 {
		return nil
	}
	const cols = 8
	valueStrings := make([]string, 0, len(traces))
	args := make([]interface{}, 0, len(traces)*cols)
	for i, t := range traces {
		base := i * cols
		valueStrings = append(valueStrings, fmt.Sprintf("($%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d)",
			base+1, base+2, base+3, base+4, base+5, base+6, base+7, base+8))
		args = append(args, t.TxHash, t.StepIndex, t.Opcode, t.OpcodeHex, t.GasConsumed,
			t.StackSize, t.ContractHash, t.InstructionPtr)
	}
	// #nosec G202 -- placeholders are generated internally; values are bound via Exec args.
	query := `INSERT INTO indexer_opcode_traces (
		tx_hash, step_index, opcode, opcode_hex, gas_consumed,
		stack_size, contract_hash, instruction_ptr
	) VALUES ` + strings.Join(valueStrings, ",")
	_, err := s.db.ExecContext(ctx, query, args...)
	return err
}

// GetOpcodeTraces retrieves opcode traces for a transaction.
func (s *Storage) GetOpcodeTraces(ctx context.Context, txHash string) ([]*OpcodeTrace, error) {
	query := `
		SELECT id, tx_hash, step_index, opcode, opcode_hex, gas_consumed,
			stack_size, contract_hash, instruction_ptr
		FROM indexer_opcode_traces WHERE tx_hash = $1 ORDER BY step_index
	`
	rows, err := s.db.QueryContext(ctx, query, txHash)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var traces []*OpcodeTrace
	for rows.Next() {
		t := &OpcodeTrace{}
		if err := rows.Scan(
			&t.ID, &t.TxHash, &t.StepIndex, &t.Opcode, &t.OpcodeHex, &t.GasConsumed,
			&t.StackSize, &t.ContractHash, &t.InstructionPtr,
		); err != nil {
			return nil, err
		}
		traces = append(traces, t)
	}
	return traces, rows.Err()
}

// =============================================================================
// Contract Call Operations
// =============================================================================

// SaveContractCalls batch inserts contract calls for a transaction.
func (s *Storage) SaveContractCalls(ctx context.Context, calls []*ContractCall) error {
	if len(calls) == 0 {
		return nil
	}
	const cols = 8
	valueStrings := make([]string, 0, len(calls))
	args := make([]interface{}, 0, len(calls)*cols)
	for i, c := range calls {
		base := i * cols
		valueStrings = append(valueStrings, fmt.Sprintf("($%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d)",
			base+1, base+2, base+3, base+4, base+5, base+6, base+7, base+8))
		args = append(args, c.TxHash, c.CallIndex, c.ContractHash, c.Method, c.ArgsJSON,
			c.GasConsumed, c.Success, c.ParentCallID)
	}
	// #nosec G202 -- placeholders are generated internally; values are bound via Exec args.
	query := `INSERT INTO indexer_contract_calls (
		tx_hash, call_index, contract_hash, method, args_json,
		gas_consumed, success, parent_call_id
	) VALUES ` + strings.Join(valueStrings, ",")
	_, err := s.db.ExecContext(ctx, query, args...)
	return err
}

// GetContractCalls retrieves contract calls for a transaction.
func (s *Storage) GetContractCalls(ctx context.Context, txHash string) ([]*ContractCall, error) {
	query := `
		SELECT id, tx_hash, call_index, contract_hash, method, args_json,
			gas_consumed, success, parent_call_id
		FROM indexer_contract_calls WHERE tx_hash = $1 ORDER BY call_index
	`
	rows, err := s.db.QueryContext(ctx, query, txHash)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var calls []*ContractCall
	for rows.Next() {
		c := &ContractCall{}
		if err := rows.Scan(
			&c.ID, &c.TxHash, &c.CallIndex, &c.ContractHash, &c.Method, &c.ArgsJSON,
			&c.GasConsumed, &c.Success, &c.ParentCallID,
		); err != nil {
			return nil, err
		}
		calls = append(calls, c)
	}
	return calls, rows.Err()
}

// =============================================================================
// Syscall Operations
// =============================================================================

// SaveSyscalls batch inserts syscalls for a transaction.
func (s *Storage) SaveSyscalls(ctx context.Context, syscalls []*Syscall) error {
	if len(syscalls) == 0 {
		return nil
	}
	const cols = 7
	valueStrings := make([]string, 0, len(syscalls))
	args := make([]interface{}, 0, len(syscalls)*cols)
	for i, sc := range syscalls {
		base := i * cols
		valueStrings = append(valueStrings, fmt.Sprintf("($%d,$%d,$%d,$%d,$%d,$%d,$%d)",
			base+1, base+2, base+3, base+4, base+5, base+6, base+7))
		args = append(args, sc.TxHash, sc.CallIndex, sc.SyscallName, sc.ArgsJSON,
			sc.ResultJSON, sc.GasConsumed, sc.ContractHash)
	}
	// #nosec G202 -- placeholders are generated internally; values are bound via Exec args.
	query := `INSERT INTO indexer_syscalls (
		tx_hash, call_index, syscall_name, args_json,
		result_json, gas_consumed, contract_hash
	) VALUES ` + strings.Join(valueStrings, ",")
	_, err := s.db.ExecContext(ctx, query, args...)
	return err
}

// GetSyscalls retrieves syscalls for a transaction.
func (s *Storage) GetSyscalls(ctx context.Context, txHash string) ([]*Syscall, error) {
	query := `
		SELECT id, tx_hash, call_index, syscall_name, args_json,
			result_json, gas_consumed, contract_hash
		FROM indexer_syscalls WHERE tx_hash = $1 ORDER BY call_index
	`
	rows, err := s.db.QueryContext(ctx, query, txHash)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var syscalls []*Syscall
	for rows.Next() {
		sc := &Syscall{}
		if err := rows.Scan(
			&sc.ID, &sc.TxHash, &sc.CallIndex, &sc.SyscallName, &sc.ArgsJSON,
			&sc.ResultJSON, &sc.GasConsumed, &sc.ContractHash,
		); err != nil {
			return nil, err
		}
		syscalls = append(syscalls, sc)
	}
	return syscalls, rows.Err()
}

// =============================================================================
// Address-Transaction Relationship Operations
// =============================================================================

// SaveAddressTxs batch inserts address-transaction relationships.
func (s *Storage) SaveAddressTxs(ctx context.Context, addrTxs []*AddressTx) error {
	if len(addrTxs) == 0 {
		return nil
	}
	const cols = 5
	valueStrings := make([]string, 0, len(addrTxs))
	args := make([]interface{}, 0, len(addrTxs)*cols)
	for i, at := range addrTxs {
		base := i * cols
		valueStrings = append(valueStrings, fmt.Sprintf("($%d,$%d,$%d,$%d,$%d)",
			base+1, base+2, base+3, base+4, base+5))
		args = append(args, at.Address, at.TxHash, at.Role, at.Network, at.BlockTime)
	}
	// #nosec G202 -- placeholders are generated internally; values are bound via Exec args.
	query := `INSERT INTO indexer_address_txs (address, tx_hash, role, network, block_time)
	VALUES ` + strings.Join(valueStrings, ",") + `
	ON CONFLICT (address, tx_hash, role) DO NOTHING`
	_, err := s.db.ExecContext(ctx, query, args...)
	return err
}

// =============================================================================
// Sync State Operations
// =============================================================================

// GetSyncState retrieves the sync state for a network.
func (s *Storage) GetSyncState(ctx context.Context, network Network) (*SyncState, error) {
	query := `
		SELECT id, network, last_block_index, last_block_time,
			total_tx_indexed, last_sync_at, updated_at
		FROM indexer_sync_state WHERE network = $1
	`
	state := &SyncState{}
	err := s.db.QueryRowContext(ctx, query, network).Scan(
		&state.ID, &state.Network, &state.LastBlockIndex, &state.LastBlockTime,
		&state.TotalTxIndexed, &state.LastSyncAt, &state.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return state, err
}

// UpdateSyncState updates the sync state for a network.
func (s *Storage) UpdateSyncState(ctx context.Context, state *SyncState) error {
	query := `
		INSERT INTO indexer_sync_state (network, last_block_index, last_block_time, total_tx_indexed, last_sync_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (network) DO UPDATE SET
			last_block_index = EXCLUDED.last_block_index,
			last_block_time = EXCLUDED.last_block_time,
			total_tx_indexed = EXCLUDED.total_tx_indexed,
			last_sync_at = EXCLUDED.last_sync_at,
			updated_at = EXCLUDED.updated_at
	`
	_, err := s.db.ExecContext(ctx, query,
		state.Network, state.LastBlockIndex, state.LastBlockTime,
		state.TotalTxIndexed, state.LastSyncAt, time.Now().UTC(),
	)
	return err
}
