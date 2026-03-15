package config

import (
	"sort"
	"testing"
)

func TestServicesConfigIsEnabled(t *testing.T) {
	cfg := &ServicesConfig{
		Services: map[string]*ServiceSettings{
			"enabled-service":  {Enabled: true, Port: 8080},
			"disabled-service": {Enabled: false, Port: 8081},
		},
	}

	t.Run("enabled service", func(t *testing.T) {
		if !cfg.IsEnabled("enabled-service") {
			t.Error("IsEnabled() should return true for enabled service")
		}
	})

	t.Run("disabled service", func(t *testing.T) {
		if cfg.IsEnabled("disabled-service") {
			t.Error("IsEnabled() should return false for disabled service")
		}
	})

	t.Run("nonexistent service", func(t *testing.T) {
		if cfg.IsEnabled("nonexistent") {
			t.Error("IsEnabled() should return false for nonexistent service")
		}
	})

	t.Run("nil config", func(t *testing.T) {
		var nilCfg *ServicesConfig
		if nilCfg.IsEnabled("any") {
			t.Error("IsEnabled() should return false for nil config")
		}
	})

	t.Run("nil services map", func(t *testing.T) {
		emptyCfg := &ServicesConfig{Services: nil}
		if emptyCfg.IsEnabled("any") {
			t.Error("IsEnabled() should return false for nil services map")
		}
	})
}

func TestServicesConfigGetSettings(t *testing.T) {
	cfg := &ServicesConfig{
		Services: map[string]*ServiceSettings{
			"test-service": {Enabled: true, Port: 8080, Description: "Test"},
		},
	}

	t.Run("existing service", func(t *testing.T) {
		settings := cfg.GetSettings("test-service")
		if settings == nil {
			t.Fatal("GetSettings() returned nil for existing service")
		}
		if settings.Port != 8080 {
			t.Errorf("Port = %d, want 8080", settings.Port)
		}
		if settings.Description != "Test" {
			t.Errorf("Description = %s, want Test", settings.Description)
		}
	})

	t.Run("nonexistent service", func(t *testing.T) {
		settings := cfg.GetSettings("nonexistent")
		if settings != nil {
			t.Error("GetSettings() should return nil for nonexistent service")
		}
	})

	t.Run("nil config", func(t *testing.T) {
		var nilCfg *ServicesConfig
		settings := nilCfg.GetSettings("any")
		if settings != nil {
			t.Error("GetSettings() should return nil for nil config")
		}
	})

	t.Run("nil services map", func(t *testing.T) {
		emptyCfg := &ServicesConfig{Services: nil}
		settings := emptyCfg.GetSettings("any")
		if settings != nil {
			t.Error("GetSettings() should return nil for nil services map")
		}
	})
}

func TestServicesConfigEnabledServices(t *testing.T) {
	cfg := &ServicesConfig{
		Services: map[string]*ServiceSettings{
			"service-a": {Enabled: true},
			"service-b": {Enabled: false},
			"service-c": {Enabled: true},
			"service-d": {Enabled: false},
		},
	}

	t.Run("returns enabled services", func(t *testing.T) {
		enabled := cfg.EnabledServices()
		if len(enabled) != 2 {
			t.Fatalf("len(EnabledServices()) = %d, want 2", len(enabled))
		}
		sort.Strings(enabled)
		if enabled[0] != "service-a" || enabled[1] != "service-c" {
			t.Errorf("EnabledServices() = %v, want [service-a service-c]", enabled)
		}
	})

	t.Run("nil config", func(t *testing.T) {
		var nilCfg *ServicesConfig
		enabled := nilCfg.EnabledServices()
		if enabled != nil {
			t.Error("EnabledServices() should return nil for nil config")
		}
	})

	t.Run("nil services map", func(t *testing.T) {
		emptyCfg := &ServicesConfig{Services: nil}
		enabled := emptyCfg.EnabledServices()
		if enabled != nil {
			t.Error("EnabledServices() should return nil for nil services map")
		}
	})

	t.Run("all disabled", func(t *testing.T) {
		allDisabled := &ServicesConfig{
			Services: map[string]*ServiceSettings{
				"service-x": {Enabled: false},
			},
		}
		enabled := allDisabled.EnabledServices()
		if len(enabled) != 0 {
			t.Errorf("EnabledServices() = %v, want empty", enabled)
		}
	})
}

func TestServicesConfigDisabledServices(t *testing.T) {
	cfg := &ServicesConfig{
		Services: map[string]*ServiceSettings{
			"service-a": {Enabled: true},
			"service-b": {Enabled: false},
			"service-c": {Enabled: true},
			"service-d": {Enabled: false},
		},
	}

	t.Run("returns disabled services", func(t *testing.T) {
		disabled := cfg.DisabledServices()
		if len(disabled) != 2 {
			t.Fatalf("len(DisabledServices()) = %d, want 2", len(disabled))
		}
		sort.Strings(disabled)
		if disabled[0] != "service-b" || disabled[1] != "service-d" {
			t.Errorf("DisabledServices() = %v, want [service-b service-d]", disabled)
		}
	})

	t.Run("nil config", func(t *testing.T) {
		var nilCfg *ServicesConfig
		disabled := nilCfg.DisabledServices()
		if disabled != nil {
			t.Error("DisabledServices() should return nil for nil config")
		}
	})

	t.Run("nil services map", func(t *testing.T) {
		emptyCfg := &ServicesConfig{Services: nil}
		disabled := emptyCfg.DisabledServices()
		if disabled != nil {
			t.Error("DisabledServices() should return nil for nil services map")
		}
	})

	t.Run("all enabled", func(t *testing.T) {
		allEnabled := &ServicesConfig{
			Services: map[string]*ServiceSettings{
				"service-x": {Enabled: true},
			},
		}
		disabled := allEnabled.DisabledServices()
		if len(disabled) != 0 {
			t.Errorf("DisabledServices() = %v, want empty", disabled)
		}
	})
}

func TestServiceSettingsStruct(t *testing.T) {
	settings := ServiceSettings{
		Enabled:     true,
		Port:        8080,
		Description: "Test service",
		Extra: map[string]any{
			"key": "value",
		},
	}

	if !settings.Enabled {
		t.Error("Enabled should be true")
	}
	if settings.Port != 8080 {
		t.Errorf("Port = %d, want 8080", settings.Port)
	}
	if settings.Description != "Test service" {
		t.Errorf("Description = %s, want 'Test service'", settings.Description)
	}
	if settings.Extra["key"] != "value" {
		t.Error("Extra map not set correctly")
	}
}
