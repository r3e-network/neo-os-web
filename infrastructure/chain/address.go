package chain

import "strings"

// NormalizeContractAddress normalizes a Neo N3 contract address by stripping
// the "0x"/"0X" prefix, lowercasing, and validating that the result is a
// 40-character hex string. Returns "" for invalid input.
func NormalizeContractAddress(raw string) string {
	raw = strings.TrimSpace(raw)
	raw = strings.TrimPrefix(raw, "0x")
	raw = strings.TrimPrefix(raw, "0X")
	raw = strings.ToLower(strings.TrimSpace(raw))
	if len(raw) != 40 {
		return ""
	}
	for _, ch := range raw {
		if (ch < '0' || ch > '9') && (ch < 'a' || ch > 'f') {
			return ""
		}
	}
	return raw
}
