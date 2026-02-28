package neoprivacy

import (
	"encoding/hex"
	"encoding/json"
	"math/big"
	"net/http"
	"strings"

	"github.com/gorilla/mux"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/chain"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
	txproxytypes "github.com/r3e-network/neo-miniapp-platform/infrastructure/txproxy/types"
)

type RelayRequest struct {
	Proof         string `json:"proof"`
	NullifierHash string `json:"nullifierHash"`
	Root          string `json:"root"`
	Recipient     string `json:"recipient"`
	RelayerFee    string `json:"relayerFee"`
	Asset         string `json:"asset"`
	Amount        string `json:"amount"`
}

type MerklePathResponse struct {
	PathElements []string `json:"pathElements"`
	PathIndices  []int    `json:"pathIndices"`
	Root         string   `json:"root"`
}

func (s *Service) handleMerklePath(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	commitment := vars["commitment"]

	if commitment == "" {
		httputil.BadRequest(w, "commitment parameter is required")
		return
	}

	// Stub: In a fully fleshed out database model, we would query the Poseidon tree.
	// For now, return mock path data to allow the MiniApp to construct proofs.
	resp := MerklePathResponse{
		PathElements: []string{"0x2a3b...", "0x4f5c..."}, // Expected to be 20 levels deep for 1M leaves
		PathIndices:  []int{0, 1},
		Root:         "0xabcdef1234567890abcdef1234567890abcdef12",
	}

	httputil.WriteJSON(w, http.StatusOK, resp)
}

func (s *Service) handleRelay(w http.ResponseWriter, r *http.Request) {
	var req RelayRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	if req.Proof == "" || req.NullifierHash == "" || req.Recipient == "" {
		httputil.BadRequest(w, "proof, nullifierHash, and recipient are required")
		return
	}

	if s.txProxyInvoker == nil || s.contractHash == "" {
		httputil.WriteErrorResponse(w, r, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "txproxy or contract hash not configured for relay", nil)
		return
	}

	// Build parameters for the zNEP17 'Withdraw' method:
	// Withdraw(byte[] proof, byte[] nullifierHash, byte[] root, UInt160 recipient, BigInteger relayerFee, UInt160 asset, BigInteger amount)

	proofBytes, err := hex.DecodeString(strings.TrimPrefix(req.Proof, "0x"))
	if err != nil {
		httputil.BadRequest(w, "invalid hex format for proof")
		return
	}

	nullifierBytes, err := hex.DecodeString(strings.TrimPrefix(req.NullifierHash, "0x"))
	if err != nil {
		httputil.BadRequest(w, "invalid hex format for nullifierHash")
		return
	}

	rootBytes, err := hex.DecodeString(strings.TrimPrefix(req.Root, "0x"))
	if err != nil {
		httputil.BadRequest(w, "invalid hex format for root")
		return
	}

	relayerFee, ok := new(big.Int).SetString(req.RelayerFee, 10)
	if !ok {
		httputil.BadRequest(w, "invalid format for relayerFee")
		return
	}

	amount, ok := new(big.Int).SetString(req.Amount, 10)
	if !ok {
		httputil.BadRequest(w, "invalid format for amount")
		return
	}

	params := []chain.ContractParam{
		chain.NewByteArrayParam(proofBytes),
		chain.NewByteArrayParam(nullifierBytes),
		chain.NewByteArrayParam(rootBytes),
		chain.NewHash160Param(req.Recipient),
		chain.NewIntegerParam(relayerFee),
		chain.NewHash160Param(req.Asset),
		chain.NewIntegerParam(amount),
	}

	txReq := &txproxytypes.InvokeRequest{
		RequestID:    "relay-" + strings.TrimPrefix(req.NullifierHash, "0x"),
		ContractHash: s.contractHash,
		Method:       "Withdraw",
		Params:       params,
		Wait:         true,
	}

	// Forward the invocation to TxProxy to execute gasless transaction using the GlobalSigner
	resp, err := s.txProxyInvoker.Invoke(r.Context(), txReq)
	if err != nil {
		s.Logger().WithError(err).Error("failed to forward relay transaction to txproxy")
		httputil.WriteErrorResponse(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to execute relay transaction", nil)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"status": "success",
		"txHash": resp.TxHash,
	})
}
