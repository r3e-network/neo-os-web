package repositories

import (
	"database/sql"
	"errors"

	"github.com/R3E-Network/service_layer/internal/models"
)

// PostgresExecutionRepository is an implementation of ExecutionRepository using PostgreSQL
type PostgresExecutionRepository struct {
	db *sql.DB
}

// NewExecutionRepository creates a new PostgreSQL implementation of ExecutionRepository
func NewExecutionRepository(db *sql.DB) models.ExecutionRepository {
	return &PostgresExecutionRepository{
		db: db,
	}
}

// Create creates a new execution
func (r *PostgresExecutionRepository) Create(execution *models.Execution) error {
	query := `
		INSERT INTO executions (function_id, status, start_time, end_time, duration, result, error, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`
	err := r.db.QueryRow(
		query,
		execution.FunctionID,
		execution.Status,
		execution.StartTime,
		execution.EndTime,
		execution.Duration,
		execution.Result,
		execution.Error,
		execution.CreatedAt,
	).Scan(&execution.ID)

	return err
}

// GetByID gets an execution by ID
func (r *PostgresExecutionRepository) GetByID(id int) (*models.Execution, error) {
	query := `
		SELECT id, function_id, status, start_time, end_time, duration, result, error, created_at
		FROM executions
		WHERE id = $1
	`
	execution := &models.Execution{}
	var endTime sql.NullTime
	var duration sql.NullInt32
	var result sql.NullString
	var errorMsg sql.NullString

	err := r.db.QueryRow(query, id).Scan(
		&execution.ID,
		&execution.FunctionID,
		&execution.Status,
		&execution.StartTime,
		&endTime,
		&duration,
		&result,
		&errorMsg,
		&execution.CreatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // Execution not found
		}
		return nil, err
	}

	if endTime.Valid {
		execution.EndTime = endTime.Time
	}
	if duration.Valid {
		execution.Duration = int(duration.Int32)
	}
	if result.Valid {
		execution.Result = []byte(result.String)
	}
	if errorMsg.Valid {
		execution.Error = errorMsg.String
	}

	// Get logs
	logs, err := r.GetLogs(execution.ID, 0, 1000)
	if err != nil {
		return nil, err
	}
	execution.Logs = logs

	return execution, nil
}

// ListByFunctionID lists executions for a function
func (r *PostgresExecutionRepository) ListByFunctionID(functionID int, offset, limit int) ([]*models.Execution, error) {
	query := `
		SELECT id, function_id, status, start_time, end_time, duration, result, error, created_at
		FROM executions
		WHERE function_id = $1
		ORDER BY start_time DESC
		LIMIT $2 OFFSET $3
	`
	rows, err := r.db.Query(query, functionID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	executions := []*models.Execution{}
	for rows.Next() {
		execution := &models.Execution{}
		var endTime sql.NullTime
		var duration sql.NullInt32
		var result sql.NullString
		var errorMsg sql.NullString

		err := rows.Scan(
			&execution.ID,
			&execution.FunctionID,
			&execution.Status,
			&execution.StartTime,
			&endTime,
			&duration,
			&result,
			&errorMsg,
			&execution.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		if endTime.Valid {
			execution.EndTime = endTime.Time
		}
		if duration.Valid {
			execution.Duration = int(duration.Int32)
		}
		if result.Valid {
			execution.Result = []byte(result.String)
		}
		if errorMsg.Valid {
			execution.Error = errorMsg.String
		}

		executions = append(executions, execution)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return executions, nil
}

// Update updates an execution
func (r *PostgresExecutionRepository) Update(execution *models.Execution) error {
	query := `
		UPDATE executions
		SET status = $1, end_time = $2, duration = $3, result = $4, error = $5
		WHERE id = $6
	`
	_, err := r.db.Exec(
		query,
		execution.Status,
		execution.EndTime,
		execution.Duration,
		execution.Result,
		execution.Error,
		execution.ID,
	)

	return err
}

// Delete deletes an execution
func (r *PostgresExecutionRepository) Delete(id int) error {
	query := `DELETE FROM executions WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}

// AddLog adds a log entry for an execution
func (r *PostgresExecutionRepository) AddLog(log *models.ExecutionLog) error {
	query := `
		INSERT INTO execution_logs (execution_id, timestamp, level, message)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`
	return r.db.QueryRow(
		query,
		log.ExecutionID,
		log.Timestamp,
		log.Level,
		log.Message,
	).Scan(&log.ID)
}

// GetLogs gets logs for an execution
func (r *PostgresExecutionRepository) GetLogs(executionID int, offset, limit int) ([]*models.ExecutionLog, error) {
	query := `
		SELECT id, execution_id, timestamp, level, message
		FROM execution_logs
		WHERE execution_id = $1
		ORDER BY timestamp
		LIMIT $2 OFFSET $3
	`
	rows, err := r.db.Query(query, executionID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	logs := []*models.ExecutionLog{}
	for rows.Next() {
		log := &models.ExecutionLog{}
		err := rows.Scan(
			&log.ID,
			&log.ExecutionID,
			&log.Timestamp,
			&log.Level,
			&log.Message,
		)
		if err != nil {
			return nil, err
		}

		logs = append(logs, log)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return logs, nil
}
