package supabase

import (
	"errors"
	"testing"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/database"
)

func TestIsDuplicateError(t *testing.T) {
	t.Run("typed unique violation", func(t *testing.T) {
		err := &database.APIError{StatusCode: 409, Code: "23505", Message: "duplicate key value violates unique constraint"}
		if !isDuplicateError(err) {
			t.Fatal("isDuplicateError() = false, want true")
		}
	})

	t.Run("legacy duplicate string", func(t *testing.T) {
		if !isDuplicateError(errors.New("duplicate key value violates unique constraint")) {
			t.Fatal("isDuplicateError() = false, want true")
		}
	})

	t.Run("non duplicate", func(t *testing.T) {
		if isDuplicateError(errors.New("network timeout")) {
			t.Fatal("isDuplicateError() = true, want false")
		}
	})
}
