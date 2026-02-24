package runtime

import (
	"os"
	"testing"
)

func TestIsDevelopment(t *testing.T) {
	// Save and restore environment
	savedMarble := os.Getenv("MARBLE_ENV")
	savedEnv := os.Getenv("ENVIRONMENT")
	defer func() {
		if savedMarble != "" {
			t.Setenv("MARBLE_ENV", savedMarble)
		} else {
			t.Setenv("MARBLE_ENV", "")
		}
		if savedEnv != "" {
			t.Setenv("ENVIRONMENT", savedEnv)
		} else {
			t.Setenv("ENVIRONMENT", "")
		}
	}()

	t.Run("true when development", func(t *testing.T) {
		t.Setenv("MARBLE_ENV", "development")
		t.Setenv("ENVIRONMENT", "")
		if !IsDevelopment() {
			t.Error("IsDevelopment() should return true")
		}
	})

	t.Run("false when production", func(t *testing.T) {
		t.Setenv("MARBLE_ENV", "production")
		if IsDevelopment() {
			t.Error("IsDevelopment() should return false for production")
		}
	})

	t.Run("true when unset (default)", func(t *testing.T) {
		t.Setenv("MARBLE_ENV", "")
		t.Setenv("ENVIRONMENT", "")
		if !IsDevelopment() {
			t.Error("IsDevelopment() should return true when env is unset")
		}
	})
}

func TestIsTesting(t *testing.T) {
	savedMarble := os.Getenv("MARBLE_ENV")
	savedEnv := os.Getenv("ENVIRONMENT")
	defer func() {
		if savedMarble != "" {
			t.Setenv("MARBLE_ENV", savedMarble)
		} else {
			t.Setenv("MARBLE_ENV", "")
		}
		if savedEnv != "" {
			t.Setenv("ENVIRONMENT", savedEnv)
		} else {
			t.Setenv("ENVIRONMENT", "")
		}
	}()

	t.Run("true when testing", func(t *testing.T) {
		t.Setenv("MARBLE_ENV", "testing")
		if !IsTesting() {
			t.Error("IsTesting() should return true")
		}
	})

	t.Run("false when development", func(t *testing.T) {
		t.Setenv("MARBLE_ENV", "development")
		if IsTesting() {
			t.Error("IsTesting() should return false for development")
		}
	})
}

func TestIsProduction(t *testing.T) {
	savedMarble := os.Getenv("MARBLE_ENV")
	savedEnv := os.Getenv("ENVIRONMENT")
	defer func() {
		if savedMarble != "" {
			t.Setenv("MARBLE_ENV", savedMarble)
		} else {
			t.Setenv("MARBLE_ENV", "")
		}
		if savedEnv != "" {
			t.Setenv("ENVIRONMENT", savedEnv)
		} else {
			t.Setenv("ENVIRONMENT", "")
		}
	}()

	t.Run("true when production", func(t *testing.T) {
		t.Setenv("MARBLE_ENV", "production")
		if !IsProduction() {
			t.Error("IsProduction() should return true")
		}
	})

	t.Run("false when development", func(t *testing.T) {
		t.Setenv("MARBLE_ENV", "development")
		if IsProduction() {
			t.Error("IsProduction() should return false for development")
		}
	})
}

func TestIsDevelopmentOrTesting(t *testing.T) {
	savedMarble := os.Getenv("MARBLE_ENV")
	savedEnv := os.Getenv("ENVIRONMENT")
	defer func() {
		if savedMarble != "" {
			t.Setenv("MARBLE_ENV", savedMarble)
		} else {
			t.Setenv("MARBLE_ENV", "")
		}
		if savedEnv != "" {
			t.Setenv("ENVIRONMENT", savedEnv)
		} else {
			t.Setenv("ENVIRONMENT", "")
		}
	}()

	t.Run("true when development", func(t *testing.T) {
		t.Setenv("MARBLE_ENV", "development")
		if !IsDevelopmentOrTesting() {
			t.Error("IsDevelopmentOrTesting() should return true for development")
		}
	})

	t.Run("true when testing", func(t *testing.T) {
		t.Setenv("MARBLE_ENV", "testing")
		if !IsDevelopmentOrTesting() {
			t.Error("IsDevelopmentOrTesting() should return true for testing")
		}
	})

	t.Run("false when production", func(t *testing.T) {
		t.Setenv("MARBLE_ENV", "production")
		if IsDevelopmentOrTesting() {
			t.Error("IsDevelopmentOrTesting() should return false for production")
		}
	})
}

func TestEnvWithLegacyFallback(t *testing.T) {
	savedMarble := os.Getenv("MARBLE_ENV")
	savedEnv := os.Getenv("ENVIRONMENT")
	defer func() {
		if savedMarble != "" {
			t.Setenv("MARBLE_ENV", savedMarble)
		} else {
			t.Setenv("MARBLE_ENV", "")
		}
		if savedEnv != "" {
			t.Setenv("ENVIRONMENT", savedEnv)
		} else {
			t.Setenv("ENVIRONMENT", "")
		}
	}()

	t.Run("MARBLE_ENV takes precedence", func(t *testing.T) {
		t.Setenv("MARBLE_ENV", "production")
		t.Setenv("ENVIRONMENT", "development")
		if Env() != Production {
			t.Error("MARBLE_ENV should take precedence over ENVIRONMENT")
		}
	})

	t.Run("ENVIRONMENT fallback", func(t *testing.T) {
		t.Setenv("MARBLE_ENV", "")
		t.Setenv("ENVIRONMENT", "testing")
		if Env() != Testing {
			t.Error("ENVIRONMENT should be used as fallback")
		}
	})
}

func TestParseEnvironmentEdgeCases(t *testing.T) {
	t.Run("case insensitive", func(t *testing.T) {
		env, ok := ParseEnvironment("PRODUCTION")
		if !ok || env != Production {
			t.Error("ParseEnvironment should be case insensitive")
		}
	})

	t.Run("mixed case", func(t *testing.T) {
		env, ok := ParseEnvironment("DeVeLoPmEnT")
		if !ok || env != Development {
			t.Error("ParseEnvironment should handle mixed case")
		}
	})

	t.Run("whitespace trimmed", func(t *testing.T) {
		env, ok := ParseEnvironment("  testing  ")
		if !ok || env != Testing {
			t.Error("ParseEnvironment should trim whitespace")
		}
	})

	t.Run("unknown returns development with ok=false", func(t *testing.T) {
		env, ok := ParseEnvironment("staging")
		if ok {
			t.Error("ParseEnvironment should return ok=false for unknown")
		}
		if env != Development {
			t.Error("ParseEnvironment should return Development for unknown")
		}
	})
}
