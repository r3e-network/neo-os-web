package txproxy

import (
	"net/http"
	"strings"
)

const (
	intentPayments   = "payments"
	intentGovernance = "governance"
)

func (s *Service) checkIntentPolicy(contractHash, method, intent string) (status int, message string) {
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
		if contractHash != s.paymentHubHash {
			return http.StatusForbidden, "payments intent requires PaymentHub contract"
		}
		if methodLower != "pay" {
			return http.StatusForbidden, "payments intent only allows Pay"
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
			return http.StatusForbidden, "governance intent only allows Stake/Unstake/Vote"
		}
	default:
		return http.StatusBadRequest, "unknown intent"
	}
}
