package neorequests

import (
	"errors"
	"testing"
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
