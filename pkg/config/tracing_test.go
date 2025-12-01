package config

import "testing"

func TestTracingConfigNormalizeMergesEnv(t *testing.T) {
	cfg := TracingConfig{
		ResourceAttributes: map[string]string{"existing": "value"},
		AttributesEnv:      "foo=bar, empty= , =skip ,trim = spaced ",
	}
	cfg.normalize()

	if cfg.ResourceAttributes["foo"] != "bar" {
		t.Fatalf("expected foo=bar, got %#v", cfg.ResourceAttributes)
	}
	if cfg.ResourceAttributes["trim"] != "spaced" {
		t.Fatalf("expected trimmed value, got %#v", cfg.ResourceAttributes["trim"])
	}
	if _, ok := cfg.ResourceAttributes[""]; ok {
		t.Fatalf("expected empty keys skipped")
	}
	if cfg.ResourceAttributes["existing"] != "value" {
		t.Fatalf("existing attributes overwritten")
	}
}

func TestTracingConfigMergeAttributes(t *testing.T) {
	cfg := TracingConfig{}
	cfg.MergeAttributes("a=1,b=2")
	if len(cfg.ResourceAttributes) != 2 || cfg.ResourceAttributes["a"] != "1" || cfg.ResourceAttributes["b"] != "2" {
		t.Fatalf("unexpected attributes: %#v", cfg.ResourceAttributes)
	}
}
