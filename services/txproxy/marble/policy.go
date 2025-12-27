package txproxy

import (
	"net/http"
	"strings"

	"github.com/R3E-Network/service_layer/infrastructure/chain"
)

const (
	intentPayments   = "payments"
	intentGovernance = "governance"
)

func (s *Service) checkIntentPolicy(contractHash, method, intent string, params []chain.ContractParam) (status int, message string) {
	intent = strings.ToLower(strings.TrimSpace(intent))
	if intent == "" {
		return 0, ""
	}

	contractHash = normalizeContractHash(contractHash)
	methodLower := strings.ToLower(strings.TrimSpace(method))

	switch intent {
	case intentPayments, "payment":
		if s == nil || s.paymentHubHash == "" {
			return http.StatusServiceUnavailable, "payments intent requires PaymentHub hash configured"
		}
		if contractHash == s.paymentHubHash && methodLower == "pay" {
			return 0, ""
		}
		if s.gasHash == "" {
			return http.StatusServiceUnavailable, "payments intent requires GAS hash configured"
		}
		if contractHash != s.gasHash || methodLower != "transfer" {
			return http.StatusForbidden, "payments intent only allows GAS transfer to PaymentHub"
		}
		if !transferTargetsPaymentHub(params, s.paymentHubHash) {
			return http.StatusForbidden, "payments intent requires transfer to PaymentHub"
		}
		return 0, ""
	case intentGovernance:
		if s == nil || s.governanceHash == "" {
			return http.StatusServiceUnavailable, "governance intent requires Governance hash configured"
		}
		if contractHash != s.governanceHash {
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

func transferTargetsPaymentHub(params []chain.ContractParam, paymentHubHash string) bool {
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
	return normalizeContractHash(value) == paymentHubHash
}
