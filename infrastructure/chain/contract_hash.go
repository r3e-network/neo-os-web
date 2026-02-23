package chain

import "strings"

// NormalizeContractHash returns a canonical lowercase contract hash without 0x prefix.
// It validates 20-byte script hashes encoded as 40 hex characters.
func NormalizeContractHash(value string) string {
	trimmed := strings.TrimSpace(value)
	trimmed = strings.TrimPrefix(trimmed, "0x")
	trimmed = strings.TrimPrefix(trimmed, "0X")
	trimmed = strings.ToLower(trimmed)
	if len(trimmed) != 40 {
		return ""
	}
	for _, ch := range trimmed {
		if (ch < '0' || ch > '9') && (ch < 'a' || ch > 'f') {
			return ""
		}
	}
	return trimmed
}
