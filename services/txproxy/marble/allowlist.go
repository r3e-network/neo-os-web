package txproxy

import (
	"encoding/json"
	"fmt"
	"strings"
)

type Allowlist struct {
	Contracts map[string]ContractAllowlist
}

type ContractAllowlist struct {
	AllowAll bool
	Methods  map[string]struct{}
}

type allowlistJSON struct {
	Contracts map[string][]string `json:"contracts"`
}

func ParseAllowlist(raw string) (*Allowlist, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return &Allowlist{Contracts: map[string]ContractAllowlist{}}, nil
	}

	var parsed allowlistJSON
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return nil, fmt.Errorf("parse allowlist json: %w", err)
	}

	out := &Allowlist{Contracts: map[string]ContractAllowlist{}}
	for contract, methods := range parsed.Contracts {
		normalized := normalizeContractHash(contract)
		if normalized == "" {
			return nil, fmt.Errorf("invalid contract hash: %q", contract)
		}

		entry := ContractAllowlist{Methods: map[string]struct{}{}}
		for _, method := range methods {
			m := strings.TrimSpace(method)
			if m == "" {
				continue
			}
			if m == "*" {
				entry.AllowAll = true
				continue
			}
			entry.Methods[m] = struct{}{}
		}
		out.Contracts[normalized] = entry
	}

	return out, nil
}

func (a *Allowlist) Allows(contractHash, method string) bool {
	if a == nil {
		return false
	}

	contractHash = normalizeContractHash(contractHash)
	method = strings.TrimSpace(method)
	if contractHash == "" || method == "" {
		return false
	}

	entry, ok := a.Contracts[contractHash]
	if !ok {
		return false
	}
	if entry.AllowAll {
		return true
	}
	_, ok = entry.Methods[method]
	return ok
}

func normalizeContractHash(raw string) string {
	raw = strings.ToLower(strings.TrimSpace(raw))
	raw = strings.TrimPrefix(raw, "0x")
	raw = strings.TrimPrefix(raw, "0X")
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	return raw
}

