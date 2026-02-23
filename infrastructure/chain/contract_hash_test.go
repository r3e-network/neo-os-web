package chain

import "testing"

func TestNormalizeContractHash(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "normalizes prefixed upper hash",
			input: "  0XABCDEF0123456789ABCDEF0123456789ABCDEF01  ",
			want:  "abcdef***REMOVED***01",
		},
		{
			name:  "keeps already normalized hash",
			input: "abcdef***REMOVED***01",
			want:  "abcdef***REMOVED***01",
		},
		{
			name:  "rejects invalid length",
			input: "0x1234",
			want:  "",
		},
		{
			name:  "rejects invalid hex char",
			input: "0xabcdef***REMOVED***0g",
			want:  "",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := NormalizeContractHash(tc.input)
			if got != tc.want {
				t.Fatalf("NormalizeContractHash(%q) = %q, want %q", tc.input, got, tc.want)
			}
		})
	}
}
