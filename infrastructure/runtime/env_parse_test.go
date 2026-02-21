package runtime

import (
	"os"
	"testing"
	"time"
)

func TestParseEnvInt(t *testing.T) {
	const key = "TEST_PARSE_ENV_INT"
	defer os.Unsetenv(key)

	t.Run("valid integer", func(t *testing.T) {
		os.Setenv(key, "42")
		v, ok := ParseEnvInt(key)
		if !ok || v != 42 {
			t.Errorf("got (%d, %v), want (42, true)", v, ok)
		}
	})

	t.Run("negative integer", func(t *testing.T) {
		os.Setenv(key, "-7")
		v, ok := ParseEnvInt(key)
		if !ok || v != -7 {
			t.Errorf("got (%d, %v), want (-7, true)", v, ok)
		}
	})

	t.Run("zero", func(t *testing.T) {
		os.Setenv(key, "0")
		v, ok := ParseEnvInt(key)
		if !ok || v != 0 {
			t.Errorf("got (%d, %v), want (0, true)", v, ok)
		}
	})

	t.Run("whitespace trimmed", func(t *testing.T) {
		os.Setenv(key, "  99  ")
		v, ok := ParseEnvInt(key)
		if !ok || v != 99 {
			t.Errorf("got (%d, %v), want (99, true)", v, ok)
		}
	})

	t.Run("empty string", func(t *testing.T) {
		os.Setenv(key, "")
		_, ok := ParseEnvInt(key)
		if ok {
			t.Error("expected ok=false for empty string")
		}
	})

	t.Run("unset variable", func(t *testing.T) {
		os.Unsetenv(key)
		_, ok := ParseEnvInt(key)
		if ok {
			t.Error("expected ok=false for unset variable")
		}
	})

	t.Run("non-numeric", func(t *testing.T) {
		os.Setenv(key, "abc")
		_, ok := ParseEnvInt(key)
		if ok {
			t.Error("expected ok=false for non-numeric value")
		}
	})

	t.Run("float value", func(t *testing.T) {
		os.Setenv(key, "3.14")
		_, ok := ParseEnvInt(key)
		if ok {
			t.Error("expected ok=false for float value")
		}
	})
}

func TestParseEnvBool(t *testing.T) {
	truthy := []string{"1", "true", "TRUE", "True", "yes", "YES", "y", "Y", "on", "ON"}
	for _, v := range truthy {
		if !ParseEnvBool(v) {
			t.Errorf("ParseEnvBool(%q) = false, want true", v)
		}
	}

	falsy := []string{"0", "false", "no", "off", "random", ""}
	for _, v := range falsy {
		if ParseEnvBool(v) {
			t.Errorf("ParseEnvBool(%q) = true, want false", v)
		}
	}

	t.Run("whitespace trimmed", func(t *testing.T) {
		if !ParseEnvBool("  true  ") {
			t.Error("ParseEnvBool should trim whitespace")
		}
	})
}

func TestParseEnvBoolKey(t *testing.T) {
	const key = "TEST_PARSE_ENV_BOOL_KEY"
	defer os.Unsetenv(key)

	t.Run("truthy value", func(t *testing.T) {
		os.Setenv(key, "true")
		if !ParseEnvBoolKey(key) {
			t.Error("ParseEnvBoolKey should return true for 'true'")
		}
	})

	t.Run("falsy value", func(t *testing.T) {
		os.Setenv(key, "no")
		if ParseEnvBoolKey(key) {
			t.Error("ParseEnvBoolKey should return false for 'no'")
		}
	})

	t.Run("unset variable", func(t *testing.T) {
		os.Unsetenv(key)
		if ParseEnvBoolKey(key) {
			t.Error("ParseEnvBoolKey should return false for unset variable")
		}
	})

	t.Run("empty string", func(t *testing.T) {
		os.Setenv(key, "")
		if ParseEnvBoolKey(key) {
			t.Error("ParseEnvBoolKey should return false for empty string")
		}
	})

	t.Run("numeric truthy", func(t *testing.T) {
		os.Setenv(key, "1")
		if !ParseEnvBoolKey(key) {
			t.Error("ParseEnvBoolKey should return true for '1'")
		}
	})
}

func TestParseEnvDuration(t *testing.T) {
	const key = "TEST_PARSE_ENV_DURATION"
	defer os.Unsetenv(key)

	t.Run("valid duration", func(t *testing.T) {
		os.Setenv(key, "5s")
		v, ok := ParseEnvDuration(key)
		if !ok || v != 5*time.Second {
			t.Errorf("got (%v, %v), want (5s, true)", v, ok)
		}
	})

	t.Run("minutes", func(t *testing.T) {
		os.Setenv(key, "10m")
		v, ok := ParseEnvDuration(key)
		if !ok || v != 10*time.Minute {
			t.Errorf("got (%v, %v), want (10m, true)", v, ok)
		}
	})

	t.Run("complex duration", func(t *testing.T) {
		os.Setenv(key, "1h30m")
		v, ok := ParseEnvDuration(key)
		if !ok || v != 90*time.Minute {
			t.Errorf("got (%v, %v), want (1h30m, true)", v, ok)
		}
	})

	t.Run("whitespace trimmed", func(t *testing.T) {
		os.Setenv(key, "  2s  ")
		v, ok := ParseEnvDuration(key)
		if !ok || v != 2*time.Second {
			t.Errorf("got (%v, %v), want (2s, true)", v, ok)
		}
	})

	t.Run("empty string", func(t *testing.T) {
		os.Setenv(key, "")
		_, ok := ParseEnvDuration(key)
		if ok {
			t.Error("expected ok=false for empty string")
		}
	})

	t.Run("unset variable", func(t *testing.T) {
		os.Unsetenv(key)
		_, ok := ParseEnvDuration(key)
		if ok {
			t.Error("expected ok=false for unset variable")
		}
	})

	t.Run("invalid duration", func(t *testing.T) {
		os.Setenv(key, "notaduration")
		_, ok := ParseEnvDuration(key)
		if ok {
			t.Error("expected ok=false for invalid duration")
		}
	})

	t.Run("bare number without unit", func(t *testing.T) {
		os.Setenv(key, "42")
		_, ok := ParseEnvDuration(key)
		if ok {
			t.Error("expected ok=false for bare number without unit")
		}
	})
}
