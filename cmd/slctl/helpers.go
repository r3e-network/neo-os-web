package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func prettyJSON(data []byte) string {
	var out bytes.Buffer
	if err := json.Indent(&out, data, "", "  "); err != nil {
		return string(data)
	}
	return out.String()
}

func prettyPrint(data []byte) {
	if len(data) == 0 {
		fmt.Println("(empty)")
		return
	}
	var dst bytes.Buffer
	if err := json.Indent(&dst, data, "", "  "); err != nil {
		fmt.Println(string(data))
		return
	}
	fmt.Println(dst.String())
}

func parseJSONMap(input string) (map[string]any, error) {
	if strings.TrimSpace(input) == "" {
		return nil, nil
	}
	var result map[string]any
	if err := json.Unmarshal([]byte(input), &result); err != nil {
		return nil, err
	}
	return result, nil
}

func splitList(input string) []string {
	if strings.TrimSpace(input) == "" {
		return nil
	}
	parts := strings.FieldsFunc(input, func(r rune) bool {
		return r == ',' || r == ';'
	})
	var out []string
	for _, p := range parts {
		if trimmed := strings.TrimSpace(p); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func parseTimestamp(value string) (time.Time, error) {
	if strings.TrimSpace(value) == "" {
		return time.Now().UTC(), nil
	}
	ts, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return time.Time{}, err
	}
	return ts.UTC(), nil
}

func normalizeAggregationFlag(val string) (string, error) {
	v := strings.ToLower(strings.TrimSpace(val))
	switch v {
	case "", "median", "mean", "min", "max":
		if v == "" {
			v = "median"
		}
		return v, nil
	default:
		return "", fmt.Errorf("unsupported aggregation %q (expected median|mean|min|max)", v)
	}
}

func toInt(v any) (int, bool) {
	switch val := v.(type) {
	case float64:
		return int(val), true
	case int:
		return val, true
	case int64:
		return int(val), true
	}
	return 0, false
}

func toInt64(v any) (int64, bool) {
	switch val := v.(type) {
	case float64:
		return int64(val), true
	case int:
		return int64(val), true
	case int64:
		return val, true
	}
	return 0, false
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func parseKeyValue(input string) (map[string]string, error) {
	result := make(map[string]string)
	if strings.TrimSpace(input) == "" {
		return result, nil
	}
	pairs := strings.Split(input, ",")
	for _, pair := range pairs {
		pair = strings.TrimSpace(pair)
		if pair == "" {
			continue
		}
		parts := strings.SplitN(pair, "=", 2)
		if len(parts) != 2 {
			return nil, fmt.Errorf("invalid entry %q (expected key=value)", pair)
		}
		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])
		if key == "" {
			return nil, fmt.Errorf("empty key in %q", pair)
		}
		result[key] = value
	}
	return result, nil
}

func splitCommaList(input string) []string {
	if strings.TrimSpace(input) == "" {
		return nil
	}
	parts := strings.Split(input, ",")
	var result []string
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func loadJSONPayload(inline, file string) (any, error) {
	if inline != "" && file != "" {
		return nil, errors.New("specify either --payload or --payload-file, not both")
	}
	var data []byte
	switch {
	case inline != "":
		data = []byte(inline)
	case file != "":
		content, err := os.ReadFile(filepath.Clean(file))
		if err != nil {
			return nil, fmt.Errorf("read payload file: %w", err)
		}
		data = content
	default:
		return nil, nil
	}

	var payload any
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, fmt.Errorf("decode payload: %w", err)
	}
	return payload, nil
}
