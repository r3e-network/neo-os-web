package neorand

import (
	"context"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/R3E-Network/service_layer/infrastructure/crypto"
)

// =============================================================================
// Core Logic
// =============================================================================

// GenerateRandomness generates verifiable random numbers.
func (s *Service) GenerateRandomness(ctx context.Context, seed string, numWords int) (*DirectRandomResponse, error) {
	if numWords <= 0 {
		numWords = 1
	}
	if numWords > MaxNumWords {
		numWords = MaxNumWords
	}

	seedBytes, err := hex.DecodeString(seed)
	if err != nil {
		seedBytes = []byte(seed)
	}

	// Use a deterministic VRF output as the entropy source, then bind it to the seed
	// with an ECDSA signature proof (compatible with on-chain verification).
	vrfProof, err := crypto.GenerateVRF(s.privateKey, seedBytes)
	if err != nil {
		return nil, fmt.Errorf("generate VRF: %w", err)
	}

	// Generate multiple random words from the VRF output
	randomWords := make([]string, numWords)
	randomWordBytes := make([][]byte, numWords)
	for i := 0; i < numWords; i++ {
		wordInput := make([]byte, 0, len(vrfProof.Output)+1)
		wordInput = append(wordInput, vrfProof.Output...)
		wordInput = append(wordInput, byte(i))
		wordHash := crypto.Hash256(wordInput)
		randomWords[i] = hex.EncodeToString(wordHash)
		randomWordBytes[i] = wordHash
	}

	encodedRandomWords := make([]byte, 0, 1+len(randomWordBytes)*32)
	encodedRandomWords = append(encodedRandomWords, byte(len(randomWordBytes)))
	for _, word := range randomWordBytes {
		encodedRandomWords = append(encodedRandomWords, word...)
	}

	proof, err := crypto.Sign(s.privateKey, append(seedBytes, encodedRandomWords...))
	if err != nil {
		return nil, fmt.Errorf("sign proof: %w", err)
	}

	return &DirectRandomResponse{
		RequestID:   uuid.New().String(),
		Seed:        seed,
		RandomWords: randomWords,
		Proof:       hex.EncodeToString(proof),
		PublicKey:   hex.EncodeToString(crypto.PublicKeyToBytes(&s.privateKey.PublicKey)),
		Timestamp:   time.Now().Format(time.RFC3339),
	}, nil
}

// VerifyRandomness verifies a VRF proof.
func (s *Service) VerifyRandomness(req *VerifyRequest) (bool, error) {
	seedBytes, err := decodeMaybeHex(req.Seed)
	if err != nil {
		return false, err
	}

	proofBytes, err := hex.DecodeString(trimHexPrefix(req.Proof))
	if err != nil {
		return false, fmt.Errorf("invalid proof hex: %w", err)
	}

	pubKeyBytes, err := hex.DecodeString(trimHexPrefix(req.PublicKey))
	if err != nil {
		return false, fmt.Errorf("invalid public key hex: %w", err)
	}

	publicKey, err := crypto.PublicKeyFromBytes(pubKeyBytes)
	if err != nil {
		return false, fmt.Errorf("invalid public key: %w", err)
	}

	if len(req.RandomWords) == 0 {
		return false, fmt.Errorf("random_words required")
	}
	if len(req.RandomWords) > MaxNumWords {
		return false, fmt.Errorf("random_words exceeds max %d", MaxNumWords)
	}

	encodedRandomWords := make([]byte, 0, 1+len(req.RandomWords)*32)
	encodedRandomWords = append(encodedRandomWords, byte(len(req.RandomWords)))
	for _, wordHex := range req.RandomWords {
		wordBytes, err := hex.DecodeString(trimHexPrefix(wordHex))
		if err != nil {
			return false, fmt.Errorf("invalid random_words hex: %w", err)
		}
		if len(wordBytes) != 32 {
			return false, fmt.Errorf("invalid random word length: %d", len(wordBytes))
		}
		encodedRandomWords = append(encodedRandomWords, wordBytes...)
	}

	message := append(seedBytes, encodedRandomWords...)
	return crypto.Verify(publicKey, message, proofBytes), nil
}

func trimHexPrefix(value string) string {
	trimmed := strings.TrimSpace(value)
	if len(trimmed) >= 2 && strings.EqualFold(trimmed[:2], "0x") {
		return trimmed[2:]
	}
	return trimmed
}

func decodeMaybeHex(value string) ([]byte, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil, fmt.Errorf("seed required")
	}
	if decoded, err := hex.DecodeString(trimHexPrefix(trimmed)); err == nil && len(decoded) > 0 {
		return decoded, nil
	}
	return []byte(trimmed), nil
}
