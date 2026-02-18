package httputil

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"time"
)

// privateRanges contains CIDR blocks that must never be reached by outbound
// HTTP requests. This prevents SSRF attacks that attempt to reach internal
// services, cloud metadata endpoints, or loopback interfaces.
var privateRanges []*net.IPNet

func init() {
	for _, cidr := range []string{
		"0.0.0.0/8",      // "This network" (unspecified)
		"10.0.0.0/8",     // RFC 1918
		"100.64.0.0/10",  // Carrier-grade NAT / cloud internal
		"127.0.0.0/8",    // Loopback
		"169.254.0.0/16", // Link-local
		"172.16.0.0/12",  // RFC 1918
		"192.0.0.0/24",   // IETF protocol assignments
		"192.168.0.0/16", // RFC 1918
		"198.18.0.0/15",  // Benchmarking
		"240.0.0.0/4",    // Reserved for future use
		"::1/128",        // IPv6 loopback
		"fc00::/7",       // IPv6 unique local
		"fe80::/10",      // IPv6 link-local
	} {
		privateRanges = append(privateRanges, mustParseCIDR(cidr))
	}
}

func mustParseCIDR(s string) *net.IPNet {
	_, ipNet, err := net.ParseCIDR(s)
	if err != nil {
		panic(fmt.Sprintf("httputil: bad CIDR %q: %v", s, err))
	}
	return ipNet
}

// isPrivateIP reports whether ip falls within any private/reserved range.
// IPv4-mapped IPv6 addresses (e.g. ::ffff:10.0.0.1) are normalised to their
// IPv4 form first, preventing SSRF bypass via mapped addresses.
func isPrivateIP(ip net.IP) bool {
	// Normalise IPv4-mapped IPv6 (::ffff:x.x.x.x) to plain IPv4 so the
	// IPv4 CIDR ranges match. Without this, an attacker could supply
	// ::ffff:127.0.0.1 and skip every v4 check.
	if v4 := ip.To4(); v4 != nil {
		ip = v4
	}
	for _, r := range privateRanges {
		if r.Contains(ip) {
			return true
		}
	}
	return false
}

// NewSafeTransport returns an *http.Transport whose DialContext resolves DNS
// first and rejects connections to private/internal IP addresses. It clones
// http.DefaultTransport for sane defaults and enforces TLS 1.2+.
//
// Use this for any HTTP client that fetches user-controlled URLs.
func NewSafeTransport() *http.Transport {
	base, ok := http.DefaultTransport.(*http.Transport)
	if !ok {
		base = &http.Transport{}
	}

	cloned := base.Clone()

	// Enforce TLS 1.2+ baseline (consistent with DefaultTransportWithMinTLS12).
	if cloned.TLSClientConfig != nil {
		cloned.TLSClientConfig = cloned.TLSClientConfig.Clone()
		if cloned.TLSClientConfig.MinVersion < tls.VersionTLS12 {
			cloned.TLSClientConfig.MinVersion = tls.VersionTLS12
		}
	} else {
		cloned.TLSClientConfig = &tls.Config{MinVersion: tls.VersionTLS12}
	}

	dialer := &net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
	}

	cloned.DialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(addr)
		if err != nil {
			return nil, fmt.Errorf("safedialer: invalid address %q: %w", addr, err)
		}

		// Resolve DNS to get actual IPs before connecting.
		ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
		if err != nil {
			return nil, fmt.Errorf("safedialer: DNS lookup failed for %q: %w", host, err)
		}

		if len(ips) == 0 {
			return nil, fmt.Errorf("safedialer: no addresses found for %q", host)
		}

		// Check every resolved address; reject if any is private.
		for _, ipAddr := range ips {
			if isPrivateIP(ipAddr.IP) {
				return nil, fmt.Errorf("safedialer: blocked connection to private/internal IP %s (host %q)", ipAddr.IP, host)
			}
		}

		// Connect to the first resolved address directly (bypasses DNS rebinding).
		target := net.JoinHostPort(ips[0].IP.String(), port)
		return dialer.DialContext(ctx, network, target)
	}

	return cloned
}
