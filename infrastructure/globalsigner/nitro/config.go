// Package globalsigner provides the TEE master key management service.
package globalsigner

import (
	"fmt"
	"strings"
	"time"
)

const (
	maxDomainLength = 256
	maxPathLength   = 512
)

func validateDomain(domain string) error {
	trimmed := strings.TrimSpace(domain)
	if trimmed == "" {
		return fmt.Errorf("domain is required")
	}
	if len(domain) > maxDomainLength {
		return fmt.Errorf("domain too long")
	}
	if strings.ContainsRune(domain, '\x00') {
		return fmt.Errorf("domain contains invalid characters")
	}
	return nil
}

func validateDeriveDomain(domain string) error {
	if err := validateDomain(domain); err != nil {
		return err
	}
	if strings.Contains(domain, ":") {
		return fmt.Errorf("domain must not contain ':'")
	}
	return nil
}

func validateDerivePath(path string) error {
	trimmed := strings.TrimSpace(path)
	if trimmed == "" {
		return fmt.Errorf("path is required")
	}
	if len(path) > maxPathLength {
		return fmt.Errorf("path too long")
	}
	if strings.ContainsRune(path, '\x00') {
		return fmt.Errorf("path contains invalid characters")
	}
	return nil
}

func validateKeyStatus(version string, status KeyStatus, overlapEndsAt *time.Time) error {
	switch status {
	case KeyStatusActive:
		return nil
	case KeyStatusOverlapping:
		if overlapEndsAt != nil && time.Now().After(*overlapEndsAt) {
			return fmt.Errorf("key version overlap expired: %s", version)
		}
		return nil
	case KeyStatusPending:
		return fmt.Errorf("key version not active: %s", version)
	case KeyStatusRevoked:
		return fmt.Errorf("key version revoked: %s", version)
	default:
		return fmt.Errorf("key version not usable: %s", version)
	}
}

func normalizeServiceID(raw string) string {
	return strings.ToLower(strings.TrimSpace(raw))
}

func parseServiceDomainAllowlist(raw string) map[string][]string {
	entries := splitAndTrimCSV(raw)
	if len(entries) == 0 {
		return nil
	}

	allowlist := make(map[string][]string)
	for _, entry := range entries {
		parts := strings.SplitN(entry, ":", 2)
		if len(parts) != 2 {
			continue
		}
		serviceID := normalizeServiceID(parts[0])
		if serviceID == "" {
			continue
		}

		domains := splitAndTrimList(parts[1])
		if len(domains) == 0 {
			continue
		}
		for _, domain := range domains {
			if domain == "" {
				continue
			}
			normalized := strings.ToLower(domain)
			allowlist[serviceID] = append(allowlist[serviceID], normalized)
		}
	}

	if len(allowlist) == 0 {
		return nil
	}
	return allowlist
}

func parseServiceIDAllowlist(ids []string) map[string]bool {
	if len(ids) == 0 {
		return nil
	}
	allowlist := make(map[string]bool)
	for _, raw := range ids {
		serviceID := normalizeServiceID(raw)
		if serviceID == "" {
			continue
		}
		if serviceID == "*" {
			return nil
		}
		allowlist[serviceID] = true
	}
	if len(allowlist) == 0 {
		return nil
	}
	return allowlist
}

func splitAndTrimCSV(raw string) []string {
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func splitAndTrimList(raw string) []string {
	if raw == "" {
		return nil
	}
	parts := strings.FieldsFunc(raw, func(r rune) bool {
		return r == '|' || r == ';'
	})
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
