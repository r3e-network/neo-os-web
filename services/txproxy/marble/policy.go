package txproxy

import (
	"net/http"
	"strings"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/chain"
)

const (
	intentPayments   = "payments"
	intentGovernance = "governance"
)

func (s *Service) checkIntentPolicy(contractAddress, method, intent string, params []chain.ContractParam) (status int, message string) {
	intent = strings.ToLower(strings.TrimSpace(intent))
	if intent == "" {
		return 0, ""
	}

	contractAddress = normalizeContractAddress(contractAddress)
	methodLower := strings.ToLower(strings.TrimSpace(method))

	switch intent {
	case intentPayments, "payment":
		if s == nil || s.paymentHubAddress == "" {
			return http.StatusServiceUnavailable, "payments intent requires PaymentHub address configured"
		}
		if contractAddress == s.paymentHubAddress && methodLower == "pay" {
			return 0, ""
		}
		if s.gasAddress == "" {
			return http.StatusServiceUnavailable, "payments intent requires GAS address configured"
		}
		if contractAddress != s.gasAddress || methodLower != "transfer" {
			return http.StatusForbidden, "payments intent only allows GAS transfer to PaymentHub"
		}
		if !transferTargetsPaymentHub(params, s.paymentHubAddress) {
			return http.StatusForbidden, "payments intent requires transfer to PaymentHub"
		}
		return 0, ""
	case intentGovernance:
		if s == nil || s.governanceAddress == "" {
			return http.StatusServiceUnavailable, "governance intent requires Governance address configured"
		}
		if contractAddress != s.governanceAddress {
			return http.StatusForbidden, "governance intent requires Governance contract"
		}
		switch methodLower {
		case "stake", "unstake", "vote":
			return 0, ""
		default:
			return http.StatusForbidden, "governance intent only allows stake/unstake/vote"
		}
	default:
		return http.StatusBadRequest, "unknown intent"
	}
}

func transferTargetsPaymentHub(params []chain.ContractParam, paymentHubAddress string) bool {
	if len(params) < 2 {
		return false
	}
	paramType := strings.ToLower(strings.TrimSpace(params[1].Type))
	if paramType != "hash160" {
		return false
	}
	value, ok := params[1].Value.(string)
	if !ok {
		return false
	}
	return normalizeContractAddress(value) == paymentHubAddress
}
