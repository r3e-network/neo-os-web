package marble

import (
	"testing"
)

func TestRequireSecret(t *testing.T) {
	m := &Marble{secrets: map[string][]byte{
		"GOOD_KEY":  make([]byte, 32),
		"SHORT_KEY": make([]byte, 8),
	}}

	tests := []struct {
		name    string
		marble  *Marble
		secret  string
		minLen  int
		strict  bool
		wantOK  bool
		wantErr bool
	}{
		{"found and long enough", m, "GOOD_KEY", 32, false, true, false},
		{"found but too short, not strict", m, "SHORT_KEY", 32, false, false, false},
		{"found but too short, strict", m, "SHORT_KEY", 32, true, false, true},
		{"missing, not strict", m, "MISSING", 32, false, false, false},
		{"missing, strict", m, "MISSING", 32, true, false, true},
		{"nil marble, not strict", nil, "ANY", 32, false, false, false},
		{"nil marble, strict", nil, "ANY", 32, true, false, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			val, ok, err := RequireSecret(tt.marble, tt.secret, tt.minLen, tt.strict)
			if ok != tt.wantOK {
				t.Errorf("ok = %v, want %v", ok, tt.wantOK)
			}
			if (err != nil) != tt.wantErr {
				t.Errorf("err = %v, wantErr %v", err, tt.wantErr)
			}
			if ok && val == nil {
				t.Error("ok=true but val is nil")
			}
		})
	}
}

func TestIsStrict(t *testing.T) {
	// nil marble
	var m *Marble
	if m.IsStrict() {
		t.Error("nil marble should not be strict")
	}

	// non-enclave marble (no report)
	m = &Marble{secrets: map[string][]byte{}}
	if m.IsStrict() {
		t.Error("non-enclave marble should not be strict")
	}
}
