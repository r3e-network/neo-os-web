package txproxy

import "testing"

func TestCheckIntentPolicyPayments(t *testing.T) {
	const paymentHubHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	const otherHash = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

	svc := &Service{paymentHubHash: paymentHubHash}

	status, _ := svc.checkIntentPolicy("0x"+paymentHubHash, "pay", "payments")
	if status != 0 {
		t.Fatalf("expected ok, got status %d", status)
	}

	status, _ = svc.checkIntentPolicy(otherHash, "pay", "payments")
	if status == 0 {
		t.Fatal("expected forbidden for non-PaymentHub contract")
	}

	status, _ = svc.checkIntentPolicy(paymentHubHash, "withdraw", "payments")
	if status == 0 {
		t.Fatal("expected forbidden for non-pay method")
	}
}

func TestCheckIntentPolicyGovernance(t *testing.T) {
	const governanceHash = "cccccccccccccccccccccccccccccccccccccccc"
	const otherHash = "dddddddddddddddddddddddddddddddddddddddd"

	svc := &Service{governanceHash: governanceHash}

	status, _ := svc.checkIntentPolicy("0x"+governanceHash, "vote", "governance")
	if status != 0 {
		t.Fatalf("expected ok, got status %d", status)
	}

	status, _ = svc.checkIntentPolicy(governanceHash, "getProposal", "governance")
	if status == 0 {
		t.Fatal("expected forbidden for non-state-changing method")
	}

	status, _ = svc.checkIntentPolicy(otherHash, "vote", "governance")
	if status == 0 {
		t.Fatal("expected forbidden for non-Governance contract")
	}
}

func TestCheckIntentPolicyUnknownIntent(t *testing.T) {
	svc := &Service{paymentHubHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}

	status, _ := svc.checkIntentPolicy("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "pay", "unknown")
	if status == 0 {
		t.Fatal("expected bad request for unknown intent")
	}
}
