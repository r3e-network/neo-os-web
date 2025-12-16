package neorand

import (
	"context"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/R3E-Network/service_layer/infrastructure/crypto"
	"github.com/nspcc-dev/neo-go/pkg/vm/stackitem"
)

// =============================================================================
// Request Fulfiller - Generates randomness and calls back to user contracts
// =============================================================================

// runRequestFulfiller processes pending VRF requests.
func (s *Service) runRequestFulfiller(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-s.StopChan():
			return
		case request := <-s.pendingRequests:
			s.fulfillRequest(ctx, request)
		}
	}
}

func parseOnChainRequestID(value string) (*big.Int, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, false
	}

	trimmed := value
	lower := strings.ToLower(trimmed)
	if strings.HasPrefix(lower, "0x") {
		trimmed = trimmed[2:]
	}

	requestID := new(big.Int)
	if _, ok := requestID.SetString(trimmed, 10); ok && requestID.Sign() > 0 {
		return requestID, true
	}
	if _, ok := requestID.SetString(trimmed, 16); ok && requestID.Sign() > 0 {
		return requestID, true
	}
	return nil, false
}

// fulfillRequest generates randomness and submits callback to user contract.
func (s *Service) fulfillRequest(ctx context.Context, request *Request) {
	requestIDBig, isOnChain := parseOnChainRequestID(request.RequestID)

	// Generate VRF proof
	seedBytes, err := hex.DecodeString(request.Seed)
	if err != nil {
		seedBytes = []byte(request.Seed)
	}

	vrfProof, err := crypto.GenerateVRF(s.privateKey, seedBytes)
	if err != nil {
		errMsg := fmt.Sprintf("generate VRF: %v", err)

		// On-chain requests should be marked failed on-chain as well.
		if isOnChain && s.teeFulfiller != nil {
			if _, failErr := s.teeFulfiller.FailRequest(ctx, requestIDBig, errMsg); failErr != nil {
				s.Logger().WithContext(ctx).WithError(failErr).WithField("request_id", request.RequestID).Warn("failed to mark request failed on-chain")
			}
		}

		s.markRequestFailed(ctx, request, errMsg)
		return
	}

	// Generate random words
	randomWords := make([]string, request.NumWords)
	randomWordBytes := make([][]byte, request.NumWords)
	for i := 0; i < request.NumWords; i++ {
		wordInput := make([]byte, 0, len(vrfProof.Output)+1)
		wordInput = append(wordInput, vrfProof.Output...)
		wordInput = append(wordInput, byte(i))
		wordHash := crypto.Hash256(wordInput)
		randomWords[i] = hex.EncodeToString(wordHash)
		randomWordBytes[i] = wordHash
	}

	// Encode random words as bytes for on-chain storage and proof verification.
	// Format: [numWords][word1(32)][word2(32)]...
	encodedRandomWords := make([]byte, 0, 1+len(randomWordBytes)*32)
	encodedRandomWords = append(encodedRandomWords, byte(len(randomWordBytes)))
	for _, word := range randomWordBytes {
		if len(word) != 32 {
			s.markRequestFailed(ctx, request, "invalid random word length")
			return
		}
		encodedRandomWords = append(encodedRandomWords, word...)
	}

	// Proof is an ECDSA signature over (seed || randomWords) to match
	// `NeoRandService.VerifyProof(seed, randomWords, proof)` on-chain.
	proof, err := crypto.Sign(s.privateKey, append(seedBytes, encodedRandomWords...))
	if err != nil {
		s.markRequestFailed(ctx, request, fmt.Sprintf("sign proof: %v", err))
		return
	}

	// Submit callback to user contract (on-chain requests only).
	if isOnChain {
		if s.teeFulfiller == nil {
			s.markRequestFailed(ctx, request, "chain callback not configured")
			return
		}

		// The VRF service contract expects `result` to be StdLib.Serialize(VRFResultPayload),
		// which is encoded as a VM struct: [RandomWords, Proof].
		resultItem := stackitem.NewStruct([]stackitem.Item{
			stackitem.NewByteArray(encodedRandomWords),
			stackitem.NewByteArray(proof),
		})
		resultBytes, err := stackitem.Serialize(resultItem)
		if err != nil {
			s.markRequestFailed(ctx, request, fmt.Sprintf("serialize result: %v", err))
			return
		}

		// Submit to chain
		txHash, err := s.teeFulfiller.FulfillRequest(ctx, requestIDBig, resultBytes)
		if err != nil {
			errMsg := fmt.Sprintf("chain callback failed: %v", err)

			// Best-effort mark failed on-chain too.
			if _, failErr := s.teeFulfiller.FailRequest(ctx, requestIDBig, errMsg); failErr != nil {
				s.Logger().WithContext(ctx).WithError(failErr).WithField("request_id", request.RequestID).Warn("failed to mark request failed on-chain")
			}

			s.markRequestFailed(ctx, request, errMsg)
			return
		}

		// Log successful submission
		s.Logger().WithContext(ctx).WithFields(map[string]any{
			"request_id": request.RequestID,
			"tx_hash":    txHash,
		}).Info("request fulfilled on-chain")

		s.mu.Lock()
		request.Proof = hex.EncodeToString(proof)
		request.FulfillTxHash = txHash
		s.mu.Unlock()
	}

	// Update request status after successful chain submission
	s.mu.Lock()
	request.Status = StatusFulfilled
	request.RandomWords = randomWords
	request.Proof = hex.EncodeToString(proof)
	request.FulfilledAt = time.Now()
	s.mu.Unlock()

	if s.repo != nil {
		updateCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		if err := s.repo.Update(updateCtx, neorandRecordFromReq(request)); err != nil {
			s.Logger().WithContext(ctx).WithError(err).WithField("request_id", request.RequestID).Warn("failed to persist fulfilled request")
		}
	}
}

// markRequestFailed marks a request as failed.
func (s *Service) markRequestFailed(ctx context.Context, request *Request, errMsg string) {
	if ctx == nil {
		ctx = context.Background()
	}

	s.mu.Lock()
	request.Status = StatusFailed
	request.Error = errMsg
	s.mu.Unlock()

	if s.repo == nil {
		return
	}

	updateCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	if err := s.repo.Update(updateCtx, neorandRecordFromReq(request)); err != nil {
		s.Logger().WithContext(ctx).WithError(err).WithFields(map[string]any{
			"request_id": request.RequestID,
			"status":     StatusFailed,
		}).Warn("failed to persist failed request")
	}
}
