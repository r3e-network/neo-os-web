package indexer

import (
	"context"
	"encoding/binary"
	"encoding/hex"
	"fmt"

	"github.com/nspcc-dev/neo-go/pkg/vm/opcode"
)

// System.Contract.Call syscall ID (little-endian)
// This is the interop hash for System.Contract.Call
const syscallContractCall uint32 = 0x627d5b52

// Tracer extracts VM execution traces from transactions.
type Tracer struct {
	storage *Storage
}

// NewTracer creates a new VM tracer.
func NewTracer(storage *Storage) *Tracer {
	return &Tracer{storage: storage}
}

// IsComplexTransaction determines if a transaction involves contract invocations.
// Simple NEP-17 transfers only use System.Runtime.Notify, while complex transactions
// use System.Contract.Call to invoke other contracts.
func IsComplexTransaction(scriptHex string) bool {
	script, err := hex.DecodeString(scriptHex)
	if err != nil {
		return false
	}
	return containsContractCall(script)
}

// containsContractCall scans script for System.Contract.Call syscall.
func containsContractCall(script []byte) bool {
	pos := 0
	for pos < len(script) {
		op := opcode.Opcode(script[pos])
		if op == opcode.SYSCALL && pos+4 < len(script) {
			// SYSCALL is followed by 4-byte interop ID
			interopID := binary.LittleEndian.Uint32(script[pos+1 : pos+5])
			if interopID == syscallContractCall {
				return true
			}
		}
		pos += getOpcodeSize(op, script[pos:])
	}
	return false
}

// ParseScript parses a transaction script into opcode traces.
func (t *Tracer) ParseScript(txHash string, scriptHex string) ([]*OpcodeTrace, error) {
	script, err := hex.DecodeString(scriptHex)
	if err != nil {
		return nil, fmt.Errorf("decode script: %w", err)
	}

	var traces []*OpcodeTrace
	pos := 0
	step := 0

	for pos < len(script) {
		op := opcode.Opcode(script[pos])
		trace := &OpcodeTrace{
			TxHash:         txHash,
			StepIndex:      step,
			Opcode:         op.String(),
			OpcodeHex:      fmt.Sprintf("%02x", script[pos]),
			InstructionPtr: pos,
		}
		traces = append(traces, trace)
		pos += getOpcodeSize(op, script[pos:])
		step++
	}
	return traces, nil
}

// getOpcodeSize returns the size of an opcode instruction.
func getOpcodeSize(op opcode.Opcode, data []byte) int {
	switch {
	case op >= opcode.PUSHINT8 && op <= opcode.PUSHINT256:
		sizes := map[opcode.Opcode]int{
			opcode.PUSHINT8:   2,
			opcode.PUSHINT16:  3,
			opcode.PUSHINT32:  5,
			opcode.PUSHINT64:  9,
			opcode.PUSHINT128: 17,
			opcode.PUSHINT256: 33,
		}
		return sizes[op]
	case op == opcode.PUSHA || op == opcode.JMP || op == opcode.JMPIF ||
		op == opcode.JMPIFNOT || op == opcode.CALL:
		return 5
	case op == opcode.PUSHDATA1:
		if len(data) > 1 {
			return 2 + int(data[1])
		}
		return 2
	case op == opcode.PUSHDATA2:
		if len(data) > 2 {
			size := int(data[1]) | int(data[2])<<8
			return 3 + size
		}
		return 3
	case op == opcode.SYSCALL:
		return 5
	default:
		return 1
	}
}

// ExtractContractCalls extracts contract calls from notifications.
func (t *Tracer) ExtractContractCalls(txHash string, notifications []Notification) []*ContractCall {
	var calls []*ContractCall
	for i, n := range notifications {
		call := &ContractCall{
			TxHash:       txHash,
			CallIndex:    i,
			ContractHash: n.ContractHash,
			Method:       n.EventName,
			ArgsJSON:     n.StateJSON,
			Success:      true,
		}
		calls = append(calls, call)
	}
	return calls
}

// SaveTraces saves opcode traces to storage.
func (t *Tracer) SaveTraces(ctx context.Context, traces []*OpcodeTrace) error {
	return t.storage.SaveOpcodeTraces(ctx, traces)
}

// SaveContractCalls saves contract calls to storage.
func (t *Tracer) SaveContractCalls(ctx context.Context, calls []*ContractCall) error {
	return t.storage.SaveContractCalls(ctx, calls)
}
