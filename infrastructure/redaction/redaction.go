package redaction

import (
	"regexp"
	"strings"
)

var (
	secretPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)(api[_-]?key|apikey)["']?\s*[:=]\s*["']?([^"'\s,}]+)["']?`),
		regexp.MustCompile(`(?i)(secret|token|auth)["']?\s*[:=]\s*["']?([^"'\s,}]+)["']?`),
		regexp.MustCompile(`(?i)Bearer\s+([a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)`),
		regexp.MustCompile(`(?i)password["']?\s*[:=]\s*["']?([^"'\s,}]+)["']?`),
		regexp.MustCompile(`(?i)(private[_-]?key|privkey)["']?\s*[:=]\s*["']?([^"'\s,}]+)["']?`),
		regexp.MustCompile(`(?i)(access[_-]?key|aws[_-]?secret)["']?\s*[:=]\s*["']?([^"'\s,}]+)["']?`),
	}
)

type SecretConfig struct {
	Enabled         bool
	RedactionText   string
	AllowedFields   []string
	BlockedPatterns []string
}

func DefaultConfig() SecretConfig {
	return SecretConfig{
		Enabled:       true,
		RedactionText: "***REDACTED***",
		AllowedFields: []string{},
		BlockedPatterns: []string{
			"password",
			"secret",
			"token",
			"apikey",
			"private_key",
			"credential",
		},
	}
}

type Redactor struct {
	config SecretConfig
}

func NewRedactor(cfg SecretConfig) *Redactor {
	if cfg.RedactionText == "" {
		cfg.RedactionText = "***REDACTED***"
	}
	return &Redactor{config: cfg}
}

func (r *Redactor) RedactString(s string) string {
	if !r.config.Enabled {
		return s
	}

	result := s
	for _, pattern := range secretPatterns {
		result = pattern.ReplaceAllString(result, "${1}: "+r.config.RedactionText)
	}

	return result
}

func (r *Redactor) RedactMap(m map[string]interface{}) map[string]interface{} {
	if !r.config.Enabled {
		return m
	}

	result := make(map[string]interface{})
	for k, v := range m {
		switch {
		case r.isSecretField(k):
			result[k] = r.config.RedactionText
		case v == nil:
			result[k] = v
		default:
			switch val := v.(type) {
			case string:
				result[k] = r.RedactString(val)
			case map[string]interface{}:
				result[k] = r.RedactMap(val)
			case []interface{}:
				result[k] = r.RedactSlice(val)
			default:
				result[k] = v
			}
		}
	}

	return result
}

func (r *Redactor) RedactSlice(s []interface{}) []interface{} {
	if !r.config.Enabled {
		return s
	}

	result := make([]interface{}, len(s))
	for i, v := range s {
		switch val := v.(type) {
		case string:
			result[i] = r.RedactString(val)
		case map[string]interface{}:
			result[i] = r.RedactMap(val)
		default:
			result[i] = val
		}
	}

	return result
}

func (r *Redactor) isSecretField(fieldName string) bool {
	lowerName := strings.ToLower(fieldName)
	for _, blocked := range r.config.BlockedPatterns {
		if strings.Contains(lowerName, strings.ToLower(blocked)) {
			return true
		}
	}
	return false
}

func RedactAll(s string) string {
	r := NewRedactor(DefaultConfig())
	return r.RedactString(s)
}

func RedactMap(m map[string]interface{}) map[string]interface{} {
	r := NewRedactor(DefaultConfig())
	return r.RedactMap(m)
}

type SafeLogger struct{}

func (l *SafeLogger) Log(ctx interface{}, level, message string, fields map[string]interface{}) {
	if fields != nil {
		r := NewRedactor(DefaultConfig())
		_ = r.RedactMap(fields)
	}
}
