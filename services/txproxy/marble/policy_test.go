package txproxy

import (
	"testing"

	"github.com/R3E-Network/service_layer/infrastructure/chain"
)

func TestCheckIntentPolicyPayments(t *testing.T) {
	const paymentHubHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	const otherHash = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	const gasHash = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"

	svc := &Service{paymentHubHash: paymentHubHash, gasHash: gasHash}

	status, _ := svc.checkIntentPolicy("0x"+paymentHubHash, "pay", "payments", nil)
	if status != 0 {
		t.Fatalf("expected ok, got status %d", status)
	}

	status, _ = svc.checkIntentPolicy(otherHash, "pay", "payments", nil)
	if status == 0 {
		t.Fatal("expected forbidden for non-PaymentHub contract")
	}

	status, _ = svc.checkIntentPolicy(paymentHubHash, "withdraw", "payments", nil)
	if status == 0 {
		t.Fatal("expected forbidden for non-pay method")
	}

	params := []chain.ContractParam{
		{Type: "Hash160", Value: "SENDER"},
		{Type: "Hash160", Value: "0x" + paymentHubHash},
	}
	status, _ = svc.checkIntentPolicy(gasHash, "transfer", "payments", params)
	if status != 0 {
		t.Fatalf("expected ok for GAS transfer, got status %d", status)
	}

	params[1].Value = "0x" + otherHash
	status, _ = svc.checkIntentPolicy(gasHash, "transfer", "payments", params)
	if status == 0 {
		t.Fatal("expected forbidden for transfer to non-PaymentHub target")
	}
}

func TestCheckIntentPolicyGovernance(t *testing.T) {
	const governanceHash = "cccccccccccccccccccccccccccccccccccccccc"
	const otherHash = "dddddddddddddddddddddddddddddddddddddddd"

	svc := &Service{governanceHash: governanceHash}

	status, _ := svc.checkIntentPolicy("0x"+governanceHash, "vote", "governance", nil)
	if status != 0 {
		t.Fatalf("expected ok, got status %d", status)
	}

	status, _ = svc.checkIntentPolicy(governanceHash, "getProposal", "governance", nil)
	if status == 0 {
		t.Fatal("expected forbidden for non-state-changing method")
	}

	status, _ = svc.checkIntentPolicy(otherHash, "vote", "governance", nil)
	if status == 0 {
		t.Fatal("expected forbidden for non-Governance contract")
	}
}

func TestCheckIntentPolicyUnknownIntent(t *testing.T) {
	svc := &Service{paymentHubHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}

	status, _ := svc.checkIntentPolicy("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "pay", "unknown", nil)
	if status == 0 {
		t.Fatal("expected bad request for unknown intent")
	}
}
