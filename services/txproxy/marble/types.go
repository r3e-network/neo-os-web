package txproxy

import "github.com/R3E-Network/service_layer/infrastructure/chain"

type InvokeRequest struct {
	RequestID    string              `json:"request_id"`
	ContractHash string              `json:"contract_hash"`
	Method       string              `json:"method"`
	Params       []chain.ContractParam `json:"params,omitempty"`
	Wait         bool                `json:"wait,omitempty"`
}

type InvokeResponse struct {
	RequestID string `json:"request_id"`
	TxHash    string `json:"tx_hash,omitempty"`
	VMState   string `json:"vm_state,omitempty"`
	Exception string `json:"exception,omitempty"`
}

