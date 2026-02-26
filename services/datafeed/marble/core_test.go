package neofeeds

import (
	"errors"
	"testing"

	"github.com/tidwall/gjson"
)

func TestIsDuplicatePriceFeedError(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{
			name: "nil error",
			err:  nil,
			want: false,
		},
		{
			name: "postgres duplicate code and message",
			err:  errors.New(`database error: create price feed: supabase API error 409: {"code":"23505","message":"duplicate key value violates unique constraint \"price_feeds_feed_id_key\""}`),
			want: true,
		},
		{
			name: "duplicate without postgres code",
			err:  errors.New("duplicate key value violates unique constraint"),
			want: false,
		},
		{
			name: "postgres code without duplicate marker",
			err:  errors.New(`database error: {"code":"23505","message":"constraint violation"}`),
			want: false,
		},
		{
			name: "other error",
			err:  errors.New("connection timeout"),
			want: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := isDuplicatePriceFeedError(tc.err); got != tc.want {
				t.Fatalf("isDuplicatePriceFeedError() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestParsePriceResult(t *testing.T) {
	tests := []struct {
		name    string
		rawJSON string
		path    string
		want    float64
		wantErr bool
	}{
		{
			name:    "numeric json value",
			rawJSON: `{"price":123.45}`,
			path:    "price",
			want:    123.45,
		},
		{
			name:    "currency formatted string",
			rawJSON: `{"price":"$195.9117"}`,
			path:    "price",
			want:    195.9117,
		},
		{
			name:    "comma formatted string",
			rawJSON: `{"price":"250,384,003.971606"}`,
			path:    "price",
			want:    250384003.971606,
		},
		{
			name:    "invalid string",
			rawJSON: `{"price":"N/A"}`,
			path:    "price",
			wantErr: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := gjson.Get(tc.rawJSON, tc.path)
			got, err := parsePriceResult(result)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("parsePriceResult() expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("parsePriceResult() error = %v", err)
			}
			if got != tc.want {
				t.Fatalf("parsePriceResult() = %v, want %v", got, tc.want)
			}
		})
	}
}
