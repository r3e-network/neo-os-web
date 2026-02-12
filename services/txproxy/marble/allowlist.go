package txproxy

import (
	"encoding/json"
	"fmt"
	"strings"
	"unicode"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/chain"
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
		normalized := normalizeContractAddress(contract)
		if normalized == "" {
			return nil, fmt.Errorf("invalid contract address: %q", contract)
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
			entry.Methods[canonicalizeMethodName(m)] = struct{}{}
		}
		out.Contracts[normalized] = entry
	}

	return out, nil
}

func (a *Allowlist) Allows(contractAddress, method string) bool {
	if a == nil {
		return false
	}

	contractAddress = normalizeContractAddress(contractAddress)
	method = canonicalizeMethodName(method)
	if contractAddress == "" || method == "" {
		return false
	}

	entry, ok := a.Contracts[contractAddress]
	if !ok {
		return false
	}
	if entry.AllowAll {
		return true
	}
	_, ok = entry.Methods[method]
	return ok
}

func normalizeContractAddress(raw string) string {
	return chain.NormalizeContractAddress(raw)
}

func canonicalizeMethodName(method string) string {
	method = strings.TrimSpace(method)
	if method == "" {
		return ""
	}
	runes := []rune(method)
	runes[0] = unicode.ToLower(runes[0])
	return string(runes)
}
