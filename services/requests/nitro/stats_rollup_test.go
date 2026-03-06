package neorequests

import (
	"errors"
	"fmt"
	"testing"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/database"
)

func TestIsNonFatalStatsRollupError(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{
			name: "nil",
			err:  nil,
			want: false,
		},
		{
			name: "unrelated error",
			err:  errors.New("network timeout"),
			want: false,
		},
		{
			name: "typed undefined column",
			err:  fmt.Errorf("rollup miniapp stats: %w", &database.APIError{StatusCode: 400, Code: "42703", Message: `column \"total_users\" does not exist`}),
			want: true,
		},
		{
			name: "typed missing on conflict without prefix",
			err:  &database.APIError{StatusCode: 400, Code: "42P10", Message: "there is no unique or exclusion constraint matching the ON CONFLICT specification"},
			want: true,
		},
		{
			name: "undefined column",
			err:  errors.New(`rollup miniapp stats: supabase API error 400: {"code":"42703","message":"column \"total_users\" does not exist"}`),
			want: true,
		},
		{
			name: "missing on conflict constraint",
			err:  errors.New(`rollup miniapp stats: supabase API error 400: {"code":"42P10","message":"there is no unique or exclusion constraint matching the ON CONFLICT specification"}`),
			want: true,
		},
		{
			name: "lowercase on conflict text",
			err:  errors.New("rollup miniapp stats: there is no unique or exclusion constraint matching the on conflict specification"),
			want: true,
		},
		{
			name: "on conflict text without prefix",
			err:  errors.New("there is no unique or exclusion constraint matching the on conflict specification"),
			want: true,
		},
		{
			name: "unrelated on conflict text",
			err:  errors.New("failed to parse on conflict specification in client request"),
			want: false,
		},
		{
			name: "contains both fragments but not postgres schema drift wording",
			err:  errors.New("on conflict specification changed after unique or exclusion constraint migration"),
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isNonFatalStatsRollupError(tt.err)
			if got != tt.want {
				t.Fatalf("isNonFatalStatsRollupError() = %v, want %v", got, tt.want)
			}
		})
	}
}
