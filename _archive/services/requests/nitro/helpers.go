package neorequests

import (
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"strconv"
	"strings"
	"time"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/chain"
	neorequestsupabase "github.com/r3e-network/neo-miniapp-platform/services/requests/supabase"
)

type serviceResult struct {
	ResultBytes []byte
	AuditJSON   json.RawMessage
}

type manifestInfo struct {
	CallbackContract string
	CallbackMethod   string
	Permissions      map[string]interface{}
	NewsIntegration  *bool
}

func buildFulfillParams(requestID string, success bool, result []byte, errorMsg string) ([]chain.ContractParam, *big.Int, error) {
	requestInt := new(big.Int)
	if _, ok := requestInt.SetString(strings.TrimSpace(requestID), 10); !ok {
		return nil, nil, fmt.Errorf("invalid request_id")
	}

	if result == nil {
		result = []byte{}
	}

	params := []chain.ContractParam{
		chain.NewIntegerParam(requestInt),
		chain.NewBoolParam(success),
		chain.NewByteArrayParam(result),
		chain.NewStringParam(errorMsg),
	}

	return params, requestInt, nil
}

func buildServiceRequestedState(event *chain.ServiceRequestedEvent) json.RawMessage {
	if event == nil {
		return nil
	}
	state := map[string]interface{}{
		"request_id":        event.RequestID,
		"app_id":            event.AppID,
		"service_type":      event.ServiceType,
		"requester":         event.Requester,
		"callback_contract": event.CallbackContract,
		"callback_method":   event.CallbackMethod,
		"payload":           decodePayload(event.Payload),
	}
	return neorequestsupabase.MarshalParams(state)
}

func buildServiceFulfilledState(event *chain.ServiceFulfilledEvent) json.RawMessage {
	if event == nil {
		return nil
	}
	state := map[string]interface{}{
		"request_id": event.RequestID,
		"success":    event.Success,
		"result":     decodeResult(event.Result),
		"error":      event.Error,
	}
	return neorequestsupabase.MarshalParams(state)
}

func buildNotificationState(event *chain.MiniAppNotificationEvent) json.RawMessage {
	if event == nil {
		return nil
	}
	state := map[string]interface{}{
		"app_id":            event.AppID,
		"title":             event.Title,
		"content":           event.Content,
		"notification_type": event.NotificationType,
		"priority":          event.Priority,
	}
	return neorequestsupabase.MarshalParams(state)
}

func buildMetricState(event *chain.MiniAppMetricEvent) json.RawMessage {
	if event == nil {
		return nil
	}
	value := ""
	if event.Value != nil {
		value = event.Value.String()
	}
	state := map[string]interface{}{
		"app_id":      event.AppID,
		"metric_name": event.MetricName,
		"value":       value,
	}
	return neorequestsupabase.MarshalParams(state)
}

func decodePayload(payload []byte) interface{} {
	if len(payload) == 0 {
		return nil
	}
	var parsed interface{}
	if err := json.Unmarshal(payload, &parsed); err == nil {
		return parsed
	}
	return map[string]string{"base64": base64.StdEncoding.EncodeToString(payload)}
}

func decodeResult(result []byte) interface{} {
	if len(result) == 0 {
		return nil
	}
	var parsed interface{}
	if err := json.Unmarshal(result, &parsed); err == nil {
		return parsed
	}
	return map[string]string{"hex": hex.EncodeToString(result)}
}

func serviceTypePermission(serviceType string) string {
	switch serviceType {
	case "rng":
		return "rng"
	case "oracle":
		return "oracle"
	case "compute":
		return "compute"
	default:
		return serviceType
	}
}

func normalizeServiceType(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "rng", "neovrf", "vrf":
		return "rng"
	case "oracle", "neooracle":
		return "oracle"
	case "compute", "neocompute", "confcompute":
		return "compute"
	default:
		return strings.ToLower(strings.TrimSpace(raw))
	}
}

func parseManifestInfo(raw json.RawMessage) (manifestInfo, error) {
	out := manifestInfo{Permissions: map[string]interface{}{}}
	if len(raw) == 0 {
		return out, nil
	}

	var m map[string]interface{}
	if err := json.Unmarshal(raw, &m); err != nil {
		return out, err
	}

	if val, ok := m["callback_contract"]; ok {
		contract := strings.TrimSpace(fmt.Sprintf("%v", val))
		if contract != "" {
			normalized := normalizeContractHash(contract)
			if normalized == "" {
				return out, fmt.Errorf("invalid callback_contract")
			}
			out.CallbackContract = "0x" + normalized
		}
	}
	if val, ok := m["callback_method"]; ok {
		out.CallbackMethod = strings.TrimSpace(fmt.Sprintf("%v", val))
	}

	if perms, ok := m["permissions"]; ok {
		switch v := perms.(type) {
		case map[string]interface{}:
			out.Permissions = v
		case []interface{}:
			for _, entry := range v {
				key := strings.ToLower(strings.TrimSpace(fmt.Sprintf("%v", entry)))
				if key != "" {
					out.Permissions[key] = true
				}
			}
		}
	}

	if val, ok := m["news_integration"]; ok {
		if enabled, ok := val.(bool); ok {
			out.NewsIntegration = &enabled
		}
	}

	return out, nil
}

func manifestContractHash(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}

	var m map[string]interface{}
	if err := json.Unmarshal(raw, &m); err != nil {
		return ""
	}

	if val, ok := m["contract_hash"]; ok {
		contract := strings.TrimSpace(fmt.Sprintf("%v", val))
		if contract == "" {
			return ""
		}
		return normalizeContractHash(contract)
	}

	return ""
}

func appContractHash(app *neorequestsupabase.MiniApp) string {
	if app == nil {
		return ""
	}
	if normalized := normalizeContractHash(app.ContractHash); normalized != "" {
		return normalized
	}
	return manifestContractHash(app.Manifest)
}

func permissionEnabled(perms map[string]interface{}, key string) bool {
	if len(perms) == 0 || key == "" {
		return false
	}
	value, ok := perms[key]
	if !ok {
		return false
	}
	switch v := value.(type) {
	case bool:
		return v
	case []interface{}:
		return len(v) > 0
	default:
		return false
	}
}

func callbackMatches(info manifestInfo, contract, method string) bool {
	if info.CallbackContract == "" && info.CallbackMethod == "" {
		return true
	}
	if info.CallbackMethod != "" && info.CallbackMethod != strings.TrimSpace(method) {
		return false
	}
	if info.CallbackContract != "" {
		if normalizeContractHash(info.CallbackContract) != normalizeContractHash(contract) {
			return false
		}
	}
	return true
}

func isAppActive(status string) bool {
	return strings.EqualFold(strings.TrimSpace(status), "active")
}

func sanitizeError(msg string, limit int) string {
	msg = strings.ReplaceAll(msg, "\n", " ")
	msg = strings.TrimSpace(msg)
	if limit <= 0 || len(msg) <= limit {
		return msg
	}
	return msg[:limit]
}

func truncateString(value string, limit int) string {
	if limit <= 0 || len(value) <= limit {
		return value
	}
	return value[:limit]
}

func ptrTime(t time.Time) *time.Time {
	return &t
}

func ptrBool(v bool) *bool {
	return &v
}

func parseRequestID(raw string) *int64 {
	id := strings.TrimSpace(raw)
	if id == "" {
		return nil
	}
	parsed, err := strconv.ParseInt(id, 10, 64)
	if err != nil {
		return nil
	}
	return &parsed
}
