package database

import (
	"context"
	"net/http"
	"strings"
	"testing"
)

func newValidationTestRepository(t *testing.T, failureMessage string) *Repository {
	t.Helper()

	return NewRepository(&Client{
		url:        "https://supabase.example.test",
		serviceKey: "test",
		httpClient: &http.Client{Transport: supabaseRoundTripFunc(func(_ *http.Request) (*http.Response, error) {
			t.Fatal(failureMessage)
			return nil, nil
		})},
	})
}

func TestRepositoryRequestRejectsInvalidTableWithoutPanic(t *testing.T) {
	t.Parallel()

	repo := newValidationTestRepository(t, "http client should not be called for invalid table")

	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("Request should return error instead of panic: %v", r)
		}
	}()

	_, err := repo.Request(context.Background(), http.MethodGet, "users;drop", nil, "")
	if err == nil {
		t.Fatal("expected error for invalid table")
	}
}

func TestRepositoryRequestRPCRejectsInvalidPathWithoutPanic(t *testing.T) {
	t.Parallel()

	repo := newValidationTestRepository(t, "http client should not be called for invalid rpc path")

	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("RequestRPC should return error instead of panic: %v", r)
		}
	}()

	_, err := repo.RequestRPC(context.Background(), http.MethodPost, "/bad/path", map[string]string{"x": "y"}, "")
	if err == nil {
		t.Fatal("expected error for invalid rpc path")
	}
}

func TestRepositoryRequestUpsertRejectsInvalidOnConflictWithoutHTTP(t *testing.T) {
	t.Parallel()

	repo := newValidationTestRepository(t, "http client should not be called for invalid onConflict")

	_, err := repo.RequestUpsert(context.Background(), "test_table", map[string]string{"id": "123"}, "id;drop", "")
	if err == nil {
		t.Fatal("expected error for invalid onConflict")
	}
	if !strings.Contains(err.Error(), "invalid field name") {
		t.Fatalf("error = %q, want invalid field name", err.Error())
	}
}

func TestGenericHelpersRejectInvalidFieldWithoutPanic(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		run  func(*Repository) error
	}{
		{
			name: "update",
			run: func(repo *Repository) error {
				model := &testModel{Name: "updated"}
				return GenericUpdate(repo, context.Background(), "test_table", "id;drop", "123", model)
			},
		},
		{
			name: "get_by_field",
			run: func(repo *Repository) error {
				_, err := GenericGetByField[testModel](repo, context.Background(), "test_table", "id;drop", "123")
				return err
			},
		},
		{
			name: "list_by_field",
			run: func(repo *Repository) error {
				_, err := GenericListByField[testModel](repo, context.Background(), "test_table", "id;drop", "123")
				return err
			},
		},
		{
			name: "delete",
			run: func(repo *Repository) error {
				return GenericDelete(repo, context.Background(), "test_table", "id;drop", "123")
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			repo := newValidationTestRepository(t, "http client should not be called for invalid field")

			defer func() {
				if r := recover(); r != nil {
					t.Fatalf("helper should return error instead of panic: %v", r)
				}
			}()

			err := tc.run(repo)
			if err == nil {
				t.Fatal("expected error for invalid field")
			}
			if !strings.Contains(err.Error(), "invalid field name") {
				t.Fatalf("error = %q, want invalid field name", err.Error())
			}
		})
	}
}

func TestGenericUpsertRejectsInvalidOnConflictWithoutHTTP(t *testing.T) {
	t.Parallel()

	repo := newValidationTestRepository(t, "http client should not be called for invalid generic upsert onConflict")
	model := &testModel{Name: "created"}

	err := GenericUpsert(repo, context.Background(), "test_table", "id;drop", model, nil)
	if err == nil {
		t.Fatal("expected error for invalid onConflict")
	}
	if !strings.Contains(err.Error(), "invalid field name") {
		t.Fatalf("error = %q, want invalid field name", err.Error())
	}
}
