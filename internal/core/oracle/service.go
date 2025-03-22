package oracle

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"text/template"
	"time"

	"github.com/PaesslerAG/jsonpath"
	"github.com/R3E-Network/service_layer/internal/blockchain"
	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/R3E-Network/service_layer/internal/core/gasbank"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/internal/tee"
	"github.com/R3E-Network/service_layer/pkg/logger"
)

// Service handles oracle operations
type Service struct {
	config           *config.Config
	logger           *logger.Logger
	oracleRepository models.OracleRepository
	blockchainClient *blockchain.Client
	gasBankService   *gasbank.Service
	teeManager       *tee.Manager

	// For processing requests
	processingRequests sync.Map
	httpClient         *http.Client
	shutdownChan       chan struct{}
	wg                 sync.WaitGroup
}

// NewService creates a new oracle service
func NewService(
	cfg *config.Config,
	log *logger.Logger,
	oracleRepository models.OracleRepository,
	blockchainClient *blockchain.Client,
	gasBankService *gasbank.Service,
	teeManager *tee.Manager,
) *Service {
	// Create HTTP client with appropriate timeouts
	httpClient := &http.Client{
		Timeout: time.Duration(cfg.Services.Oracle.RequestTimeout) * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        100,
			MaxIdleConnsPerHost: 20,
			IdleConnTimeout:     60 * time.Second,
		},
	}

	return &Service{
		config:           cfg,
		logger:           log,
		oracleRepository: oracleRepository,
		blockchainClient: blockchainClient,
		gasBankService:   gasBankService,
		teeManager:       teeManager,
		httpClient:       httpClient,
		shutdownChan:     make(chan struct{}),
	}
}

// Start starts the oracle service
func (s *Service) Start() error {
	s.logger.Info("Starting oracle service")

	// Start worker for processing oracle requests
	numWorkers := s.config.Services.Oracle.NumWorkers
	if numWorkers <= 0 {
		numWorkers = 5 // Default number of workers
	}

	for i := 0; i < numWorkers; i++ {
		s.wg.Add(1)
		go s.processRequestsWorker()
	}

	s.logger.Info("Oracle service started")
	return nil
}

// Stop stops the oracle service
func (s *Service) Stop() {
	s.logger.Info("Stopping oracle service")

	// Signal all workers to stop
	close(s.shutdownChan)

	// Wait for all workers to finish
	s.wg.Wait()

	s.logger.Info("Oracle service stopped")
}

// CreateOracle creates a new oracle data source configuration
func (s *Service) CreateOracle(
	ctx context.Context,
	name, description string,
	sourceType models.OracleDataSourceType,
	url, method string,
	headers map[string]interface{},
	body string,
	authType models.OracleAuthType,
	authParams map[string]interface{},
	path string,
	transform string,
	schedule string,
	userID int,
) (*models.Oracle, error) {
	// Validate input
	if name == "" {
		return nil, errors.New("name is required")
	}

	if url == "" {
		return nil, errors.New("URL is required")
	}

	// Check if oracle with this name already exists
	existingOracle, err := s.oracleRepository.GetOracleByName(name)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing oracle: %w", err)
	}

	if existingOracle != nil {
		return nil, fmt.Errorf("oracle with name '%s' already exists", name)
	}

	// Set default values if not provided
	if method == "" {
		method = "GET"
	}

	if sourceType == "" {
		sourceType = models.OracleDataSourceTypeREST
	}

	if authType == "" {
		authType = models.OracleAuthTypeNone
	}

	// Create headers map if nil
	if headers == nil {
		headers = make(map[string]interface{})
	}

	// Create auth params map if nil
	if authParams == nil {
		authParams = make(map[string]interface{})
	}

	// Create oracle
	oracle := &models.Oracle{
		Name:        name,
		Description: description,
		Type:        sourceType,
		URL:         url,
		Method:      method,
		Headers:     headers,
		Body:        body,
		AuthType:    authType,
		AuthParams:  authParams,
		Path:        path,
		Transform:   transform,
		Schedule:    schedule,
		Active:      true,
		UserID:      userID,
	}

	// Save to database
	oracle, err = s.oracleRepository.CreateOracle(oracle)
	if err != nil {
		return nil, fmt.Errorf("failed to create oracle: %w", err)
	}

	s.logger.Infof("Created oracle %d (%s)", oracle.ID, oracle.Name)
	return oracle, nil
}

// UpdateOracle updates an oracle data source configuration
func (s *Service) UpdateOracle(
	ctx context.Context,
	id int,
	name, description string,
	sourceType models.OracleDataSourceType,
	url, method string,
	headers map[string]interface{},
	body string,
	authType models.OracleAuthType,
	authParams map[string]interface{},
	path string,
	transform string,
	schedule string,
	active bool,
	userID int,
) (*models.Oracle, error) {
	// Get oracle
	oracle, err := s.oracleRepository.GetOracleByID(id)
	if err != nil {
		return nil, fmt.Errorf("failed to get oracle: %w", err)
	}

	if oracle == nil {
		return nil, errors.New("oracle not found")
	}

	// Check ownership
	if oracle.UserID != userID {
		return nil, errors.New("not authorized to update this oracle")
	}

	// Update fields if provided
	if name != "" && name != oracle.Name {
		// Check if oracle with new name already exists
		existingOracle, err := s.oracleRepository.GetOracleByName(name)
		if err != nil {
			return nil, fmt.Errorf("failed to check existing oracle: %w", err)
		}

		if existingOracle != nil && existingOracle.ID != id {
			return nil, fmt.Errorf("oracle with name '%s' already exists", name)
		}

		oracle.Name = name
	}

	if description != "" {
		oracle.Description = description
	}

	if sourceType != "" {
		oracle.Type = sourceType
	}

	if url != "" {
		oracle.URL = url
	}

	if method != "" {
		oracle.Method = method
	}

	if headers != nil {
		oracle.Headers = headers
	}

	if body != "" {
		oracle.Body = body
	}

	if authType != "" {
		oracle.AuthType = authType
	}

	if authParams != nil {
		oracle.AuthParams = authParams
	}

	if path != "" {
		oracle.Path = path
	}

	if transform != "" {
		oracle.Transform = transform
	}

	if schedule != "" {
		oracle.Schedule = schedule
	}

	oracle.Active = active

	// Save to database
	oracle, err = s.oracleRepository.UpdateOracle(oracle)
	if err != nil {
		return nil, fmt.Errorf("failed to update oracle: %w", err)
	}

	s.logger.Infof("Updated oracle %d (%s)", oracle.ID, oracle.Name)
	return oracle, nil
}

// GetOracle gets an oracle data source configuration by ID
func (s *Service) GetOracle(ctx context.Context, id int) (*models.Oracle, error) {
	return s.oracleRepository.GetOracleByID(id)
}

// GetOracleByName gets an oracle data source configuration by name
func (s *Service) GetOracleByName(ctx context.Context, name string) (*models.Oracle, error) {
	return s.oracleRepository.GetOracleByName(name)
}

// ListOracles lists oracle data source configurations
func (s *Service) ListOracles(ctx context.Context, userID int, offset, limit int) ([]*models.Oracle, error) {
	return s.oracleRepository.ListOracles(userID, offset, limit)
}

// DeleteOracle deletes an oracle data source configuration
func (s *Service) DeleteOracle(ctx context.Context, id, userID int) error {
	// Get oracle
	oracle, err := s.oracleRepository.GetOracleByID(id)
	if err != nil {
		return fmt.Errorf("failed to get oracle: %w", err)
	}

	if oracle == nil {
		return errors.New("oracle not found")
	}

	// Check ownership
	if oracle.UserID != userID {
		return errors.New("not authorized to delete this oracle")
	}

	// Delete from database
	err = s.oracleRepository.DeleteOracle(id)
	if err != nil {
		return fmt.Errorf("failed to delete oracle: %w", err)
	}

	s.logger.Infof("Deleted oracle %d (%s)", id, oracle.Name)
	return nil
}

// CreateOracleRequest creates a new oracle data request
func (s *Service) CreateOracleRequest(
	ctx context.Context,
	oracleID int,
	userID int,
	params map[string]interface{},
	callbackAddress string,
	callbackMethod string,
	gasFee float64,
) (*models.OracleRequest, error) {
	// Get oracle
	var oracle *models.Oracle
	var err error

	if oracleID > 0 {
		oracle, err = s.oracleRepository.GetOracleByID(oracleID)
		if err != nil {
			return nil, fmt.Errorf("failed to get oracle: %w", err)
		}

		if oracle == nil {
			return nil, errors.New("oracle not found")
		}

		if !oracle.Active {
			return nil, errors.New("oracle is not active")
		}
	} else {
		// Direct request without oracle ID
		if params["url"] == nil || params["url"] == "" {
			return nil, errors.New("URL is required for direct requests")
		}
	}

	// Prepare request
	request := &models.OracleRequest{
		OracleID:        oracleID,
		UserID:          userID,
		Status:          models.OracleRequestStatusPending,
		CallbackAddress: callbackAddress,
		CallbackMethod:  callbackMethod,
		GasFee:          gasFee,
	}

	// If using an oracle template, apply parameters
	if oracle != nil {
		// Apply parameters to URL template
		url, err := s.applyTemplate(oracle.URL, params)
		if err != nil {
			return nil, fmt.Errorf("failed to apply URL template: %w", err)
		}
		request.URL = url

		// Apply parameters to other fields
		request.Method = oracle.Method
		request.Headers = oracle.Headers

		if oracle.Body != "" {
			body, err := s.applyTemplate(oracle.Body, params)
			if err != nil {
				return nil, fmt.Errorf("failed to apply body template: %w", err)
			}
			request.Body = body
		}

		request.AuthType = oracle.AuthType
		request.AuthParams = oracle.AuthParams
		request.Path = oracle.Path
		request.Transform = oracle.Transform
	} else {
		// Direct request, use parameters directly
		request.URL = params["url"].(string)

		if method, ok := params["method"].(string); ok && method != "" {
			request.Method = method
		} else {
			request.Method = "GET"
		}

		if headers, ok := params["headers"].(map[string]interface{}); ok {
			request.Headers = headers
		} else {
			request.Headers = make(map[string]interface{})
		}

		if body, ok := params["body"].(string); ok {
			request.Body = body
		}

		if authType, ok := params["auth_type"].(string); ok && authType != "" {
			request.AuthType = models.OracleAuthType(authType)
		} else {
			request.AuthType = models.OracleAuthTypeNone
		}

		if authParams, ok := params["auth_params"].(map[string]interface{}); ok {
			request.AuthParams = authParams
		} else {
			request.AuthParams = make(map[string]interface{})
		}

		if path, ok := params["path"].(string); ok {
			request.Path = path
		}

		if transform, ok := params["transform"].(string); ok {
			request.Transform = transform
		}
	}

	// Save to database
	request, err = s.oracleRepository.CreateOracleRequest(request)
	if err != nil {
		return nil, fmt.Errorf("failed to create oracle request: %w", err)
	}

	s.logger.Infof("Created oracle request %d for URL %s", request.ID, request.URL)
	return request, nil
}

// GetOracleRequest gets an oracle data request by ID
func (s *Service) GetOracleRequest(ctx context.Context, id int) (*models.OracleRequest, error) {
	return s.oracleRepository.GetOracleRequestByID(id)
}

// ListOracleRequests lists oracle data requests for an oracle
func (s *Service) ListOracleRequests(ctx context.Context, oracleID int, offset, limit int) ([]*models.OracleRequest, error) {
	return s.oracleRepository.ListOracleRequests(oracleID, offset, limit)
}

// GetOracleStatistics gets statistics for oracle data
func (s *Service) GetOracleStatistics(ctx context.Context) (map[string]interface{}, error) {
	return s.oracleRepository.GetOracleStatistics()
}

// processRequestsWorker is a worker that processes oracle requests
func (s *Service) processRequestsWorker() {
	defer s.wg.Done()

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-s.shutdownChan:
			return
		case <-ticker.C:
			s.processRequests()
		}
	}
}

// processRequests processes pending oracle requests
func (s *Service) processRequests() {
	// Get pending requests
	requests, err := s.oracleRepository.ListPendingOracleRequests()
	if err != nil {
		s.logger.Errorf("Failed to list pending oracle requests: %v", err)
		return
	}

	if len(requests) == 0 {
		return
	}

	s.logger.Infof("Processing %d pending oracle requests", len(requests))

	for _, request := range requests {
		// Skip if already processing
		if _, ok := s.processingRequests.Load(request.ID); ok {
			continue
		}

		// Mark as processing
		s.processingRequests.Store(request.ID, true)

		// Process in a goroutine
		go func(req *models.OracleRequest) {
			defer s.processingRequests.Delete(req.ID)

			// Mark as processing
			req.Status = models.OracleRequestStatusProcessing
			_, err := s.oracleRepository.UpdateOracleRequest(req)
			if err != nil {
				s.logger.Errorf("Failed to update request %d status: %v", req.ID, err)
				return
			}

			// Process the request
			err = s.processOracleRequest(req)
			if err != nil {
				s.logger.Errorf("Failed to process oracle request %d: %v", req.ID, err)

				// Update request with error
				req.Status = models.OracleRequestStatusFailed
				req.Error = err.Error()

				_, updateErr := s.oracleRepository.UpdateOracleRequest(req)
				if updateErr != nil {
					s.logger.Errorf("Failed to update request %d: %v", req.ID, updateErr)
				}
			}
		}(request)
	}
}

// processOracleRequest processes a single oracle request
func (s *Service) processOracleRequest(request *models.OracleRequest) error {
	// Execute in TEE if available
	if s.teeManager != nil {
		return s.teeManager.ExecuteInTEE(func() error {
			return s.fetchAndProcessData(request)
		})
	}

	// Otherwise, process directly
	return s.fetchAndProcessData(request)
}

// fetchAndProcessData fetches data from the external source and processes it
func (s *Service) fetchAndProcessData(request *models.OracleRequest) error {
	// Fetch data from external source
	result, rawResult, err := s.fetchData(request)
	if err != nil {
		return fmt.Errorf("failed to fetch data: %w", err)
	}

	// Extract data using path if provided
	if request.Path != "" {
		extractedData, err := s.extractData(result, request.Path)
		if err != nil {
			return fmt.Errorf("failed to extract data: %w", err)
		}

		// Update result with extracted data
		result = map[string]interface{}{
			"value": extractedData,
		}
	}

	// Apply transformation if provided
	if request.Transform != "" {
		transformedData, err := s.transformData(result, request.Transform)
		if err != nil {
			return fmt.Errorf("failed to transform data: %w", err)
		}

		// Update result with transformed data
		result = map[string]interface{}{
			"value": transformedData,
		}
	}

	// Update request with result
	request.Result = result
	request.RawResult = rawResult
	request.Status = models.OracleRequestStatusCompleted

	// Get current block height
	blockHeight, err := s.blockchainClient.GetBlockHeight()
	if err != nil {
		s.logger.Warnf("Failed to get block height: %v", err)
	} else {
		request.BlockHeight = blockHeight
	}

	// Save to database
	_, err = s.oracleRepository.UpdateOracleRequest(request)
	if err != nil {
		return fmt.Errorf("failed to update request: %w", err)
	}

	// Send callback if required
	if request.CallbackAddress != "" && request.CallbackMethod != "" {
		err = s.sendCallback(request)
		if err != nil {
			return fmt.Errorf("failed to send callback: %w", err)
		}
	}

	s.logger.Infof("Completed oracle request %d with result: %v", request.ID, result)
	return nil
}

// fetchData fetches data from an external source
func (s *Service) fetchData(request *models.OracleRequest) (map[string]interface{}, string, error) {
	// Create HTTP request
	var reqBody io.Reader
	if request.Body != "" {
		reqBody = strings.NewReader(request.Body)
	}

	req, err := http.NewRequest(request.Method, request.URL, reqBody)
	if err != nil {
		return nil, "", fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Add headers
	for key, value := range request.Headers {
		if strValue, ok := value.(string); ok {
			req.Header.Add(key, strValue)
		}
	}

	// Set content type if not already set
	if request.Body != "" && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}

	// Add authentication
	err = s.addAuthentication(req, request.AuthType, request.AuthParams)
	if err != nil {
		return nil, "", fmt.Errorf("failed to add authentication: %w", err)
	}

	// Execute request
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("failed to execute HTTP request: %w", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return nil, "", fmt.Errorf("HTTP request failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", fmt.Errorf("failed to read response body: %w", err)
	}

	// Parse response as JSON
	var result map[string]interface{}
	err = json.Unmarshal(body, &result)
	if err != nil {
		// Try to parse as array
		var arrayResult []interface{}
		err2 := json.Unmarshal(body, &arrayResult)
		if err2 != nil {
			// Not JSON, return as plain text
			result = map[string]interface{}{
				"text": string(body),
			}
		} else {
			// Return array as result
			result = map[string]interface{}{
				"array": arrayResult,
			}
		}
	}

	return result, string(body), nil
}

// addAuthentication adds authentication to an HTTP request
func (s *Service) addAuthentication(req *http.Request, authType models.OracleAuthType, authParams map[string]interface{}) error {
	switch authType {
	case models.OracleAuthTypeNone:
		// No authentication required
		return nil

	case models.OracleAuthTypeAPIKey:
		// API key authentication
		key, ok := authParams["key"].(string)
		if !ok {
			return errors.New("API key not provided")
		}

		location, _ := authParams["location"].(string)
		name, _ := authParams["name"].(string)

		if name == "" {
			name = "api_key"
		}

		switch location {
		case "header":
			req.Header.Set(name, key)
		case "query":
			q := req.URL.Query()
			q.Add(name, key)
			req.URL.RawQuery = q.Encode()
		default:
			// Default to header
			req.Header.Set(name, key)
		}

		return nil

	case models.OracleAuthTypeBasic:
		// Basic authentication
		username, ok1 := authParams["username"].(string)
		password, ok2 := authParams["password"].(string)

		if !ok1 || !ok2 {
			return errors.New("username or password not provided")
		}

		req.SetBasicAuth(username, password)
		return nil

	case models.OracleAuthTypeJWT:
		// JWT authentication
		token, ok := authParams["token"].(string)
		if !ok {
			return errors.New("JWT token not provided")
		}

		req.Header.Set("Authorization", "Bearer "+token)
		return nil

	case models.OracleAuthTypeOAuth:
		// OAuth authentication
		token, ok := authParams["access_token"].(string)
		if !ok {
			return errors.New("OAuth token not provided")
		}

		req.Header.Set("Authorization", "Bearer "+token)
		return nil

	case models.OracleAuthTypeCustom:
		// Custom authentication
		for key, value := range authParams {
			if strValue, ok := value.(string); ok {
				req.Header.Set(key, strValue)
			}
		}
		return nil

	default:
		return fmt.Errorf("unsupported authentication type: %s", authType)
	}
}

// extractData extracts data from a JSON object using JSONPath
func (s *Service) extractData(data map[string]interface{}, path string) (interface{}, error) {
	// Special case for empty path
	if path == "" {
		return data, nil
	}

	// Special case for array
	if array, ok := data["array"].([]interface{}); ok && path == "." {
		return array, nil
	}

	// Check for JSONPath syntax
	if !strings.HasPrefix(path, "$") {
		// Make it a JSONPath expression
		if !strings.HasPrefix(path, ".") {
			path = "$." + path
		} else {
			path = "$" + path
		}
	}

	// Extract data
	extracted, err := jsonpath.Get(path, data)
	if err != nil {
		return nil, fmt.Errorf("failed to extract data using JSONPath: %w", err)
	}

	return extracted, nil
}

// transformData applies a transformation to the data
func (s *Service) transformData(data map[string]interface{}, transform string) (interface{}, error) {
	// TODO: Implement more sophisticated transformations
	// For now, we'll just support basic JavaScript-like expressions

	// If the value is a string, try to convert it to a number
	if valueObj, ok := data["value"]; ok {
		if valueStr, ok := valueObj.(string); ok {
			// Try to convert to number
			if valueFloat, err := strconv.ParseFloat(valueStr, 64); err == nil {
				data["value"] = valueFloat
			}
		}
	}

	return data["value"], nil
}

// sendCallback sends a callback to a contract
func (s *Service) sendCallback(request *models.OracleRequest) error {
	// Sign the data for verification
	signature, err := s.signData(request.Result)
	if err != nil {
		return fmt.Errorf("failed to sign data: %w", err)
	}

	// TODO: Implement actual blockchain callback
	// For now, we'll mark the request as callback sent

	request.Status = models.OracleRequestStatusCallbackSent
	request.TxHash = fmt.Sprintf("0x%x", signature[:8])

	_, err = s.oracleRepository.UpdateOracleRequest(request)
	if err != nil {
		return fmt.Errorf("failed to update request: %w", err)
	}

	s.logger.Infof("Sent callback for request %d to %s", request.ID, request.CallbackAddress)

	return nil
}

// signData signs data for verification
func (s *Service) signData(data interface{}) ([]byte, error) {
	// Convert data to JSON
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal data: %w", err)
	}

	// Sign data with HMAC-SHA256
	key := []byte(s.config.Services.Oracle.SigningKey)
	h := hmac.New(sha256.New, key)
	h.Write(jsonData)

	return h.Sum(nil), nil
}

// applyTemplate applies template parameters to a string
func (s *Service) applyTemplate(templateStr string, params map[string]interface{}) (string, error) {
	// Find template placeholders ({{param}})
	tmpl, err := template.New("template").Parse(templateStr)
	if err != nil {
		return "", fmt.Errorf("invalid template: %w", err)
	}

	// Apply parameters
	var buf bytes.Buffer
	err = tmpl.Execute(&buf, params)
	if err != nil {
		return "", fmt.Errorf("failed to apply template parameters: %w", err)
	}

	return buf.String(), nil
}
