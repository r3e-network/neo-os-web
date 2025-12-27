package chain

import (
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"

	"github.com/nspcc-dev/neo-go/pkg/core/interop/interopnames"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/vm"
	"github.com/nspcc-dev/neo-go/pkg/vm/opcode"
)

// ExtractContractCallTargets scans a Neo VM script and returns contract hashes
// invoked via System.Contract.Call (normalized as lowercase LE hex without 0x).
func ExtractContractCallTargets(script string) ([]string, error) {
	script = strings.TrimSpace(script)
	if script == "" {
		return nil, nil
	}

	payload, err := decodeScriptPayload(script)
	if err != nil {
		return nil, err
	}
	if len(payload) == 0 {
		return nil, nil
	}

	ctx := vm.NewContext(payload)
	targets := make(map[string]struct{})
	var lastPush []byte
	lastWasPush := false

	for {
		op, param, err := ctx.Next()
		if err != nil {
			return nil, err
		}
		if op == opcode.RET {
			break
		}

		switch op {
		case opcode.PUSHDATA1, opcode.PUSHDATA2, opcode.PUSHDATA4:
			lastPush = param
			lastWasPush = true
		case opcode.SYSCALL:
			if len(param) == 4 {
				id := binary.LittleEndian.Uint32(param)
				name, nameErr := interopnames.FromID(id)
				if nameErr == nil && name == interopnames.SystemContractCall {
					if lastWasPush {
						if hash := decodeScriptHash(lastPush); hash != "" {
							targets[hash] = struct{}{}
						}
					}
				}
			}
			lastPush = nil
			lastWasPush = false
		default:
			lastWasPush = false
		}
	}

	if len(targets) == 0 {
		return nil, nil
	}
	out := make([]string, 0, len(targets))
	for hash := range targets {
		out = append(out, hash)
	}
	sort.Strings(out)
	return out, nil
}

func decodeScriptPayload(raw string) ([]byte, error) {
	raw = strings.TrimSpace(raw)
	raw = strings.TrimPrefix(raw, "0x")
	raw = strings.TrimPrefix(raw, "0X")
	if raw == "" {
		return nil, nil
	}
	if isHexString(raw) {
		return hex.DecodeString(raw)
	}
	payload, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		return nil, fmt.Errorf("decode script: %w", err)
	}
	return payload, nil
}

func isHexString(value string) bool {
	if len(value)%2 != 0 {
		return false
	}
	for _, ch := range value {
		if (ch < '0' || ch > '9') && (ch < 'a' || ch > 'f') && (ch < 'A' || ch > 'F') {
			return false
		}
	}
	return true
}

func decodeScriptHash(value []byte) string {
	if len(value) != util.Uint160Size {
		return ""
	}
	hash, err := util.Uint160DecodeBytesBE(value)
	if err != nil {
		return ""
	}
	return hash.StringLE()
}
