package models

import (
	"encoding/json"
	"time"
)

// TriggerType defines the type of trigger
type TriggerType string

const (
	// TriggerTypeCron is a time-based trigger using cron syntax
	TriggerTypeCron TriggerType = "cron"
	// TriggerTypePrice is a price-based trigger
	TriggerTypePrice TriggerType = "price"
	// TriggerTypeBlockchain is a blockchain event trigger
	TriggerTypeBlockchain TriggerType = "blockchain"
)

// Trigger represents a contract automation trigger
type Trigger struct {
	ID            int             `json:"id" db:"id"`
	UserID        int             `json:"user_id" db:"user_id"`
	FunctionID    int             `json:"function_id" db:"function_id"`
	Name          string          `json:"name" db:"name"`
	Description   string          `json:"description" db:"description"`
	TriggerType   TriggerType     `json:"trigger_type" db:"trigger_type"`
	TriggerConfig json.RawMessage `json:"trigger_config" db:"trigger_config"`
	Status        string          `json:"status" db:"status"`
	CreatedAt     time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at" db:"updated_at"`
}

// CronTriggerConfig represents configuration for a cron trigger
type CronTriggerConfig struct {
	Schedule string `json:"schedule"`
	Timezone string `json:"timezone"`
}

// PriceTriggerConfig represents configuration for a price trigger
type PriceTriggerConfig struct {
	AssetPair string  `json:"asset_pair"`
	Condition string  `json:"condition"` // "above", "below", "between"
	Threshold float64 `json:"threshold"`
	Duration  int     `json:"duration"` // seconds the condition must be met
}

// BlockchainTriggerConfig represents configuration for a blockchain event trigger
type BlockchainTriggerConfig struct {
	ContractHash string `json:"contract_hash"`
	EventName    string `json:"event_name"`
}

// TriggerEvent represents a trigger execution event
type TriggerEvent struct {
	ID         int       `json:"id" db:"id"`
	TriggerID  int       `json:"trigger_id" db:"trigger_id"`
	Timestamp  time.Time `json:"timestamp" db:"timestamp"`
	Status     string    `json:"status" db:"status"`
	ExecutionID int      `json:"execution_id,omitempty" db:"execution_id"`
}

// TriggerRepository defines methods for working with triggers
type TriggerRepository interface {
	Create(trigger *Trigger) error
	GetByID(id int) (*Trigger, error)
	GetByUserIDAndName(userID int, name string) (*Trigger, error)
	List(userID int, offset, limit int) ([]*Trigger, error)
	ListActiveTriggers() ([]*Trigger, error)
	Update(trigger *Trigger) error
	UpdateStatus(id int, status string) error
	Delete(id int) error
	
	// Event related methods
	CreateEvent(event *TriggerEvent) error
	GetEventByID(id int) (*TriggerEvent, error)
	ListEventsByTriggerID(triggerID int, offset, limit int) ([]*TriggerEvent, error)
}