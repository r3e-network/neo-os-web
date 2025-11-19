package migrations

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestApplyExecutesAllMigrations(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock new: %v", err)
	}
	defer db.Close()

	entries, err := files.ReadDir(".")
	if err != nil {
		t.Fatalf("read migrations: %v", err)
	}
	for range entries {
		mock.ExpectExec(".*").WillReturnResult(sqlmock.NewResult(0, 0))
	}

	if err := Apply(context.Background(), db); err != nil {
		t.Fatalf("apply migrations: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}
