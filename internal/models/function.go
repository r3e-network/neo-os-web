package models

import (
	"encoding/json"
	"time"
)

// Function represents a JavaScript function stored in the system
type Function struct {
	ID             int       `json:"id" db:"id"`
	UserID         int       `json:"user_id" db:"user_id"`
	Name           string    `json:"name" db:"name"`
	Description    string    `json:"description" db:"description"`
	SourceCode     string    `json:"source_code" db:"source_code"`
	Version        int       `json:"version" db:"version"`
	Status         string    `json:"status" db:"status"`
	Timeout        int       `json:"timeout" db:"timeout"`
	Memory         int       `json:"memory" db:"memory"`
	ExecutionCount int       `json:"execution_count" db:"execution_count"`
	LastExecution  time.Time `json:"last_execution,omitempty" db:"last_execution"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
	Secrets        []string  `json:"secrets,omitempty" db:"-"`
}

// Execution represents a function execution
type Execution struct {
	ID         int             `json:"id" db:"id"`
	FunctionID int             `json:"function_id" db:"function_id"`
	Status     string          `json:"status" db:"status"`
	StartTime  time.Time       `json:"start_time" db:"start_time"`
	EndTime    time.Time       `json:"end_time,omitempty" db:"end_time"`
	Duration   int             `json:"duration,omitempty" db:"duration"`
	Result     json.RawMessage `json:"result,omitempty" db:"result"`
	Error      string          `json:"error,omitempty" db:"error"`
	CreatedAt  time.Time       `json:"created_at" db:"created_at"`
	Logs       []ExecutionLog  `json:"logs,omitempty" db:"-"`
}

// ExecutionLog represents a log entry for a function execution
type ExecutionLog struct {
	ID          int       `json:"id" db:"id"`
	ExecutionID int       `json:"execution_id" db:"execution_id"`
	Timestamp   time.Time `json:"timestamp" db:"timestamp"`
	Level       string    `json:"level" db:"level"`
	Message     string    `json:"message" db:"message"`
}

// ExecutionResult represents the result of a function execution
type ExecutionResult struct {
	ExecutionID string          `json:"execution_id"`
	FunctionID  int             `json:"function_id"`
	Status      string          `json:"status"`
	StartTime   time.Time       `json:"start_time"`
	EndTime     time.Time       `json:"end_time,omitempty"`
	Duration    int             `json:"duration,omitempty"`
	Result      json.RawMessage `json:"result,omitempty"`
	Error       string          `json:"error,omitempty"`
	Logs        []string        `json:"logs,omitempty"`
}

// ExecutionRequest represents a request to execute a function
type ExecutionRequest struct {
	Params interface{} `json:"params"`
	Async  bool        `json:"async"`
}

// FunctionRepository defines methods for working with functions
type FunctionRepository interface {
	Create(function *Function) error
	GetByID(id int) (*Function, error)
	GetByUserIDAndName(userID int, name string) (*Function, error)
	List(userID int, offset, limit int) ([]*Function, error)
	Update(function *Function) error
	Delete(id int) error
	IncrementExecutionCount(id int) error
	UpdateLastExecution(id int, lastExecution time.Time) error
	GetSecrets(functionID int) ([]string, error)
	SetSecrets(functionID int, secrets []string) error
}

// ExecutionRepository defines methods for working with executions
type ExecutionRepository interface {
	Create(execution *Execution) error
	GetByID(id int) (*Execution, error)
	ListByFunctionID(functionID int, offset, limit int) ([]*Execution, error)
	Update(execution *Execution) error
	Delete(id int) error
	AddLog(log *ExecutionLog) error
	GetLogs(executionID int, offset, limit int) ([]*ExecutionLog, error)
}