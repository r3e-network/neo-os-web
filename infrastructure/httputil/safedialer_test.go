package httputil

import (
	"net"
	"testing"
)

func TestIsPrivateIP(t *testing.T) {
	tests := []struct {
		ip      string
		private bool
	}{
		// IPv4 private ranges
		{"10.0.0.1", true},
		{"10.255.255.255", true},
		{"172.16.0.1", true},
		{"172.31.255.255", true},
		{"192.168.0.1", true},
		{"192.168.255.255", true},
		{"127.0.0.1", true},
		{"127.255.255.255", true},
		{"169.254.1.1", true},
		{"0.0.0.1", true},
		{"100.64.0.1", true},
		{"192.0.0.1", true},
		{"198.18.0.1", true},
		{"240.0.0.1", true},

		// IPv6 private ranges
		{"::1", true},
		{"fc00::1", true},
		{"fdff::1", true},
		{"fe80::1", true},
		{"::ffff:127.0.0.1", true},
		{"::ffff:10.0.0.1", true},

		// Public IPs - should NOT be blocked
		{"8.8.8.8", false},
		{"1.1.1.1", false},
		{"93.184.216.34", false},
		{"172.32.0.1", false}, // just outside 172.16.0.0/12
		{"172.15.255.255", false},
		{"11.0.0.1", false},
		{"2607:f8b0:4004:800::200e", false}, // Google public IPv6
	}

	for _, tt := range tests {
		ip := net.ParseIP(tt.ip)
		if ip == nil {
			t.Fatalf("failed to parse IP %q", tt.ip)
		}
		got := isPrivateIP(ip)
		if got != tt.private {
			t.Errorf("isPrivateIP(%s) = %v, want %v", tt.ip, got, tt.private)
		}
	}
}

func TestNewSafeTransport_ReturnsNonNil(t *testing.T) {
	tr := NewSafeTransport()
	if tr == nil {
		t.Fatal("NewSafeTransport() returned nil")
	}
	if tr.DialContext == nil {
		t.Fatal("NewSafeTransport().DialContext is nil")
	}
	if tr.TLSClientConfig == nil || tr.TLSClientConfig.MinVersion == 0 {
		t.Fatal("NewSafeTransport() did not enforce TLS 1.2+")
	}
}

func TestMustParseCIDR_Panics(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Fatal("mustParseCIDR did not panic on invalid CIDR")
		}
	}()
	mustParseCIDR("not-a-cidr")
}
