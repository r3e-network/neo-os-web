package runtime

import "testing"

func TestStrictIdentityMode(t *testing.T) {
	t.Run("production env", func(t *testing.T) {
		t.Setenv("NITRO_ENV", "production")
		if !StrictIdentityMode() {
			t.Fatalf("StrictIdentityMode() = false, want true")
		}
	})

	t.Run("explicit strict mode", func(t *testing.T) {
		t.Setenv("NITRO_ENV", "development")
		t.Setenv("TEE_STRICT_MODE", "true")
		if !StrictIdentityMode() {
			t.Fatalf("StrictIdentityMode() = false, want true")
		}
	})

	t.Run("tee backend strict opt-in", func(t *testing.T) {
		t.Setenv("NITRO_ENV", "development")
		t.Setenv("TEE_BACKEND", "nitro")
		t.Setenv("STRICT_IDENTITY_ON_TEE", "true")
		if !StrictIdentityMode() {
			t.Fatalf("StrictIdentityMode() = false, want true")
		}
	})

	t.Run("nitrorun tls injected", func(t *testing.T) {
		t.Setenv("NITRO_ENV", "development")
		t.Setenv("NITRO_CERT", "cert")
		t.Setenv("NITRO_KEY", "key")
		t.Setenv("NITRO_ROOT_CA", "ca")
		if !StrictIdentityMode() {
			t.Fatalf("StrictIdentityMode() = false, want true")
		}
	})

	t.Run("dev default", func(t *testing.T) {
		t.Setenv("NITRO_ENV", "development")
		if StrictIdentityMode() {
			t.Fatalf("StrictIdentityMode() = true, want false")
		}
	})
}
