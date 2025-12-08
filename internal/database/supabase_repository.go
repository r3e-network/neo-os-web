package database

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// =============================================================================
// Repository Pattern
// =============================================================================

// Repository provides data access methods.
type Repository struct {
	client *Client
}

// NewRepository creates a new repository.
func NewRepository(client *Client) *Repository {
	return &Repository{client: client}
}

// =============================================================================
// User Operations
// =============================================================================

// GetUser retrieves a user by ID.
func (r *Repository) GetUser(ctx context.Context, id string) (*User, error) {
	data, err := r.client.request(ctx, "GET", "users", nil, "id=eq."+id+"&limit=1")
	if err != nil {
		return nil, err
	}

	var users []User
	if err := json.Unmarshal(data, &users); err != nil {
		return nil, err
	}
	if len(users) == 0 {
		return nil, fmt.Errorf("user not found")
	}
	return &users[0], nil
}

// GetUserByAddress retrieves a user by wallet address.
func (r *Repository) GetUserByAddress(ctx context.Context, address string) (*User, error) {
	data, err := r.client.request(ctx, "GET", "users", nil, "address=eq."+address+"&limit=1")
	if err != nil {
		return nil, err
	}

	var users []User
	if err := json.Unmarshal(data, &users); err != nil {
		return nil, err
	}
	if len(users) == 0 {
		return nil, fmt.Errorf("user not found")
	}
	return &users[0], nil
}

// GetUserByEmail retrieves a user by email.
func (r *Repository) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	data, err := r.client.request(ctx, "GET", "users", nil, "email=eq."+email+"&limit=1")
	if err != nil {
		return nil, err
	}

	var users []User
	if err := json.Unmarshal(data, &users); err != nil {
		return nil, err
	}
	if len(users) == 0 {
		return nil, fmt.Errorf("user not found")
	}
	return &users[0], nil
}

// CreateUser creates a new user.
func (r *Repository) CreateUser(ctx context.Context, user *User) error {
	_, err := r.client.request(ctx, "POST", "users", user, "")
	return err
}

// UpdateUserEmail updates user's email.
func (r *Repository) UpdateUserEmail(ctx context.Context, userID, email string) error {
	update := map[string]interface{}{
		"email":      email,
		"updated_at": time.Now(),
	}
	_, err := r.client.request(ctx, "PATCH", "users", update, "id=eq."+userID)
	return err
}

// UpdateUserNonce updates the user's nonce for signature verification.
func (r *Repository) UpdateUserNonce(ctx context.Context, userID, nonce string) error {
	update := map[string]interface{}{
		"nonce": nonce,
	}
	_, err := r.client.request(ctx, "PATCH", "users", update, "id=eq."+userID)
	return err
}

// =============================================================================
// Service Request Operations
// =============================================================================

// GetServiceRequests retrieves service requests for a user.
func (r *Repository) GetServiceRequests(ctx context.Context, userID string, limit int) ([]ServiceRequest, error) {
	query := fmt.Sprintf("user_id=eq.%s&order=created_at.desc&limit=%d", userID, limit)
	data, err := r.client.request(ctx, "GET", "service_requests", nil, query)
	if err != nil {
		return nil, err
	}

	var requests []ServiceRequest
	if err := json.Unmarshal(data, &requests); err != nil {
		return nil, err
	}
	return requests, nil
}

// CreateServiceRequest creates a new service request.
func (r *Repository) CreateServiceRequest(ctx context.Context, req *ServiceRequest) error {
	_, err := r.client.request(ctx, "POST", "service_requests", req, "")
	return err
}

// UpdateServiceRequest updates a service request.
func (r *Repository) UpdateServiceRequest(ctx context.Context, req *ServiceRequest) error {
	_, err := r.client.request(ctx, "PATCH", "service_requests", req, "id=eq."+req.ID)
	return err
}

// =============================================================================
// Price Feed Operations
// =============================================================================

// GetLatestPrice retrieves the latest price for a feed.
func (r *Repository) GetLatestPrice(ctx context.Context, feedID string) (*PriceFeed, error) {
	query := fmt.Sprintf("feed_id=eq.%s&order=timestamp.desc&limit=1", feedID)
	data, err := r.client.request(ctx, "GET", "price_feeds", nil, query)
	if err != nil {
		return nil, err
	}

	var feeds []PriceFeed
	if err := json.Unmarshal(data, &feeds); err != nil {
		return nil, err
	}
	if len(feeds) == 0 {
		return nil, fmt.Errorf("price feed not found")
	}
	return &feeds[0], nil
}

// CreatePriceFeed creates a new price feed entry.
func (r *Repository) CreatePriceFeed(ctx context.Context, feed *PriceFeed) error {
	_, err := r.client.request(ctx, "POST", "price_feeds", feed, "")
	return err
}
