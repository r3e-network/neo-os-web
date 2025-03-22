package functions

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/internal/tee"
	"github.com/R3E-Network/service_layer/pkg/logger"
)

// Service handles JavaScript function execution
type Service struct {
	config              *config.Config
	logger              *logger.Logger
	functionRepository  models.FunctionRepository
	executionRepository models.ExecutionRepository
	teeManager          *tee.Manager
}

// NewService creates a new functions service
func NewService(
	cfg *config.Config,
	log *logger.Logger,
	functionRepository models.FunctionRepository,
	executionRepository models.ExecutionRepository,
	teeManager *tee.Manager,
) *Service {
	return &Service{
		config:              cfg,
		logger:              log,
		functionRepository:  functionRepository,
		executionRepository: executionRepository,
		teeManager:          teeManager,
	}
}

// CreateFunction creates a new function
func (s *Service) CreateFunction(userID int, name, description, sourceCode string, timeout, memory int, secrets []string) (*models.Function, error) {
	// Validate input
	if err := s.validateFunction(name, sourceCode, timeout, memory, secrets); err != nil {
		return nil, err
	}

	// Check if function already exists
	existingFunction, err := s.functionRepository.GetByUserIDAndName(userID, name)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing function: %w", err)
	}
	if existingFunction != nil {
		return nil, errors.New("function with this name already exists")
	}

	// Create function
	now := time.Now()
	function := &models.Function{
		UserID:      userID,
		Name:        name,
		Description: description,
		SourceCode:  sourceCode,
		Status:      "active",
		Timeout:     timeout,
		Memory:      memory,
		CreatedAt:   now,
		UpdatedAt:   now,
		Secrets:     secrets,
	}

	// Save to database
	err = s.functionRepository.Create(function)
	if err != nil {
		return nil, fmt.Errorf("failed to create function: %w", err)
	}

	return function, nil
}

// UpdateFunction updates an existing function
func (s *Service) UpdateFunction(id, userID int, name, description, sourceCode string, timeout, memory int, secrets []string) (*models.Function, error) {
	// Get existing function
	function, err := s.GetFunction(id, userID)
	if err != nil {
		return nil, err
	}
	if function == nil {
		return nil, errors.New("function not found")
	}

	// Validate input
	if err := s.validateFunction(name, sourceCode, timeout, memory, secrets); err != nil {
		return nil, err
	}

	// Check if name changed and if the new name already exists
	if name != function.Name {
		existingFunction, err := s.functionRepository.GetByUserIDAndName(userID, name)
		if err != nil {
			return nil, fmt.Errorf("failed to check existing function: %w", err)
		}
		if existingFunction != nil && existingFunction.ID != id {
			return nil, errors.New("function with this name already exists")
		}
	}

	// Update function
	function.Name = name
	function.Description = description
	function.SourceCode = sourceCode
	function.Timeout = timeout
	function.Memory = memory
	function.Secrets = secrets
	function.UpdatedAt = time.Now()

	// Save to database
	err = s.functionRepository.Update(function)
	if err != nil {
		return nil, fmt.Errorf("failed to update function: %w", err)
	}

	return function, nil
}

// DeleteFunction deletes a function
func (s *Service) DeleteFunction(id, userID int) error {
	// Get existing function
	function, err := s.GetFunction(id, userID)
	if err != nil {
		return err
	}
	if function == nil {
		return errors.New("function not found")
	}

	// Delete from database
	err = s.functionRepository.Delete(id)
	if err != nil {
		return fmt.Errorf("failed to delete function: %w", err)
	}

	return nil
}

// GetFunction gets a function by ID
func (s *Service) GetFunction(id, userID int) (*models.Function, error) {
	// Get function from database
	function, err := s.functionRepository.GetByID(id)
	if err != nil {
		return nil, fmt.Errorf("failed to get function: %w", err)
	}
	if function == nil {
		return nil, nil
	}

	// Check ownership
	if function.UserID != userID {
		return nil, errors.New("function not found")
	}

	return function, nil
}

// ListFunctions lists functions for a user
func (s *Service) ListFunctions(userID int, page, limit int) ([]*models.Function, error) {
	// Calculate offset
	offset := (page - 1) * limit

	// Get functions from database
	functions, err := s.functionRepository.List(userID, offset, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list functions: %w", err)
	}

	return functions, nil
}

// ExecuteFunction executes a function
func (s *Service) ExecuteFunction(ctx context.Context, id, userID int, params map[string]interface{}, async bool) (*models.ExecutionResult, error) {
	// Get function
	function, err := s.GetFunction(id, userID)
	if err != nil {
		return nil, err
	}
	if function == nil {
		return nil, errors.New("function not found")
	}

	// Create execution record
	now := time.Now()
	execution := &models.Execution{
		FunctionID: function.ID,
		Status:     "running",
		StartTime:  now,
		CreatedAt:  now,
	}

	err = s.executionRepository.Create(execution)
	if err != nil {
		return nil, fmt.Errorf("failed to create execution record: %w", err)
	}

	// Execute function asynchronously if requested
	if async {
		go s.executeFunction(context.Background(), function, execution, params)

		// Return execution ID
		return &models.ExecutionResult{
			ExecutionID: fmt.Sprintf("%d", execution.ID),
			FunctionID:  function.ID,
			Status:      "running",
			StartTime:   execution.StartTime,
		}, nil
	}

	// Execute function synchronously
	return s.executeFunction(ctx, function, execution, params)
}

// executeFunction executes a function in the TEE
func (s *Service) executeFunction(ctx context.Context, function *models.Function, execution *models.Execution, params map[string]interface{}) (*models.ExecutionResult, error) {
	// Update execution count
	err := s.functionRepository.IncrementExecutionCount(function.ID)
	if err != nil {
		s.logger.Warnf("Failed to increment execution count: %v", err)
	}

	// Update last execution time
	err = s.functionRepository.UpdateLastExecution(function.ID, execution.StartTime)
	if err != nil {
		s.logger.Warnf("Failed to update last execution time: %v", err)
	}

	// Execute in TEE
	result, err := s.teeManager.ExecuteFunction(ctx, function, params, function.Secrets)

	// Update execution record with result
	endTime := time.Now()
	execution.EndTime = endTime
	execution.Duration = int(endTime.Sub(execution.StartTime).Milliseconds())

	if err != nil {
		execution.Status = "error"
		execution.Error = err.Error()
		// Log the error
		s.logger.Errorf("Function execution failed: %v", err)
	} else {
		execution.Status = "success"
		execution.Result = result.Result
	}

	// Update execution in database
	err = s.executionRepository.Update(execution)
	if err != nil {
		s.logger.Errorf("Failed to update execution record: %v", err)
	}

	// Convert to execution result
	executionResult := &models.ExecutionResult{
		ExecutionID: fmt.Sprintf("%d", execution.ID),
		FunctionID:  function.ID,
		Status:      execution.Status,
		StartTime:   execution.StartTime,
		EndTime:     execution.EndTime,
		Duration:    execution.Duration,
		Result:      execution.Result,
		Error:       execution.Error,
	}

	if result != nil {
		executionResult.Logs = result.Logs
	}

	return executionResult, nil
}

// GetExecution gets details of a function execution
func (s *Service) GetExecution(executionID string, userID int) (*models.ExecutionResult, error) {
	// Parse execution ID
	var id int
	_, err := fmt.Sscanf(executionID, "%d", &id)
	if err != nil {
		return nil, errors.New("invalid execution ID")
	}

	// Get execution from database
	execution, err := s.executionRepository.GetByID(id)
	if err != nil {
		return nil, fmt.Errorf("failed to get execution: %w", err)
	}
	if execution == nil {
		return nil, errors.New("execution not found")
	}

	// Get function to check ownership
	function, err := s.functionRepository.GetByID(execution.FunctionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get function: %w", err)
	}
	if function == nil || function.UserID != userID {
		return nil, errors.New("execution not found")
	}

	// Get logs
	logs, err := s.executionRepository.GetLogs(execution.ID, 0, 1000)
	if err != nil {
		s.logger.Warnf("Failed to get execution logs: %v", err)
	}

	// Convert logs to strings
	logStrings := []string{}
	for _, log := range logs {
		logStrings = append(logStrings, log.Message)
	}

	// Convert to execution result
	result := &models.ExecutionResult{
		ExecutionID: fmt.Sprintf("%d", execution.ID),
		FunctionID:  execution.FunctionID,
		Status:      execution.Status,
		StartTime:   execution.StartTime,
		EndTime:     execution.EndTime,
		Duration:    execution.Duration,
		Result:      execution.Result,
		Error:       execution.Error,
		Logs:        logStrings,
	}

	return result, nil
}

// ListExecutions lists executions for a function
func (s *Service) ListExecutions(functionID, userID int, page, limit int) ([]*models.Execution, error) {
	// Get function to check ownership
	function, err := s.GetFunction(functionID, userID)
	if err != nil {
		return nil, err
	}
	if function == nil {
		return nil, errors.New("function not found")
	}

	// Calculate offset
	offset := (page - 1) * limit

	// Get executions from database
	executions, err := s.executionRepository.ListByFunctionID(functionID, offset, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list executions: %w", err)
	}

	return executions, nil
}

// validateFunction validates function input
func (s *Service) validateFunction(name, sourceCode string, timeout, memory int, secrets []string) error {
	if name == "" {
		return errors.New("function name is required")
	}

	if sourceCode == "" {
		return errors.New("function source code is required")
	}

	if len(sourceCode) > s.config.Services.Functions.MaxSourceCodeSize {
		return fmt.Errorf("function source code exceeds maximum size of %d bytes", s.config.Services.Functions.MaxSourceCodeSize)
	}

	// Validate timeout and memory
	if timeout <= 0 {
		timeout = s.config.TEE.Runtime.ExecutionTimeout
	} else if timeout > s.config.TEE.Runtime.ExecutionTimeout {
		return fmt.Errorf("function timeout exceeds maximum of %d seconds", s.config.TEE.Runtime.ExecutionTimeout)
	}

	if memory <= 0 {
		memory = s.config.TEE.Runtime.JSMemoryLimit
	} else if memory > s.config.TEE.Runtime.JSMemoryLimit {
		return fmt.Errorf("function memory exceeds maximum of %d MB", s.config.TEE.Runtime.JSMemoryLimit)
	}

	// TODO: Validate JavaScript syntax

	return nil
}
