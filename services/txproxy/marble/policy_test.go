package txproxy

import (
	"testing"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/chain"
)

func TestCheckIntentPolicyPayments(t *testing.T) {
	const paymentHubAddress = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	const otherAddress = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	const gasAddress = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"

	svc := &Service{paymentHubAddress: paymentHubAddress, gasAddress: gasAddress}

	status, _ := svc.checkIntentPolicy("0x"+paymentHubAddress, "pay", "payments", nil)
	if status != 0 {
		t.Fatalf("expected ok, got status %d", status)
	}

	status, _ = svc.checkIntentPolicy(otherAddress, "pay", "payments", nil)
	if status == 0 {
		t.Fatal("expected forbidden for non-PaymentHub contract")
	}

	status, _ = svc.checkIntentPolicy(paymentHubAddress, "withdraw", "payments", nil)
	if status == 0 {
		t.Fatal("expected forbidden for non-pay method")
	}

	params := []chain.ContractParam{
		{Type: "Hash160", Value: "SENDER"},
		{Type: "Hash160", Value: "0x" + paymentHubAddress},
	}
	status, _ = svc.checkIntentPolicy(gasAddress, "transfer", "payments", params)
	if status != 0 {
		t.Fatalf("expected ok for GAS transfer, got status %d", status)
	}

	params[1].Value = "0x" + otherAddress
	status, _ = svc.checkIntentPolicy(gasAddress, "transfer", "payments", params)
	if status == 0 {
		t.Fatal("expected forbidden for transfer to non-PaymentHub target")
	}
}

func TestCheckIntentPolicyGovernance(t *testing.T) {
	const governanceAddress = "cccccccccccccccccccccccccccccccccccccccc"
	const otherAddress = "dddddddddddddddddddddddddddddddddddddddd"

	svc := &Service{governanceAddress: governanceAddress}

	status, _ := svc.checkIntentPolicy("0x"+governanceAddress, "vote", "governance", nil)
	if status != 0 {
		t.Fatalf("expected ok, got status %d", status)
	}

	status, _ = svc.checkIntentPolicy(governanceAddress, "getProposal", "governance", nil)
	if status == 0 {
		t.Fatal("expected forbidden for non-state-changing method")
	}

	status, _ = svc.checkIntentPolicy(otherAddress, "vote", "governance", nil)
	if status == 0 {
		t.Fatal("expected forbidden for non-Governance contract")
	}
}

func TestCheckIntentPolicyUnknownIntent(t *testing.T) {
	svc := &Service{paymentHubAddress: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}

	status, _ := svc.checkIntentPolicy("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "pay", "unknown", nil)
	if status == 0 {
		t.Fatal("expected bad request for unknown intent")
	}
}
