package repositories

import (
	"database/sql"
	"errors"
	"time"

	"github.com/R3E-Network/service_layer/internal/models"
)

// PostgresTriggerRepository is an implementation of TriggerRepository using PostgreSQL
type PostgresTriggerRepository struct {
	db *sql.DB
}

// NewTriggerRepository creates a new PostgreSQL implementation of TriggerRepository
func NewTriggerRepository(db *sql.DB) models.TriggerRepository {
	return &PostgresTriggerRepository{
		db: db,
	}
}

// Create creates a new trigger
func (r *PostgresTriggerRepository) Create(trigger *models.Trigger) error {
	query := `
		INSERT INTO triggers (user_id, function_id, name, description, trigger_type, trigger_config, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id
	`
	err := r.db.QueryRow(
		query,
		trigger.UserID,
		trigger.FunctionID,
		trigger.Name,
		trigger.Description,
		trigger.TriggerType,
		trigger.TriggerConfig,
		trigger.Status,
		trigger.CreatedAt,
		trigger.UpdatedAt,
	).Scan(&trigger.ID)

	return err
}

// GetByID gets a trigger by ID
func (r *PostgresTriggerRepository) GetByID(id int) (*models.Trigger, error) {
	query := `
		SELECT id, user_id, function_id, name, description, trigger_type, trigger_config, status, created_at, updated_at
		FROM triggers
		WHERE id = $1
	`
	trigger := &models.Trigger{}
	err := r.db.QueryRow(query, id).Scan(
		&trigger.ID,
		&trigger.UserID,
		&trigger.FunctionID,
		&trigger.Name,
		&trigger.Description,
		&trigger.TriggerType,
		&trigger.TriggerConfig,
		&trigger.Status,
		&trigger.CreatedAt,
		&trigger.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // Trigger not found
		}
		return nil, err
	}

	return trigger, nil
}

// GetByUserIDAndName gets a trigger by user ID and name
func (r *PostgresTriggerRepository) GetByUserIDAndName(userID int, name string) (*models.Trigger, error) {
	query := `
		SELECT id, user_id, function_id, name, description, trigger_type, trigger_config, status, created_at, updated_at
		FROM triggers
		WHERE user_id = $1 AND name = $2
	`
	trigger := &models.Trigger{}
	err := r.db.QueryRow(query, userID, name).Scan(
		&trigger.ID,
		&trigger.UserID,
		&trigger.FunctionID,
		&trigger.Name,
		&trigger.Description,
		&trigger.TriggerType,
		&trigger.TriggerConfig,
		&trigger.Status,
		&trigger.CreatedAt,
		&trigger.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // Trigger not found
		}
		return nil, err
	}

	return trigger, nil
}

// List lists triggers for a user
func (r *PostgresTriggerRepository) List(userID int, offset, limit int) ([]*models.Trigger, error) {
	query := `
		SELECT id, user_id, function_id, name, description, trigger_type, trigger_config, status, created_at, updated_at
		FROM triggers
		WHERE user_id = $1
		ORDER BY name
		LIMIT $2 OFFSET $3
	`
	rows, err := r.db.Query(query, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	triggers := []*models.Trigger{}
	for rows.Next() {
		trigger := &models.Trigger{}
		err := rows.Scan(
			&trigger.ID,
			&trigger.UserID,
			&trigger.FunctionID,
			&trigger.Name,
			&trigger.Description,
			&trigger.TriggerType,
			&trigger.TriggerConfig,
			&trigger.Status,
			&trigger.CreatedAt,
			&trigger.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		triggers = append(triggers, trigger)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return triggers, nil
}

// Update updates a trigger
func (r *PostgresTriggerRepository) Update(trigger *models.Trigger) error {
	query := `
		UPDATE triggers
		SET name = $1, description = $2, function_id = $3, trigger_type = $4, trigger_config = $5, status = $6, updated_at = $7
		WHERE id = $8
	`
	now := time.Now()
	trigger.UpdatedAt = now

	_, err := r.db.Exec(
		query,
		trigger.Name,
		trigger.Description,
		trigger.FunctionID,
		trigger.TriggerType,
		trigger.TriggerConfig,
		trigger.Status,
		now,
		trigger.ID,
	)

	return err
}

// UpdateStatus updates a trigger's status
func (r *PostgresTriggerRepository) UpdateStatus(id int, status string) error {
	query := `
		UPDATE triggers
		SET status = $1, updated_at = $2
		WHERE id = $3
	`
	now := time.Now()

	_, err := r.db.Exec(query, status, now, id)
	return err
}

// Delete deletes a trigger
func (r *PostgresTriggerRepository) Delete(id int) error {
	query := `DELETE FROM triggers WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}

// CreateEvent creates a new trigger event
func (r *PostgresTriggerRepository) CreateEvent(event *models.TriggerEvent) error {
	query := `
		INSERT INTO trigger_events (trigger_id, timestamp, status, execution_id)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`
	var executionID sql.NullInt64
	if event.ExecutionID != 0 {
		executionID = sql.NullInt64{
			Int64: int64(event.ExecutionID),
			Valid: true,
		}
	}

	err := r.db.QueryRow(
		query,
		event.TriggerID,
		event.Timestamp,
		event.Status,
		executionID,
	).Scan(&event.ID)

	return err
}

// GetEventByID gets a trigger event by ID
func (r *PostgresTriggerRepository) GetEventByID(id int) (*models.TriggerEvent, error) {
	query := `
		SELECT id, trigger_id, timestamp, status, execution_id
		FROM trigger_events
		WHERE id = $1
	`
	event := &models.TriggerEvent{}
	var executionID sql.NullInt64

	err := r.db.QueryRow(query, id).Scan(
		&event.ID,
		&event.TriggerID,
		&event.Timestamp,
		&event.Status,
		&executionID,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // Event not found
		}
		return nil, err
	}

	if executionID.Valid {
		event.ExecutionID = int(executionID.Int64)
	}

	return event, nil
}

// ListEventsByTriggerID lists events for a trigger
func (r *PostgresTriggerRepository) ListEventsByTriggerID(triggerID int, offset, limit int) ([]*models.TriggerEvent, error) {
	query := `
		SELECT id, trigger_id, timestamp, status, execution_id
		FROM trigger_events
		WHERE trigger_id = $1
		ORDER BY timestamp DESC
		LIMIT $2 OFFSET $3
	`
	rows, err := r.db.Query(query, triggerID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	events := []*models.TriggerEvent{}
	for rows.Next() {
		event := &models.TriggerEvent{}
		var executionID sql.NullInt64

		err := rows.Scan(
			&event.ID,
			&event.TriggerID,
			&event.Timestamp,
			&event.Status,
			&executionID,
		)
		if err != nil {
			return nil, err
		}

		if executionID.Valid {
			event.ExecutionID = int(executionID.Int64)
		}

		events = append(events, event)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return events, nil
}

// ListActiveTriggers lists all active triggers
func (r *PostgresTriggerRepository) ListActiveTriggers() ([]*models.Trigger, error) {
	query := `
		SELECT id, user_id, function_id, name, description, trigger_type, trigger_config, status, created_at, updated_at
		FROM triggers
		WHERE status = 'active'
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	triggers := []*models.Trigger{}
	for rows.Next() {
		trigger := &models.Trigger{}
		err := rows.Scan(
			&trigger.ID,
			&trigger.UserID,
			&trigger.FunctionID,
			&trigger.Name,
			&trigger.Description,
			&trigger.TriggerType,
			&trigger.TriggerConfig,
			&trigger.Status,
			&trigger.CreatedAt,
			&trigger.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		triggers = append(triggers, trigger)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return triggers, nil
}
