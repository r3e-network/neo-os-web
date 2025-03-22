package random

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/willtech-services/service_layer/internal/blockchain"
	"github.com/willtech-services/service_layer/internal/config"
	"github.com/willtech-services/service_layer/internal/models"
	"github.com/willtech-services/service_layer/internal/tee"
	"github.com/willtech-services/service_layer/pkg/logger"
)

// Service handles random number generation operations
type Service struct {
	config           *config.Config
	logger           *logger.Logger
	randomRepository models.RandomRepository
	blockchainClient *blockchain.Client
	teeManager       *tee.Manager
	
	// For processing requests
	processingRequests sync.Map
	shutdownChan       chan struct{}
	wg                 sync.WaitGroup
}

// NewService creates a new random service
func NewService(
	cfg *config.Config,
	log *logger.Logger,
	randomRepository models.RandomRepository,
	blockchainClient *blockchain.Client,
	teeManager *tee.Manager,
) *Service {
	return &Service{
		config:           cfg,
		logger:           log,
		randomRepository: randomRepository,
		blockchainClient: blockchainClient,
		teeManager:       teeManager,
		shutdownChan:     make(chan struct{}),
	}
}

// Start starts the random service
func (s *Service) Start() error {
	s.logger.Info("Starting random number service")

	// Start workers
	s.wg.Add(1)
	go s.processPendingRequestsWorker()

	s.wg.Add(1)
	go s.processCommittedRequestsWorker()

	s.logger.Info("Random number service started")
	return nil
}

// Stop stops the random service
func (s *Service) Stop() {
	s.logger.Info("Stopping random number service")
	
	// Signal all workers to stop
	close(s.shutdownChan)
	
	// Wait for all workers to finish
	s.wg.Wait()
	
	s.logger.Info("Random number service stopped")
}

// CreateRequest creates a new random number request
func (s *Service) CreateRequest(
	ctx context.Context,
	userID int,
	callbackAddress string,
	callbackMethod string,
	seed []byte,
	numBytes int,
	delayBlocks int,
	gasFee float64,
) (*models.RandomRequest, error) {
	// Validate input
	if numBytes <= 0 {
		numBytes = 32 // Default to 32 bytes
	}
	
	if numBytes > 1024 {
		return nil, errors.New("number of bytes cannot exceed 1024")
	}
	
	if delayBlocks < 0 {
		delayBlocks = 0
	}
	
	// Get current block height
	blockHeight, err := s.blockchainClient.GetBlockHeight()
	if err != nil {
		s.logger.Warnf("Failed to get block height, using 0: %v", err)
		blockHeight = 0
	}
	
	// Create request
	request := &models.RandomRequest{
		UserID:          userID,
		Status:          models.RandomRequestStatusPending,
		CallbackAddress: callbackAddress,
		CallbackMethod:  callbackMethod,
		Seed:            seed,
		BlockHeight:     blockHeight,
		NumBytes:        numBytes,
		DelayBlocks:     delayBlocks,
		GasFee:          gasFee,
	}
	
	// Save to database
	request, err = s.randomRepository.CreateRequest(request)
	if err != nil {
		return nil, fmt.Errorf("failed to create random request: %w", err)
	}
	
	s.logger.Infof("Created random request %d", request.ID)
	
	return request, nil
}

// GetRequest gets a random number request by ID
func (s *Service) GetRequest(ctx context.Context, id int) (*models.RandomRequest, error) {
	return s.randomRepository.GetRequestByID(id)
}

// ListRequests lists random number requests for a user
func (s *Service) ListRequests(ctx context.Context, userID int, offset, limit int) ([]*models.RandomRequest, error) {
	return s.randomRepository.ListRequests(userID, offset, limit)
}

// GetRandomStatistics gets statistics for random number generation
func (s *Service) GetRandomStatistics(ctx context.Context) (map[string]interface{}, error) {
	return s.randomRepository.GetRandomStatistics()
}

// VerifyRandomNumber verifies a random number
func (s *Service) VerifyRandomNumber(ctx context.Context, requestID int, randomNumber, proof []byte) (bool, error) {
	// Get request
	request, err := s.randomRepository.GetRequestByID(requestID)
	if err != nil {
		return false, fmt.Errorf("failed to get random request: %w", err)
	}
	
	if request == nil {
		return false, errors.New("random request not found")
	}
	
	// Verify commitment
	if request.CommitmentHash == "" {
		return false, errors.New("no commitment hash found")
	}
	
	// Calculate commitment hash from random number and proof
	calculatedHash := s.calculateCommitmentHash(randomNumber, proof)
	
	// Compare commitment hashes
	return calculatedHash == request.CommitmentHash, nil
}

// processPendingRequestsWorker processes pending random number requests
func (s *Service) processPendingRequestsWorker() {
	defer s.wg.Done()
	
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-s.shutdownChan:
			return
		case <-ticker.C:
			s.processPendingRequests()
		}
	}
}

// processCommittedRequestsWorker processes committed random number requests
func (s *Service) processCommittedRequestsWorker() {
	defer s.wg.Done()
	
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-s.shutdownChan:
			return
		case <-ticker.C:
			s.processCommittedRequests()
		}
	}
}

// processPendingRequests processes pending random number requests
func (s *Service) processPendingRequests() {
	// Get pending requests
	requests, err := s.randomRepository.ListPendingRequests()
	if err != nil {
		s.logger.Errorf("Failed to list pending requests: %v", err)
		return
	}
	
	if len(requests) == 0 {
		return
	}
	
	s.logger.Infof("Processing %d pending random number requests", len(requests))
	
	for _, request := range requests {
		// Skip if already processing
		if _, ok := s.processingRequests.Load(request.ID); ok {
			continue
		}
		
		// Mark as processing
		s.processingRequests.Store(request.ID, true)
		
		// Process in a goroutine
		go func(req *models.RandomRequest) {
			defer s.processingRequests.Delete(req.ID)
			
			err := s.generateCommitment(req)
			if err != nil {
				s.logger.Errorf("Failed to generate commitment for request %d: %v", req.ID, err)
				
				// Update request with error
				req.Status = models.RandomRequestStatusFailed
				req.Error = err.Error()
				
				_, updateErr := s.randomRepository.UpdateRequest(req)
				if updateErr != nil {
					s.logger.Errorf("Failed to update request %d: %v", req.ID, updateErr)
				}
			}
		}(request)
	}
}

// processCommittedRequests processes committed random number requests
func (s *Service) processCommittedRequests() {
	// Get committed requests
	requests, err := s.randomRepository.ListCommittedRequests()
	if err != nil {
		s.logger.Errorf("Failed to list committed requests: %v", err)
		return
	}
	
	if len(requests) == 0 {
		return
	}
	
	s.logger.Infof("Processing %d committed random number requests", len(requests))
	
	// Get current block height
	currentBlockHeight, err := s.blockchainClient.GetBlockHeight()
	if err != nil {
		s.logger.Errorf("Failed to get current block height: %v", err)
		return
	}
	
	for _, request := range requests {
		// Skip if already processing
		if _, ok := s.processingRequests.Load(request.ID); ok {
			continue
		}
		
		// Check if it's time to reveal
		if request.BlockHeight+int64(request.DelayBlocks) > currentBlockHeight {
			continue
		}
		
		// Mark as processing
		s.processingRequests.Store(request.ID, true)
		
		// Process in a goroutine
		go func(req *models.RandomRequest) {
			defer s.processingRequests.Delete(req.ID)
			
			err := s.revealRandomNumber(req)
			if err != nil {
				s.logger.Errorf("Failed to reveal random number for request %d: %v", req.ID, err)
				
				// Update request with error
				req.Status = models.RandomRequestStatusFailed
				req.Error = err.Error()
				
				_, updateErr := s.randomRepository.UpdateRequest(req)
				if updateErr != nil {
					s.logger.Errorf("Failed to update request %d: %v", req.ID, updateErr)
				}
			}
		}(request)
	}
}

// generateCommitment generates a commitment for a random number request
func (s *Service) generateCommitment(request *models.RandomRequest) error {
	// Generate a secure random value to use as proof
	proof := make([]byte, 32)
	_, err := rand.Read(proof)
	if err != nil {
		return fmt.Errorf("failed to generate random proof: %w", err)
	}
	
	// Store proof in the request
	request.Proof = proof
	
	// Generate commitment hash
	commitmentHash := s.calculateCommitmentHash([]byte{}, proof)
	request.CommitmentHash = commitmentHash
	
	// Update status
	request.Status = models.RandomRequestStatusCommitted
	
	// Update request
	_, err = s.randomRepository.UpdateRequest(request)
	if err != nil {
		return fmt.Errorf("failed to update request: %w", err)
	}
	
	// TODO: Publish commitment to blockchain if required
	// For now, we'll log it
	s.logger.Infof("Generated commitment %s for request %d", commitmentHash, request.ID)
	
	return nil
}

// revealRandomNumber reveals a random number for a request
func (s *Service) revealRandomNumber(request *models.RandomRequest) error {
	// Generate the random number
	randomNumber, err := s.generateRandomNumber(request)
	if err != nil {
		return fmt.Errorf("failed to generate random number: %w", err)
	}
	
	// Store random number
	request.RandomNumber = randomNumber
	
	// Mark as revealed
	request.Status = models.RandomRequestStatusRevealed
	request.RevealedAt = time.Now().UTC()
	
	// Update request
	_, err = s.randomRepository.UpdateRequest(request)
	if err != nil {
		return fmt.Errorf("failed to update request: %w", err)
	}
	
	// TODO: Publish reveal to blockchain if required
	// For now, we'll log it
	s.logger.Infof("Revealed random number for request %d", request.ID)
	
	// Send callback if address is specified
	if request.CallbackAddress != "" && request.CallbackMethod != "" {
		err = s.sendCallback(request)
		if err != nil {
			s.logger.Errorf("Failed to send callback for request %d: %v", request.ID, err)
		}
	}
	
	return nil
}

// generateRandomNumber generates a random number for a request
func (s *Service) generateRandomNumber(request *models.RandomRequest) ([]byte, error) {
	// We should use the TEE for secure random number generation
	// For now, we'll use a combination of sources
	
	// Collect entropy from various sources
	entropy := make([]byte, 0, 128)
	
	// 1. Use the request ID, block height, and timestamp
	idBytes := []byte(fmt.Sprintf("%d", request.ID))
	blockHeightBytes := []byte(fmt.Sprintf("%d", request.BlockHeight))
	timestampBytes := []byte(fmt.Sprintf("%d", time.Now().UnixNano()))
	
	entropy = append(entropy, idBytes...)
	entropy = append(entropy, blockHeightBytes...)
	entropy = append(entropy, timestampBytes...)
	
	// 2. Use the seed if provided
	if request.Seed != nil && len(request.Seed) > 0 {
		entropy = append(entropy, request.Seed...)
	}
	
	// 3. Use the proof
	entropy = append(entropy, request.Proof...)
	
	// 4. Use system entropy
	sysEntropy := make([]byte, 32)
	_, err := rand.Read(sysEntropy)
	if err != nil {
		return nil, fmt.Errorf("failed to read system entropy: %w", err)
	}
	entropy = append(entropy, sysEntropy...)
	
	// Create HMAC using collected entropy
	h := hmac.New(sha256.New, entropy)
	h.Write(request.Proof)
	
	// Generate random bytes
	randomBytes := h.Sum(nil)
	
	// If more bytes are needed, generate them
	if request.NumBytes > len(randomBytes) {
		// Create a deterministic PRNG from the initial random bytes
		additionalBytes := make([]byte, request.NumBytes-len(randomBytes))
		for i := 0; i < len(additionalBytes); i += sha256.Size {
			h := sha256.New()
			h.Write(randomBytes)
			h.Write([]byte{byte(i)})
			copy(additionalBytes[i:min(i+sha256.Size, len(additionalBytes))], h.Sum(nil))
		}
		randomBytes = append(randomBytes, additionalBytes...)
	}
	
	// Trim if too long
	if len(randomBytes) > request.NumBytes {
		randomBytes = randomBytes[:request.NumBytes]
	}
	
	return randomBytes, nil
}

// sendCallback sends a callback to a contract
func (s *Service) sendCallback(request *models.RandomRequest) error {
	// TODO: Implement actual blockchain callback
	// For now, we'll mark the request as callback sent
	
	request.Status = models.RandomRequestStatusCallbackSent
	
	_, err := s.randomRepository.UpdateRequest(request)
	if err != nil {
		return fmt.Errorf("failed to update request: %w", err)
	}
	
	s.logger.Infof("Callback sent for request %d to %s", request.ID, request.CallbackAddress)
	
	return nil
}

// calculateCommitmentHash calculates the commitment hash for a random number and proof
func (s *Service) calculateCommitmentHash(randomNumber, proof []byte) string {
	h := sha256.New()
	h.Write(randomNumber)
	h.Write(proof)
	return hex.EncodeToString(h.Sum(nil))
}

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
} 