package txproxy

import "testing"

func TestCheckIntentPolicyPayments(t *testing.T) {
	svc := &Service{paymentHubHash: "abcd"}

	status, _ := svc.checkIntentPolicy("0xabcd", "Pay", "payments")
	if status != 0 {
		t.Fatalf("expected ok, got status %d", status)
	}

	status, _ = svc.checkIntentPolicy("beef", "Pay", "payments")
	if status == 0 {
		t.Fatal("expected forbidden for non-PaymentHub contract")
	}

	status, _ = svc.checkIntentPolicy("abcd", "Withdraw", "payments")
	if status == 0 {
		t.Fatal("expected forbidden for non-Pay method")
	}
}

func TestCheckIntentPolicyGovernance(t *testing.T) {
	svc := &Service{governanceHash: "beef"}

	status, _ := svc.checkIntentPolicy("0xbeef", "Vote", "governance")
	if status != 0 {
		t.Fatalf("expected ok, got status %d", status)
	}

	status, _ = svc.checkIntentPolicy("beef", "GetProposal", "governance")
	if status == 0 {
		t.Fatal("expected forbidden for non-state-changing method")
	}

	status, _ = svc.checkIntentPolicy("abcd", "Vote", "governance")
	if status == 0 {
		t.Fatal("expected forbidden for non-Governance contract")
	}
}

func TestCheckIntentPolicyUnknownIntent(t *testing.T) {
	svc := &Service{paymentHubHash: "abcd"}

	status, _ := svc.checkIntentPolicy("abcd", "Pay", "unknown")
	if status == 0 {
		t.Fatal("expected bad request for unknown intent")
	}
}
