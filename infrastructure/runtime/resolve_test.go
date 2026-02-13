package runtime

import (
	"os"
	"testing"
	"time"
)

func TestResolveInt(t *testing.T) {
	tests := []struct {
		name     string
		cfgValue int
		envKey   string
		envValue string
		fallback int
		want     int
	}{
		{"cfg value wins", 42, "TEST_RESOLVE_INT", "", 10, 42},
		{"env value wins when cfg is zero", 0, "TEST_RESOLVE_INT", "99", 10, 99},
		{"fallback when both empty", 0, "TEST_RESOLVE_INT", "", 10, 10},
		{"cfg zero and env invalid", 0, "TEST_RESOLVE_INT", "notanumber", 10, 10},
		{"negative cfg falls through", -1, "TEST_RESOLVE_INT", "", 10, 10},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.envValue != "" {
				t.Setenv("TEST_RESOLVE_INT", tt.envValue)
			} else {
				os.Unsetenv("TEST_RESOLVE_INT")
			}
			got := ResolveInt(tt.cfgValue, tt.envKey, tt.fallback)
			if got != tt.want {
				t.Errorf("ResolveInt(%d, %q, %d) = %d, want %d", tt.cfgValue, tt.envKey, tt.fallback, got, tt.want)
			}
		})
	}
}

func TestResolveDuration(t *testing.T) {
	tests := []struct {
		name     string
		cfgValue time.Duration
		envKey   string
		envValue string
		fallback time.Duration
		want     time.Duration
	}{
		{"cfg value wins", 5 * time.Second, "TEST_RESOLVE_DUR", "", time.Second, 5 * time.Second},
		{"env value wins", 0, "TEST_RESOLVE_DUR", "30s", time.Second, 30 * time.Second},
		{"fallback when both empty", 0, "TEST_RESOLVE_DUR", "", time.Second, time.Second},
		{"invalid env falls to fallback", 0, "TEST_RESOLVE_DUR", "notaduration", time.Second, time.Second},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.envValue != "" {
				t.Setenv("TEST_RESOLVE_DUR", tt.envValue)
			} else {
				os.Unsetenv("TEST_RESOLVE_DUR")
			}
			got := ResolveDuration(tt.cfgValue, tt.envKey, tt.fallback)
			if got != tt.want {
				t.Errorf("ResolveDuration() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestResolveString(t *testing.T) {
	tests := []struct {
		name     string
		cfgValue string
		envKey   string
		envValue string
		fallback string
		want     string
	}{
		{"cfg value wins", "from-cfg", "TEST_RESOLVE_STR", "", "default", "from-cfg"},
		{"env value wins", "", "TEST_RESOLVE_STR", "from-env", "default", "from-env"},
		{"fallback when both empty", "", "TEST_RESOLVE_STR", "", "default", "default"},
		{"whitespace-only cfg falls through", "  ", "TEST_RESOLVE_STR", "from-env", "default", "from-env"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.envValue != "" {
				t.Setenv("TEST_RESOLVE_STR", tt.envValue)
			} else {
				os.Unsetenv("TEST_RESOLVE_STR")
			}
			got := ResolveString(tt.cfgValue, tt.envKey, tt.fallback)
			if got != tt.want {
				t.Errorf("ResolveString() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestResolveBool(t *testing.T) {
	tests := []struct {
		name     string
		cfgValue bool
		envKey   string
		envValue string
		want     bool
	}{
		{"cfg true, no env", true, "TEST_RESOLVE_BOOL", "", true},
		{"cfg false, no env", false, "TEST_RESOLVE_BOOL", "", false},
		{"env overrides cfg true", true, "TEST_RESOLVE_BOOL", "false", false},
		{"env overrides cfg false", false, "TEST_RESOLVE_BOOL", "true", true},
		{"env 1 is true", false, "TEST_RESOLVE_BOOL", "1", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.envValue != "" {
				t.Setenv("TEST_RESOLVE_BOOL", tt.envValue)
			} else {
				os.Unsetenv("TEST_RESOLVE_BOOL")
			}
			got := ResolveBool(tt.cfgValue, tt.envKey)
			if got != tt.want {
				t.Errorf("ResolveBool(%v, %q) = %v, want %v", tt.cfgValue, tt.envKey, got, tt.want)
			}
		})
	}
}
