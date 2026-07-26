//go:build scripts

package main

import "testing"

func TestAtgParseSignerIdentityAcceptsScriptHash(t *testing.T) {
	const expected = "0x13ef519c362973f9a34648a9eac5b71250b2a80a"

	actual, err := atgParseSignerIdentity(expected)
	if err != nil {
		t.Fatalf("parse script hash: %v", err)
	}
	if got := "0x" + actual.StringLE(); got != expected {
		t.Fatalf("round-trip script hash: got %s, want %s", got, expected)
	}
}

func TestAtgParseSignerIdentityRejectsMissingOrMalformedInput(t *testing.T) {
	for _, input := range []string{"", "not-an-address", "0x1234"} {
		if _, err := atgParseSignerIdentity(input); err == nil {
			t.Fatalf("expected signer identity %q to fail", input)
		}
	}
}
