package models

import (
	"time"

	"golang.org/x/crypto/bcrypt"
)

// User represents a user in the system
type User struct {
	ID           int       `json:"id" db:"id"`
	Username     string    `json:"username" db:"username"`
	Email        string    `json:"email" db:"email"`
	PasswordHash string    `json:"-" db:"password_hash"`
	APIKey       string    `json:"-" db:"api_key"`
	IsActive     bool      `json:"is_active" db:"is_active"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

// NewUser creates a new user
func NewUser(username, email, password string) (*User, error) {
	// Hash password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// Create user
	now := time.Now()
	user := &User{
		Username:     username,
		Email:        email,
		PasswordHash: string(passwordHash),
		IsActive:     true,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	return user, nil
}

// CheckPassword checks if the provided password matches the user's password
func (u *User) CheckPassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password))
	return err == nil
}

// SetPassword sets a new password for the user
func (u *User) SetPassword(password string) error {
	// Hash password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	// Update password hash
	u.PasswordHash = string(passwordHash)
	u.UpdatedAt = time.Now()

	return nil
}

// UserRepository defines methods for working with users
type UserRepository interface {
	Create(user *User) error
	GetByID(id int) (*User, error)
	GetByUsername(username string) (*User, error)
	GetByEmail(email string) (*User, error)
	GetByAPIKey(apiKey string) (*User, error)
	Update(user *User) error
	Delete(id int) error
}