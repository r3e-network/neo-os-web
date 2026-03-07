package neogasbank

import "testing"

func TestIsClientValidationError(t *testing.T) {
	tests := []struct {
		name string
		msg  string
		want bool
	}{
		{name: "request nil", msg: errRequestNil, want: true},
		{name: "user id required", msg: errUserIDRequired, want: true},
		{name: "amount positive", msg: errAmountMustBePositive, want: true},
		{name: "service id required", msg: errServiceIDRequired, want: true},
		{name: "other", msg: "insufficient balance", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isClientValidationError(tt.msg); got != tt.want {
				t.Fatalf("isClientValidationError(%q) = %v, want %v", tt.msg, got, tt.want)
			}
		})
	}
}
