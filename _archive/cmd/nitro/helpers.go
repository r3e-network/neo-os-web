package main

import (
	"fmt"
	"strconv"
	"strings"
)

func splitAndTrimCSV(raw string) []string {
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			values = append(values, trimmed)
		}
	}
	return values
}

func isAvailableService(serviceType string) bool {
	for _, available := range availableServices {
		if serviceType == available {
			return true
		}
	}
	return false
}

func parseByteSize(raw string) (int64, error) {
	value := strings.ToLower(strings.TrimSpace(raw))
	if value == "" {
		return 0, fmt.Errorf("empty size")
	}

	type suffix struct {
		value      string
		multiplier int64
	}

	suffixes := []suffix{
		{value: "gib", multiplier: 1024 * 1024 * 1024},
		{value: "gb", multiplier: 1024 * 1024 * 1024},
		{value: "g", multiplier: 1024 * 1024 * 1024},
		{value: "mib", multiplier: 1024 * 1024},
		{value: "mb", multiplier: 1024 * 1024},
		{value: "m", multiplier: 1024 * 1024},
		{value: "kib", multiplier: 1024},
		{value: "kb", multiplier: 1024},
		{value: "k", multiplier: 1024},
		{value: "b", multiplier: 1},
	}

	const maxInt64 = int64(^uint64(0) >> 1)

	for _, entry := range suffixes {
		if !strings.HasSuffix(value, entry.value) {
			continue
		}
		num := strings.TrimSpace(strings.TrimSuffix(value, entry.value))
		if num == "" {
			return 0, fmt.Errorf("missing size value")
		}
		parsed, err := strconv.ParseInt(num, 10, 64)
		if err != nil {
			return 0, err
		}
		if parsed <= 0 {
			return 0, fmt.Errorf("size must be positive")
		}
		if parsed > maxInt64/entry.multiplier {
			return 0, fmt.Errorf("size too large")
		}
		return parsed * entry.multiplier, nil
	}

	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return 0, err
	}
	if parsed <= 0 {
		return 0, fmt.Errorf("size must be positive")
	}
	return parsed, nil
}

func trimHexPrefix(value string) string {
	value = strings.TrimSpace(value)
	if len(value) >= 2 {
		prefix := strings.ToLower(value[:2])
		if prefix == "0x" {
			return value[2:]
		}
	}
	return value
}
