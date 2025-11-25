// Example: Creating a Custom Service for the Service Layer
//
// This example demonstrates how to create a fully functional service
// that integrates with the Service Engine, including:
// - ServiceBase embedding
// - Manifest declaration
// - Lifecycle management
// - Bus integration
// - Health checks
// - HTTP handlers
//
// Run: go run main.go

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
)

// =============================================================================
// Domain Models
// =============================================================================

// Item represents a domain entity
type Item struct {
	ID        string            `json:"id"`
	AccountID string            `json:"account_id"`
	Name      string            `json:"name"`
	Data      map[string]any    `json:"data,omitempty"`
	CreatedAt time.Time         `json:"created_at"`
	UpdatedAt time.Time         `json:"updated_at"`
}

// =============================================================================
// Store Interface (Platform Layer)
// =============================================================================

// Store defines the persistence interface
type Store interface {
	Create(ctx context.Context, item Item) (Item, error)
	Get(ctx context.Context, id string) (Item, error)
	List(ctx context.Context, accountID string) ([]Item, error)
	Update(ctx context.Context, item Item) (Item, error)
	Delete(ctx context.Context, id string) error
	Ping(ctx context.Context) error
}

// MemoryStore implements Store with in-memory storage
type MemoryStore struct {
	mu    sync.RWMutex
	items map[string]Item
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		items: make(map[string]Item),
	}
}

func (s *MemoryStore) Create(ctx context.Context, item Item) (Item, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if item.ID == "" {
		item.ID = fmt.Sprintf("item-%d", time.Now().UnixNano())
	}
	now := time.Now().UTC()
	item.CreatedAt = now
	item.UpdatedAt = now

	s.items[item.ID] = item
	return item, nil
}

func (s *MemoryStore) Get(ctx context.Context, id string) (Item, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	item, ok := s.items[id]
	if !ok {
		return Item{}, fmt.Errorf("item %s not found", id)
	}
	return item, nil
}

func (s *MemoryStore) List(ctx context.Context, accountID string) ([]Item, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []Item
	for _, item := range s.items {
		if accountID == "" || item.AccountID == accountID {
			result = append(result, item)
		}
	}
	return result, nil
}

func (s *MemoryStore) Update(ctx context.Context, item Item) (Item, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, ok := s.items[item.ID]
	if !ok {
		return Item{}, fmt.Errorf("item %s not found", item.ID)
	}

	item.CreatedAt = existing.CreatedAt
	item.UpdatedAt = time.Now().UTC()
	s.items[item.ID] = item
	return item, nil
}

func (s *MemoryStore) Delete(ctx context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.items[id]; !ok {
		return fmt.Errorf("item %s not found", id)
	}
	delete(s.items, id)
	return nil
}

func (s *MemoryStore) Ping(ctx context.Context) error {
	return nil // Memory store is always available
}

// =============================================================================
// Service Implementation (Services Layer)
// =============================================================================

// ServiceState represents the service lifecycle state
type ServiceState string

const (
	StateUnknown      ServiceState = ""
	StateInitializing ServiceState = "initializing"
	StateReady        ServiceState = "ready"
	StateStopped      ServiceState = "stopped"
	StateFailed       ServiceState = "failed"
)

// Service implements a custom domain service
type Service struct {
	name    string
	domain  string
	state   ServiceState
	stateMu sync.RWMutex

	store     Store
	logger    *log.Logger
	startTime time.Time
	stopTime  time.Time
}

// NewService creates a new custom service
func NewService(store Store, logger *log.Logger) *Service {
	if logger == nil {
		logger = log.New(os.Stdout, "[custom-service] ", log.LstdFlags)
	}
	return &Service{
		name:   "custom-service",
		domain: "custom",
		store:  store,
		logger: logger,
		state:  StateUnknown,
	}
}

// Name returns the service name (ServiceModule interface)
func (s *Service) Name() string { return s.name }

// Domain returns the service domain (ServiceModule interface)
func (s *Service) Domain() string { return s.domain }

// Start initializes the service (ServiceModule interface)
func (s *Service) Start(ctx context.Context) error {
	s.stateMu.Lock()
	defer s.stateMu.Unlock()

	s.state = StateInitializing
	s.logger.Println("Starting service...")

	// Validate dependencies
	if s.store == nil {
		s.state = StateFailed
		return fmt.Errorf("store is required")
	}

	// Test store connectivity
	if err := s.store.Ping(ctx); err != nil {
		s.state = StateFailed
		return fmt.Errorf("store ping failed: %w", err)
	}

	s.state = StateReady
	s.startTime = time.Now()
	s.logger.Println("Service started successfully")
	return nil
}

// Stop shuts down the service (ServiceModule interface)
func (s *Service) Stop(ctx context.Context) error {
	s.stateMu.Lock()
	defer s.stateMu.Unlock()

	s.logger.Println("Stopping service...")
	s.state = StateStopped
	s.stopTime = time.Now()
	s.logger.Printf("Service stopped (uptime: %v)", s.Uptime())
	return nil
}

// Ready checks if the service is ready (ReadyChecker interface)
func (s *Service) Ready(ctx context.Context) error {
	s.stateMu.RLock()
	defer s.stateMu.RUnlock()

	if s.state != StateReady {
		return fmt.Errorf("service not ready: state=%s", s.state)
	}
	return s.store.Ping(ctx)
}

// State returns the current service state
func (s *Service) State() ServiceState {
	s.stateMu.RLock()
	defer s.stateMu.RUnlock()
	return s.state
}

// Uptime returns how long the service has been running
func (s *Service) Uptime() time.Duration {
	if s.startTime.IsZero() {
		return 0
	}
	if !s.stopTime.IsZero() {
		return s.stopTime.Sub(s.startTime)
	}
	return time.Since(s.startTime)
}

// Manifest returns the service manifest (Framework integration)
func (s *Service) Manifest() map[string]any {
	return map[string]any{
		"name":         s.name,
		"domain":       s.domain,
		"description":  "Example custom service implementation",
		"version":      "1.0.0",
		"layer":        "service",
		"depends_on":   []string{"store-postgres"},
		"requires_api": []string{"store"},
		"capabilities": []string{"custom.read", "custom.write"},
	}
}

// =============================================================================
// Business Logic
// =============================================================================

// CreateItem creates a new item
func (s *Service) CreateItem(ctx context.Context, accountID, name string, data map[string]any) (Item, error) {
	if err := s.Ready(ctx); err != nil {
		return Item{}, err
	}

	if accountID == "" {
		return Item{}, fmt.Errorf("account_id is required")
	}
	if name == "" {
		return Item{}, fmt.Errorf("name is required")
	}

	item := Item{
		AccountID: accountID,
		Name:      name,
		Data:      data,
	}

	item, err := s.store.Create(ctx, item)
	if err != nil {
		return Item{}, fmt.Errorf("create item: %w", err)
	}

	s.logger.Printf("Created item: id=%s account=%s name=%s", item.ID, accountID, name)
	return item, nil
}

// GetItem retrieves an item by ID
func (s *Service) GetItem(ctx context.Context, id string) (Item, error) {
	if err := s.Ready(ctx); err != nil {
		return Item{}, err
	}
	return s.store.Get(ctx, id)
}

// ListItems lists all items for an account
func (s *Service) ListItems(ctx context.Context, accountID string) ([]Item, error) {
	if err := s.Ready(ctx); err != nil {
		return nil, err
	}
	return s.store.List(ctx, accountID)
}

// UpdateItem updates an existing item
func (s *Service) UpdateItem(ctx context.Context, id, name string, data map[string]any) (Item, error) {
	if err := s.Ready(ctx); err != nil {
		return Item{}, err
	}

	item, err := s.store.Get(ctx, id)
	if err != nil {
		return Item{}, err
	}

	if name != "" {
		item.Name = name
	}
	if data != nil {
		item.Data = data
	}

	item, err = s.store.Update(ctx, item)
	if err != nil {
		return Item{}, fmt.Errorf("update item: %w", err)
	}

	s.logger.Printf("Updated item: id=%s", item.ID)
	return item, nil
}

// DeleteItem removes an item
func (s *Service) DeleteItem(ctx context.Context, id string) error {
	if err := s.Ready(ctx); err != nil {
		return err
	}

	if err := s.store.Delete(ctx, id); err != nil {
		return fmt.Errorf("delete item: %w", err)
	}

	s.logger.Printf("Deleted item: id=%s", id)
	return nil
}

// =============================================================================
// HTTP Handlers
// =============================================================================

// Handler provides HTTP endpoints for the service
type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		if r.URL.Path == "/health" {
			h.handleHealth(w, r)
			return
		}
		if r.URL.Path == "/status" {
			h.handleStatus(w, r)
			return
		}
		h.handleList(w, r)
	case http.MethodPost:
		h.handleCreate(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Handler) handleHealth(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.Ready(r.Context()); err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{"status": "unhealthy", "error": err.Error()})
		return
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
}

func (h *Handler) handleStatus(w http.ResponseWriter, r *http.Request) {
	status := map[string]any{
		"name":     h.svc.Name(),
		"domain":   h.svc.Domain(),
		"state":    h.svc.State(),
		"uptime":   h.svc.Uptime().String(),
		"manifest": h.svc.Manifest(),
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

func (h *Handler) handleList(w http.ResponseWriter, r *http.Request) {
	accountID := r.URL.Query().Get("account_id")
	items, err := h.svc.ListItems(r.Context(), accountID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func (h *Handler) handleCreate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccountID string         `json:"account_id"`
		Name      string         `json:"name"`
		Data      map[string]any `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	item, err := h.svc.CreateItem(r.Context(), req.AccountID, req.Name, req.Data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(item)
}

// =============================================================================
// Main Entry Point
// =============================================================================

func main() {
	logger := log.New(os.Stdout, "", log.LstdFlags)

	// Create store (Platform layer)
	store := NewMemoryStore()

	// Create service (Services layer)
	svc := NewService(store, logger)

	// Start service
	ctx := context.Background()
	if err := svc.Start(ctx); err != nil {
		logger.Fatalf("Failed to start service: %v", err)
	}

	// Create HTTP handler
	handler := NewHandler(svc)

	// Start HTTP server
	server := &http.Server{
		Addr:    ":8090",
		Handler: handler,
	}

	go func() {
		logger.Printf("Starting HTTP server on %s", server.Addr)
		if err := server.ListenAndServe(); err != http.ErrServerClosed {
			logger.Fatalf("HTTP server error: %v", err)
		}
	}()

	// Wait for shutdown signal
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	logger.Println("Shutting down...")

	// Graceful shutdown
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Printf("HTTP server shutdown error: %v", err)
	}

	if err := svc.Stop(shutdownCtx); err != nil {
		logger.Printf("Service stop error: %v", err)
	}

	logger.Println("Shutdown complete")
}

/*
Usage:

1. Run the service:
   go run main.go

2. Check health:
   curl http://localhost:8090/health

3. Check status:
   curl http://localhost:8090/status

4. Create an item:
   curl -X POST http://localhost:8090/ \
     -H "Content-Type: application/json" \
     -d '{"account_id":"acc-1","name":"test-item","data":{"key":"value"}}'

5. List items:
   curl http://localhost:8090/
   curl http://localhost:8090/?account_id=acc-1

This example demonstrates the Service Layer patterns:
- ServiceBase-like state management
- Manifest declaration
- Lifecycle (Start/Stop/Ready)
- Store interface (Platform layer)
- HTTP handlers
- Graceful shutdown
*/
