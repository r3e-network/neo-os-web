package models

import (
	"time"
)

// Secret represents a user secret
type Secret struct {
	ID        int       `json:"id" db:"id"`
	UserID    int       `json:"user_id" db:"user_id"`
	Name      string    `json:"name" db:"name"`
	Value     string    `json:"-" db:"value"` // Value is never returned to clients
	Version   int       `json:"version" db:"version"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// SecretMetadata represents public information about a secret
type SecretMetadata struct {
	ID        int       `json:"id"`
	UserID    int       `json:"user_id"`
	Name      string    `json:"name"`
	Version   int       `json:"version"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ToMetadata converts a Secret to SecretMetadata
func (s *Secret) ToMetadata() *SecretMetadata {
	return &SecretMetadata{
		ID:        s.ID,
		UserID:    s.UserID,
		Name:      s.Name,
		Version:   s.Version,
		CreatedAt: s.CreatedAt,
		UpdatedAt: s.UpdatedAt,
	}
}

// SecretRepository defines methods for working with secrets
type SecretRepository interface {
	Create(secret *Secret) error
	GetByID(id int) (*Secret, error)
	GetByUserIDAndName(userID int, name string) (*Secret, error)
	List(userID int) ([]*Secret, error)
	Update(secret *Secret) error
	Delete(id int) error
}